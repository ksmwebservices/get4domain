import * as fs from 'fs';
import * as path from 'path';
import { HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { OtpPepper } from '../src/directory/pepper';
import { renderInvoiceHtml } from '../src/invoices/templates/invoice.template';
import { BillingSettingsService } from '../src/plan-billing/settings/billing-settings.service';
import { renderProposalHtml } from '../src/quotes/templates/proposal.template';
import { TermsService } from '../src/terms/terms.service';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { AdminFirmController, PublicFirmController } from '../src/v3-firm/api/firm.controllers';
import { applyFirmTokens, checkFirmEdit, FIRM_DEFAULTS, FirmProfile, gstinProblem, invoiceSeller, publicFirm } from '../src/v3-firm/core/firm-core';
import { FirmService } from '../src/v3-firm/firm.service';
import { FirmStore } from '../src/v3-firm/firm.store';
import { renderInvoiceHtml as planInvoiceHtml } from '../src/v3-vendor-gaps/core/gaps-core';
import { termsWorld } from './support/terms-world';

/** Wave 2 Part H3: the firm identity as data. One profile, edited by SUPER_ADMIN only and audited; invoices, the proposal, the legal text and the public footer read it instead of typed text. */
jest.setTimeout(120_000);
const GSTIN = '33ABCDE1234F1Z5'; const PAN = 'ABCDE1234F';

class MemoryFirmStore extends FirmStore {
  row: FirmProfile | null; writes = 0;
  constructor(row: FirmProfile | null = { ...FIRM_DEFAULTS }) { super(); this.row = row; }
  async get(): Promise<FirmProfile | null> { return this.row ? { ...this.row } : null; }
  async update(patch: Partial<FirmProfile>): Promise<FirmProfile> { this.writes += 1; this.row = { ...(this.row ?? FIRM_DEFAULTS), ...patch }; return { ...this.row }; }
}
const world = (row?: FirmProfile | null) => {
  const store = new MemoryFirmStore(row); const activity: Array<Record<string, unknown>> = [];
  const firm = new FirmService(store, { record: async (i: Record<string, unknown>) => { activity.push(i); return null; } } as never);
  return { store, firm, activity };
};
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; fields?: Record<string, string> }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as { code?: string; details?: { fields?: Record<string, string> } }; return { status: e.getStatus(), code: b.code, fields: b.details?.fields }; } throw e; }
  return { status: 0 };
};
const staff = { id: 'staff-super', ip: '10.0.0.1' };
const vendor = { businessName: 'Acme Traders', name: 'Acme', email: 'a@x.example', phone: '9999999999', address: null, gstin: null };
const invoice = { invoiceNumber: 'INV-1', description: 'Plan', amount: 100000, gstAmount: 18000, totalAmount: 118000, status: 'PENDING', createdAt: new Date('2026-11-10'), dueDate: new Date('2026-11-17'), paidAt: null, periodStart: null, periodEnd: null };

