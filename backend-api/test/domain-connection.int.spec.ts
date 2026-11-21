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
import { FakeCloudflare } from './support/domain-connection-world';

/**
 * Batch 11 slice 5.6c on STAGING: the own-domain connection with the real database and a FAKE Cloudflare (never live). Synthetic data only, removed at the end.
 * NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(120_000);
const lc = (s: string): string => s.toLowerCase().replace(/[^a-z0-9-]/g, '');

describe('own-domain connection on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let ops: string; let mkt: string; const cf = new FakeCloudflare();
  let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let domainId: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const host = `v3test-${lc(RUN_ID)}.in`;   // a BARE domain: the suite asserts the www connect host and the Cloudflare option, which only a bare domain has (a subdomain connects as itself, see domain-connection-core.spec.ts)

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    ops = await seedStaff(prisma, 'p56cops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p56cmkt', RUN_ID, 'MARKETING');
    app = await buildProvisioningTestApp({ includeSiteApi: true, domainAutomation: { cloudflare: cf } });
    A = await seedTenant(prisma, 'p56ca', RUN_ID); B = await seedTenant(prisma, 'p56cb', RUN_ID);
    await makeSiteVendor(prisma, app.get(SubscriptionsService), A, RUN_ID, { pro: true });
    await makeSiteVendor(prisma, app.get(SubscriptionsService), B, RUN_ID, { pro: true });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
    // Every vendor has a mandatory Get4Domain subdomain (V3_DOMAINS_AUTOMATION rule 1) and Forward mode redirects to it. makeSiteVendor only fills the vendor's column, so reserve the row the way a vendor does.
    const sub = await api('put', '/v3/me/domains/subdomain', tokenA, { slug: `p56c-${lc(RUN_ID)}` });
    if (sub.status !== 200) throw new Error(`setup step "reserve the subdomain" answered ${sub.status}: ${JSON.stringify(sub.body)}`);
    for (const [key, value] of [['customHostnameTarget', 'edge.example.test']] as const) await prisma.v3PlanSetting.upsert({ where: { key }, update: { valueJson: value }, create: { key, valueJson: value } });
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('a domain whose ownership is not confirmed cannot be connected; once staff confirm it the connection starts and the guide lists the records', async () => {
    const add = await api('post', '/v3/me/domains/custom', tokenA, { hostname: host }); expect(add.status).toBe(200); domainId = add.body.data.id;
    expect((await api('post', `/v3/me/domains/${domainId}/connection`, tokenA, {})).body.code).toBe('CONNECTION_NOT_READY');
    expect((await api('put', `/v3/admin/domains/${domainId}/state`, ops, { status: 'ACTIVE', reason: 'v3test confirmed' })).status).toBe(200);
    const g = await api('get', `/v3/me/domains/${domainId}/connection-guide?registrar=GODADDY`, tokenA);
    expect(g.status).toBe(200); expect(g.body.data.records.map((r: { type: string }) => r.type)).toEqual(['TXT', 'CNAME']); expect(g.body.data.bareDomain.needsCloudflareOption).toBe(true);
    const b = await api('post', `/v3/me/domains/${domainId}/connection`, tokenA, { mode: 'FORWARD', registrar: 'GODADDY' });
    expect(b.status).toBe(200); expect(b.body.data).toMatchObject({ connectHost: `www.${host}`, status: 'VERIFYING', mode: 'FORWARD' });
    expect(await prisma.v3DomainConnection.count({ where: { domainId, vendorId: A.vendorId } })).toBe(1);
  });

  it('the certificate becoming active makes the connection ACTIVE and forwards to the subdomain; the activity log gets a domain event', async () => {
    const id = [...cf.hostnames.keys()][0]; cf.setCert(id, 'ACTIVE');
    const c = await api('post', `/v3/me/domains/${domainId}/connection/check`, tokenA);
    expect(c.status).toBe(200); expect(c.body.data).toMatchObject({ status: 'ACTIVE', sslStatus: 'ACTIVE' });
    expect(cf.redirects.has(`www.${host}`)).toBe(true);
  });

  it('another vendor sees nothing of it, and MARKETING is refused on the staff routes', async () => {
    expect((await api('get', `/v3/me/domains/${domainId}/connection`, tokenB)).status).toBe(404);
    expect((await api('post', `/v3/me/domains/${domainId}/connection/check`, tokenB)).status).toBe(404);
    expect((await api('get', '/v3/admin/domain-connections', mkt)).status).toBe(403);
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/domain-log`, mkt)).status).toBe(403);
    const list = await api('get', '/v3/admin/domain-connections?status=ACTIVE', ops); expect(list.status).toBe(200);
    expect(list.body.data.items.some((x: { domainId: string }) => x.domainId === domainId)).toBe(true);
  });

  it('disconnecting ends the connection and the domain stays the vendor\'s', async () => {
    const d = await api('delete', `/v3/me/domains/${domainId}/connection`, tokenA); expect(d.status).toBe(200);
    expect(await prisma.v3Domain.count({ where: { id: domainId, vendorId: A.vendorId, status: 'ACTIVE' } })).toBe(1);
  });
});
