import { HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import request from 'supertest';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { ADMIN_ROLE_MATRIX, effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { InviteAdminDto } from '../src/admin-team/dto/invite-admin.dto';
import { UpdateAdminDto } from '../src/admin-team/dto/update-admin.dto';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { AdminGapsController } from '../src/v3-admin-gaps/api/admin-gaps.controllers';
import { AdminGapsService } from '../src/v3-admin-gaps/admin-gaps.service';
import { AdminGapsStore, AdminVendorRow, NoteRow } from '../src/v3-admin-gaps/admin-gaps.store';
import { checkNote, checkOffline, checkVendorFilter, invoiceStatusOf, listingStateWhere, permissionMatrix, STAFF_ROLE_ORDER, VendorFilter } from '../src/v3-admin-gaps/core/admin-gaps-core';
import { staffDisplayName } from '../src/v3-admin-gaps/staff-name';
import { billingWorld, paid, STAFF as BILLING_STAFF } from './support/billing-world';
import { ops, seededWorld, row } from './support/seeded-world';

/** Wave 2 Part C: the admin gap routes. The matrix, the vendors list, the held count, the notes, the offline settle details, the invoice list and the go-live on behalf, plus the roles. */
jest.setTimeout(120_000);

const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; details?: Record<string, unknown> }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as { code?: string; details?: Record<string, unknown> }; return { status: e.getStatus(), code: b.code, details: b.details }; } throw e; }
  throw new Error('expected a refusal');
};

describe('C1: the permission matrix', () => {
  const m = permissionMatrix();
  it('is read from the live matrix: every listed route has its effective roles, in a fixed order, and unlisted routes fall back to SUPER_ADMIN', () => {
    expect(m.roles).toEqual(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'SUPPORT', 'MARKETING']); expect(m.fallback).toEqual(['SUPER_ADMIN']);
    for (const k of Object.keys(ADMIN_ROLE_MATRIX)) expect(m.routes[k]).toEqual([...effectiveRolesFor(k)].sort((a, b) => STAFF_ROLE_ORDER.indexOf(a) - STAFF_ROLE_ORDER.indexOf(b)));
  });
  it('shows ADMIN inheriting OPERATIONS and SUPPORT only on its own list, as AdminGuard enforces them', () => {
    expect(m.routes['GET /v3/admin/vendors']).toEqual(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']);
    expect(m.routes['GET /v3/admin/permission-matrix']).toEqual(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'SUPPORT', 'MARKETING']);
    expect(m.routes['GET /v3/admin/tickets']).toContain('SUPPORT'); expect(m.routes['GET /v3/admin/billing/orders']).not.toContain('SUPPORT');
  });
});

describe('C3: the vendors list filters', () => {
  it('cleans a good query and clamps the paging', () => {
    const r = checkVendorFilter({ q: '  Acme ', plan: 'PRO', status: 'active', industry: 'retail', listingState: 'live', page: '2', pageSize: '500' });
    expect(r).toMatchObject({ ok: true, value: { q: 'Acme', planLevel: 'PRO', planKey: null, status: 'ACTIVE', industry: 'retail', listingState: 'LIVE', page: 2, pageSize: 100, skip: 100, take: 100 } });
    expect(checkVendorFilter({ plan: 'professional_pro' })).toMatchObject({ ok: true, value: { planLevel: null, planKey: 'professional_pro' } });
  });
  it('refuses a status, a listing state or a plan that is not on the list, naming each', () => {
    const r = checkVendorFilter({ status: 'GONE', listingState: 'HIDDEN', plan: 'a b' });
    expect(r.ok).toBe(false); if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['listingState', 'plan', 'status']);
  });
  it('maps each listing state to the stored lifecycle and the published fact', () => {
    expect(listingStateWhere('UNCLAIMED_LISTING')).toEqual({ lifecycle: ['SEEDED', 'INVITED'], published: true });
    expect(listingStateWhere('DRAFT_SITE')).toEqual({ lifecycle: ['SEEDED', 'INVITED'], published: false });
    expect(listingStateWhere('CLAIMED')).toEqual({ lifecycle: ['CLAIMED_FREE'], published: false }); expect(listingStateWhere('LIVE').lifecycle).toEqual(['PRO']); expect(listingStateWhere('REMOVED').published).toBeNull();
  });
});