describe('the firm profile rules (pure)', () => {
  it('the defaults are the two facts the owner gave; the tax number, PAN, email and phone start empty', () => {
    expect(FIRM_DEFAULTS).toEqual({ legalName: 'KSM QUANTUM TECHNOLOGIES', registeredAddress: 'Tidel Park, D Block, Tharamani, Chennai 600113', gstin: null, pan: null, registeredEmail: null, registeredPhone: null });
  });
  it('a GSTIN is 15 characters in the GST layout with a known state code', () => {
    expect(gstinProblem(GSTIN)).toBeNull(); expect(gstinProblem('27ABCDE1234F1Z5')).toBeNull(); expect(gstinProblem('97ABCDE1234F1Z5')).toBeNull();
    for (const bad of ['', '33ABCDE1234F1Z', '33ABCDE1234F1Z55', '33abcde1234F1Z5', '33ABCDE1234F1X5', '33ABCDE12345F1Z5', 'ABCDE1234F1Z5XX', '33ABCDE1234F0Z5']) expect(gstinProblem(bad)).toMatch(/15 characters/);
    for (const code of ['00', '39', '40', '50', '96', '98']) expect(gstinProblem(`${code}ABCDE1234F1Z5`)).toMatch(/unknown state code/);
  });
  it('an edit cleans the values (upper case, no spaces), leaves unsent fields alone, and clears a nullable field with null or an empty text', () => {
    const r = checkFirmEdit({ gstin: ` ${GSTIN.toLowerCase().slice(0, 7)} ${GSTIN.slice(7).toLowerCase()} `, pan: PAN.toLowerCase(), registeredEmail: ' Accounts@Example.COM ', registeredPhone: '+91 44 1234 5678' }, FIRM_DEFAULTS);
    expect(r).toEqual({ ok: true, patch: { gstin: GSTIN, pan: PAN, registeredEmail: 'accounts@example.com', registeredPhone: '+91 44 1234 5678' } });
    const filled = { ...FIRM_DEFAULTS, gstin: GSTIN, pan: PAN };
    expect(checkFirmEdit({ gstin: null, pan: '' }, filled)).toEqual({ ok: true, patch: { gstin: null, pan: null } }); expect(checkFirmEdit({}, filled)).toEqual({ ok: true, patch: {} });
  });
  it('every problem is named by field; the name and the address can never be empty; the PAN must be the one inside the GSTIN', () => {
    const r = checkFirmEdit({ legalName: '  ', registeredAddress: 'x'.repeat(401), gstin: '33ABCDE1234F1Z', pan: '12345', registeredEmail: 'nope', registeredPhone: 'abc' }, FIRM_DEFAULTS);
    expect(r.ok).toBe(false); if (!r.ok) expect(Object.keys(r.problems).sort()).toEqual(['gstin', 'legalName', 'pan', 'registeredAddress', 'registeredEmail', 'registeredPhone']);
    const mismatch = checkFirmEdit({ gstin: GSTIN, pan: 'ZZZZZ9999Z' }, FIRM_DEFAULTS); expect(mismatch).toEqual({ ok: false, problems: { pan: expect.stringMatching(/inside the GSTIN/) } });
    expect(checkFirmEdit({ pan: 'ZZZZZ9999Z' }, { ...FIRM_DEFAULTS, gstin: GSTIN }).ok).toBe(false);   // checked against what is already stored too
    expect(checkFirmEdit({ legalName: 5 as never }, FIRM_DEFAULTS).ok).toBe(false); expect(checkFirmEdit({ legalName: '<b>x</b>' }, FIRM_DEFAULTS).ok).toBe(false);
  });
  it('the public view is the name, the address, and the GSTIN only when it is set: never the PAN, email or phone', () => {
    expect(publicFirm({ ...FIRM_DEFAULTS, pan: PAN, registeredEmail: 'a@b.co', registeredPhone: '+911234567890' })).toEqual({ legalName: FIRM_DEFAULTS.legalName, registeredAddress: FIRM_DEFAULTS.registeredAddress });
    expect(publicFirm({ ...FIRM_DEFAULTS, gstin: GSTIN, pan: PAN })).toEqual({ legalName: FIRM_DEFAULTS.legalName, registeredAddress: FIRM_DEFAULTS.registeredAddress, gstin: GSTIN });
  });
  it('legal text tokens are filled in, and a line whose value is not set is taken out whole', () => {
    const text = 'Operated by {{firm.name}}\nRegistered office: {{ firm.address }}\nGSTIN: {{firm.gstin}}\nContact: {{firm.email}}\nKept {{firm.unknown}} as it is';
    expect(applyFirmTokens(text, FIRM_DEFAULTS)).toBe(`Operated by KSM QUANTUM TECHNOLOGIES\nRegistered office: Tidel Park, D Block, Tharamani, Chennai 600113\nKept {{firm.unknown}} as it is`);
    expect(applyFirmTokens(text, { ...FIRM_DEFAULTS, gstin: GSTIN, registeredEmail: 'a@b.co' })).toContain(`GSTIN: ${GSTIN}\nContact: a@b.co`);
  });
  it('the migration carries the same defaults and the same checks (one row, the GSTIN and PAN layouts)', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '..', 'prisma/migrations/20261219180000_v3_wave2_firm_profile/migration.sql'), 'utf8');
    expect(sql).toContain(`'${FIRM_DEFAULTS.legalName}'`); expect(sql).toContain(`'${FIRM_DEFAULTS.registeredAddress}'`);
    expect(sql).toContain('ALTER TABLE "g4d_firm_profile" ENABLE ROW LEVEL SECURITY'); expect(sql).toContain(`"id" = 'platform'`); expect(sql).toContain('g4d_firm_profile_gstin_check'); expect(sql).toContain('g4d_firm_profile_pan_check'); expect(sql).not.toMatch(/DROP |DELETE FROM|ALTER TABLE "(?!g4d_firm_profile)/);
    // the SQL pattern accepts what the code accepts: every state code the code knows starts a match
    const re = new RegExp((/"gstin" ~ '([^']+)'/.exec(sql) as RegExpExecArray)[1]);
    expect(re.test(GSTIN)).toBe(true); for (const c of ['00', '39', '50', '98']) expect(re.test(`${c}ABCDE1234F1Z5`)).toBe(false); for (const c of ['01', '28', '38', '97', '99']) expect(re.test(`${c}ABCDE1234F1Z5`)).toBe(true);
  });
  it('the error code is registered with the exception filter', () => { expect(BUSINESS_ERROR_CODES).toContain('FIRM_PROFILE_INVALID'); });
});

