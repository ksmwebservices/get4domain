import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { ConflictException } from '@nestjs/common';
import { DuplicateCheckService, EnforceContext } from '../src/v3-duplicates/duplicate-check.service';
import { DuplicateInput } from '../src/v3-duplicates/core/duplicate-core';
import { MemoryDuplicateStore } from './support/memory-duplicate-store';

/** D1: the shared duplicate check, every outcome, with the in-memory twin of the store. */
let store: MemoryDuplicateStore; let svc: DuplicateCheckService;
const ADMIN = { id: 'staff-admin', role: 'ADMIN' }; const SUPER = { id: 'staff-super', role: 'SUPER_ADMIN' }; const OPS = { id: 'staff-ops', role: 'OPERATIONS' }; const SALES = { id: 'staff-sales', role: 'MARKETING' };
const self: EnforceContext = { path: 'REGISTER', selfService: true };
const staff: EnforceContext = { path: 'PROVISIONING', actor: OPS, selfService: false, listingsAreAttachable: true };
const input = (o: Partial<DuplicateInput> = {}): DuplicateInput => ({ email: 'new@example.com', phone: '98765 43210', businessName: 'Sri Ganesh Plumbing', area: 'T Nagar', pincode: '600017', category: 'plumber', ownerName: 'Ganesh Kumar', ...o });
const err = async (p: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> } | null> => { try { await p; return null; } catch (e) { const x = e as { getStatus?: () => number; getResponse?: () => unknown }; return { status: x.getStatus?.() ?? 0, body: (x.getResponse?.() ?? {}) as Record<string, unknown> }; } };

beforeEach(() => {
  store = new MemoryDuplicateStore(); svc = new DuplicateCheckService(store);
  store.vendors.push({ id: 'v-old', email: 'old@example.com', phone: '+91 98765 43210', phoneKey: '9876543210', name: 'Ganesh Kumar', businessName: 'Sri Ganesh Plumbing', industry: 'plumber', address: 'T Nagar 600017', subdomain: 'sriganesh', customDomain: 'sriganeshplumbing.in' });
  store.listings.push({ id: 'b-old', slug: 'sri-ganesh-plumbing-chennai', name: 'Sri Ganesh Plumbing', vendorId: 'v-old', status: 'UNCLAIMED', phoneE164: '+919876543210', pincode: '600017', line2: 'T Nagar', city: 'Chennai', category: 'plumber' });
});

describe('strong signals block, each one', () => {
  it('phone: any spelling of the same number, found by the key', async () => {
    for (const phone of ['9876543210', '+91 98765-43210', '098765 43210']) expect((await err(svc.enforce(input({ phone, email: 'x@y.com', businessName: 'Zzz', area: undefined, pincode: undefined }), self)))?.body.code).toBe('DUPLICATE_BUSINESS');
  });
  it('phone: a vendor written before the backfill (no phoneKey) is still found by its raw phone', async () => {
    store.vendors[0].phoneKey = null; store.listings = [];
    expect((await err(svc.enforce(input({ businessName: 'Zzz', area: undefined, pincode: undefined }), self)))?.body.code).toBe('DUPLICATE_BUSINESS');
  });
  it('e-mail (case does not matter)', async () => { expect((await err(svc.enforce(input({ email: 'OLD@Example.com', phone: '9000000001', businessName: 'Zzz', area: undefined, pincode: undefined }), self)))?.body.code).toBe('DUPLICATE_BUSINESS'); });
  it('GSTIN', async () => {
    store.vendors[0].gstin = '33ABCDE1234F1Z5';
    expect((await err(svc.enforce(input({ email: 'a@b.com', phone: '9000000001', businessName: 'Zzz', area: undefined, pincode: undefined, gstin: '33 abcde-1234f1z5' }), self)))?.body.code).toBe('DUPLICATE_BUSINESS');
  });
  it('an existing website: a host row of another vendor, or its mapped custom domain (www, scheme and case ignored)', async () => {
    const base = { email: 'a@b.com', phone: '9000000001', businessName: 'Zzz', area: undefined, pincode: undefined };
    expect((await err(svc.enforce(input({ ...base, customDomain: 'https://www.SriGaneshPlumbing.in/' }), self)))?.body.code).toBe('DUPLICATE_BUSINESS');
    store.vendors[0].customDomain = null; store.hosts.push({ hostname: 'ganeshpipes.in', vendorId: 'v-old' });
    expect((await err(svc.enforce(input({ ...base, customDomain: 'ganeshpipes.in' }), self)))?.body.code).toBe('DUPLICATE_BUSINESS');
  });
  it('a vendor never matches itself (excludeVendorId)', async () => {
    const d = await svc.enforce(input({ excludeVendorId: 'v-old' }), self);
    expect(d.outcome).toBe('CLEAR');
  });
  it('a demo sandbox (a throwaway tour account) is not an existing business', async () => {
    store.vendors[0].sandboxExpiring = true; store.listings = [];
    expect((await svc.enforce(input(), self)).outcome).toBe('CLEAR');
  });
});