describe('C5, C4, C3 over HTTP with the real AdminGuard', () => {
  class MemoryAdminStore extends AdminGapsStore {
    vendors: AdminVendorRow[] = [{ id: 'v1', name: 'Asha', businessName: 'Asha Plumbing', email: 'a@x.invalid', phone: '+919800000001', industry: 'plumber', status: 'ACTIVE', subdomain: 'asha', createdAt: new Date('2026-11-01T00:00:00Z'), plan: { key: 'handyman_pro', name: 'Pro', level: 'PRO', track: 'HANDYMAN', status: 'ACTIVE' }, listingState: 'LIVE' }];
    held = new Map([['v1', 3]]); notes: NoteRow[] = []; lastFilter: VendorFilter | null = null;
    async listVendors(f: VendorFilter) { this.lastFilter = f; return { items: this.vendors, total: this.vendors.length }; }
    async vendorExists(id: string) { return this.vendors.some((v) => v.id === id); }
    async heldCount(id: string) { return this.held.get(id) ?? 0; }
    async listNotes(id: string, skip: number, take: number) { const all = this.notes.filter((n) => n.vendorId === id); return { items: all.slice(skip, skip + take), total: all.length }; }
    async addNote(vendorId: string, body: string, by: { id: string | null; name: string }): Promise<NoteRow> { const n = { id: `n${this.notes.length + 1}`, vendorId, body, byStaffId: by.id, byName: by.name, createdAt: new Date('2026-11-15T00:00:00Z') }; this.notes.unshift(n); return n; }
    async staffName(id: string) { return id === 'staff-1' ? 'Priya Nair' : null; }
  }
  let app: INestApplication; let store: MemoryAdminStore; let activity: Array<{ actionKey: string; vendorId: string | null; summary: unknown }>;
  const as = (role: string) => ({ 'x-test-role': role });
  const get = (url: string, role: string) => request(app.getHttpServer()).get(url).set(as(role));
  const post = (url: string, role: string, body: object) => request(app.getHttpServer()).post(url).set(as(role)).send(body);

  beforeEach(async () => {
    store = new MemoryAdminStore(); activity = [];
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [AdminGapsController],
      providers: [throttlerGuardProvider, AdminGuard, { provide: AdminGapsStore, useValue: store }, { provide: AdminGapsService, useFactory: () => new AdminGapsService(store, { record: async (i: { actionKey: string; vendorId: string | null; summary: unknown }) => { activity.push(i); return null; } } as never) }],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const r = req.headers['x-test-role'];
      if (r) req.user = { sub: r === 'SUPER_ADMIN' ? 'staff-1' : 'staff-2', email: `${r.toLowerCase()}@x.invalid`, role: 'ADMIN', kind: 'admin_member', adminRole: r };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it('the registered error codes include the new ones', () => { for (const c of ['ADMIN_GAP_INVALID', 'ADMIN_VENDOR_NOT_FOUND', 'OFFLINE_AMOUNT_MISMATCH', 'GO_LIVE_BLOCKED']) expect(BUSINESS_ERROR_CODES).toContain(c); });

  it('every staff role reads the permission matrix', async () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'SUPPORT', 'MARKETING']) { const r = await get('/v3/admin/permission-matrix', role); expect(r.status).toBe(200); expect(r.body.data.routes['GET /v3/admin/vendors']).toBeDefined(); }
    expect((await request(app.getHttpServer()).get('/v3/admin/permission-matrix')).status).toBe(403);   // not a staff member
  });
  it('the vendors list, the held count and the notes are OPERATIONS, ADMIN and SUPER_ADMIN; SALES and SUPPORT are refused', async () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']) { expect((await get('/v3/admin/vendors', role)).status).toBe(200); expect((await get('/v3/admin/vendors/v1/held-count', role)).status).toBe(200); }
    for (const role of ['MARKETING', 'SUPPORT']) for (const url of ['/v3/admin/vendors', '/v3/admin/vendors/v1/held-count', '/v3/admin/vendors/v1/notes']) expect((await get(url, role)).status).toBe(403);
    expect((await post('/v3/admin/vendors/v1/notes', 'MARKETING', { body: 'x' })).status).toBe(403); expect(store.notes).toHaveLength(0);
  });
  it('the vendors list passes the cleaned filters through and returns rows with the plan and the listing state', async () => {
    const r = await get('/v3/admin/vendors?q=asha&plan=PRO&status=ACTIVE&listingState=LIVE&page=1&pageSize=10', 'OPERATIONS');
    expect(r.body.data).toMatchObject({ total: 1, page: 1, pageSize: 10 }); expect(r.body.data.items[0]).toMatchObject({ plan: { key: 'handyman_pro', level: 'PRO' }, listingState: 'LIVE' });
    expect(store.lastFilter).toMatchObject({ q: 'asha', planLevel: 'PRO', status: 'ACTIVE', listingState: 'LIVE' });
    const bad = await get('/v3/admin/vendors?status=GONE', 'OPERATIONS'); expect(bad.status).toBe(400); expect(JSON.stringify(bad.body)).toContain('ADMIN_GAP_INVALID'); expect(bad.body.data.fields.status).toBeDefined();
  });
  it('the held count is a number only, and an unknown business is a plain 404', async () => {
    expect((await get('/v3/admin/vendors/v1/held-count', 'OPERATIONS')).body.data).toEqual({ count: 3 });
    const none = await get('/v3/admin/vendors/nope/held-count', 'OPERATIONS'); expect(none.status).toBe(404); expect(JSON.stringify(none.body)).toContain('ADMIN_VENDOR_NOT_FOUND');
  });
  it('a note is added with the staff name, is audited without its text, and the list is newest first; empty or markup is refused', async () => {
    const a = await post('/v3/admin/vendors/v1/notes', 'SUPER_ADMIN', { body: 'Called, wants the Pro plan.' });
    expect(a.status).toBe(200); expect(a.body.data).toMatchObject({ body: 'Called, wants the Pro plan.', byName: 'Priya Nair', byStaffId: 'staff-1' });
    expect(activity).toEqual([{ actionKey: 'vendor.note_added', vendorId: 'v1', summary: { length: 'Called, wants the Pro plan.'.length }, actor: expect.anything(), entityType: 'vendor_note', entityId: 'n1' }]);
    expect(JSON.stringify(activity)).not.toContain('Called');
    await post('/v3/admin/vendors/v1/notes', 'ADMIN', { body: 'Second note' });
    const list = await get('/v3/admin/vendors/v1/notes', 'OPERATIONS'); expect(list.body.data.items.map((n: { body: string }) => n.body)).toEqual(['Second note', 'Called, wants the Pro plan.']);
    expect((await post('/v3/admin/vendors/v1/notes', 'OPERATIONS', { body: '   ' })).status).toBe(400);
    expect((await post('/v3/admin/vendors/v1/notes', 'OPERATIONS', { body: '<script>x</script>' })).status).toBe(400);
    expect((await post('/v3/admin/vendors/nope/notes', 'OPERATIONS', { body: 'x' })).status).toBe(404);
    expect(store.notes).toHaveLength(2);
  });
  it('the note rules and the staff display name', async () => {
    expect(checkNote('  hello ')).toEqual({ ok: true, value: 'hello' }); expect(checkNote('x'.repeat(2001)).ok).toBe(false);
    expect(await staffDisplayName(undefined, { sub: 's', email: 'e@x.invalid' })).toBe('e@x.invalid');
  });
});

