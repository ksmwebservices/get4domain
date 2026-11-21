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
import { WebsiteSettingsService } from '../src/v3-website/settings/website-settings.service';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice B4 on STAGING: testimonials over the real database. Nothing can be saved until staff set testimonialMaxCount; Pro saves words with consent and a first name; a full name, missing consent,
 * promises and ratings are refused; the live page shows the words with the owner label and no rating or review markup; Free cannot write; the staff projection holds the words and MARKETING cannot
 * read them; vendor B never sees vendor A's draft. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('testimonials on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let F: SeededTenant; let siteA: { vendorId: string; sub: string; host: string };
  let tokenA: string; let tokenB: string; let tokenF: string; let ops: string; let mkt: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string) => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: '/' });
  const item = (over: Record<string, unknown> = {}) => ({ name: 'Anita R.', text: 'V3TEST They explained the work before they started.', date: '2026-09', consent: true, ...over });
  const setCap = async (n: number | null) => { if (n === null) await prisma.v3PlanSetting.deleteMany({ where: { key: 'testimonialMaxCount' } }); else await prisma.v3PlanSetting.upsert({ where: { key: 'testimonialMaxCount' }, create: { key: 'testimonialMaxCount', valueJson: n }, update: { valueJson: n } }); app.get(WebsiteSettingsService).invalidate(); };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, activity: true, website: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p5b4a', RUN_ID); B = await seedTenant(prisma, 'p5b4b', RUN_ID); F = await seedTenant(prisma, 'p5b4f', RUN_ID);
    siteA = await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); tokenF = vendorToken(F.vendorId, F.email);
    ops = await seedStaff(prisma, 'p5b4ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p5b4mkt', RUN_ID, 'MARKETING');
  }, 240000);

  afterAll(async () => { await runCleanup([() => prisma.v3PlanSetting.deleteMany({ where: { key: 'testimonialMaxCount' } }), () => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('refused until the cap is set; then Pro saves, the rules hold, publish shows the words with the owner label and no rating markup, the staff projection holds them', async () => {
    await setCap(null); const off = await api('put', '/v3/me/site/draft/testimonials', tokenA, { items: [item()] }); expect(off.status).toBe(409); expect(off.body.code).toBe('TESTIMONIALS_NOT_CONFIGURED');
    await setCap(3);
    expect((await api('put', '/v3/me/site/draft/testimonials', tokenA, { items: [item({ name: 'Anita Rajan Kumar' })] })).body.code).toBe('NAME_NOT_ALLOWED'); expect((await api('put', '/v3/me/site/draft/testimonials', tokenA, { items: [item({ consent: false })] })).body.code).toBe('CONSENT_REQUIRED');
    expect((await api('put', '/v3/me/site/draft/testimonials', tokenA, { items: [item({ rating: 5 })] })).body.code).toBe('FIELD_LOCKED'); expect((await api('put', '/v3/me/site/draft/testimonials', tokenA, { items: [item({ text: 'We guarantee the number 1 ranking' })] })).status).toBe(422);
    expect((await api('put', '/v3/me/site/draft/testimonials', tokenA, { items: [item()] })).status).toBe(200);
    expect((await api('post', '/v3/me/site/draft/publish', tokenA, {})).body.data.mode).toBe('LIVE');
    const page = await byHost(siteA.host); expect(page.text).toContain('V3TEST They explained the work'); expect(page.text).toContain('Words shared by the business owner'); expect(page.text).not.toMatch(/aggregateRating|ratingValue|"@type":"Review"/);
    expect((await prisma.v3Testimonial.findMany({ where: { vendorId: A.vendorId } })).map((r) => r.name)).toEqual(['Anita R.']);
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/site/testimonials`, ops)).body.data).toHaveLength(1); expect((await api('get', `/v3/admin/vendors/${A.vendorId}/site/testimonials`, mkt)).status).toBe(403);
  });

  it('Free cannot write testimonials; vendor B never sees vendor A\'s draft', async () => {
    const free = await api('put', '/v3/me/site/draft/testimonials', tokenF, { items: [item()] }); expect(free.status).toBe(403); expect(free.body.code).toBe('FEATURE_LOCKED');
    expect((await api('get', '/v3/me/site/testimonials', tokenB)).body.data.items).toEqual([]); expect(await prisma.v3Testimonial.count({ where: { vendorId: B.vendorId } })).toBe(0);
  });
});