describe('the refusal tells a visitor nothing private', () => {
  it('a strong match says a business with these details exists and shows the claim route; no ids, no signal names, no names, no contact details', async () => {
    const r = await err(svc.enforce(input(), self));
    expect(r?.status).toBe(409);
    expect(r?.body).toEqual({ message: 'A business with these details already exists. Sign in to your account, or claim the listing if it is yours.', code: 'DUPLICATE_BUSINESS', claim: { businessSlug: 'sri-ganesh-plumbing-chennai', startPath: '/v3/claim/start' } });
    const text = JSON.stringify(r?.body);
    for (const secret of ['v-old', 'b-old', 'old@example.com', '9876543210', 'Ganesh Kumar', 'PHONE', 'EMAIL']) expect(text).not.toContain(secret);
  });
  it('a CLAIMED listing offers no claim route (sign in instead)', async () => {
    store.listings[0].status = 'CLAIMED';
    expect((await err(svc.enforce(input(), self)))?.body.claim).toBeNull();
  });
  it('STAFF see which record matched, to decide what to do', async () => {
    const r = await err(svc.enforce(input({ category: undefined }), { ...staff, listingsAreAttachable: false }));
    expect(r?.body.matches).toEqual(expect.arrayContaining([expect.objectContaining({ signal: 'PHONE', vendorId: 'v-old' })]));
  });
});

