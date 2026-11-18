import { ConflictException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import { DealsService } from '../src/commercial/deals.service';
import { PublishService } from '../src/site-publish/publish/publish.service';
import { StarterService } from '../src/site-doc/starter.service';
import { CreateDirectoryProfileStep } from '../src/provisioning/steps/create-directory-profile.step';
import { CreateVendorStep } from '../src/provisioning/steps/create-vendor.step';
import { StepContext } from '../src/provisioning/runner/job-runner.service';
import { DEFAULT_PROVISIONING_SETTINGS } from '../src/provisioning/settings/provisioning-settings';
import { BusinessVendors, NewBusinessVendor } from '../src/provisioning/vendors/business-vendors';
import { TrialSignupPolicy } from '../src/v3-trial/trial-signup.policy';
import { ProvisioningAdminService } from '../src/provisioning/admin/provisioning-admin.service';
import { DuplicateCheckService } from '../src/v3-duplicates/duplicate-check.service';
import { VendorsService } from '../src/vendors/vendors.service';
import { directoryWorld } from './support/directory-world';
import { MemoryDuplicateStore } from './support/memory-duplicate-store';
import { ops, row, seededWorld, sup } from './support/seeded-world';

/** D1: every creation path, with its own outcomes. The in-memory twin stands in for the database; everything else is the real code. */
let store: MemoryDuplicateStore; let dup: DuplicateCheckService;
const code = async (p: Promise<unknown>): Promise<{ status: number; code?: string; body: Record<string, unknown> } | null> => {
  try { await p; return null; } catch (e) { const x = e as { getStatus?: () => number; getResponse?: () => unknown; code?: string }; const body = (x.getResponse?.() ?? {}) as Record<string, unknown>; return { status: x.getStatus?.() ?? 0, code: (body.code as string | undefined) ?? x.code, body }; }
};
const ADMIN = { id: 'staff-admin', role: 'ADMIN' };
beforeEach(() => {
  store = new MemoryDuplicateStore(); dup = new DuplicateCheckService(store);
  store.vendors.push({ id: 'v-old', email: 'old@example.com', phone: '+91 98765 43210', phoneKey: '9876543210', name: 'Ganesh Kumar', businessName: 'Sri Ganesh Plumbing', industry: 'plumber', address: 'T Nagar 600017', subdomain: 'sriganesh', customDomain: null });
  store.listings.push({ id: 'b-old', slug: 'sri-ganesh-plumbing-chennai', name: 'Sri Ganesh Plumbing', vendorId: 'v-old', status: 'UNCLAIMED', phoneE164: '+919876543210', pincode: '600017', line2: 'T Nagar', city: 'Chennai', category: 'plumber' });
});

// ── P1 /auth/register and P2 POST /vendors: both go through VendorsService.create ─────────────────────────────────────
describe('VendorsService.create (POST /auth/register and POST /vendors)', () => {
  const made: Array<Record<string, unknown>> = [];
  const mk = (existingEmail = false) => {
    made.length = 0;
    const tx = {
      vendor: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { made.push(data); return { id: 'v-new', email: data.email, businessName: data.businessName, industry: data.industry ?? null, ...data }; }) },
      v3DuplicateReview: { create: jest.fn(async ({ data }: { data: Parameters<MemoryDuplicateStore['addReview']>[0] }) => { store.addReview(data); }) },
    };
    const prisma = { vendor: { findUnique: jest.fn(async () => (existingEmail ? { id: 'x' } : null)) }, $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx), vendorCMS: { upsert: jest.fn() } };
    const svc = new VendorsService(prisma as never, { sendWelcomeEmail: async () => undefined } as never, { getRate: async () => 100, grantCredit: async () => undefined } as never, { generateSiteHero: async () => ({ status: 'not_configured' }) } as never, dup);
    return { svc, tx, prisma };
  };
  const dto = (o: Record<string, unknown> = {}) => ({ name: 'Ganesh K', email: 'new@example.com', password: 'StrongPass1', businessName: 'Sri Ganesh Plumbing', industry: 'plumber', phone: '98765 43210', ...o });

  it('keeps the e-mail 409 exactly as it was, before the duplicate check is even asked', async () => {
    const { svc, tx } = mk(true);
    const r = await code(svc.create(dto() as never, { selfService: true }));
    expect(r).toMatchObject({ status: 409, body: { message: 'A vendor with this email already exists' } }); expect(r?.code).toBeUndefined(); expect(tx.vendor.create).not.toHaveBeenCalled();
  });
  it('REGISTER, strong match (phone): 409 DUPLICATE_BUSINESS with the claim route, and nothing is created', async () => {
    const { svc, tx } = mk();
    const r = await code(svc.create(dto() as never, { selfService: true }));
    expect(r).toMatchObject({ status: 409, code: 'DUPLICATE_BUSINESS', body: { claim: { businessSlug: 'sri-ganesh-plumbing-chennai' } } }); expect(tx.vendor.create).not.toHaveBeenCalled();
    expect(JSON.stringify(r?.body)).not.toMatch(/v-old|old@example|Ganesh Kumar|9876543210/);
  });
  it('REGISTER, strong match on GSTIN or custom domain', async () => {
    store.vendors[0].gstin = '33ABCDE1234F1Z5'; store.vendors[0].customDomain = 'ganeshplumbing.in';
    const { svc } = mk();
    expect((await code(svc.create(dto({ phone: '9000000001', gstin: '33ABCDE1234F1Z5' }) as never, { selfService: true })))?.code).toBe('DUPLICATE_BUSINESS');
    expect((await code(svc.create(dto({ phone: '9000000001', customDomain: 'www.ganeshplumbing.in' }) as never, { selfService: true })))?.code).toBe('DUPLICATE_BUSINESS');
  });
  it('REGISTER, medium match: asks "Is this your business?" with public listing facts; answering "different" creates the vendor HELD, in the same transaction as its review row', async () => {
    const { svc, tx } = mk();
    const near = dto({ phone: '9000000001', businessName: 'Sri Ganesh Plumbers', area: 'T Nagar', pincode: '600017' });
    const ask = await code(svc.create(near as never, { selfService: true }));
    expect(ask).toMatchObject({ status: 409, code: 'DUPLICATE_POSSIBLE', body: { candidates: [{ slug: 'sri-ganesh-plumbing-chennai', name: 'Sri Ganesh Plumbing', area: 'T Nagar' }] } }); expect(tx.vendor.create).not.toHaveBeenCalled();
    const v = await svc.create({ ...near, confirmDistinct: true } as never, { selfService: true });
    expect(v.id).toBe('v-new'); expect(store.reviews).toEqual([expect.objectContaining({ vendorId: 'v-new', status: 'PENDING', path: 'REGISTER', matchedBusinessId: 'b-old' })]);
    expect(await dup.isHeld('v-new')).toBe(true);
  });
  it('REGISTER, a clean business is created with its phoneKey and no review', async () => {
    const { svc } = mk();
    await svc.create(dto({ email: 'q@q.com', phone: '+91 91111-11111', businessName: 'Kumar Electricals', industry: 'electrician' }) as never, { selfService: true });
    expect(made[0].phoneKey).toBe('9111111111'); expect(store.reviews).toHaveLength(0);
  });
  it('the extra check inputs (city, area, pincode, gstin, confirmDistinct, override reason) are never written to the vendor row', async () => {
    const { svc } = mk();
    await svc.create(dto({ email: 'q@q.com', phone: '9111111111', businessName: 'Kumar Electricals', city: 'Chennai', area: 'Adyar', pincode: '600020', gstin: '33ABCDE1234F1Z9', confirmDistinct: true }) as never, { selfService: true });
    for (const k of ['city', 'area', 'pincode', 'gstin', 'confirmDistinct', 'duplicateOverrideReason']) expect(made[0]).not.toHaveProperty(k);
  });
  it('POST /vendors (staff): a strong match shows staff what matched; ADMIN with a reason creates it and the override is logged; OPERATIONS is refused; no reason, no override', async () => {
    const { svc } = mk();
    const refused = await code(svc.create(dto() as never, { path: 'ADMIN_VENDOR', actor: { id: 's1', role: 'OPERATIONS' }, selfService: false }));
    expect(refused).toMatchObject({ status: 409, code: 'DUPLICATE_BUSINESS', body: { matches: expect.arrayContaining([expect.objectContaining({ signal: 'PHONE', vendorId: 'v-old' })]) } });
    expect((await code(svc.create(dto({ duplicateOverrideReason: 'Second branch, same owner' }) as never, { path: 'ADMIN_VENDOR', actor: { id: 's1', role: 'OPERATIONS' }, selfService: false })))?.code).toBe('DUPLICATE_OVERRIDE_FORBIDDEN');
    expect((await code(svc.create(dto({ duplicateOverrideReason: 'no' }) as never, { path: 'ADMIN_VENDOR', actor: ADMIN, selfService: false })))?.code).toBe('DUPLICATE_OVERRIDE_REASON_REQUIRED');
    const v = await svc.create(dto({ duplicateOverrideReason: 'Second branch, same owner' }) as never, { path: 'ADMIN_VENDOR', actor: ADMIN, selfService: false });
    expect(v.id).toBe('v-new'); expect(store.overrides).toEqual([expect.objectContaining({ path: 'ADMIN_VENDOR', staffId: 'staff-admin', reason: 'Second branch, same owner', newVendorId: 'v-new' })]);
  });
  it('POST /vendors (staff), medium match: stopped unless overridden (staff cannot answer for the owner)', async () => {
    const { svc } = mk();
    const near = dto({ phone: '9000000001', businessName: 'Sri Ganesh Plumbers', area: 'T Nagar', pincode: '600017' });
    expect((await code(svc.create(near as never, { path: 'ADMIN_VENDOR', actor: ADMIN, selfService: false })))?.code).toBe('DUPLICATE_POSSIBLE');
    expect((await svc.create({ ...near, duplicateOverrideReason: 'A different shop on the same street' } as never, { path: 'ADMIN_VENDOR', actor: ADMIN, selfService: false })).id).toBe('v-new');
    expect(store.reviews).toHaveLength(0);   // an overridden business is not held
  });
});

