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

/**
 * B2 slice 5.6 on STAGING: with the real unique rules and the real per-vendor advisory lock, racing requests never leave two owners of one host, two primaries, or two free
 * subdomains for a vendor. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(120_000);
const lc = (s: string): string => s.toLowerCase().replace(/[^a-z0-9-]/g, '');

describe('domain concurrency on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string;
  const put = (url: string, token: string, body: object) => request(app.getHttpServer()).put(url).set('Authorization', `Bearer ${token}`).send(body);
  const post = (url: string, token: string, body: object) => request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p56ca', RUN_ID); B = await seedTenant(prisma, 'p56cb', RUN_ID);
    await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('two vendors claim the same free subdomain at once: exactly one wins, the other gets the uniform 409, one row exists', async () => {
    const slug = `race-${lc(RUN_ID)}`;
    const [a, b] = await Promise.all([put('/v3/me/domains/subdomain', tokenA, { slug }), put('/v3/me/domains/subdomain', tokenB, { slug })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([a, b].find((r) => r.status === 409)!.body.code).toBe('HOST_UNAVAILABLE');
    expect(await prisma.v3Domain.count({ where: { hostname: { startsWith: `${slug}.` } } })).toBe(1);
  });

  it('two Pro vendors request the same custom host at once: exactly one PENDING row, one 200 and one 409', async () => {
    const host = `race-${lc(RUN_ID)}.example.in`;
    const [a, b] = await Promise.all([post('/v3/me/domains/custom', tokenA, { hostname: host }), post('/v3/me/domains/custom', tokenB, { hostname: host })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await prisma.v3Domain.count({ where: { hostname: host } })).toBe(1);
  });

  it('one vendor double-clicking the same subdomain: both calls succeed and there is one ACTIVE row', async () => {
    const slug = `dbl-${lc(RUN_ID)}`;
    const [x, y] = await Promise.all([put('/v3/me/domains/subdomain', tokenA, { slug }), put('/v3/me/domains/subdomain', tokenA, { slug })]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect(await prisma.v3Domain.count({ where: { hostname: { startsWith: `${slug}.` } } })).toBe(1);
  });

  it('one vendor changing to two different names at once: the lock serialises them; afterwards exactly one ACTIVE free subdomain and exactly one primary remain', async () => {
    const [x, y] = await Promise.all([put('/v3/me/domains/subdomain', tokenA, { slug: `ch1-${lc(RUN_ID)}` }), put('/v3/me/domains/subdomain', tokenA, { slug: `ch2-${lc(RUN_ID)}` })]);
    expect([200, 429]).toContain(x.status); expect([200, 429]).toContain(y.status);   // the second may hit the change limit
    const rows = await prisma.v3Domain.findMany({ where: { vendorId: A.vendorId } });
    expect(rows.filter((r) => r.kind === 'SUBDOMAIN' && r.status === 'ACTIVE')).toHaveLength(1);
    expect(rows.filter((r) => r.isPrimary)).toHaveLength(1);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: A.vendorId } })).subdomain).toBe(rows.find((r) => r.kind === 'SUBDOMAIN' && r.status === 'ACTIVE')!.hostname.split('.')[0]);
  });
});
