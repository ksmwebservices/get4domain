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
 * S51.6 against the STAGING database: the real admin controllers behind the real AdminGuard and role matrix. SUPER_ADMIN writes, OPERATIONS reads only,
 * MARKETING is refused, every write leaves an audit row, a stale write is refused. Synthetic staff and vendors (@v3test.invalid) are removed at the end.
 * NOT RUN in the build session that wrote it (no .env.staging there).
 */
describe('plans admin API on staging', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let V: SeededTenant;
  let sup: string; let ops: string; let mkt: string;
  let proId: string; let freeId: string;
  const createdPrices: string[] = [];
  const staffIds: string[] = [];
  const FUTURE = new Date(Date.now() + 400 * 86_400_000).toISOString();

  const call = (token: string, method: 'get' | 'post' | 'put' | 'delete', url: string, body?: Record<string, unknown>) => {
    const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const data = (res: { body: { data?: unknown } }): Record<string, unknown> => (res.body.data ?? res.body) as Record<string, unknown>;
  const staffId = (token: string): string => String((new JwtService().decode(token) as { sub: string }).sub);

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    app = await buildPlansTestApp();
    sup = await seedStaff(prisma, 'p51sup', RUN_ID, 'SUPER_ADMIN');
    ops = await seedStaff(prisma, 'p51ops', RUN_ID, 'OPERATIONS');
    mkt = await seedStaff(prisma, 'p51mkt', RUN_ID, 'MARKETING');
    staffIds.push(staffId(sup), staffId(ops), staffId(mkt));
    V = await seedTenant(prisma, 'p51v', RUN_ID);
    proId = (await prisma.v3Plan.findUniqueOrThrow({ where: { key: 'handyman_pro' } })).id;
    freeId = (await prisma.v3Plan.findUniqueOrThrow({ where: { key: 'handyman_free' } })).id;
  }, 180000);

  afterAll(async () => {
    await runCleanup([   // every step runs even if an earlier one (or a failed assertion upstream) threw
      () => prisma.v3PlanPrice.deleteMany({ where: { id: { in: createdPrices } } }),
      () => prisma.v3AuditLog.deleteMany({ where: { OR: [{ actorId: { in: staffIds } }, { entityId: V?.vendorId }] } }),
      () => cleanupTenants(prisma, RUN_ID),
      () => app?.close(), () => prisma?.$disconnect(),
    ]);
  }, 120000);

  it('roles: MARKETING is refused everywhere, OPERATIONS reads but cannot write, SUPER_ADMIN does both', async () => {
    expect((await call(mkt, 'get', '/v3/admin/plans')).status).toBe(403);
    expect((await call(ops, 'get', '/v3/admin/plans')).status).toBe(200);
    expect((await call(ops, 'get', `/v3/admin/vendors/${V.vendorId}/entitlements`)).status).toBe(200);
    const plan = data(await call(sup, 'get', `/v3/admin/plans/${proId}`));
    const put = { expectedUpdatedAt: plan.updatedAt, name: String(plan.name) };
    expect((await call(ops, 'put', `/v3/admin/plans/${proId}`, put)).status).toBe(403);
    expect((await call(mkt, 'put', `/v3/admin/plans/${proId}`, put)).status).toBe(403);
    expect((await call(ops, 'post', '/v3/admin/tax-rates', { name: 'x', ratePercent: 1 })).status).toBe(403);
    expect((await call(sup, 'put', `/v3/admin/plans/${proId}`, put)).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/v3/admin/plans')).status).toBe(401);
    expect((await call(V.token, 'get', '/v3/admin/plans')).status).toBe(403);   // a vendor is not staff
  });

  it('price rules return the stable codes; a valid price is created, audited, and a stale edit is refused', async () => {
    const bad = (body: Record<string, unknown>, id = proId) => call(sup, 'post', `/v3/admin/plans/${id}/prices`, body);
    const r1 = await bad({ termMonths: 3, amountPaise: -1, effectiveFrom: FUTURE });
    expect([r1.status, r1.body.code]).toEqual([400, 'INVALID_AMOUNT']);
    const r2 = await bad({ termMonths: 5, amountPaise: 100, effectiveFrom: FUTURE });
    expect([r2.status, r2.body.code]).toEqual([400, 'INVALID_TERM']);
    const r3 = await bad({ termMonths: 3, amountPaise: 100, effectiveFrom: FUTURE }, freeId);
    expect([r3.status, r3.body.code]).toEqual([400, 'FREE_PLAN_HAS_NO_PRICE']);
    const ok = await bad({ termMonths: 3, amountPaise: 123400, effectiveFrom: FUTURE });
    expect(ok.status).toBe(201);
    const price = data(ok);
    createdPrices.push(String(price.id));
    const audit = await prisma.v3AuditLog.findFirst({ where: { entityType: 'price', entityId: String(price.id), action: 'price.create' } });
    expect(audit).toMatchObject({ actorType: 'STAFF', actorId: staffId(sup) });
    const edit = await call(sup, 'put', `/v3/admin/prices/${price.id}`, { expectedUpdatedAt: price.updatedAt, amountPaise: 124500 });
    expect(edit.status).toBe(200);
    const stale = await call(sup, 'put', `/v3/admin/prices/${price.id}`, { expectedUpdatedAt: price.updatedAt, amountPaise: 999 });
    expect([stale.status, stale.body.code]).toEqual([409, 'STALE_WRITE']);
    expect((await prisma.v3PlanPrice.findUniqueOrThrow({ where: { id: String(price.id) } })).amountPaise).toBe(124500);
  });

  it('assigning a plan needs a reason, closes the previous one, keeps a price copy, and the entitlements view says why', async () => {
    const noReason = await call(sup, 'post', `/v3/admin/vendors/${V.vendorId}/subscription`, { planKey: 'handyman_free', reason: '' });
    expect([noReason.status, noReason.body.code]).toEqual([400, 'REASON_REQUIRED']);
    expect((await call(sup, 'post', `/v3/admin/vendors/${V.vendorId}/subscription`, { planKey: 'handyman_free', reason: 'integration test' })).status).toBe(201);
    expect((await call(sup, 'post', `/v3/admin/vendors/${V.vendorId}/subscription`, { planKey: 'handyman_pro', termMonths: 6, reason: 'integration test upgrade' })).status).toBe(201);
    const sub = data(await call(ops, 'get', `/v3/admin/vendors/${V.vendorId}/subscription`));
    expect((sub.history as unknown[]).length).toBe(2);
    expect((sub.current as { plan: { key: string } }).plan.key).toBe('handyman_pro');
    const ent = data(await call(ops, 'get', `/v3/admin/vendors/${V.vendorId}/entitlements`)) as { plan: string; features: Record<string, { state: string; why: { source: string } }> };
    expect(ent.plan).toBe('handyman_pro');
    expect(ent.features['site.video']).toMatchObject({ state: 'ACTIVE', why: { source: 'PLAN' } });
    expect(await prisma.v3PlanSubscription.count({ where: { vendorId: V.vendorId, currentVendorId: V.vendorId } })).toBe(1);
  });

  it('an override needs a reason, wins over the plan, shows as OVERRIDE, and DELETE expires it without erasing it', async () => {
    const r = await call(sup, 'post', `/v3/admin/vendors/${V.vendorId}/overrides`, { featureShould: 'x' });
    expect(r.status).toBe(400);
    const made = await call(sup, 'post', `/v3/admin/vendors/${V.vendorId}/overrides`, { featureKey: 'site.pages', state: 'LIMITED', limitValue: 99, reason: 'integration test' });
    expect(made.status).toBe(201);
    const o = data(made);
    const view = data(await call(ops, 'get', `/v3/admin/vendors/${V.vendorId}/entitlements`)) as { features: Record<string, { limit: number; why: { source: string; overrideReason: string } }> };
    expect(view.features['site.pages']).toMatchObject({ limit: 99, why: { source: 'OVERRIDE', overrideReason: 'integration test' } });
    expect((await call(sup, 'delete', `/v3/admin/overrides/${o.id}`)).status).toBe(200);
    expect(await prisma.v3EntitlementOverride.count({ where: { id: String(o.id) } })).toBe(1);
    const after = data(await call(ops, 'get', `/v3/admin/vendors/${V.vendorId}/entitlements`)) as { features: Record<string, { limit: number }> };
    expect(after.features['site.pages'].limit).toBe(24);
  });
});