describe('the firm service', () => {
  it('answers the defaults when the row is missing, and keeps the answer 15 seconds', async () => {
    const { store, firm } = world(null); let now = 1_000; firm.clock = () => now;
    expect(await firm.get()).toEqual(FIRM_DEFAULTS);
    store.row = { ...FIRM_DEFAULTS, legalName: 'CHANGED BEHIND' }; expect((await firm.get()).legalName).toBe(FIRM_DEFAULTS.legalName);
    now += 16_000; expect((await firm.get()).legalName).toBe('CHANGED BEHIND');
  });
  it('an edit is saved, audited with the fields and their before and after, and seen at once', async () => {
    const { firm, activity } = world(); await firm.get();
    const row = await firm.update({ gstin: GSTIN, registeredEmail: 'accounts@example.com' }, staff);
    expect(row).toMatchObject({ gstin: GSTIN, registeredEmail: 'accounts@example.com', legalName: FIRM_DEFAULTS.legalName }); expect((await firm.get()).gstin).toBe(GSTIN);
    expect(activity).toEqual([expect.objectContaining({ vendorId: null, actionKey: 'firm.profile.changed', entityId: 'platform', actor: { type: 'STAFF', id: 'staff-super', ip: '10.0.0.1' },
      summary: { fields: ['gstin', 'registeredEmail'], before: { gstin: null, registeredEmail: null }, after: { gstin: GSTIN, registeredEmail: 'accounts@example.com' } } })]);
  });
  it('an edit that changes nothing writes nothing and is not audited', async () => {
    const { store, firm, activity } = world(); await firm.update({ legalName: FIRM_DEFAULTS.legalName, gstin: null }, staff);
    expect(store.writes).toBe(0); expect(activity).toEqual([]);
  });
  it('a bad edit is refused with FIRM_PROFILE_INVALID and the fields named; nothing is written or audited', async () => {
    const { store, firm, activity } = world();
    const r = await codeOf(firm.update({ gstin: '40ABCDE1234F1Z5', registeredPhone: 'x' }, staff));
    expect(r).toMatchObject({ status: 400, code: 'FIRM_PROFILE_INVALID' }); expect(Object.keys(r.fields!).sort()).toEqual(['gstin', 'registeredPhone']);
    expect(store.writes).toBe(0); expect(activity).toEqual([]); expect((await firm.get()).gstin).toBeNull();
  });
  it('clearing the GSTIN puts the profile back to "no GSTIN"', async () => {
    const { firm } = world({ ...FIRM_DEFAULTS, gstin: GSTIN, pan: PAN }); await firm.update({ gstin: null, pan: null }, staff);
    expect(await firm.publicView()).toEqual({ legalName: FIRM_DEFAULTS.legalName, registeredAddress: FIRM_DEFAULTS.registeredAddress });
  });
});