describe('AuthService.register hands the visitor path to the shared check', () => {
  const mk = (create: jest.Mock) => {
    const prisma = { vendor: { findUnique: jest.fn(async () => null) }, vendorAddon: { upsert: jest.fn() } };
    return new AuthService(prisma as never, { sign: () => 'token', decode: () => null } as never, { create } as never);
  };
  const body = { name: 'Ganesh K', email: 'new@example.com', password: 'StrongPass1', businessName: 'Sri Ganesh Plumbing', industry: 'plumber', phone: '9876543210', city: 'Chennai', area: 'T Nagar', pincode: '600017', confirmDistinct: true };
  it('a registration is a self-service path, and a referral-link registration is the REFERRAL path with the same outcomes', async () => {
    const create = jest.fn(async (..._a: unknown[]) => ({ id: 'v1', name: 'G', email: 'new@example.com', role: 'VENDOR', businessName: 'x', industry: 'plumber', subdomain: 's' }));
    await mk(create).register(body as never);
    await mk(create).register({ ...body, referralCode: 'K7M2P9QX' } as never);
    expect(create.mock.calls[0]).toEqual([expect.objectContaining({ city: 'Chennai', area: 'T Nagar', pincode: '600017', confirmDistinct: true }), { path: 'REGISTER', selfService: true }]);
    expect(create.mock.calls[1][1]).toEqual({ path: 'REFERRAL', selfService: true });
  });
  it('a duplicate refusal reaches the caller as it is: no token, no second site', async () => {
    const create = jest.fn(async (..._a: unknown[]) => { throw new ConflictException({ code: 'DUPLICATE_BUSINESS', message: 'x' }); });
    await expect(mk(create).register(body as never)).rejects.toBeInstanceOf(ConflictException);
  });
  it('a referral partner and a team member who register a business get the same outcomes as anyone: the REFERRAL path and the REGISTER path refuse the same strong match with the same code and claim route', async () => {
    const mkSvc = () => new VendorsService({ vendor: { findUnique: async () => null } } as never, {} as never, {} as never, {} as never, dup);
    const d = { name: 'G', email: 'new@example.com', password: 'StrongPass1', businessName: 'Sri Ganesh Plumbing', industry: 'plumber', phone: '9876543210' };
    const a = await code(mkSvc().create(d as never, { path: 'REGISTER', selfService: true })); const b = await code(mkSvc().create(d as never, { path: 'REFERRAL', selfService: true }));
    expect(a).toEqual(b); expect(a?.body.claim).toEqual({ businessSlug: 'sri-ganesh-plumbing-chennai', startPath: '/v3/claim/start' });
  });
});