describe('a medium match', () => {
  const near = (o: Partial<DuplicateInput> = {}) => input({ email: 'fresh@example.com', phone: '9000000001', businessName: 'Sri Ganesh Plumbers', ...o });
  it('asks "Is this your business?" with PUBLIC listing facts only', async () => {
    const r = await err(svc.enforce(near(), self));
    expect(r?.status).toBe(409); expect(r?.body.code).toBe('DUPLICATE_POSSIBLE');
    expect(r?.body.candidates).toEqual([{ slug: 'sri-ganesh-plumbing-chennai', name: 'Sri Ganesh Plumbing', category: 'plumber', city: 'Chennai', area: 'T Nagar', claimable: true }]);
    const text = JSON.stringify(r?.body);
    for (const secret of ['v-old', 'b-old', 'old@example.com', '9876543210', 'Ganesh Kumar']) expect(text).not.toContain(secret);
  });
  it('needs the place, the category and a close name: each missing piece keeps it quiet', async () => {
    for (const o of [{ area: undefined, pincode: undefined }, { area: 'Adyar', pincode: '600020' }, { category: 'electrician' }, { businessName: 'Kumar Electricals' }]) expect((await svc.enforce(near(o), self)).outcome).toBe('CLEAR');
  });
  it('the visitor answers "a different business": it goes ahead but is HELD for admin review, unpublished', async () => {
    const d = await svc.enforce(near({ ...{} }), { ...self, confirmDistinct: true });
    expect(d).toMatchObject({ outcome: 'POSSIBLE', hold: true });
    expect(svc.reviewData(d, 'v-new')).toMatchObject({ vendorId: 'v-new', path: 'REGISTER', matchedBusinessId: 'b-old', matchedSignals: ['NAME_LOCATION_CATEGORY'] });
  });
  it('no PUBLIC listing to show (a vendor without one): nothing is revealed, the case goes straight to admin review, unpublished', async () => {
    store.listings = [];
    const d = await svc.enforce(near(), self);
    expect(d).toMatchObject({ outcome: 'POSSIBLE', hold: true });
  });
  it('a REMOVED listing is not shown to anyone', async () => {
    store.listings[0].status = 'REMOVED'; store.vendors = [];
    expect((await svc.enforce(near(), self)).outcome).toBe('CLEAR');
  });
  it('owner or address help a near-miss name become a medium match', async () => {
    store.listings[0].line1 = '12 Usman Road';
    const faint = near({ businessName: 'Ganesh Pipe Works', ownerName: 'Someone Else' });
    expect((await svc.enforce(faint, self)).outcome).toBe('CLEAR');
    store.vendors[0].businessName = 'Sri Ganesh Pipe Works'; store.listings[0].name = 'Sri Ganesh Pipe Works';
    expect((await err(svc.enforce(faint, self)))?.body.code).toBe('DUPLICATE_POSSIBLE');
  });
  it('a STAFF path is stopped (a staff member cannot answer for the owner) and sees what matched', async () => {
    const r = await err(svc.enforce(near(), { ...staff, listingsAreAttachable: false }));
    expect(r?.body.code).toBe('DUPLICATE_POSSIBLE'); expect(r?.body.matches).toEqual(expect.arrayContaining([expect.objectContaining({ signal: 'NAME_LOCATION_CATEGORY' })]));
  });
  it('an unowned listing is not a stop for a staff path: it is attached later', async () => {
    store.vendors = []; store.listings[0].vendorId = null;
    expect((await svc.enforce(near(), staff)).outcome).toBe('CLEAR');
    expect(await svc.findAttachableListing({ phone: '9000000001', businessName: 'Sri Ganesh Plumbers', area: 'T Nagar', pincode: '600017', category: 'plumber' })).toBe('b-old');
    // the same unowned listing STOPS a self-service path: the visitor is told to claim it
    expect((await err(svc.enforce(near(), self)))?.body.code).toBe('DUPLICATE_POSSIBLE');
  });
  it('findAttachableListing: same phone attaches too; a listing that has an owner never does', async () => {
    store.vendors = []; store.listings[0].vendorId = null;
    expect(await svc.findAttachableListing({ phone: '+91 98765 43210', businessName: 'Totally Different' })).toBe('b-old');
    store.listings[0].vendorId = 'v-owner';
    expect(await svc.findAttachableListing({ phone: '+91 98765 43210', businessName: 'Totally Different' })).toBeNull();
  });
});

