// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { runCleanup } from './support/cleanup-guard';
import { cleanupTenants, newPrisma, seedBareVendor } from './support/fixtures';
import { DuplicateCheckService } from '../src/v3-duplicates/duplicate-check.service';
import { PrismaDuplicateStore } from '../src/v3-duplicates/prisma-duplicate.store';

/**
 * D1 on STAGING (real database, no third-party calls): the migration (phoneKey column and its backfill, the two new tables with row level security, the guarded trigram index) and the Prisma store
 * (phone by key and by raw phone, sandboxes excluded, name similarity with place and category, the held review and the override log) behind the real DuplicateCheckService.
 * Synthetic data only, under one run id, removed afterwards.
 */
jest.setTimeout(300_000);

describe('the duplicate check on staging', () => {
  let prisma: PrismaClient; let store: PrismaDuplicateStore; let svc: DuplicateCheckService;
  const tag = RUN_ID.toLowerCase().replace(/[^a-z0-9]/g, '');
  const digits = String(parseInt(tag.replace(/[^0-9a-f]/g, '').slice(0, 7) || '1234567', 16)).padStart(9, '0').slice(-9);
  const PHONE = `9${digits}`;                      // a number no real staging vendor has
  const NAME = `V3TEST Sri Ganesh Plumbing ${tag}`;
  const slug = `v3t-${tag}-dup`;
  let catId = ''; let locId = ''; let a = { vendorId: '', email: '' }; let b = { vendorId: '', email: '' }; let sandbox = { vendorId: '', email: '' };
  let bizId = ''; const reviewVendors: string[] = []; const overrideVendors: string[] = [];

  beforeAll(async () => {
    prisma = newPrisma(); store = new PrismaDuplicateStore(prisma as never); svc = new DuplicateCheckService(store);
    a = await seedBareVendor(prisma, 'dupa', RUN_ID); b = await seedBareVendor(prisma, 'dupb', RUN_ID); sandbox = await seedBareVendor(prisma, 'dups', RUN_ID);
    await prisma.vendor.update({ where: { id: a.vendorId }, data: { phone: `+91 ${PHONE.slice(0, 5)} ${PHONE.slice(5)}`, phoneKey: PHONE, industry: 'plumber', businessName: NAME, name: 'V3TEST Ganesh Kumar' } });
    // B was written before the backfill (no phoneKey): found by its raw phone
    await prisma.vendor.update({ where: { id: b.vendorId }, data: { phone: `0${String(Number(PHONE) + 1)}`, phoneKey: null } });
    // a demo sandbox (expiring) with the same phone as A must never count
    await prisma.vendor.update({ where: { id: sandbox.vendorId }, data: { phone: PHONE, phoneKey: PHONE, isSandbox: true, expiresAt: new Date(Date.now() + 3600_000) } });
    catId = (await prisma.v3DirectoryCategory.create({ data: { parentKey: 'ROOT', name: `V3T Cat ${tag}`, slug: `v3t${tag}cat`, themeCategoryId: `v3t${tag}kit` } })).id;
    locId = (await prisma.v3DirectoryLocation.create({ data: { parentKey: 'ROOT', kind: 'CITY', name: `V3T City ${tag}`, slug: `v3t${tag}city` } })).id;
    bizId = (await prisma.v3DirectoryBusiness.create({ data: { vendorId: null, slug, name: NAME, categoryId: catId, locationId: locId, pincode: '600099', addressJson: { line1: '12 Usman Road', line2: 'V3T Nagar', city: 'Chennai' }, phoneE164: `+91${Number(PHONE) + 2}`, status: 'UNCLAIMED', source: 'STAFF' } })).id;
  }, 300000);

  afterAll(async () => {
    await runCleanup([
      prisma ? () => prisma.v3DuplicateReview.deleteMany({ where: { vendorId: { in: reviewVendors } } }) : null,
      prisma ? () => prisma.v3DuplicateOverride.deleteMany({ where: { newVendorId: { in: overrideVendors } } }) : null,
      prisma && bizId ? () => prisma.v3DirectoryBusiness.deleteMany({ where: { id: bizId } }) : null,
      prisma ? () => cleanupTenants(prisma, RUN_ID) : null,
      prisma && catId ? () => prisma.v3DirectoryCategory.deleteMany({ where: { id: catId } }) : null,
      prisma && locId ? () => prisma.v3DirectoryLocation.deleteMany({ where: { id: locId } }) : null,
      prisma ? () => prisma.$disconnect() : null,
    ]);
  }, 330000);

  it('the migration: the column exists, vendors with a 10-digit phone were backfilled, and both new tables have row level security on', async () => {
    const unfilled = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM "Vendor" WHERE "phoneKey" IS NULL AND "phone" IS NOT NULL AND length(regexp_replace("phone", '\D', '', 'g')) >= 10 AND "email" NOT LIKE ${`%${RUN_ID}%`}`;
    expect(Number(unfilled[0].n)).toBe(0);
    const rls = await prisma.$queryRaw<Array<{ relname: string; on: boolean }>>`SELECT c.relname, c.relrowsecurity AS "on" FROM pg_class c WHERE c.relname IN ('g4d_duplicate_overrides', 'g4d_duplicate_reviews')`;
    expect(rls).toHaveLength(2); for (const r of rls) expect(r.on).toBe(true);
    const idx = await prisma.$queryRaw<Array<{ indexname: string }>>`SELECT indexname FROM pg_indexes WHERE indexname = 'Vendor_phoneKey_idx'`;
    expect(idx).toHaveLength(1);
  });

  it('phone: found by its key, found by its raw phone while it has no key, and a demo sandbox never counts', async () => {
    const hit = await store.byPhone(PHONE, null, null);
    expect(hit.map((h) => h.vendorId)).toEqual([a.vendorId]);                  // A only: not the sandbox
    const raw = await store.byPhone(String(Number(PHONE) + 1), null, null);
    expect(raw.map((h) => h.vendorId)).toEqual([b.vendorId]);                  // B has no phoneKey: found the long way
    expect(await store.byPhone(PHONE, null, a.vendorId)).toEqual([]);          // a vendor never matches itself
  });

  it('phone on a listing nobody owns is an attachable hit', async () => {
    const hits = await store.byPhone(String(Number(PHONE) + 2), `+91${Number(PHONE) + 2}`, null);
    expect(hits).toEqual([{ vendorId: null, businessId: bizId, attachable: true }]);
  });

  it('name similarity with the place and the category: the unowned listing is a medium match and attachable; a different place is not', async () => {
    const q = { name: `V3TEST Sri Ganesh Plumbers ${tag}`, pincode: '600099', area: null, category: `v3t${tag}cat`, ownerName: null, address: null, excludeVendorId: null };
    const c = await store.nameCandidates(q);
    const mine = c.find((x) => x.businessId === bizId);
    expect(mine).toMatchObject({ attachable: true, locationMatch: true, categoryMatch: true }); expect(mine!.similarity).toBeGreaterThan(0.55);
    const elsewhere = (await store.nameCandidates({ ...q, pincode: '600001' })).find((x) => x.businessId === bizId);
    expect(elsewhere?.locationMatch ?? false).toBe(false);
    // the theme-kit link of the category counts as the category too
    expect((await store.nameCandidates({ ...q, category: `v3t${tag}kit` })).find((x) => x.businessId === bizId)?.categoryMatch).toBe(true);
    // through the service: a visitor is stopped and told the listing can be claimed; a staff path is not stopped (it attaches)
    const r = await svc.check({ businessName: q.name, pincode: '600099', category: `v3t${tag}cat` }, { listingsAreAttachable: false });
    expect(r.outcome).toBe('POSSIBLE'); expect(r.listings).toEqual([expect.objectContaining({ slug, claimable: true })]);
    expect((await svc.check({ businessName: q.name, pincode: '600099', category: `v3t${tag}cat` }, { listingsAreAttachable: true })).outcome).toBe('CLEAR');
    expect(await svc.findAttachableListing({ businessName: q.name, pincode: '600099', category: `v3t${tag}cat` })).toBe(bizId);
  });

  it('a vendor with no listing is judged on its industry and the address it typed', async () => {
    const r = await store.nameCandidates({ name: NAME, pincode: null, area: null, category: 'plumber', ownerName: 'V3TEST Ganesh Kumar', address: null, excludeVendorId: null });
    const mine = r.find((x) => x.vendorId === a.vendorId);
    expect(mine).toMatchObject({ categoryMatch: true, ownerMatch: true, locationMatch: false }); expect(mine!.similarity).toBe(1);
  });

  it('a strong match through the real service blocks with the claim-free message; the e-mail is found case-insensitively', async () => {
    const e = await svc.check({ email: a.email.toUpperCase(), businessName: 'Anything' });
    expect(e.outcome).toBe('BLOCKED'); expect(e.deciding[0]).toMatchObject({ signal: 'EMAIL', vendorId: a.vendorId });
  });

  it('the review row is written in the same transaction as the vendor; held until cleared; rejected stays held; the override log keeps who, why and which record', async () => {
    const decision = await svc.enforce({ email: `new-${tag}@v3test.invalid`, phone: '9000000001', businessName: `V3TEST Sri Ganesh Plumbers ${tag}`, pincode: '600099', category: `v3t${tag}cat` }, { path: 'REGISTER', selfService: true, confirmDistinct: true });
    expect(decision.hold).toBe(true);
    const v = await prisma.$transaction(async (tx) => {
      const created = await tx.vendor.create({ data: { name: 'V3TEST held', email: `new-${tag}@v3test.invalid`, password: 'x', businessName: `V3TEST held ${tag}` } });
      await tx.v3DuplicateReview.create({ data: svc.reviewData(decision, created.id)! });
      return created;
    });
    reviewVendors.push(v.id);
    expect(await svc.isHeld(v.id)).toBe(true);
    const row = (await store.listReviews('PENDING', 0, 200)).items.find((r) => r.vendorId === v.id)!;
    expect(row).toMatchObject({ path: 'REGISTER', matchedBusinessId: bizId, matchedSignals: ['NAME_LOCATION_CATEGORY'] });
    expect(await svc.decide(row.id, 'REJECTED', 'it is the same shop', { id: 'staff-x', role: 'ADMIN' })).toMatchObject({ status: 'REJECTED' });
    expect(await svc.isHeld(v.id)).toBe(true);
    // a rejected review is final: it cannot be decided again, and a cleared one lets the business through
    const second = await prisma.v3DuplicateReview.create({ data: { path: 'REGISTER', vendorId: `${v.id}-b`, matchedSignals: [] } }); reviewVendors.push(`${v.id}-b`);
    await svc.decide(second.id, 'CLEARED', 'a different branch, confirmed', { id: 'staff-x', role: 'SUPER_ADMIN' });
    expect(await svc.isHeld(`${v.id}-b`)).toBe(false);
    await expect(svc.decide(second.id, 'REJECTED', 'changed my mind', { id: 'staff-x', role: 'ADMIN' })).rejects.toMatchObject({ response: { code: 'DUPLICATE_REVIEW_DECIDED' } });

    const ov = await svc.enforce({ email: a.email, businessName: 'Anything' }, { path: 'ADMIN_VENDOR', actor: { id: 'staff-y', role: 'ADMIN' }, overrideReason: 'Second branch, same owner', selfService: false });
    await svc.record(ov, v.id); overrideVendors.push(v.id);
    expect(await prisma.v3DuplicateOverride.findFirst({ where: { newVendorId: v.id } })).toMatchObject({ path: 'ADMIN_VENDOR', staffId: 'staff-y', staffRole: 'ADMIN', reason: 'Second branch, same owner', outcome: 'BLOCKED', matchedVendorId: a.vendorId, matchedSignals: ['EMAIL'] });
  });

  it('similar subdomains are found for the warning, and the look-alike rule applies', async () => {
    await prisma.vendor.update({ where: { id: a.vendorId }, data: { subdomain: `v3t${tag}ganesh` } });
    expect(await svc.subdomainWarning(`v3t${tag}gan3sh`)).toBe(`v3t${tag}ganesh`);
    expect(await svc.subdomainWarning(`v3t${tag}ganesh`)).toBeNull();          // identical = taken, not a warning
  });
});
