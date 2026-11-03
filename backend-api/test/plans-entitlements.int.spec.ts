// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { PrismaPlansRepository } from '../src/plans/entitlements/plans.repository';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant } from './support/fixtures';

/**
 * S51.4 against the STAGING database: the entitlement engine reads the real V3 tables. The plan data is loaded from the owner's seed file (idempotent),
 * the vendors are synthetic (@v3test.invalid) and are removed at the end (their V3 rows go with them: foreign keys cascade).
 * NOT RUN in the build session that wrote it (no .env.staging there): run with `npm run test:int` on a machine that has it.
 */
describe('entitlements on staging (real tables)', () => {
  let prisma: PrismaClient;
  let svc: EntitlementsService;
  let A: SeededTenant;   // handyman Free
  let B: SeededTenant;   // professional Pro, then expired
  let C: SeededTenant;   // no subscription at all
  const DAY = 86_400_000;
  const planId = async (key: string): Promise<string> => (await prisma.v3Plan.findUniqueOrThrow({ where: { key } })).id;

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    svc = new EntitlementsService(new PrismaPlansRepository(prisma as unknown as PrismaService));
    A = await seedTenant(prisma, 'ea', RUN_ID);
    B = await seedTenant(prisma, 'eb', RUN_ID);
    C = await seedTenant(prisma, 'ec', RUN_ID);
    await prisma.v3PlanSubscription.create({ data: { vendorId: A.vendorId, planId: await planId('handyman_free'), source: 'REGISTRATION', createdByType: 'SYSTEM', currentVendorId: A.vendorId } });
    await prisma.v3PlanSubscription.create({
      data: {
        vendorId: B.vendorId, planId: await planId('professional_pro'), termMonths: 3, source: 'STAFF', createdByType: 'STAFF', currentVendorId: B.vendorId,
        startsAt: new Date(Date.now() - 100 * DAY), endsAt: new Date(Date.now() + 30 * DAY),
      },
    });
  }, 180000);

  afterAll(async () => {
    await cleanupTenants(prisma, RUN_ID);
    await prisma.$disconnect();
  }, 120000);

  it('a vendor on the handyman Free plan gets the seed\'s Free features', async () => {
    const r = await svc.resolve(A.vendorId);
    expect(r.mode).toBe('V3');
    expect(r.plan).toBe('handyman_free');
    expect(r.features['site.video'].state).toBe('LOCKED_PREVIEW');
    expect(r.features['site.pages']).toMatchObject({ state: 'LIMITED', limit: 1 });
    expect(await svc.renderEntitlements(A.vendorId)).toEqual({ video: false, cart: false, booking: false, customDomain: false });
  });

  it('a vendor with no subscription and the flag off is LEGACY; with the flag on it is UNASSIGNED', async () => {
    expect((await svc.resolve(C.vendorId)).mode).toBe('LEGACY');
    await prisma.v3VendorFlag.create({ data: { vendorId: C.vendorId, key: 'v3_plans', enabled: true } });
    svc.invalidate(C.vendorId);
    expect((await svc.resolve(C.vendorId)).mode).toBe('UNASSIGNED');
  });

  it('Professional Pro: booking is on, the cart is off; then the term ends and the vendor falls to Professional Free', async () => {
    const pro = await svc.renderEntitlements(B.vendorId);
    expect(pro.booking).toBe(true);
    expect(pro.cart).toBe(false);
    await prisma.v3PlanSubscription.updateMany({ where: { vendorId: B.vendorId }, data: { endsAt: new Date(Date.now() - 30 * DAY) } });
    svc.invalidate(B.vendorId);
    const r = await svc.resolve(B.vendorId);
    expect(r.subscriptionStatus).toBe('EXPIRED');
    expect(r.plan).toBe('professional_free');
    expect(r.features['site.video'].state).toBe('LOCKED_PREVIEW');
  });

  it('an override wins until it expires, and clearing the cache shows it at once', async () => {
    await prisma.v3EntitlementOverride.create({ data: { vendorId: A.vendorId, featureKey: 'site.video', state: 'ACTIVE', reason: 'integration test', createdByStaffId: 'test', expiresAt: new Date(Date.now() + DAY) } });
    svc.invalidate(A.vendorId);
    expect((await svc.resolve(A.vendorId)).features['site.video']).toMatchObject({ state: 'ACTIVE', source: 'OVERRIDE' });
    await prisma.v3EntitlementOverride.updateMany({ where: { vendorId: A.vendorId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    svc.invalidate(A.vendorId);
    expect((await svc.resolve(A.vendorId)).features['site.video'].state).toBe('LOCKED_PREVIEW');
  });

  it('at most one current subscription per vendor: the database refuses a second one', async () => {
    await expect(prisma.v3PlanSubscription.create({ data: { vendorId: A.vendorId, planId: await planId('handyman_pro'), source: 'STAFF', createdByType: 'STAFF', currentVendorId: A.vendorId } })).rejects.toThrow();
  });
});