describe('C6: offline settle with a reference, a day and an amount', () => {
  it('the details are checked: a real day, not in the future, a whole number of paise; each bad one is named', () => {
    expect(checkOffline({ reference: ' UTR 123456 ', receivedOn: '2026-11-14', amountPaise: 360_000 }, '2026-11-15')).toEqual({ ok: true, value: { reference: 'UTR 123456', receivedOn: '2026-11-14', amountPaise: 360_000 } });
    expect(checkOffline({}, '2026-11-15')).toEqual({ ok: true, value: { reference: null, receivedOn: null, amountPaise: null } });
    const bad = checkOffline({ reference: '<b>', receivedOn: '2026-12-31', amountPaise: 12.5 }, '2026-11-15');
    expect(bad.ok).toBe(false); if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['amountPaise', 'receivedOn', 'reference']);
    expect(checkOffline({ receivedOn: '2026-02-30' }, '2026-11-15').ok).toBe(false);
  });
  it('markPaid stores the reference, the day, the amount and who recorded it on the order, in the same transaction as the payment', async () => {
    const w = billingWorld(); const o = await w.buy();
    const r = await w.settlement.markPaid(o.id, 'Cash received at the office', BILLING_STAFF, { reference: 'RCPT-77', receivedOn: new Date('2026-11-14T00:00:00Z'), amountPaise: o.amountPaise, byName: 'Priya Nair' });
    expect(r).toMatchObject({ status: 'PAID', outcome: 'PAID' });
    expect(w.repo.orders.get(o.id)).toMatchObject({ settledReference: 'RCPT-77', settledAmountPaise: o.amountPaise, settledByName: 'Priya Nair', source: 'STAFF', reason: 'Cash received at the office' });
    expect(w.repo.orders.get(o.id)!.settledOn!.toISOString().slice(0, 10)).toBe('2026-11-14');
    expect(w.repo.audits.some((a) => a.action === 'billing.order.paid' && a.entityId === o.id)).toBe(true);
  });
  it('a reason alone still works and leaves the details empty', async () => {
    const w = billingWorld(); const o = await w.buy();
    await w.settlement.markPaid(o.id, 'Paid offline', BILLING_STAFF);
    expect(w.repo.orders.get(o.id)).toMatchObject({ status: 'PAID', settledReference: null, settledOn: null, settledAmountPaise: null, settledByName: null });
  });
  it('an amount that is not the amount of the order is refused with OFFLINE_AMOUNT_MISMATCH and nothing is settled', async () => {
    const w = billingWorld(); const o = await w.buy();
    expect(await codeOf(w.settlement.markPaid(o.id, 'Paid offline', BILLING_STAFF, { reference: null, receivedOn: null, amountPaise: o.amountPaise - 100, byName: 'x' }))).toMatchObject({ status: 409, code: 'OFFLINE_AMOUNT_MISMATCH' });
    expect(w.repo.orders.get(o.id)!.status).not.toBe('PAID'); expect(w.repo.invoices).toHaveLength(0);
  });
});