// ── P2 provisioning jobs ─────────────────────────────────────────────────────────────────────────────────────────────
class MemVendors extends BusinessVendors {
  rows: Array<NewBusinessVendor & { id: string }> = [];
  async findDuplicate() { return null; }
  async subdomainTaken() { return false; }
  async exists() { return true; }
  async createForJob(_j: string, d: NewBusinessVendor) { const id = `v${this.rows.length + 1}`; this.rows.push({ ...d, id }); return { id }; }
}
const INPUT = { businessName: 'Sri Ganesh Plumbing', track: 'handyman', category: 'plumber', ownerName: 'Ganesh Kumar', phone: '+91 98765 43210', email: 'ganesh@example.com', city: 'Chennai', language: 'en', area: 'T Nagar' };
const stepCtx = (input: Record<string, unknown> = INPUT): StepContext => ({ job: { id: 'j1', vendorId: null, createdByType: 'STAFF', createdById: 'staff-1', input } as never, input, vendorId: null, actor: { type: 'STAFF', id: 'staff-1', ip: null }, settings: { ...DEFAULT_PROVISIONING_SETTINGS }, now: new Date() });

describe('provisioning CREATE_VENDOR (staff jobs, team members, seeded sites)', () => {
  const mk = () => { const v = new MemVendors(); return { v, step: new CreateVendorStep(v, async () => 'hash', dup) }; };
  it('a strong match refuses the job for good (DUPLICATE_BUSINESS), with the existing vendor for staff only', async () => {
    const { v, step } = mk();
    await expect(step.run(stepCtx())).rejects.toMatchObject({ code: 'DUPLICATE_BUSINESS', retryable: false, extra: { existingVendorId: 'v-old', matchedOn: 'phone' } }); expect(v.rows).toHaveLength(0);
  });
  it('the e-mail of a seeded business is a placeholder: it never matches, but its real phone does', async () => {
    const { step } = mk(); store.vendors[0].email = 'site+seed-x@sites.get4domain.invalid';
    await expect(step.run(stepCtx({ ...INPUT, mode: 'SEEDED', placeholderEmail: 'site+seed-x@sites.get4domain.invalid', email: undefined }))).rejects.toMatchObject({ code: 'DUPLICATE_BUSINESS' });
  });
  it('a possible duplicate stops the job (DUPLICATE_POSSIBLE) unless it is overridden', async () => {
    const { step } = mk(); const near = { ...INPUT, phone: '9000000001', email: 'n@example.com', businessName: 'Sri Ganesh Plumbers', pincode: '600017' };
    await expect(step.run(stepCtx(near))).rejects.toMatchObject({ code: 'DUPLICATE_POSSIBLE', retryable: false });
  });
  it('an ADMIN override carried in the job lets it through and is logged; a forged override from a role that may not is refused', async () => {
    const { v, step } = mk();
    const r = await step.run(stepCtx({ ...INPUT, duplicateOverride: { reason: 'Second branch of the same owner', staffId: 'staff-admin', staffRole: 'ADMIN' } }));
    expect(r.vendorId).toBe('v1'); expect(v.rows[0].phoneKey).toBe('9876543210');
    expect(store.overrides).toEqual([expect.objectContaining({ path: 'PROVISIONING', staffId: 'staff-admin', reason: 'Second branch of the same owner', outcome: 'BLOCKED', newVendorId: 'v1' })]);
    await expect(mk().step.run(stepCtx({ ...INPUT, duplicateOverride: { reason: 'Second branch of the same owner', staffId: 's9', staffRole: 'OPERATIONS' } }))).rejects.toMatchObject({ code: 'DUPLICATE_OVERRIDE_INVALID' });
  });
  it('a clean business is created with its phoneKey; an unowned listing of the same business does not stop a staff job', async () => {
    store.vendors = []; store.listings[0].vendorId = null;
    const { v, step } = mk(); await step.run(stepCtx());
    expect(v.rows[0]).toMatchObject({ phoneKey: '9876543210' });
  });
  it('the job-creation API judges an override at once: role and reason', async () => {
    const created: unknown[] = [];
    const svc = new ProvisioningAdminService({ createJob: async (j: unknown) => { created.push(j); return { job: { id: 'j', kind: 'BUSINESS_FREE_SITE', status: 'QUEUED', input: {}, vendorId: null, currentStep: null, attempt: 0, maxAttempts: 3, nextRunAt: new Date(), lastErrorCode: null, lastErrorMessage: null, createdByType: 'STAFF', createdById: 's', createdAt: new Date(), updatedAt: new Date(), finishedAt: null }, created: true }; } } as never, {} as never, { get: async () => ({ provisioningMaxAttempts: 3 }) } as never, { record: async () => undefined } as never, {} as never);
    const dto = { ...INPUT, duplicateOverrideReason: 'Second branch of the same owner' } as never;
    const actor = { type: 'STAFF' as const, id: 'staff-1', ip: null };
    expect((await code(svc.createJob(dto, 'idem-key-12345', actor, 'OPERATIONS')))?.code).toBe('DUPLICATE_OVERRIDE_FORBIDDEN');
    expect((await code(svc.createJob({ ...INPUT, duplicateOverrideReason: 'no' } as never, 'idem-key-12345', actor, 'ADMIN')))?.code).toBe('DUPLICATE_OVERRIDE_REASON_REQUIRED');
    await svc.createJob(dto, 'idem-key-12345', actor, 'SUPER_ADMIN');
    expect((created[0] as { input: { duplicateOverride: unknown } }).input.duplicateOverride).toEqual({ reason: 'Second branch of the same owner', staffId: 'staff-1', staffRole: 'SUPER_ADMIN' });
  });
});

