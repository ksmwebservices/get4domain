// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice B3 on STAGING: the Google review link over the real database. Pro saves a link on an allowed host (others are refused), publishes, and the live page carries the kit's Write a review
 * button; Free cannot write the link; the staff projection holds the live link and MARKETING cannot read it; vendor B never sees vendor A's draft. Nothing is sent to Google. Synthetic data
 * only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('the Google review link on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let F: SeededTenant; let siteA: { vendorId: string; sub: string; host: string };
  let tokenA: string; let tokenB: string; let tokenF: string; let ops: string; let mkt: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string) => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: '/' });
  const URL1 = 'https://g.page/r/V3TESTabc/review';

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, activity: true, website: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p5b3a', RUN_ID); B = await seedTenant(prisma, 'p5b3b', RUN_ID); F = await seedTenant(prisma, 'p5b3f', RUN_ID);
    siteA = await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); tokenF = vendorToken(F.vendorId, F.email);
    ops = await seedStaff(prisma, 'p5b3ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p5b3mkt', RUN_ID, 'MARKETING');
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('Pro: an allowed link is saved, others are refused, publish puts the button on the page, the staff projection holds it; Free cannot write it', async () => {
    const bad = await api('put', '/v3/me/site/draft/review-link', tokenA, { url: 'https://evil.example.test/x' }); expect(bad.status).toBe(400); expect(bad.body.code).toBe('REVIEW_HOST_NOT_ALLOWED');
    expect((await api('put', '/v3/me/site/draft/review-link', tokenA, { url: URL1 })).status).toBe(200);
    expect((await api('get', '/v3/me/site/review-link', tokenA)).body.data).toEqual({ url: URL1, pro: true });
    expect((await api('post', '/v3/me/site/draft/publish', tokenA, {})).body.data.mode).toBe('LIVE');
    const page = await byHost(siteA.host); expect(page.text).toContain(`href="${URL1}"`); expect(page.text).toContain('g4d-reviews__write');
    expect(await prisma.v3ReviewLink.findUnique({ where: { vendorId: A.vendorId } })).toMatchObject({ url: URL1, host: 'g.page' });
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/site/review-link`, ops)).body.data).toMatchObject({ host: 'g.page' }); expect((await api('get', `/v3/admin/vendors/${A.vendorId}/site/review-link`, mkt)).status).toBe(403);
    const free = await api('put', '/v3/me/site/draft/review-link', tokenF, { url: URL1 }); expect(free.status).toBe(403); expect(free.body.code).toBe('FEATURE_LOCKED');
    expect((await api('get', '/v3/me/site/review-link', tokenB)).body.data.url).toBe(''); expect(await prisma.v3ReviewLink.count({ where: { vendorId: B.vendorId } })).toBe(0);
  });
});
