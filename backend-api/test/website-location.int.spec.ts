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
 * Slice B2 on STAGING: location and directions over the real database. The directions link is built (no key, no network); a short link is refused; a Pro page shows the address and the directions
 * link; a Free page shows the address as plain text with no link; the staff projection holds the live location and MARKETING cannot read it; vendor B cannot see vendor A's draft. Synthetic data
 * only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('location and directions on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let F: SeededTenant; let siteA: { vendorId: string; sub: string; host: string }; let siteF: { vendorId: string; sub: string; host: string };
  let tokenA: string; let tokenB: string; let tokenF: string; let ops: string; let mkt: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string, p = '/contact') => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: p });
  const LOC = { addressLine1: 'V3TEST 12 Kamaraj Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', latitude: 13.0827, longitude: 80.2707 };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, activity: true, website: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p5b2a', RUN_ID); B = await seedTenant(prisma, 'p5b2b', RUN_ID); F = await seedTenant(prisma, 'p5b2f', RUN_ID);
    siteA = await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true }); siteF = await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); tokenF = vendorToken(F.vendorId, F.email);
    ops = await seedStaff(prisma, 'p5b2ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p5b2mkt', RUN_ID, 'MARKETING');
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('Pro: the location is saved, a short link is refused, publish shows the address and the built directions link, the staff projection holds it', async () => {
    expect((await api('put', '/v3/me/site/draft/location', tokenA, { ...LOC, mapLinkInput: 'https://maps.app.goo.gl/abc' })).body.code).toBe('SHORT_LINK_NOT_EXPANDED');
    expect((await api('put', '/v3/me/site/draft/location', tokenA, { ...LOC, pincode: '12' })).body.code).toBe('FIELD_INVALID');
    expect((await api('put', '/v3/me/site/draft/location', tokenA, LOC)).status).toBe(200);
    const v = await api('get', '/v3/me/site/location', tokenA); expect(v.body.data.directionsUrl).toBe('https://www.google.com/maps/search/?api=1&query=13.0827,80.2707');
    expect((await api('get', `/v3/me/site/location/parse?url=${encodeURIComponent('https://www.google.com/maps/@9.9252,78.1198,15z')}`, tokenA)).body.data).toMatchObject({ ok: true, coords: { latitude: 9.9252, longitude: 78.1198 } });
    expect((await api('post', '/v3/me/site/draft/publish', tokenA, {})).body.data.mode).toBe('LIVE');
    const page = await byHost(siteA.host); expect(page.text).toContain('V3TEST 12 Kamaraj Road'); expect(page.text).toContain('google.com/maps/search/?api=1&amp;query=13.0827,80.2707');
    expect(await prisma.v3SiteLocation.findUnique({ where: { vendorId: A.vendorId } })).toMatchObject({ city: 'Chennai', pincode: '600040', directionsUrl: 'https://www.google.com/maps/search/?api=1&query=13.0827,80.2707' });
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/site/location`, ops)).body.data).toMatchObject({ city: 'Chennai' }); expect((await api('get', `/v3/admin/vendors/${A.vendorId}/site/location`, mkt)).status).toBe(403);
  });

  it('Free: the address is plain text with no directions link once staff approve; vendor B never sees A\'s draft', async () => {
    expect((await api('put', '/v3/me/site/draft/location', tokenF, LOC)).status).toBe(200);
    const s = await api('post', '/v3/me/site/draft/publish', tokenF, {}); expect(s.body.data.mode).toBe('SUBMITTED');
    expect((await api('post', `/v3/admin/content-reviews/${s.body.data.submission.id}/approve`, ops)).status).toBe(200);
    const page = await byHost(siteF.host); expect(page.text).toContain('V3TEST 12 Kamaraj Road'); expect(page.text).not.toContain('google.com/maps');
    expect((await api('get', '/v3/me/site/location', tokenB)).body.data.location).toEqual({}); expect(await prisma.v3SiteLocation.count({ where: { vendorId: B.vendorId } })).toBe(0);
  });
});