// ── P4 the directory step attaches instead of creating ───────────────────────────────────────────────────────────────
describe('CreateDirectoryProfileStep: attach instead of create', () => {
  const ctx = (vendorId: string, over: Record<string, unknown> = {}) => ({ vendorId, actor: { type: 'STAFF' as const, id: 's1', ip: null }, job: {}, settings: {}, now: new Date(), input: { ...INPUT, ...over } }) as never;
  it('an UNCLAIMED listing nobody owns, of the same business: the vendor takes it over and no second listing is made', async () => {
    const w = await directoryWorld();
    const listing = await w.biz({ name: 'Sri Ganesh Plumbing', status: 'UNCLAIMED', vendorId: null, phoneE164: '+919876543210', address: { line1: '12 Usman Road', line2: 'T Nagar', city: 'Chennai' } });
    store.vendors = []; store.listings = [{ id: listing.id, slug: listing.slug, name: listing.name, vendorId: null, status: 'UNCLAIMED', phoneE164: '+919876543210', pincode: null, line2: 'T Nagar', city: 'Chennai', category: 'plumber' }];
    const before = (await w.repo.listForStaff({ skip: 0, take: 50 })).total;
    const r = await new CreateDirectoryProfileStep(w.repo, w.admin, w.audit, dup).run(ctx('v-new'));
    expect(r.outputRef).toEqual({ businessId: listing.id, attached: 'true' });
    expect((await w.repo.getBusiness(listing.id))!.vendorId).toBe('v-new'); expect((await w.repo.listForStaff({ skip: 0, take: 50 })).total).toBe(before);
    expect(w.audit.rows.map((a: { action: string }) => a.action)).toContain('directory.business.attached');
  });
  it('the same name in the same place and category attaches even when the phone differs', async () => {
    const w = await directoryWorld();
    const listing = await w.biz({ name: 'Sri Ganesh Plumbing', status: 'UNCLAIMED', vendorId: null, phoneE164: '+919000000099', address: { line2: 'T Nagar', city: 'Chennai' } });
    store.vendors = []; store.listings = [{ id: listing.id, slug: listing.slug, name: listing.name, vendorId: null, status: 'UNCLAIMED', phoneE164: '+919000000099', pincode: null, line2: 'T Nagar', city: 'Chennai', category: 'plumber' }];
    const r = await new CreateDirectoryProfileStep(w.repo, w.admin, w.audit, dup).run(ctx('v-new'));
    expect(r.outputRef).toMatchObject({ businessId: listing.id, attached: 'true' });
  });
  it('a listing that already has an owner, or a CLAIMED one, is never taken over: a new listing is made', async () => {
    const w = await directoryWorld();
    const owned = await w.biz({ name: 'Sri Ganesh Plumbing', status: 'UNCLAIMED', vendorId: 'v-other', phoneE164: '+919876543210' });
    store.vendors = []; store.listings = [{ id: owned.id, slug: owned.slug, name: owned.name, vendorId: 'v-other', status: 'UNCLAIMED', phoneE164: '+919876543210', pincode: null, category: 'plumber' }];
    const r = await new CreateDirectoryProfileStep(w.repo, w.admin, w.audit, dup).run(ctx('v-new'));
    expect((r.outputRef as { businessId: string }).businessId).not.toBe(owned.id); expect((r.outputRef as Record<string, string>).attached).toBeUndefined();
  });
  it('a vendor that already has a listing keeps it (idempotent), and a step built without the check still creates', async () => {
    const w = await directoryWorld(); const step = new CreateDirectoryProfileStep(w.repo, w.admin, w.audit, dup);
    const a = await step.run(ctx('v-a', { phone: '9811111111', businessName: 'Alpha Pipes' })); const b = await step.run(ctx('v-a', { phone: '9811111111', businessName: 'Alpha Pipes' }));
    expect(a.outputRef).toEqual(b.outputRef);
    expect((await new CreateDirectoryProfileStep(w.repo, w.admin, w.audit).run(ctx('v-b', { phone: '9822222222', businessName: 'Beta Pipes' }))).outputRef).toHaveProperty('businessId');
  });
});

