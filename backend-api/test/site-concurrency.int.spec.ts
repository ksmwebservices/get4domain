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
import { SeededTenant, cleanupTenants, newPrisma, seedTenant, vendorToken } from './support/fixtures';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * S54.9 on STAGING: with the real advisory lock and the real unique rule, overlapping publishes leave exactly one PUBLISHED row, overlapping builds get
 * distinct monotonic versions, and a publish racing a rollback also ends with one PUBLISHED. Synthetic data only, removed at the end. NOT RUN in the build session
 * that wrote it (no .env.staging there).
 */
describe('site concurrency on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let T: SeededTenant; let token: string;
  const api = (method: 'get' | 'post', url: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const build = async (tagline: string): Promise<string> => {
    await prisma.vendorCMS.update({ where: { vendorId: T.vendorId }, data: { tagline } });
    const r = await api('post', '/v3/me/site/build', {});
    expect(r.status).toBe(200);
    return r.body.data.publication.id as string;
  };

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true });
    T = await seedTenant(prisma, 'p54c', RUN_ID);
    await makeSiteVendor(prisma, app.get(SubscriptionsService), T, RUN_ID, { pro: true });
    token = vendorToken(T.vendorId, T.email);
  }, 240000);

  afterAll(async () => { try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); } }, 180000);

  it('two different previews published at once: both calls succeed, exactly one row is PUBLISHED, the other is SUPERSEDED', async () => {
    const a = await build('Concurrent tagline one.'); const b = await build('Concurrent tagline two.');
    const [ra, rb] = await Promise.all([api('post', '/v3/me/site/publish', { publicationId: a }), api('post', '/v3/me/site/publish', { publicationId: b })]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    const rows = await prisma.v3SitePublication.findMany({ where: { vendorId: T.vendorId } });
    expect(rows.filter((r) => r.status === 'PUBLISHED')).toHaveLength(1);
    expect(rows.filter((r) => r.currentVendorId === T.vendorId)).toHaveLength(1);
    expect(rows.filter((r) => r.id === a || r.id === b).map((r) => r.status).sort()).toEqual(['PUBLISHED', 'SUPERSEDED']);
  });

  it('the same preview published twice at once is fine and still leaves one PUBLISHED', async () => {
    const id = await build('Concurrent tagline three.');
    const [x, y] = await Promise.all([api('post', '/v3/me/site/publish', { publicationId: id }), api('post', '/v3/me/site/publish', { publicationId: id })]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect(await prisma.v3SitePublication.count({ where: { vendorId: T.vendorId, status: 'PUBLISHED' } })).toBe(1);
  });

  it('five builds at once: no server error, versions are distinct and consecutive', async () => {
    await prisma.vendorCMS.update({ where: { vendorId: T.vendorId }, data: { tagline: 'Concurrent tagline four.' } });
    const before = await prisma.v3SitePublication.aggregate({ where: { vendorId: T.vendorId }, _max: { version: true } });
    const rs = await Promise.all(Array.from({ length: 5 }, () => api('post', '/v3/me/site/build', {})));
    expect(rs.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const versions = (await prisma.v3SitePublication.findMany({ where: { vendorId: T.vendorId }, select: { version: true }, orderBy: { version: 'asc' } })).map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions).toEqual(Array.from({ length: versions.length }, (_, i) => i + 1));
    expect(Math.max(...versions)).toBeGreaterThan(before._max.version ?? 0);
  });

  it('a publish racing a rollback still ends with exactly one PUBLISHED', async () => {
    const id = await build('Concurrent tagline five.');
    const [p, r] = await Promise.all([api('post', '/v3/me/site/publish', { publicationId: id }), api('post', '/v3/me/site/rollback', { toVersion: 1 })]);
    expect([200, 404]).toContain(p.status); expect([200, 404, 409]).toContain(r.status);
    expect(await prisma.v3SitePublication.count({ where: { vendorId: T.vendorId, status: 'PUBLISHED' } })).toBe(1);
  });
});
