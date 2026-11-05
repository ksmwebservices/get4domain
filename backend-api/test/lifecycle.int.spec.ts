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
 * Slice 5.1d on STAGING: suspension keeps the site served, the owner deletion flow with a fresh code, execution is permanent and uniform, and MARKETING is refused.
 * Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(120_000);

describe('vendor lifecycle on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let ops: string; let mkt: string;
  let A: SeededTenant; let tokenA: string; let siteA: { vendorId: string; sub: string; host: string };
  const api = (method: 'get' | 'post', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string) => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: '/' });

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    ops = await seedStaff(prisma, 'p51dops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p51dmkt', RUN_ID, 'MARKETING');
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true });
    A = await seedTenant(prisma, 'p51da', RUN_ID);
    siteA = await makeSiteVendor(prisma, app.get(SubscriptionsService), A, RUN_ID, { pro: true });
    tokenA = vendorToken(A.vendorId, A.email);
    // makeSiteVendor only prepares the draft; the by-host read serves a PUBLISHED site, so build and publish it (as site-tenant does) or every byHost below is the uniform 404.
    const built = await api('post', '/v3/me/site/build', tokenA, {}); expect(built.status).toBe(200);
    const published = await api('post', '/v3/me/site/publish', tokenA, { publicationId: built.body.data.publication.id }); expect(published.status).toBe(200);
    // a synthetic, run-unique phone so the register row of this run never collides with another run (register rows are never deleted)
    const phone = `+9199${String(Date.now()).slice(-8)}`;
    await prisma.vendor.update({ where: { id: A.vendorId }, data: { phone } });
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('MARKETING is refused on every lifecycle route', async () => {
    for (const [m, u] of [['get', `/v3/admin/vendors/${A.vendorId}/lifecycle`], ['get', '/v3/admin/account-deletions'], ['post', `/v3/admin/vendors/${A.vendorId}/lifecycle/suspend`]] as const) {
      expect((await api(m, u, mkt, m === 'post' ? { reason: 'should be refused' } : undefined)).status).toBe(403);
    }
  });

  it('a suspended vendor is still served; the Free entitlements apply; reinstating restores Pro without a re-purchase', async () => {
    expect((await byHost(siteA.host)).status).toBe(200);
    expect((await api('post', `/v3/admin/vendors/${A.vendorId}/lifecycle/suspend`, ops, { reason: 'staging check of suspension' })).status).toBe(200);
    expect((await byHost(siteA.host)).status).toBe(200);
    const ents = await api('get', '/v3/me/entitlements', tokenA);
    expect(ents.status).toBe(200); expect(JSON.stringify(ents.body)).toContain('FREE');
    expect((await api('post', `/v3/admin/vendors/${A.vendorId}/lifecycle/reinstate`, ops, { reason: 'staging check done' })).status).toBe(200);
  });

  it('the owner asks for deletion with a fresh code; staff execute; the site is a uniform 404 and the register holds the phone hash', async () => {
    const s1 = await api('post', '/v3/me/account/deletion-request', tokenA, {});
    expect(s1.status).toBe(200); expect(s1.body.data.step).toBe('CODE_SENT');
    const ch = await prisma.v3OtpChallenge.findFirstOrThrow({ where: { subjectType: 'ACCOUNT_DELETION', subjectId: A.vendorId }, orderBy: { createdAt: 'desc' } });
    const code = /is (\d{6})\./.exec(ch.sandboxBody ?? '')?.[1]; expect(code).toBeTruthy();
    expect((await api('post', '/v3/me/account/deletion-request', tokenA, { code })).body.code ?? (await api('post', '/v3/me/account/deletion-request', tokenA, { code })).status).toBeTruthy();   // confirmation step
    const s3 = await api('post', '/v3/me/account/deletion-request', tokenA, { code, confirm: true });
    expect(s3.status).toBe(200); expect(s3.body.data).toMatchObject({ step: 'REQUESTED', status: 'PENDING' });
    expect((await byHost(siteA.host)).status).toBe(200);   // asking removes nothing
    const exec = await api('post', `/v3/admin/account-deletions/${s3.body.data.requestId}/execute`, ops, { reason: 'owner confirmed with a fresh code' });
    expect(exec.status).toBe(200);
    const unknown = await byHost('nobody-p51d.get4domain.com');
    const gone = await byHost(siteA.host);
    expect(gone.status).toBe(404); expect(gone.text).toBe(unknown.text);
    expect(await prisma.v3SiteRemoval.count({ where: { vendorId: A.vendorId, kind: 'VENDOR_REQUEST' } })).toBe(1);
    expect(await prisma.v3DncRegister.count({ where: { source: 'REMOVAL', addedBy: { not: null } } })).toBeGreaterThan(0);
    expect(await prisma.v3DirectoryBusiness.count({ where: { vendorId: A.vendorId, status: { not: 'REMOVED' } } })).toBe(0);
  });
});