describe('C7: the admin invoice list', () => {
  it('lists every business invoices newest first, with the filters and the paging, and the status words', async () => {
    const w = billingWorld(); const a = await w.buy({}, 'v1'); await paid(w, a, 'v1'); const b = await w.buy({ termMonths: 6 }, 'v2'); await paid(w, b, 'v2');
    const all = await w.repo.listInvoicesForStaff({ skip: 0, take: 25 });
    expect(all.total).toBe(2); expect(all.items.map((i) => i.vendorId).sort()).toEqual(['v1', 'v2']);
    expect((await w.repo.listInvoicesForStaff({ vendorId: 'v2', skip: 0, take: 25 })).items.map((i) => i.vendorId)).toEqual(['v2']);
    expect((await w.repo.listInvoicesForStaff({ skip: 0, take: 1 })).items).toHaveLength(1);
    expect((await w.repo.listInvoicesForStaff({ status: 'PAID', skip: 0, take: 25 })).total).toBe(2); expect((await w.repo.listInvoicesForStaff({ status: 'REFUND_RECORDED', skip: 0, take: 25 })).total).toBe(0);
    await w.settlement.recordRefund(a.id, { amountPaise: 1000, note: 'Goodwill refund' }, BILLING_STAFF);
    const refunded = await w.repo.listInvoicesForStaff({ status: 'REFUND_RECORDED', skip: 0, take: 25 });
    expect(refunded.items.map((i) => i.vendorId)).toEqual(['v1']); expect(invoiceStatusOf(refunded.items[0].refundRecordedPaise)).toBe('REFUND_RECORDED'); expect(invoiceStatusOf(null)).toBe('PAID'); expect(invoiceStatusOf(0)).toBe('PAID');
  });
});

