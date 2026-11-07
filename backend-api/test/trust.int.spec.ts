// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { OtpPepper } from '../src/directory/pepper';
import { ActivityService } from '../src/v3-activity/activity.service';
import { PrismaActivityStore } from '../src/v3-activity/prisma-activity.store';
import { PrismaTrustStore } from '../src/v3-trust/prisma-trust.store';
import { ProofsService, TakedownService, TermsService, TrustScanService } from '../src/v3-trust/trust.service';
import { cleanupTenants, newPrisma, seedTenant, SeededTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Slice 5.21 on STAGING: the takedown guard trigger, the constraints, and the takedown's effect on the real listing row. NOT RUN in the build session that wrote it (no staging database there).
 * The vendors it makes are removed by cleanupTenants; the takedown rows can be deleted only after their vendor and listing are gone (the trigger), so the vendors go first.
 */
jest.setTimeout(180_000);
const SUPER = { id: 'staff-int', ip: null, role: 'SUPER_ADMIN' };

describe('trust and safety on staging', () => {
  let prisma: PrismaClient; let store: PrismaTrustStore; let takedowns: TakedownService; let proofs: ProofsService; let terms: TermsService; let scan: TrustScanService; let a: SeededTenant; let b: SeededTenant;
  let listingId = ''; let categoryId = ''; let madeCategory = false; const slug = `v3test-${RUN_ID}`.toLowerCase();

  beforeAll(async () => {
    prisma = newPrisma(); store = new PrismaTrustStore(prisma as unknown as PrismaService);
    const activity = new ActivityService(new PrismaActivityStore(prisma as unknown as PrismaService), new OtpPepper());
    takedowns = new TakedownService(store, activity); proofs = new ProofsService(store); terms = new TermsService(store); scan = new TrustScanService(store, activity);
    a = await seedTenant(prisma, 'p521a', RUN_ID); b = await seedTenant(prisma, 'p521b', RUN_ID);
    const cat = await prisma.v3DirectoryCategory.findFirst({ select: { id: true } });
    if (cat) categoryId = cat.id; else { madeCategory = true; categoryId = (await prisma.v3DirectoryCategory.create({ data: { slug: `${slug}-cat`, name: `V3TEST ${RUN_ID}` } as never })).id; }
    listingId = (await prisma.v3DirectoryBusiness.create({ data: { vendorId: a.vendorId, slug, name: `V3TEST ${RUN_ID}`, categoryId, status: 'CLAIMED', indexable: true } })).id;
  }, 240000);

  afterAll(async () => {
    await runCleanup([
      () => cleanupTenants(prisma, RUN_ID),
      () => prisma.v3Takedown.deleteMany({ where: { vendorId: { in: [a.vendorId, b.vendorId] } } }),
      () => prisma.v3ProhibitedTerm.deleteMany({ where: { term: { startsWith: 'v3test' } } }),
      () => (madeCategory ? prisma.v3DirectoryCategory.deleteMany({ where: { id: categoryId } }) : Promise.resolve()),
      () => prisma.$disconnect(),
    ]);
  }, 180000);

  it('a takedown and the listing change together: the listing is REMOVED, and a reversal puts it back', async () => {
    const t = await takedowns.create(SUPER, { vendorId: a.vendorId, reason: 'staging test reason' });
    expect(t).toMatchObject({ vendorId: a.vendorId, listingId, status: 'ACTIVE', priorListingStatus: 'CLAIMED', priorIndexable: true });
    expect(await prisma.v3DirectoryBusiness.findUniqueOrThrow({ where: { id: listingId } })).toMatchObject({ status: 'REMOVED', indexable: false });
    expect(await takedowns.activeForVendor(a.vendorId)).toBe(true); expect(await takedowns.activeForVendor(b.vendorId)).toBe(false);
    await expect(takedowns.create(SUPER, { vendorId: a.vendorId, reason: 'again' })).rejects.toMatchObject({ response: { code: 'TAKEDOWN_ALREADY_ACTIVE' } });
    await takedowns.reverse(t.id, SUPER, { reason: 'staging test reversal' });
    expect(await prisma.v3DirectoryBusiness.findUniqueOrThrow({ where: { id: listingId } })).toMatchObject({ status: 'CLAIMED', indexable: true, removedAt: null });
  });

  it('two takedowns at once make exactly one', async () => {
    const r = await Promise.allSettled([takedowns.create(SUPER, { vendorId: b.vendorId, reason: 'one' }), takedowns.create(SUPER, { vendorId: b.vendorId, reason: 'two' })]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1); expect(await prisma.v3Takedown.count({ where: { vendorId: b.vendorId, status: 'ACTIVE' } })).toBe(1);
  });

  it('the database refuses to delete a takedown, change its reason, decider, time or target, or change a reversed one', async () => {
    const t = await prisma.v3Takedown.findFirstOrThrow({ where: { vendorId: a.vendorId, status: 'REVERSED' } });
    await expect(prisma.v3Takedown.update({ where: { id: t.id }, data: { reason: 'edited' } })).rejects.toThrow(/cannot be changed/);
    await expect(prisma.v3Takedown.update({ where: { id: t.id }, data: { decidedBy: 'someone else' } })).rejects.toThrow(/cannot be changed/);
    await expect(prisma.v3Takedown.update({ where: { id: t.id }, data: { reverseReason: 'edited' } })).rejects.toThrow(/reversed takedown cannot be changed/);
    await expect(prisma.v3Takedown.delete({ where: { id: t.id } })).rejects.toThrow(/cannot be deleted/);
    await expect(prisma.v3Takedown.create({ data: { vendorId: a.vendorId, reason: '   ', decidedBy: 'x' } })).rejects.toThrow(/g4d_takedowns_reason_chk/);
    await expect(prisma.v3Takedown.create({ data: { reason: 'no target', decidedBy: 'x' } })).rejects.toThrow(/g4d_takedowns_target_chk/);
    await expect(prisma.v3Takedown.create({ data: { vendorId: a.vendorId, reason: 'r', decidedBy: 'x', status: 'REVERSED' } })).rejects.toThrow(/g4d_takedowns_reversal_chk/);
  });

  it('proofs: one per vendor and kind, replaced on a new submission, and the checker is enforced by the database', async () => {
    const p = await proofs.submit(a.vendorId, { kind: 'GST', number: '33AAAAA0000A1Z5' });
    await expect(prisma.v3BusinessProof.update({ where: { id: p.id }, data: { status: 'CHECKED' } })).rejects.toThrow(/g4d_business_proofs_checked_chk/);
    await proofs.review(p.id, SUPER, { expectedStatus: 'SUBMITTED', status: 'CHECKED' });
    const again = await proofs.submit(a.vendorId, { kind: 'GST', number: '33BBBBB0000B1Z5' }); expect(again).toMatchObject({ id: p.id, status: 'SUBMITTED', checkedBy: null });
    expect(await proofs.mine(b.vendorId)).toEqual([]);
  });

  it('the scan reads the real phrase table and writes a row for the right vendor, never storing the text', async () => {
    await terms.create(SUPER, { term: `v3test phrase ${RUN_ID}`.toLowerCase(), category: 'TEST' });
    await scan.scan(a.vendorId, 'REQUEST', [`please sell me V3TEST phrase ${RUN_ID} now`]);
    const rows = await prisma.v3ActivityLog.findMany({ where: { vendorId: a.vendorId, actionKey: 'prohibited_text.matched' } });
    expect(rows).toHaveLength(1); expect(JSON.stringify(rows[0].summaryJson)).not.toMatch(/please sell me/);
  });
});