// ── seeded sites ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('seeded sites', () => {
  const mk = () => { const w = seededWorld(); (w.svc as unknown as { dup: DuplicateCheckService }).dup = dup; return w; };
  it('a seeded business that is already a real business is refused 409 DUPLICATE_BUSINESS before anything is made', async () => {
    const w = mk();
    expect((await code(w.svc.create(row(), ops)))).toMatchObject({ status: 409, code: 'DUPLICATE_BUSINESS' });
    expect(w.provisioner.calls).toHaveLength(0); expect(w.store.rows.size).toBe(0); expect(w.publisher.published).toEqual([]);
  });
  it('a possible duplicate (same name, area, category) is stopped; an ADMIN with a written reason carries the override into the job', async () => {
    const w = mk(); store.vendors[0].phone = '+91 90000 00009'; store.vendors[0].phoneKey = '9000000009'; store.listings[0].phoneE164 = '+919000000009'; store.vendors[0].email = 'someone@else.com';
    expect((await code(w.svc.create(row({ email: '' }), ops)))).toMatchObject({ status: 409, code: 'DUPLICATE_POSSIBLE' });
    const admin = { ...sup, role: 'ADMIN' as const };
    expect((await code(w.svc.create(row({ email: '' }), ops, { duplicateOverrideReason: 'Another shop on the same street' })))?.code).toBe('DUPLICATE_OVERRIDE_FORBIDDEN');
    await w.svc.create(row({ email: '' }), admin, { duplicateOverrideReason: 'Another shop on the same street' });
    expect(w.provisioner.calls[0]).toMatchObject({ duplicateOverride: { reason: 'Another shop on the same street', staffRole: 'ADMIN' } });
  });
  it('a business nobody has is created as before', async () => {
    const w = mk(); store.vendors = []; store.listings = [];
    expect((await w.svc.create(row(), ops)).lifecycle).toBe('SEEDED');
  });
});

