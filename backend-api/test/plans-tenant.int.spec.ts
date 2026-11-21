// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { runCleanup } from './support/cleanup-guard';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant } from './support/fixtures';
import { buildPlansTestApp } from './support/plans-test-app';

/**
 * S51.9 on STAGING: vendor A cannot read or change vendor B's subscription, events, overrides or entitlements through any vendor route; a team member
 * cannot read billing information; staff are not vendors; and two staff editing the same plan cannot both win. Synthetic data only, removed at the end.
 * NOT RUN in the build session that wrote it (no .env.staging there).
 */
describe('plans: tenant isolation and concurrency (staging database)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let A: SeededTenant; let B: SeededTenant;
  let sup: string;
  const staffIds: string[] = [];
  const MARK_A = `AMARK-${RUN_ID}`;
  const MARK_B = `BMARK-${RUN_ID}`;

  const get = (token: string | undefined, url: string) => {
    const r = request(app.getHttpServer()).get(url);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  const data = (res: { body: { data?: unknown } }): Record<string, unknown> => (res.body.data ?? res.body) as Record<string, unknown>;
  const planId = async (key: string): Promise<string> => (await prisma.v3Plan.findUniqueOrThrow({ where: { key } })).id;

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    app = await buildPlansTestApp();
    sup = await seedStaff(prisma, 'p51tsup', RUN_ID, 'SUPER_ADMIN');
    staffIds.push(String((new JwtService().decode(sup) as { sub: string }).sub));
    A = await seedTenant(prisma, 'p51ta', RUN_ID);
    B = await seedTenant(prisma, 'p51tb', RUN_ID);
    const fa = await planId('handyman_free');
    const pb = await planId('professional_pro');
    const subA = await prisma.v3PlanSubscription.create({ data: { vendorId: A.vendorId, planId: fa, source: 'STAFF', createdByType: 'STAFF', currentVendorId: A.vendorId } });
    const subB = await prisma.v3PlanSubscription.create({
      data: { vendorId: B.vendorId, planId: pb, termMonths: 6, source: 'STAFF', createdByType: 'STAFF', currentVendorId: B.vendorId, endsAt: new Date(Date.now() + 100 * 86_400_000), priceSnapshotJson: { amountPaise: 539500, currency: 'INR', note: MARK_B } },
    });
    await prisma.v3SubscriptionEvent.create({ data: { subscriptionId: subA.id, vendorId: A.vendorId, type: 'ASSIGNED', toPlanId: fa, reason: MARK_A, actorType: 'STAFF' } });
    await prisma.v3SubscriptionEvent.create({ data: { subscriptionId: subB.id, vendorId: B.vendorId, type: 'ASSIGNED', toPlanId: pb, reason: MARK_B, actorType: 'STAFF' } });
    await prisma.v3EntitlementOverride.create({ data: { vendorId: B.vendorId, featureKey: 'site.pages', state: 'LIMITED', limitValue: 77, reason: MARK_B, createdByStaffId: 'test' } });
  }, 180000);

  afterAll(async () => {
    await runCleanup([
      () => prisma.v3AuditLog.deleteMany({ where: { OR: [{ actorId: { in: staffIds } }, { entityId: { in: [A?.vendorId, B?.vendorId].filter(Boolean) as string[] } }] } }),
      () => cleanupTenants(prisma, RUN_ID),
      () => app?.close(), () => prisma?.$disconnect(),
    ]);
  }, 120000);

  it('each vendor sees only its own entitlements, subscription and events', async () => {
    const a = data(await get(A.token, '/v3/me/entitlements'));
    expect(a.plan).toBe('handyman_free');
    const subA = data(await get(A.token, '/v3/me/subscription')) as { plan: { key: string } };
    expect(subA.plan.key).toBe('handyman_free');
    const evA = JSON.stringify((await get(A.token, '/v3/me/subscription/events')).body);
    expect(evA).toContain(MARK_A);
    expect(evA).not.toContain(MARK_B);
    const subB = data(await get(B.token, '/v3/me/subscription')) as { plan: { key: string } };
    expect(subB.plan.key).toBe('professional_pro');
    const everythingA = JSON.stringify([a, subA, evA]);
    expect(everythingA).not.toContain(MARK_B);
    expect(everythingA).not.toContain('539500');
  });

  it('a vendor id in the query or path changes nothing: the caller is always the verified principal\'s vendor', async () => {
    const sneaky = await get(A.token, `/v3/me/subscription?vendorId=${B.vendorId}`);
    expect(JSON.stringify(sneaky.body)).not.toContain('professional_pro');
    const events = await get(A.token, `/v3/me/subscription/events?vendorId=${B.vendorId}`);
    expect(JSON.stringify(events.body)).not.toContain(MARK_B);
    const limit = (data(await get(A.token, '/v3/me/entitlements')).features as Record<string, { limit: number | null }>)['site.pages'].limit;
    expect(limit).toBe(1);   // B's override (77) never reaches A
  });

  it('A cannot reach any staff route about B', async () => {
    for (const url of [`/v3/admin/vendors/${B.vendorId}/subscription`, `/v3/admin/vendors/${B.vendorId}/overrides`, `/v3/admin/vendors/${B.vendorId}/entitlements`, '/v3/admin/audit-logs']) {
      expect((await get(A.token, url)).status).toBe(403);
    }
    expect((await get(undefined, '/v3/me/entitlements')).status).toBe(401);
  });

  it('a team member of A reads entitlements but not billing information; staff are not vendors', async () => {
    expect((await get(A.memberToken, '/v3/me/entitlements')).status).toBe(200);
    expect((await get(A.memberToken, '/v3/me/subscription')).status).toBe(403);
    expect((await get(A.memberToken, '/v3/me/subscription/events')).status).toBe(403);
    expect((await get(sup, '/v3/me/entitlements')).status).toBe(403);
  });

  it('the public comparison needs no login and shows nothing internal', async () => {
    const res = await get(undefined, '/v3/plans');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/"id"|currentVendorId|createdByStaffId|valueJson|AMARK|BMARK/);
    expect((data(res).plans as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it('two staff editing the same plan at once: one wins (200), the other is refused (409 STALE_WRITE), and the audit trail has exactly one entry', async () => {
    const id = await planId('ecommerce_free');
    const plan = data(await request(app.getHttpServer()).get(`/v3/admin/plans/${id}`).set('Authorization', `Bearer ${sup}`));
    const before = await prisma.v3AuditLog.count({ where: { entityType: 'plan', entityId: id, action: 'plan.update' } });
    const put = (name: string) => request(app.getHttpServer()).put(`/v3/admin/plans/${id}`).set('Authorization', `Bearer ${sup}`).send({ expectedUpdatedAt: plan.updatedAt, name });
    const [r1, r2] = await Promise.all([put('Ecommerce Free A'), put('Ecommerce Free B')]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const loser = r1.status === 409 ? r1 : r2;
    expect(loser.body.code).toBe('STALE_WRITE');
    const after = await prisma.v3AuditLog.count({ where: { entityType: 'plan', entityId: id, action: 'plan.update' } });
    expect(after - before).toBe(1);
    const final = await prisma.v3Plan.findUniqueOrThrow({ where: { id } });
    expect(final.name).toBe(r1.status === 200 ? 'Ecommerce Free A' : 'Ecommerce Free B');
    await request(app.getHttpServer()).put(`/v3/admin/plans/${id}`).set('Authorization', `Bearer ${sup}`).send({ expectedUpdatedAt: final.updatedAt.toISOString(), name: String(plan.name) });   // put the name back
  });
});