describe('what the documents print', () => {
  const seller = invoiceSeller(FIRM_DEFAULTS);
  it('an invoice with no GSTIN shows no GSTIN line, no "pending" and no typed email; the name and address come from the profile', () => {
    process.env.COMPANY_NAME = 'FROM THE ENVIRONMENT'; process.env.COMPANY_GST = '99ENVGSTIN';   // the old fallbacks are not read any more
    try {
      const html = renderInvoiceHtml(invoice as never, vendor as never, { company: { name: seller.name, address: seller.address, gstin: undefined, pan: undefined, phone: undefined, email: undefined } });
      expect(html).toContain('KSM QUANTUM TECHNOLOGIES'); expect(html).toContain('Tidel Park, D Block, Tharamani, Chennai 600113');
      expect(html).not.toMatch(/GSTIN|PAN:|pending|admin@get4domain\.com|FROM THE ENVIRONMENT|99ENVGSTIN|undefined|null/);
      const bare = renderInvoiceHtml(invoice as never, vendor as never, {});   // even with no company passed at all
      expect(bare).toContain('KSM QUANTUM TECHNOLOGIES'); expect(bare).not.toMatch(/GSTIN|PAN:|pending|admin@get4domain\.com|FROM THE ENVIRONMENT|undefined|null/);
    } finally { delete process.env.COMPANY_NAME; delete process.env.COMPANY_GST; }
  });
  it('with a GSTIN (and PAN, phone, email) set the invoice prints each of them', () => {
    const s = invoiceSeller({ ...FIRM_DEFAULTS, gstin: GSTIN, pan: PAN, registeredEmail: 'accounts@example.com', registeredPhone: '+91 44 1234 5678' });
    const html = renderInvoiceHtml(invoice as never, vendor as never, { company: { name: s.name, address: s.address, gstin: s.gstin, pan: s.pan, phone: s.phone, email: s.email } });
    expect(html).toContain(`GSTIN: ${GSTIN} · PAN: ${PAN}`); expect(html).toContain('+91 44 1234 5678 · accounts@example.com');
  });
  it('the proposal reads the profile too, and prints no empty contact line', () => {
    const html = renderProposalHtml({ id: 'q', prospectName: 'P', prospectEmail: 'p@x.example', itemLabel: 'Site', amount: 1000, status: 'sent', createdAt: new Date('2026-11-10'), validUntil: null, notes: null } as never, [{ label: 'Site', qty: 1, rate: 1000 }], { company: { name: seller.name, address: seller.address } });
    expect(html).toContain('KSM QUANTUM TECHNOLOGIES'); expect(html).toContain('Tidel Park, D Block, Tharamani, Chennai 600113'); expect(html).not.toMatch(/admin@get4domain\.com|undefined|null| · <\/div>|&middot; &middot;/);
  });
  it('the plan invoice page and the wallet invoice take their seller from the profile through the billing settings; no GSTIN means no GSTIN line', async () => {
    const { firm } = world(); const prisma = { v3PlanSetting: { findMany: async () => [{ key: 'invoiceSellerName', valueJson: 'Old typed name' }, { key: 'invoiceSellerGstin', valueJson: '29ABCDE1234F1Z5' }] } };
    const settings = new BillingSettingsService(prisma as never, firm);
    const b = await settings.get(); expect([b.invoiceSellerName, b.invoiceSellerAddress, b.invoiceSellerGstin]).toEqual(['KSM QUANTUM TECHNOLOGIES', 'Tidel Park, D Block, Tharamani, Chennai 600113', '']);
    const page = planInvoiceHtml({ invoiceNumber: 'X', financialYear: '2026-27', issuedAt: new Date('2026-11-10'), snapshot: { seller: { name: b.invoiceSellerName, address: b.invoiceSellerAddress, gstin: b.invoiceSellerGstin } }, taxBreakdown: {} });
    expect(page).toContain('KSM QUANTUM TECHNOLOGIES'); expect(page).not.toContain('GSTIN');
    await firm.update({ gstin: GSTIN }, staff); expect((await settings.get()).invoiceSellerGstin).toBe(GSTIN);
    expect((await new BillingSettingsService(prisma as never).get()).invoiceSellerName).toBe('Old typed name');   // without the profile (a test, an old build) the stored values stay as they were
  });
  it('the public legal text carries the firm details from the profile, and a line for an unset GSTIN is simply not there', async () => {
    const w = await termsWorld(); const pepper = new OtpPepper(); pepper.env = { OTP_HASH_PEPPER: 'unit-test-pepper' };
    await w.publish('PRIVACY', '# Privacy\n\nThis notice is given by {{firm.name}}, registered at {{firm.address}}.\nGSTIN: {{firm.gstin}}\n\nQuestions about privacy are answered in writing within a reasonable time.');
    const { firm } = world(); const svc = new TermsService(w.store, pepper, firm);
    const t1 = await svc.latest('PRIVACY'); expect(t1.bodyMarkdown).toContain('given by KSM QUANTUM TECHNOLOGIES, registered at Tidel Park'); expect(t1.bodyMarkdown).not.toMatch(/GSTIN|\{\{/);
    await firm.update({ gstin: GSTIN }, staff); expect((await svc.latest('PRIVACY')).bodyMarkdown).toContain(`GSTIN: ${GSTIN}`);
    expect((await w.svc.latest('PRIVACY')).bodyMarkdown).toContain('{{firm.name}}');   // a service built without the profile serves the text as stored
  });
  it('no source file types the firm name, the address or a tax number any more (only the profile defaults and the migration do)', () => {
    const roots = ['src/invoices', 'src/quotes', 'src/payments', 'src/plan-billing', 'src/v3-wallet', 'src/terms', 'src/v3-vendor-gaps']; const hits: string[] = [];
    const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.ts$/.test(e.name) && /KSM Quantum|Tidel|GSTIN pending|PAN pending|COMPANY_(NAME|GST|PAN|ADDRESS|EMAIL|PHONE)/i.test(fs.readFileSync(p, 'utf8').replace(/ADMIN_WHATSAPP_NUMBER \?\? process\.env\.COMPANY_PHONE/g, ''))) hits.push(p); } };   // the admin WhatsApp number is a notification setting, not firm text
    for (const r of roots) walk(path.resolve(__dirname, '..', r)); expect(hits).toEqual([]);
  });
});

