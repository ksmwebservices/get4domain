// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { forTenant } from '../src/common/tenant/for-tenant';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * S54.9 on STAGING: vendor A cannot build, preview, publish or roll back vendor B's site, every miss looks like an unknown id, a vendor token is refused on the staff
 * routes, and the tenant client confines the four site tables. Synthetic data only, removed at the end. NOT RUN in the build session that wrote it (no .env.staging there).
 */
describe('site tenant isolation on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let mkt: string;
  let pubB: string; let siteB: { host: string };
  const api = (method: 'get' | 'post' | 'put', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    mkt = await seedStaff(prisma, 'p54tmkt', RUN_ID, 'MARKETING');
    app = await buildProvisioningTestApp({ includeSiteApi: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p54ta', RUN_ID); B = await seedTenant(prisma, 'p54tb', RUN_ID);
    await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); siteB = await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
    const built = await api('post', '/v3/me/site/build', tokenB, {}); pubB = built.body.data.publication.id;
    await api('post', '/v3/me/site/publish', tokenB, { publicationId: pubB });
  }, 240000);

  afterAll(async () => { try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); } }, 180000);

  it('A cannot publish, roll back to, or preview B\'s publication: the same PUBLICATION_NOT_FOUND as an unknown id; nothing of B changes', async () => {
    const before = await prisma.v3SitePublication.findUniqueOrThrow({ where: { id: pubB } });
    const pub = await api('post', '/v3/me/site/publish', tokenA, { publicationId: pubB }); expect(pub.status).toBe(404); expect(pub.body.code).toBe('PUBLICATION_NOT_FOUND');
    expect((await api('post', '/v3/me/site/publish', tokenA, { publicationId: 'nope' })).body.code).toBe('PUBLICATION_NOT_FOUND');
    expect((await api('post', '/v3/me/site/rollback', tokenA, { toVersion: 1 })).status).toBe(404);   // A has no published version of its own
    const prev = await api('get', `/v3/me/site/preview/${pubB}/${encodeURIComponent('/')}`, tokenA); expect(prev.status).toBe(404); expect(prev.body.code).toBe('PUBLICATION_NOT_FOUND');
    expect(await prisma.v3SitePublication.findUniqueOrThrow({ where: { id: pubB } })).toEqual(before);
  });

  it('A\'s build only ever creates A\'s rows: there is no vendor id to send, and a vendorId in the body is refused', async () => {
    const r = await api('post', '/v3/me/site/build', tokenA, { vendorId: B.vendorId });
    expect(r.status).toBe(400);
    const ok = await api('post', '/v3/me/site/build', tokenA, {});
    expect(ok.status).toBe(200);
    expect(await prisma.v3SitePublication.count({ where: { vendorId: A.vendorId } })).toBe(1);
    expect(await prisma.v3SitePublication.count({ where: { vendorId: B.vendorId } })).toBe(1);
  });

  it('a vendor token (owner or team member) is refused on every staff site route', async () => {
    for (const t of [tokenA, A.memberToken]) {
      expect((await api('get', '/v3/admin/sites', t)).status).toBe(403);
      expect((await api('get', `/v3/admin/vendors/${B.vendorId}/site`, t)).status).toBe(403);
      expect((await api('post', `/v3/admin/vendors/${B.vendorId}/site/build`, t, {})).status).toBe(403);
      expect((await api('put', `/v3/admin/vendors/${B.vendorId}/site/noindex`, t, { forceNoindex: true })).status).toBe(403);
    }
    expect((await prisma.v3SiteSettings.findUnique({ where: { vendorId: B.vendorId } }))?.forceNoindex ?? false).toBe(false);
  });

  it('MARKETING sees summaries and never html', async () => {
    const one = await api('get', `/v3/admin/vendors/${B.vendorId}/site`, mkt);
    expect(one.status).toBe(200); expect(JSON.stringify(one.body)).not.toContain('<!doctype');
    expect((await api('get', `/v3/admin/vendors/${B.vendorId}/site/preview/${pubB}/${encodeURIComponent('/')}`, mkt)).status).toBe(403);
  });

  // B3.0b: the owner decided that a suspended vendor is NOT hidden (rule 9). This replaces the Batch 2 expectation of a 404 for a suspended vendor; it is a deliberate
  // owner-approved change, not a weakening. The only hide state is a removed business, which must look exactly like an unknown host.
  it('the public read serves a suspended vendor, and is one uniform 404 for an unknown host, a REMOVED business and an unpublished site', async () => {
    const get = (host: string) => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: '/' });
    const unknown = await get('nobody-p54.get4domain.com');
    expect(unknown.status).toBe(404);
    expect((await get(siteB.host)).status).toBe(200);
    await prisma.vendor.update({ where: { id: B.vendorId }, data: { status: 'SUSPENDED' } });
    const suspendedPage = await get(siteB.host);
    expect(suspendedPage.status).toBe(200);
    // slice 5.4b / 5.1d: the stored Pro page is served as a listing-only page while the vendor is suspended (entitlements are cached up to 30 s, so the engine cache is dropped first)
    app.get(EntitlementsService).invalidate(B.vendorId);
    const listing = await get(siteB.host);
    expect(listing.status).toBe(200);
    for (const re of [/<form\b/i, /<button\b/i, /href="tel:/i, /href="mailto:/i, /wa\.me/i, /href="\/(?:cart|book|enquire)/i]) expect(re.test(listing.text)).toBe(false);
    expect(listing.text).toContain('data-g4d-listed-on');
    await prisma.vendor.update({ where: { id: B.vendorId }, data: { status: 'ACTIVE' } });
    await prisma.v3SiteRemoval.create({ data: { vendorId: B.vendorId, kind: 'VENDOR_REQUEST', reason: 'synthetic test' } });
    try {
      const removed = await get(siteB.host);
      expect(removed.status).toBe(404); expect(removed.text).toBe(unknown.text);
    } finally { await prisma.v3SiteRemoval.deleteMany({ where: { vendorId: B.vendorId } }); }
    const subA = (await prisma.vendor.findUniqueOrThrow({ where: { id: A.vendorId } })).subdomain!;
    const unpublished = await get(`${subA}.get4domain.com`);
    expect(unpublished.status).toBe(404); expect(unpublished.text).toBe(unknown.text);
  });

  it('the tenant client for A sees only A\'s settings, publications, pages and events, and cannot read or write B\'s', async () => {
    const db = forTenant(prisma, A.vendorId);
    expect((await db.v3SitePublication.findMany()).every((p) => p.vendorId === A.vendorId)).toBe(true);
    expect((await db.v3SitePublicationPage.findMany({ take: 50 })).every((p) => p.vendorId === A.vendorId)).toBe(true);
    expect((await db.v3SiteEvent.findMany()).every((e) => e.vendorId === A.vendorId)).toBe(true);
    await expect(db.v3SitePublication.findMany({ where: { vendorId: B.vendorId } })).rejects.toThrow();
    expect(await db.v3SitePublication.findUnique({ where: { id: pubB } })).toBeNull();
    await expect(db.v3SitePublication.update({ where: { id: pubB }, data: { indexable: true } })).rejects.toThrow();
    await expect(db.v3SiteSettings.create({ data: { vendorId: B.vendorId } })).rejects.toThrow();
  });
});
