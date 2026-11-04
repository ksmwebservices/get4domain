// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { BillingFixture, setUpBilling, tearDownBilling } from './support/billing-staging';
import { runCleanup } from './support/cleanup-guard';
import { FakeRazorpay } from './support/fake-razorpay';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/** B2 slice 5.1b on STAGING: cross-tenant behaviour of the plan order tables and routes, with the real database and the FAKE provider. NOT RUN in the build session (no .env.staging there). */
jest.setTimeout(180_000);

describe('plan billing: tenant isolation on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let fx: BillingFixture; const fake = new FakeRazorpay();
  let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let mkt: string; let ops: string;
  const api = (method: 'get' | 'post', url: string, token?: string, body?: object) => { const r = request(app.getHttpServer())[method](url); const t = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? t.send(body) : t; };
  let orderA = ''; let providerA = '';

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma);
    app = await buildProvisioningTestApp({ billing: { fake } });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p51bta', RUN_ID); B = await seedTenant(prisma, 'p51btb', RUN_ID); await makeSiteVendor(prisma, subs, A, RUN_ID, {}); await makeSiteVendor(prisma, subs, B, RUN_ID, {});
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); mkt = await seedStaff(prisma, 'p51btmkt', RUN_ID, 'MARKETING'); ops = await seedStaff(prisma, 'p51btops', RUN_ID, 'OPERATIONS');
    const c = await api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `v3test-${RUN_ID}-ta` }); orderA = c.body.data.id; providerA = c.body.data.providerOrderId;
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('vendor B cannot confirm vendor A\'s order, and gets the same 404 as for an order that does not exist; A\'s order is untouched', async () => {
    const p = fake.pay(providerA); const body = { paymentId: p.paymentId, signature: p.signature };
    const other = await api('post', `/v3/me/billing/orders/${orderA}/confirm`, tokenB, body); const none = await api('post', '/v3/me/billing/orders/does-not-exist/confirm', tokenB, body);
    expect([other.status, other.body.code, other.body.message]).toEqual([404, 'ORDER_NOT_FOUND', none.body.message]);
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: orderA } })).status).toBe('PENDING_PAYMENT');
  });
  it('each owner lists only their own orders and invoices; the same idempotency key is independent per vendor', async () => {
    const b = await api('post', '/v3/me/billing/orders', tokenB, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `v3test-${RUN_ID}-ta` });   // A's key, used by B
    expect(b.status).toBe(200); expect(b.body.data.id).not.toBe(orderA);
    expect((await api('get', '/v3/me/billing/orders', tokenA)).body.data.items.map((o: { id: string }) => o.id)).toEqual([orderA]); expect((await api('get', '/v3/me/billing/orders', tokenB)).body.data.items.map((o: { id: string }) => o.id)).toEqual([b.body.data.id]);
  });
  it('a team member of A (even with every area) cannot buy, confirm or read; MARKETING cannot read orders or the payment inbox; a vendor token is refused on staff routes', async () => {
    expect((await api('post', '/v3/me/billing/orders', A.memberToken, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `v3test-${RUN_ID}-m1` })).status).toBe(403); expect((await api('get', '/v3/me/billing/orders', A.memberToken)).status).toBe(403);
    expect((await api('get', '/v3/admin/billing/orders', mkt)).status).toBe(403); expect((await api('get', '/v3/admin/billing/payment-events', mkt)).status).toBe(403);
    expect((await api('get', '/v3/admin/billing/orders', tokenA)).status).toBe(403); expect((await api('get', '/v3/admin/billing/orders', ops)).status).toBe(200);
  });
  it('the request body cannot carry a vendor, an amount or a plan id: unknown fields are 400', async () => {
    for (const extra of [{ vendorId: B.vendorId }, { amountPaise: 1 }, { planId: 'x' }]) expect((await api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `v3test-${RUN_ID}-x${Object.keys(extra)[0]}`, ...extra })).status).toBe(400);
  });
});