// ── deals and starter sites ──────────────────────────────────────────────────────────────────────────────────────────
describe('deal prospects and starter sites', () => {
  it('a prospect that is already a business (same phone, another e-mail) is refused; staff attach the deal with vendorId instead; a new prospect is created with its phoneKey', async () => {
    const created: Array<Record<string, unknown>> = [];
    const prisma = { vendor: { findUnique: jest.fn(async () => null), create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => { created.push(data); return { id: 'v-new', businessName: data.businessName }; }) } };
    const deals = new DealsService(prisma as never, {} as never, {} as never, {} as never, { log: async () => undefined } as never, {} as never, {} as never, {} as never, dup);
    const actor = { type: 'STAFF', id: 's1', ip: null } as never;
    const dupe = { prospect: { name: 'Ganesh', business: 'Sri Ganesh Plumbing', email: 'prospect@example.com', phone: '98765 43210' } };
    expect((await code(deals.resolveVendor(dupe as never, actor)))).toMatchObject({ status: 409, code: 'DUPLICATE_BUSINESS' }); expect(created).toHaveLength(0);
    const fresh = { prospect: { name: 'Kumar', business: 'Kumar Electricals', email: 'kumar@example.com', phone: '91111 11111' } };
    expect(await deals.resolveVendor(fresh as never, actor)).toEqual({ vendorId: 'v-new', created: true }); expect(created[0].phoneKey).toBe('9111111111');
  });
  it('an admin starter site that is already a business is refused before any row is made', async () => {
    const prisma = { vendor: { findUnique: jest.fn(async () => null), create: jest.fn() }, categoryPack: { findUnique: jest.fn(async () => ({ key: 'plumber', enabled: true, config: { seed: true } })) } };
    const starter = new StarterService(prisma as never, {} as never, {} as never, dup);
    const r = await code(starter.createSite({ categoryKey: 'plumber', businessName: 'Sri Ganesh Plumbing', subdomain: 'ganesh-pipes', city: 'Chennai', phone: '98765 43210' }, 'staff-1'));
    expect(r).toMatchObject({ status: 409, code: 'DUPLICATE_BUSINESS' }); expect(prisma.vendor.create).not.toHaveBeenCalled();
  });
});