describe('override: ADMIN or SUPER_ADMIN, a written reason, logged', () => {
  it('SUPER_ADMIN and ADMIN can override a strong match; it is recorded with who, why, which record, and the new vendor', async () => {
    for (const actor of [SUPER, ADMIN]) {
      store.overrides = [];
      const d = await svc.enforce(input(), { path: 'ADMIN_VENDOR', actor, overrideReason: 'Two branches, same owner, confirmed by phone', selfService: false });
      expect(d).toMatchObject({ outcome: 'BLOCKED', hold: false });
      await svc.record(d, 'v-new');
      expect(store.overrides).toEqual([expect.objectContaining({ path: 'ADMIN_VENDOR', staffId: actor.id, staffRole: actor.role, reason: 'Two branches, same owner, confirmed by phone', outcome: 'BLOCKED', newVendorId: 'v-new' })]);
      expect(store.overrides[0].matches.map((m) => m.signal)).toEqual(expect.arrayContaining(['PHONE']));
    }
  });
  it('it also overrides a possible duplicate, with no hold', async () => {
    const d = await svc.enforce(input({ email: 'f@e.com', phone: '9000000001', businessName: 'Sri Ganesh Plumbers' }), { path: 'ADMIN_VENDOR', actor: ADMIN, overrideReason: 'Different shop, same street', selfService: false });
    expect(d).toMatchObject({ outcome: 'POSSIBLE', hold: false });
    expect(svc.reviewData(d, 'v-new')).toBeNull();
  });
  it('other staff roles are refused 403 (OPERATIONS, SALES); a visitor can never override; no actor = refused', async () => {
    for (const actor of [OPS, SALES]) expect((await err(svc.enforce(input(), { path: 'ADMIN_VENDOR', actor, overrideReason: 'a good enough reason', selfService: false })))?.body.code).toBe('DUPLICATE_OVERRIDE_FORBIDDEN');
    expect((await err(svc.enforce(input(), { ...self, actor: ADMIN, overrideReason: 'a good enough reason' })))?.body.code).toBe('DUPLICATE_OVERRIDE_FORBIDDEN');
    expect((await err(svc.enforce(input(), { path: 'DEAL', actor: null, overrideReason: 'a good enough reason', selfService: false })))?.body.code).toBe('DUPLICATE_OVERRIDE_FORBIDDEN');
    expect(store.overrides).toHaveLength(0);
  });
  it('a reason is required: missing, blank, too short or too long is 400 and nothing is let through', async () => {
    for (const overrideReason of ['abc', '    ', 'x'.repeat(301)]) { const r = await err(svc.enforce(input(), { path: 'ADMIN_VENDOR', actor: ADMIN, overrideReason, selfService: false })); expect(r?.status).toBe(400); expect(r?.body.code).toBe('DUPLICATE_OVERRIDE_REASON_REQUIRED'); }
    expect((await err(svc.enforce(input(), { path: 'ADMIN_VENDOR', actor: ADMIN, selfService: false })))?.body.code).toBe('DUPLICATE_BUSINESS');   // no reason at all = no override
  });
  it('an override on a clear business is not logged (nothing was overridden)', async () => {
    const d = await svc.enforce(input({ email: 'q@q.com', phone: '9111111111', businessName: 'Kumar Electricals' }), { path: 'ADMIN_VENDOR', actor: ADMIN, overrideReason: 'just in case', selfService: false });
    await svc.record(d, 'v-new'); expect(d.outcome).toBe('CLEAR'); expect(store.overrides).toHaveLength(0);
  });
});

describe('the similar-subdomain warning (a warning, not a block)', () => {
  it('a look-alike is reported and the business is still allowed', async () => {
    const d = await svc.enforce(input({ email: 'q@q.com', phone: '9111111111', businessName: 'Kumar Electricals', area: undefined, pincode: undefined, subdomain: 'sr1ganesh' }), self);
    expect(d.outcome).toBe('CLEAR'); expect(d.subdomainWarning).toBe('sriganesh');
  });
  it('a different name, or none, gives no warning', async () => {
    expect((await svc.check(input({ subdomain: 'kumar-electricals', phone: '9111111111', email: 'q@q.com', area: undefined, pincode: undefined }))).subdomainWarning).toBeNull();
    expect((await svc.check(input({ subdomain: null }))).subdomainWarning).toBeNull();
  });
});