describe('C12: approve and go live on behalf', () => {
  const live = (w: ReturnType<typeof seededWorld>, vendorId: string, on = true) => { const f = w.facts.facts.get(vendorId)!; w.facts.facts.set(vendorId, { ...f, sitePublished: on } as never); };
  async function made() {
    const w = seededWorld(); await w.svc.create(row(), ops);
    const r = [...w.store.rows.values()][0];
    live(w, r.vendorId, false);   // a listing whose site is not published yet
    w.publisher.publish = async (v: string) => { w.publisher.published.push(v); live(w, v, true); return { published: true }; };
    return { w, id: r.id, vendorId: r.vendorId };
  }
  it('publishes an unpublished site once, audited, and answers alreadyLive on a repeat without publishing again', async () => {
    const { w, id, vendorId } = await made(); w.publisher.published.length = 0;
    const first = await w.svc.goLive(id, ops); expect(first).toMatchObject({ alreadyLive: false, listingState: 'UNCLAIMED_LISTING' });
    const again = await w.svc.goLive(id, ops); expect(again).toMatchObject({ alreadyLive: true, listingState: 'UNCLAIMED_LISTING' });
    expect(w.publisher.published).toEqual([vendorId]); expect(w.store.audits.filter((a) => a.action === 'seeded.go_live')).toHaveLength(1);
  });
  it('two clicks at once publish once', async () => {
    const { w, id, vendorId } = await made(); w.publisher.published.length = 0;
    const [a, b] = await Promise.all([w.svc.goLive(id, ops), w.svc.goLive(id, ops)]);
    expect([a.alreadyLive, b.alreadyLive].sort()).toEqual([false, true]); expect(w.publisher.published).toEqual([vendorId]);
  });
  it('is refused for a removed business and for a phone on the do-not-contact register', async () => {
    const { w, id } = await made();
    expect(await codeOf(w.svc.goLive(id, ops).then(() => w.svc.remove(id, 'Owner asked', ops)).then(() => w.svc.goLive(id, ops)))).toMatchObject({ status: 409 });
    const x = await made(); await x.w.store.addToRegister([...x.w.store.rows.values()][0].phoneHash, 'asked', 'STAFF', 'staff-1');
    expect(await codeOf(x.w.svc.goLive(x.id, ops))).toMatchObject({ status: 409, code: 'GO_LIVE_BLOCKED', details: { reason: 'DO_NOT_CONTACT' } });
  });
  it('a claimed business whose owner has not accepted the Terms is refused (staff never accept for an owner); once accepted it goes live', async () => {
    const { w, id, vendorId } = await made();
    w.facts.facts.set(vendorId, { ...w.facts.facts.get(vendorId)!, businessStatus: 'CLAIMED', sitePublished: false } as never);
    w.publisher.published.length = 0; let accepted = false; w.publisher.ownerTermsAccepted = async () => accepted;
    expect(await codeOf(w.svc.goLive(id, ops))).toMatchObject({ status: 409, code: 'GO_LIVE_BLOCKED', details: { reason: 'TERMS_REQUIRED' } });
    expect(w.publisher.published).not.toContain(vendorId);
    accepted = true; expect(await w.svc.goLive(id, ops)).toMatchObject({ alreadyLive: false });
  });
  it('an unknown id is the plain not-found', async () => { const w = seededWorld(); expect((await codeOf(w.svc.goLive('nope', ops))).status).toBe(404); });
});

describe('C13: ADMIN and SUPPORT are valid wherever staff roles are validated', () => {
  it('the staff invite and update bodies accept all five roles and refuse an unknown one', async () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'SUPPORT', 'MARKETING']) {
      expect(await validate(plainToInstance(InviteAdminDto, { name: 'Ravi', email: 'r@x.invalid', role }))).toEqual([]);
      expect(await validate(plainToInstance(UpdateAdminDto, { role }))).toEqual([]);
    }
    expect((await validate(plainToInstance(InviteAdminDto, { name: 'Ravi', email: 'r@x.invalid', role: 'BOSS' }))).length).toBeGreaterThan(0);
    // Wave 3 Part A added the two SALES labels and the partner login role; the five earlier values are unchanged
    expect(Object.values(AdminRole).sort()).toEqual(['ADMIN', 'FIELD_EXECUTIVE', 'MARKETING', 'OPERATIONS', 'REFERRAL_PARTNER', 'SUPER_ADMIN', 'SUPPORT', 'TELECALLER']);
  });
});
