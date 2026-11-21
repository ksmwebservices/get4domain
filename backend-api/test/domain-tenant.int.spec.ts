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
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/** B2 slice 5.6 on STAGING: cross-tenant behaviour of the domain tables and routes with the real database. NOT RUN in the build session (no .env.staging there). */
jest.setTimeout(120_000);
const lc = (s: string): string => s.toLowerCase().replace(/[^a-z0-9-]/g, '');

describe('domains: tenant isolation on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let memberA: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const hostA = `a-${lc(RUN_ID)}.example.in`;
  let domainA = '';

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p56ta', RUN_ID); B = await seedTenant(prisma, 'p56tb', RUN_ID);
    await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); memberA = A.memberToken;
    const add = await api('post', '/v3/me/domains/custom', tokenA, { hostname: hostA });
    domainA = add.body.data.id as string;
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('vendor B cannot read, verify, make primary or remove vendor A\'s domain: the same 404 as for an unknown id; the row is unchanged', async () => {
    const unknown = await api('get', '/v3/me/domains/does-not-exist', tokenB);
    expect(unknown.status).toBe(404);
    for (const [m, url] of [['get', `/v3/me/domains/${domainA}`], ['post', `/v3/me/domains/${domainA}/verify`], ['post', `/v3/me/domains/${domainA}/primary`], ['delete', `/v3/me/domains/${domainA}`]] as const) {
      const r = await api(m, url, tokenB);
      expect([r.status, r.body.code, r.body.message]).toEqual([404, unknown.body.code, unknown.body.message]);
    }
    expect(await prisma.v3Domain.findUniqueOrThrow({ where: { id: domainA } })).toMatchObject({ vendorId: A.vendorId, status: 'PENDING' });
  });

  it('vendor B asking for A\'s host, or A\'s subdomain, gets the uniform 409 (no hint who owns it)', async () => {
    const a = await api('post', '/v3/me/domains/custom', tokenB, { hostname: hostA });
    const subA = (await prisma.vendor.findUniqueOrThrow({ where: { id: A.vendorId } })).subdomain!;
    const b = await api('put', '/v3/me/domains/subdomain', tokenB, { slug: subA });
    expect([a.status, b.status]).toEqual([409, 409]);
    expect([a.body.code, b.body.code]).toEqual(['HOST_UNAVAILABLE', 'HOST_UNAVAILABLE']); expect(a.body.message).toBe(b.body.message);
    expect(await prisma.v3Domain.count({ where: { hostname: hostA } })).toBe(1);
  });

  it('a team member of A (even with every area) is refused on the owner-only routes, and a body vendorId is rejected', async () => {
    expect((await api('get', '/v3/me/domains', memberA)).status).toBe(403);
    expect((await api('post', '/v3/me/domains/custom', memberA, { hostname: `m-${lc(RUN_ID)}.example.in` })).status).toBe(403);
    expect((await api('put', '/v3/me/domains/subdomain', tokenA, { slug: `x-${lc(RUN_ID)}`, vendorId: B.vendorId })).status).toBe(400);
  });

  it('the overview lists only the caller\'s own domains', async () => {
    const o = await api('get', '/v3/me/domains', tokenB);
    expect(o.status).toBe(200);
    expect((o.body.data.domains as Array<{ hostname: string }>).map((d) => d.hostname)).not.toContain(hostA);
  });
});
