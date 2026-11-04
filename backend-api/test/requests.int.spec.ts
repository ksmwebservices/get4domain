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
import { B3SettingsService } from '../src/b3-settings/b3-settings.service';
import { SeededTenant, cleanupTenants, newPrisma, seedMember, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice 5.14 on STAGING: the real routes over the real database: a Pro site takes a request and the vendor sees it; a Free site and an unknown host are the same 404; vendor B cannot read
 * vendor A's request; a team member cannot touch payment methods; MARKETING cannot read requests; a webhook with a bad signature is a plain 401; secrets are never in a response.
 * Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`. Order and stock concurrency are covered by the unit twin only.
 */
jest.setTimeout(180_000);

describe('requests and orders on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let mkt: string; let ops: string;
  let A: SeededTenant; let B: SeededTenant; let F: SeededTenant; let memberA: string; let tokenA: string; let tokenB: string; let tokenF: string;
  let hostA: string; let hostF: string;
  const phone = `98${String(Date.now()).slice(-8)}`;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string | null, body?: object) => { const r = request(app.getHttpServer())[method](url); const a = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? a.send(body) : a; };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    mkt = await seedStaff(prisma, 'p514mkt', RUN_ID, 'MARKETING'); ops = await seedStaff(prisma, 'p514ops', RUN_ID, 'OPERATIONS');
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p514a', RUN_ID); B = await seedTenant(prisma, 'p514b', RUN_ID); F = await seedTenant(prisma, 'p514f', RUN_ID);
    hostA = (await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true })).host; await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true }); hostF = (await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false })).host;
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); tokenF = vendorToken(F.vendorId, F.email);
    memberA = await seedMember(prisma, A.vendorId, 'p514m', RUN_ID, ['website']);
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  const body = async () => {
    const s = await app.get(B3SettingsService).get();
    return { kind: 'ENQUIRY', name: 'V3TEST Meena', phone, payload: { message: 'Do you fix geysers?' }, consent: { contactByBusiness: true, contactByPlatform: false, marketing: false, textVersion: s.customerConsentVersion }, idempotencyKey: `k-${RUN_ID}-${Date.now()}-aaaaaaaa` };
  };

  it('a Pro site takes an enquiry; the vendor sees it; another vendor gets the same 404 as for an id that does not exist; a team member can read it', async () => {
    const r = await api('post', `/v3/public/sites/${hostA}/requests`, null, await body());
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ accepted: true }); expect(r.headers['cache-control']).toBe('no-store');
    const id = r.body.data.reference as string;
    const list = await api('get', '/v3/me/requests', tokenA); expect(list.status).toBe(200); expect(list.body.data.total).toBeGreaterThanOrEqual(1);
    expect((await api('get', `/v3/me/requests/${id}`, tokenA)).body.data.status).toBe('SEEN');
    expect((await api('get', `/v3/me/requests/${id}`, memberA)).status).toBe(200);
    const foreign = await api('get', `/v3/me/requests/${id}`, tokenB); const missing = await api('get', '/v3/me/requests/does-not-exist', tokenB);
    expect([foreign.status, missing.status]).toEqual([404, 404]); expect(foreign.body.code).toBe(missing.body.code);
    expect((await api('post', `/v3/me/requests/${id}/respond`, tokenB, { message: 'Hello' })).status).toBe(404);
  });

  it('a Free site, an unknown host and a missing consent give the answers the dispatch asks for; a Free vendor is locked out of every vendor route here', async () => {
    const a = await api('post', `/v3/public/sites/${hostF}/requests`, null, await body()); const b = await api('post', '/v3/public/sites/nobody-here.get4domain.com/requests', null, await body());
    expect([a.status, b.status]).toEqual([404, 404]); expect(a.body.message).toBe(b.body.message);
    const noConsent = { ...(await body()), consent: undefined }; expect((await api('post', `/v3/public/sites/${hostA}/requests`, null, noConsent)).status).toBe(400);
    for (const u of ['/v3/me/requests', '/v3/me/orders', '/v3/me/offers', '/v3/me/payment-methods', '/v3/me/invoices']) {
      const r = await api('get', u, tokenF); expect({ u, status: r.status, code: r.body.code }).toEqual({ u, status: 403, code: 'FEATURE_LOCKED' });
    }
  });

  it('money and credentials are owner only; secrets are write-only', async () => {
    expect((await api('get', '/v3/me/payment-methods', memberA)).status).toBe(403); expect((await api('post', '/v3/me/orders/x/refund', memberA, { amountPaise: 100 })).status).toBe(403);
    const c = await api('post', '/v3/me/payment-methods', tokenA, { kind: 'OWN_GATEWAY', label: 'V3TEST gateway', details: 'rzp_test_key_5678', webhookSecret: 'whsec-v3test-secret-value' });
    expect(c.status).toBe(200); expect(c.body.data).toMatchObject({ last4: '5678', hasGatewayDetails: true });
    const all = JSON.stringify([c.body, (await api('get', '/v3/me/payment-methods', tokenA)).body]);
    expect(all).not.toMatch(/rzp_test_key|whsec-v3test|cipher/);
    const stored = await prisma.v3VendorPaymentMethod.findFirstOrThrow({ where: { vendorId: A.vendorId } });
    expect(JSON.stringify(stored)).not.toMatch(/rzp_test_key|whsec-v3test/);   // sealed at rest
    expect((await api('get', '/v3/me/payment-methods', tokenB)).body.data.items ?? (await api('get', '/v3/me/payment-methods', tokenB)).body.data).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: stored.id })]));
    const hook = (sig: string) => request(app.getHttpServer()).post(`/v3/payments/vendor/${A.vendorId}/${stored.id}`).set('content-type', 'application/json').set('x-g4d-signature', sig).send(JSON.stringify({ id: 'evt_x', type: 'payment.captured', orderRef: 'none', amountPaise: 100, currency: 'INR' }));
    expect((await hook('00'.repeat(32))).status).toBe(401);
    expect((await request(app.getHttpServer()).post(`/v3/payments/vendor/${A.vendorId}/not-a-method`).set('content-type', 'application/json').send('{}')).status).toBe(401);
  });

  it('staff: MARKETING is refused on requests, the outbox, reports and the blocklist; OPERATIONS may read them', async () => {
    for (const u of ['/v3/admin/requests', '/v3/admin/message-outbox', '/v3/admin/reports', '/v3/admin/blocklist']) {
      expect({ u, s: (await api('get', u, mkt)).status }).toEqual({ u, s: 403 }); expect({ u, s: (await api('get', u, ops)).status }).toEqual({ u, s: 200 });
    }
    const list = await api('get', '/v3/admin/requests', ops); expect(JSON.stringify(list.body)).not.toContain(phone);   // no customer phone in the staff list
  });
});