describe('over HTTP', () => {
  let app: INestApplication; const as = (r: string) => ({ 'x-test-role': r }); let w: ReturnType<typeof world>;
  beforeEach(async () => {
    w = world();
    const mod = await Test.createTestingModule({ imports: [throttlerImport], controllers: [PublicFirmController, AdminFirmController], providers: [throttlerGuardProvider, AdminGuard, { provide: FirmService, useValue: w.firm }] }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { const r = req.headers['x-test-role']; if (r) req.user = { sub: `staff-${r}`, email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: r }; next(); });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });
  it('the public read needs no sign-in, shows the name and address, adds the GSTIN only when set, never the PAN, email or phone, and is cacheable', async () => {
    const a = await request(app.getHttpServer()).get('/v3/public/firm'); expect(a.status).toBe(200); expect(a.headers['cache-control']).toContain('max-age=300');
    expect(a.body.data).toEqual({ legalName: FIRM_DEFAULTS.legalName, registeredAddress: FIRM_DEFAULTS.registeredAddress });
    await w.firm.update({ gstin: GSTIN, pan: PAN, registeredEmail: 'accounts@example.com', registeredPhone: '+911234567890' }, staff);
    const b = await request(app.getHttpServer()).get('/v3/public/firm'); expect(b.body.data).toEqual({ legalName: FIRM_DEFAULTS.legalName, registeredAddress: FIRM_DEFAULTS.registeredAddress, gstin: GSTIN });
    expect(JSON.stringify(b.body)).not.toMatch(/accounts@example|1234567890|"pan"|registeredEmail|registeredPhone/);
  });
  it('only SUPER_ADMIN reads or edits the profile; every other staff role (ADMIN included) is refused', async () => {
    const sup = await request(app.getHttpServer()).put('/v3/admin/firm-profile').set(as('SUPER_ADMIN')).send({ gstin: GSTIN, pan: PAN });
    expect(sup.status).toBe(200); expect(sup.body.data).toMatchObject({ gstin: GSTIN, pan: PAN });
    expect((await request(app.getHttpServer()).get('/v3/admin/firm-profile').set(as('SUPER_ADMIN'))).body.data).toMatchObject({ gstin: GSTIN, registeredEmail: null });
    for (const role of ['ADMIN', 'OPERATIONS', 'MARKETING', 'SUPPORT']) {
      expect((await request(app.getHttpServer()).put('/v3/admin/firm-profile').set(as(role)).send({ legalName: 'X' })).status).toBe(403);
      expect((await request(app.getHttpServer()).get('/v3/admin/firm-profile').set(as(role))).status).toBe(403);
    }
    expect([401, 403]).toContain((await request(app.getHttpServer()).get('/v3/admin/firm-profile')).status);   // nobody signed in is refused too
    expect((await w.firm.get()).legalName).toBe(FIRM_DEFAULTS.legalName);
    for (const k of ['GET /v3/admin/firm-profile', 'PUT /v3/admin/firm-profile']) expect(effectiveRolesFor(k)).toEqual(['SUPER_ADMIN']);
  });
  it('a bad GSTIN over HTTP is a 400 with FIRM_PROFILE_INVALID and the field named; the GSTIN can be cleared with null', async () => {
    const bad = await request(app.getHttpServer()).put('/v3/admin/firm-profile').set(as('SUPER_ADMIN')).send({ gstin: '40ABCDE1234F1Z5' });
    expect(bad.status).toBe(400); expect(JSON.stringify(bad.body)).toContain('FIRM_PROFILE_INVALID'); expect(bad.body.data.fields.gstin).toMatch(/state code/);
    await request(app.getHttpServer()).put('/v3/admin/firm-profile').set(as('SUPER_ADMIN')).send({ gstin: GSTIN });
    const clear = await request(app.getHttpServer()).put('/v3/admin/firm-profile').set(as('SUPER_ADMIN')).send({ gstin: null }); expect(clear.status).toBe(200); expect(clear.body.data.gstin).toBeNull();
    expect((await request(app.getHttpServer()).put('/v3/admin/firm-profile').set(as('SUPER_ADMIN')).send({ gstin: 5 })).status).toBe(400);
    expect((await request(app.getHttpServer()).put('/v3/admin/firm-profile').set(as('SUPER_ADMIN')).send({ stateOfMind: 'x' })).status).toBe(400);   // unknown fields are refused by the validation pipe
  });
});
