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
import { cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken, SeededTenant } from './support/fixtures';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor, markClaimed, siteHost } from './support/site-staging';

/**
 * S54.9 on STAGING: the whole path with the real database and providers. A provisioned business gets a DRAFT_PREVIEW and nothing is published; a vendor with
 * a complete draft builds, publishes and is read back by host; an unclaimed site is noindex until claimed; rollback restores an older snapshot as a new version.
 * Synthetic data only, removed at the end (the plan setting this test turns on is put back). NOT RUN in the build session that wrote it (no .env.staging there).
 */
describe('site renderer and publish on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let ops: string; let mkt: string; let subs: SubscriptionsService;
  let A: SeededTenant; let siteA: { vendorId: string; sub: string; host: string }; let tokenA: string;
  let previousMode: { existed: boolean; value: unknown } = { existed: false, value: null };
  const api = (method: 'get' | 'post' | 'put', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string, p = '/') => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: p });

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    ops = await seedStaff(prisma, 'p54ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p54mkt', RUN_ID, 'MARKETING');
    app = await buildProvisioningTestApp({ includeSiteApi: true });
    subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p54a', RUN_ID);
    siteA = await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true });
    tokenA = vendorToken(A.vendorId, A.email);
    const before = await prisma.v3PlanSetting.findUnique({ where: { key: 'siteDraftBuilderMode' } });
    previousMode = { existed: !!before, value: before?.valueJson ?? null };
    await prisma.v3PlanSetting.upsert({ where: { key: 'siteDraftBuilderMode' }, create: { key: 'siteDraftBuilderMode', valueJson: 'renderer', description: 'v3test' }, update: { valueJson: 'renderer' } });
  }, 240000);

  afterAll(async () => {
    try {
      if (previousMode.existed) await prisma.v3PlanSetting.update({ where: { key: 'siteDraftBuilderMode' }, data: { valueJson: previousMode.value as never } });
      else await prisma.v3PlanSetting.deleteMany({ where: { key: 'siteDraftBuilderMode' } });
      await cleanupTenants(prisma, RUN_ID);
    } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 180000);

  it('renderer mode: a provisioned business gets site settings with the default theme and a DRAFT_PREVIEW, nothing PUBLISHED, nothing public', async () => {
    const email = `p54prov-${RUN_ID}@v3test.invalid`;
    const created = await api('post', '/v3/admin/provisioning/jobs', ops, { businessName: `V3TEST p54prov ${RUN_ID}`, track: 'handyman', category: 'plumber', ownerName: 'V3TEST Owner', phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, email, city: 'Chennai', language: 'en' }).set('Idempotency-Key', `v3test-${RUN_ID}-site-1`);
    expect(created.status).toBe(201);
    const ran = await api('post', `/v3/admin/provisioning/jobs/${created.body.data.id}/run`, ops);
    expect(ran.body.data.status).toBe('SUCCEEDED');
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { email } });
    expect(await prisma.v3SiteSettings.findUniqueOrThrow({ where: { vendorId: vendor.id } })).toMatchObject({ themeId: 'free-service-pro', language: 'en' });
    const pubs = await prisma.v3SitePublication.findMany({ where: { vendorId: vendor.id } });
    expect(pubs.map((p) => p.status)).toEqual(['DRAFT_PREVIEW']);
    expect(pubs[0]).toMatchObject({ indexable: false, createdByType: 'SYSTEM' });
    expect((await byHost(siteHost(vendor.subdomain!))).status).toBe(404);   // a preview is never public
    expect(await prisma.vendorCMS.findUniqueOrThrow({ where: { vendorId: vendor.id } })).toMatchObject({ siteStatus: 'DRAFT' });
  });

  it('build -> publish -> fetched by host; an unclaimed site is noindex in the page and the header, with an empty sitemap', async () => {
    const b = await api('post', '/v3/me/site/build', tokenA, {});
    expect(b.status).toBe(200); expect(b.body.data.publication).toMatchObject({ version: 1, status: 'DRAFT_PREVIEW', indexable: false });
    const pre = await api('get', `/v3/me/site/preview/${b.body.data.publication.id}/${encodeURIComponent('/')}`, tokenA);
    expect(pre.status).toBe(200); expect(pre.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
    expect((await byHost(siteA.host)).status).toBe(404);
    expect((await api('post', '/v3/me/site/publish', tokenA, { publicationId: b.body.data.publication.id })).status).toBe(200);
    const page = await byHost(siteA.host);
    expect(page.status).toBe(200); expect(page.headers['x-robots-tag']).toBe('noindex, nofollow'); expect(page.headers.etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(page.text).toContain(`<link rel="canonical" href="https://${siteA.host}/">`);
    expect((await byHost(siteA.host, '/sitemap.xml')).text).not.toContain('<url>');
    expect((await api('get', '/v3/me/site', tokenA)).body.data.missing.map((m: { code: string }) => m.code)).toEqual(['CLAIMED', 'VERIFIED_CONTACT']);
  });

  it('after the owner claims, the next build is indexable and, once published, says so in the page, the header and the sitemap', async () => {
    await markClaimed(prisma, A.vendorId);
    const b = await api('post', '/v3/me/site/build', tokenA, {});
    expect(b.body.data.publication).toMatchObject({ version: 2, indexable: true });
    await api('post', '/v3/me/site/publish', tokenA, { publicationId: b.body.data.publication.id });
    const page = await byHost(siteA.host);
    expect(page.headers['x-robots-tag']).toBe('index, follow, max-image-preview:large'); expect(page.text).toContain('content="index, follow, max-image-preview:large"');
    expect((await byHost(siteA.host, '/sitemap.xml')).text).toContain(`<loc>https://${siteA.host}/about</loc>`);
    expect((await byHost(siteA.host, '/robots.txt')).text).toContain(`Sitemap: https://${siteA.host}/sitemap.xml`);
  });

  it('rollback (Pro) restores an older snapshot as a NEW version with its lineage, and the public site serves it', async () => {
    const v1 = await prisma.v3SitePublication.findUniqueOrThrow({ where: { vendorId_version: { vendorId: A.vendorId, version: 1 } } });
    const v1Home = await prisma.v3SitePublicationPage.findUniqueOrThrow({ where: { publicationId_path_lang: { publicationId: v1.id, path: '/', lang: 'en' } } });
    const r = await api('post', '/v3/me/site/rollback', tokenA, { toVersion: 1 });
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ version: 3, status: 'PUBLISHED', rolledBackFromVersion: 1 });
    expect((await byHost(siteA.host)).headers.etag).toBe(`"${v1Home.sha256}"`);
    const published = await prisma.v3SitePublication.findMany({ where: { vendorId: A.vendorId, status: 'PUBLISHED' } });
    expect(published).toHaveLength(1); expect(published[0].currentVendorId).toBe(A.vendorId);
    const events = await prisma.v3SiteEvent.findMany({ where: { vendorId: A.vendorId }, orderBy: { createdAt: 'asc' } });
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['BUILT', 'PUBLISHED', 'ROLLED_BACK']));
    const audit = await prisma.v3AuditLog.findMany({ where: { entityId: A.vendorId, entityType: 'site' } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['site.build', 'site.publish', 'site.rollback']));
  });

  it('staff: MARKETING reads summaries but never html; OPERATIONS previews html; the noindex switch republishes a noindex version', async () => {
    const list = await api('get', '/v3/admin/sites', mkt);
    expect(list.status).toBe(200); expect(JSON.stringify(list.body)).not.toContain('<!doctype');
    const pub = await prisma.v3SitePublication.findFirstOrThrow({ where: { vendorId: A.vendorId, status: 'PUBLISHED' } });
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/site/preview/${pub.id}/${encodeURIComponent('/')}`, mkt)).status).toBe(403);
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/site/preview/${pub.id}/${encodeURIComponent('/')}`, ops)).status).toBe(200);
    const off = await api('put', `/v3/admin/vendors/${A.vendorId}/site/noindex`, ops, { forceNoindex: true });
    expect(off.body.data.published).toMatchObject({ indexable: false });
    expect((await byHost(siteA.host)).headers['x-robots-tag']).toBe('noindex, nofollow');
    await api('put', `/v3/admin/vendors/${A.vendorId}/site/noindex`, ops, { forceNoindex: false });
    expect((await byHost(siteA.host)).headers['x-robots-tag']).toBe('index, follow, max-image-preview:large');
  });
});