// ── publishing is held while a possible duplicate waits for review ───────────────────────────────────────────────────
describe('publish hold', () => {
  const svc = (): PublishService => new PublishService({} as never, {} as never, {} as never, { resolve: async () => ({ features: {} }) } as never, {} as never, undefined, undefined, dup);
  it('a held business cannot be published (409 DUPLICATE_REVIEW_PENDING), cleared it can, and the check happens before anything else', async () => {
    store.addReview({ path: 'REGISTER', vendorId: 'v-held', matchedVendorId: null, matchedBusinessId: 'b-old', matchedSignals: ['NAME_LOCATION_CATEGORY'], score: 0.8 });
    const actor = { type: 'STAFF' as const, id: 's1', ip: null };
    expect(await code(svc().publish('v-held', 'p1', actor))).toMatchObject({ status: 409, code: 'DUPLICATE_REVIEW_PENDING' });
    await dup.decide(store.reviews[0].id, 'CLEARED', 'different branch, confirmed', ADMIN);
    // once cleared the publish goes on to the repository, which this test does not have: the point is that the hold no longer answers first
    const r = await code(svc().publish('v-held', 'p1', actor));
    expect(r?.code).not.toBe('DUPLICATE_REVIEW_PENDING');
  });
});

// ── the public availability check carries the similar-address warning ──────────────────────────────────────────────────
describe('subdomain availability check', () => {
  const settings = { get: async () => ({ subdomainMinLength: 3, subdomainMaxLength: 40, reservedSubdomains: [], blockedSubdomainWords: [], baseDomain: 'get4domain.com' }) };
  const prisma = { vendor: { findUnique: async ({ where }: { where: { subdomain: string } }) => (where.subdomain === 'sriganesh' ? { id: 'v-old' } : null) }, v3Domain: { findUnique: async () => null } };
  it('a look-alike of an existing address is still available, with a warning naming it; an exact match is unavailable; a different name has no warning', async () => {
    const policy = new TrialSignupPolicy(prisma as never, settings as never, dup);
    expect(await policy.check('sr1ganesh')).toMatchObject({ available: true, reason: 'AVAILABLE', similarTo: 'sriganesh' });
    expect(await policy.check('sriganesh')).toMatchObject({ available: false, reason: 'UNAVAILABLE' });
    expect((await policy.check('kumar-electricals')).similarTo).toBeUndefined();
  });
  it('without the duplicate check (an older construction) the answer is exactly as before', async () => {
    expect(await new TrialSignupPolicy(prisma as never, settings as never).check('sr1ganesh')).toEqual({ available: true, name: 'sr1ganesh', reason: 'AVAILABLE', message: 'That address is free.' });
  });
});