describe('the admin review queue', () => {
  it('the held list carries the held business, the matched record and its public listing, and no contact details (B3.2)', async () => {
    store.vendors.push({ id: 'v-held', email: 'held@example.com', phone: '9111122222', phoneKey: '9111122222', name: 'Held Owner', businessName: 'Sri Ganesh Plumbing Works', industry: 'plumbing', address: null, subdomain: 'sri-ganesh-works', gstin: null, customDomain: null, sandboxExpiring: false } as never);
    store.addReview({ path: 'REGISTER', vendorId: 'v-held', matchedVendorId: 'v-old', matchedBusinessId: 'b-old', matchedSignals: ['NAME_LOCATION_CATEGORY'], score: 0.8 });
    const r = await svc.listReviews({ skip: 0, take: 10 });
    expect(r.total).toBe(1);
    expect(r.items[0].vendor).toMatchObject({ id: 'v-held', businessName: 'Sri Ganesh Plumbing Works', subdomain: 'sri-ganesh-works', industry: 'plumbing' });
    expect(r.items[0].matched).toMatchObject({ vendorId: 'v-old', businessId: 'b-old', listing: { businessId: 'b-old', slug: 'sri-ganesh-plumbing-chennai' } });
    const text = JSON.stringify(r.items[0]);
    for (const secret of ['held@example.com', '9111122222', 'Held Owner', 'old@example.com', '9876543210']) expect(text).not.toContain(secret);
  });
  const held = () => { store.addReview({ path: 'REGISTER', vendorId: 'v-held', matchedVendorId: 'v-old', matchedBusinessId: 'b-old', matchedSignals: ['NAME_LOCATION_CATEGORY'], score: 0.8 }); return store.reviews[0].id; };
  it('a held business is held until cleared; rejected stays held', async () => {
    const id = held();
    expect(await svc.isHeld('v-held')).toBe(true); expect(await svc.isHeld('v-other')).toBe(false);
    await svc.decide(id, 'REJECTED', 'it is the same shop', ADMIN); expect(await svc.isHeld('v-held')).toBe(true);
  });
  it('clearing needs ADMIN or SUPER_ADMIN and a written reason, and lets the business through; a second decision is refused', async () => {
    const id = held();
    expect((await err(svc.decide(id, 'CLEARED', 'different branch', OPS)))?.body.code).toBe('DUPLICATE_OVERRIDE_FORBIDDEN');
    expect((await err(svc.decide(id, 'CLEARED', 'no', ADMIN)))?.body.code).toBe('DUPLICATE_OVERRIDE_REASON_REQUIRED');
    expect(await svc.decide(id, 'CLEARED', 'different branch, owner confirmed', SUPER)).toEqual({ id, status: 'CLEARED' });
    expect(await svc.isHeld('v-held')).toBe(false);
    expect((await err(svc.decide(id, 'REJECTED', 'changed my mind', ADMIN)))?.body.code).toBe('DUPLICATE_REVIEW_DECIDED');
    expect((await err(svc.decide('nope', 'CLEARED', 'whatever reason', ADMIN)))?.status).toBe(404);
    expect(store.reviews[0]).toMatchObject({ status: 'CLEARED', decidedByStaffId: 'staff-super', decisionReason: 'different branch, owner confirmed' });
  });
});

describe('no creation path skips the check', () => {
  /** Every file under src/ that creates a Vendor row. A new one must call the shared check (DuplicateCheckService) or be listed here with its reason. */
  const CREATORS: Record<string, string> = {
    'vendors/vendors.service.ts': 'check', 'provisioning/vendors/business-vendors.ts': 'step', 'commercial/deals.service.ts': 'check', 'site-doc/starter.service.ts': 'check',
    'demo/demo.service.ts': 'EXEMPT: a Book-Demo sandbox is a throwaway tour account (isSandbox, 48 hour expiry) that never counts as a business and is never published',
  };
  const walk = (dir: string, out: string[] = []): string[] => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.ts$/.test(n)) out.push(p); } return out; };
  it('the list of files that create a vendor is exactly the list above, and each (but the exempt one) uses the shared check or goes through the step that does', () => {
    const src = join(__dirname, '..', 'src');
    const found = walk(src).filter((f) => /\b(?:prisma|tx|this\.prisma)\.vendor\.create\(/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(src.length + 1).replace(/\\/g, '/')).sort();
    expect(found).toEqual(Object.keys(CREATORS).sort());
    for (const [file, how] of Object.entries(CREATORS)) {
      if (how.startsWith('EXEMPT')) continue;
      const text = readFileSync(join(src, file), 'utf8');
      if (how === 'check') expect(text).toContain('duplicates.enforce(');
    }
    // the provisioning step (every staff job and every seeded site) and the directory step
    expect(readFileSync(join(src, 'provisioning/steps/create-vendor.step.ts'), 'utf8')).toContain('this.dup.enforce(');
    expect(readFileSync(join(src, 'provisioning/steps/create-directory-profile.step.ts'), 'utf8')).toContain('findAttachableListing(');
    expect(readFileSync(join(src, 'seeded-sites/seeded-sites.service.ts'), 'utf8')).toContain('duplicateGate(');
  });
  it('ConflictException is what a refused path throws (HTTP 409)', async () => {
    await expect(svc.enforce(input(), self)).rejects.toBeInstanceOf(ConflictException);
  });
});
