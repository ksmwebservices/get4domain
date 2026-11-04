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
 * B2 slice 5.6 on STAGING: the free subdomain and custom domain flow with the real database, the real advisory locks and the real unique rules. Live DNS checks stay OFF
 * (the default setting), so no DNS query is made: a custom domain is activated by staff (force state), which is the same path the owner uses until the setting is turned on.
 * Synthetic data only, removed at the end. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(120_000);
const lc = (s: string): string => s.toLowerCase().replace(/[^a-z0-9-]/g, '');

describe('domains on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let ops: string; let mkt: string;
  let A: SeededTenant; let tokenA: string; let siteA: { vendorId: string; sub: string; host: string };
  const base = (): string => siteA.host.slice(siteA.sub.length + 1);
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string, p = '/') => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: p });
  const customHost = `shop-${lc(RUN_ID)}.example.in`;

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    ops = await seedStaff(prisma, 'p56ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p56mkt', RUN_ID, 'MARKETING');
    app = await buildProvisioningTestApp({ includeSiteApi: true });
    A = await seedTenant(prisma, 'p56a', RUN_ID);
    siteA = await makeSiteVendor(prisma, app.get(SubscriptionsService), A, RUN_ID, { pro: true });
    tokenA = vendorToken(A.vendorId, A.email);
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('a legacy vendor (only the subdomain column) is served by the new resolver and shows its address in the overview', async () => {
    const o = await api('get', '/v3/me/domains', tokenA);
    expect(o.status).toBe(200); expect(o.body.data.primaryHost).toBe(siteA.host);
    expect(o.body.data.customDomain.allowed).toBe(true);
  });

  it('reserve a new free subdomain: rows, the vendor column, and the old address redirecting 301', async () => {
    const slug = `p56n-${lc(RUN_ID)}`;
    const r = await api('put', '/v3/me/domains/subdomain', tokenA, { slug });
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ hostname: `${slug}.${base()}`, status: 'ACTIVE', isPrimary: true });
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: A.vendorId } })).subdomain).toBe(slug);
    const rows = await prisma.v3Domain.findMany({ where: { vendorId: A.vendorId }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((x) => [x.kind, x.status, x.isPrimary])).toEqual([['SUBDOMAIN', 'REMOVED', false], ['SUBDOMAIN', 'ACTIVE', true]]);
    expect(await prisma.v3Redirect.count({ where: { vendorId: A.vendorId, fromHost: siteA.host, toHost: `${slug}.${base()}`, status: 301, active: true } })).toBe(1);
    const old = await byHost(siteA.host, '/about'); expect(old.status).toBe(301); expect(old.headers.location).toBe(`https://${slug}.${base()}/about`);
    expect(await prisma.v3AuditLog.count({ where: { entityType: 'domain', action: 'domain.subdomain.set', actorId: A.vendorId } })).toBeGreaterThanOrEqual(1);
  });

  it('custom domain: request returns TXT instructions; verify (live checks off) says DISABLED; MARKETING cannot touch it; OPERATIONS activates it; it becomes primary and the site is served on it', async () => {
    const add = await api('post', '/v3/me/domains/custom', tokenA, { hostname: customHost });
    expect(add.status).toBe(200); expect(add.body.data.instructions).toMatchObject({ type: 'TXT', name: `_g4d-verify.${customHost}` });
    const id = add.body.data.id as string;
    const setting = await prisma.v3PlanSetting.findUnique({ where: { key: 'domainDnsLiveChecks' } });
    if (setting?.valueJson !== true) {
      const v = await api('post', `/v3/me/domains/${id}/verify`, tokenA);
      expect(v.status).toBe(200); expect(v.body.data.result).toBe('DISABLED');
    }
    expect((await api('put', `/v3/admin/domains/${id}/state`, mkt, { status: 'ACTIVE', reason: 'marketing must not' })).status).toBe(403);
    const forced = await api('put', `/v3/admin/domains/${id}/state`, ops, { status: 'ACTIVE', sslStatus: 'PENDING', reason: 'v3test confirmed' });
    expect(forced.status).toBe(200); expect(forced.body.data).toMatchObject({ status: 'ACTIVE', isPrimary: true, sslStatus: 'PENDING' });
    expect(await prisma.v3Domain.count({ where: { vendorId: A.vendorId, isPrimary: true } })).toBe(1);   // the database rule: one primary

    const built = await api('post', '/v3/me/site/build', tokenA, {}); expect(built.status).toBe(200);
    expect((await api('post', '/v3/me/site/publish', tokenA, { publicationId: built.body.data.publication.id })).status).toBe(200);
    const served = await byHost(customHost); expect(served.status).toBe(200); expect(served.text).toContain(`https://${customHost}`);
    const alias = await byHost(`www.${customHost}`); expect(alias.status).toBe(301); expect(alias.headers.location).toBe(`https://${customHost}/`);
    const sub = await prisma.vendor.findUniqueOrThrow({ where: { id: A.vendorId } });
    const viaSub = await byHost(`${sub.subdomain}.${base()}`, '/contact'); expect(viaSub.status).toBe(301); expect(viaSub.headers.location).toBe(`https://${customHost}/contact`);
  });

  it('removing the custom domain gives primary back to the free subdomain; the row is kept as REMOVED', async () => {
    const row = await prisma.v3Domain.findUniqueOrThrow({ where: { hostname: customHost } });
    const r = await api('delete', `/v3/me/domains/${row.id}`, tokenA);
    expect(r.status).toBe(200);
    expect(await prisma.v3Domain.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: 'REMOVED', isPrimary: false, primaryVendorId: null });
    const primary = await prisma.v3Domain.findMany({ where: { vendorId: A.vendorId, isPrimary: true } });
    expect(primary.map((p) => p.kind)).toEqual(['SUBDOMAIN']);
    expect((await byHost(customHost)).status).toBe(404);
  });

  it('staff list and read need OPERATIONS or SUPER_ADMIN; MARKETING gets 403', async () => {
    expect((await api('get', `/v3/admin/domains?vendorId=${A.vendorId}`, ops)).status).toBe(200);
    expect((await api('get', `/v3/admin/domains?vendorId=${A.vendorId}`, mkt)).status).toBe(403);
  });
});
