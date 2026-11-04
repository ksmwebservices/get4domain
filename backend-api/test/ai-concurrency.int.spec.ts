// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/** B2 slice 5.11 on STAGING: with the real per-vendor advisory lock, parallel requests cannot overspend the month's credits and one idempotency key is one charge. Mock model only. NOT RUN in the build session (no .env.staging there). */
jest.setTimeout(180_000);
const GOOD = { section: 'tagline', businessName: 'V3TEST Plumbing', category: 'plumber', keyPoints: 'fast and tidy' };

describe('AI credits under concurrency on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let token: string; let prevLive: { existed: boolean; value: unknown } = { existed: false, value: null };
  const gen = (k: string) => request(app.getHttpServer()).post('/v3/me/ai/generate').set('Authorization', `Bearer ${token}`).send({ feature: 'site_copy', input: GOOD, idempotencyKey: k });

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    const before = await prisma.v3PlanSetting.findUnique({ where: { key: 'aiLiveCalls' } }); prevLive = { existed: !!before, value: before?.valueJson ?? null };
    await prisma.v3PlanSetting.upsert({ where: { key: 'aiLiveCalls' }, create: { key: 'aiLiveCalls', valueJson: false, description: 'v3test' }, update: { valueJson: false } });
    app = await buildProvisioningTestApp({ includeAiApi: true });
    A = await seedTenant(prisma, 'p511ca', RUN_ID); await makeSiteVendor(prisma, app.get(SubscriptionsService), A, RUN_ID, {}); token = vendorToken(A.vendorId, A.email);
  }, 240000);

  afterAll(async () => {
    await runCleanup([
      async () => { if (prevLive.existed) await prisma.v3PlanSetting.update({ where: { key: 'aiLiveCalls' }, data: { valueJson: prevLive.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key: 'aiLiveCalls' } }); },
      () => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect(),
    ]);
  }, 180000);

  it('the same key sent six times at once: one usage row, one charge', async () => {
    const k = `v3test-${RUN_ID}-aic-1`; const rs = await Promise.all(Array.from({ length: 6 }, () => gen(k)));
    expect(rs.some((r) => r.status === 200)).toBe(true); expect(rs.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect(await prisma.v3AiUsage.count({ where: { vendorId: A.vendorId, idempotencyKey: k } })).toBe(1);
  });

  it('many different requests at once: the credits kept never pass the plan\'s limit plus grants, and the rest are LIMIT_REACHED (never a server error)', async () => {
    const used0 = (await prisma.v3AiUsage.aggregate({ where: { vendorId: A.vendorId, status: { in: ['RESERVED', 'DONE'] } }, _sum: { credits: true } }))._sum.credits ?? 0;
    const u = await request(app.getHttpServer()).get('/v3/me/ai/usage').set('Authorization', `Bearer ${token}`); const left = (u.body.data.remaining as number | null) ?? 0;
    const n = left + 8; const rs = await Promise.all(Array.from({ length: n }, (_, i) => gen(`v3test-${RUN_ID}-aic-b${i}`)));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(left); expect(rs.filter((r) => r.status === 403 && r.body.code === 'LIMIT_REACHED')).toHaveLength(n - left); expect(rs.some((r) => r.status >= 500)).toBe(false);
    const used1 = (await prisma.v3AiUsage.aggregate({ where: { vendorId: A.vendorId, status: { in: ['RESERVED', 'DONE'] } }, _sum: { credits: true } }))._sum.credits ?? 0;
    expect(used1).toBe(used0 + left);
  });
});
