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
import { SeededTenant, cleanupTenants, newPrisma, seedTenant, vendorToken } from './support/fixtures';
import { BillingFixture, evId, setUpBilling, tearDownBilling } from './support/billing-staging';
import { runCleanup } from './support/cleanup-guard';
import { FakeRazorpay } from './support/fake-razorpay';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * B2 slice 5.1b on STAGING: with the real advisory lock, compare-and-set updates and the locked invoice counter, a confirm racing a webhook gives ONE extension, parallel orders with the same
 * key give ONE order, and parallel settlements give distinct, consecutive invoice numbers. FAKE provider only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(180_000);

describe('plan billing concurrency on staging (fake provider)', () => {
  let app: INestApplication; let prisma: PrismaClient; let fx: BillingFixture; const fake = new FakeRazorpay(); let vendors: Array<{ t: SeededTenant; token: string }> = [];
  const api = (method: 'get' | 'post', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const hook = (raw: string, sig: string, id: string) => request(app.getHttpServer()).post('/v3/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', sig).set('x-razorpay-event-id', id).send(raw);

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma);
    app = await buildProvisioningTestApp({ billing: { fake } });
    for (const label of ['p51bca', 'p51bcb', 'p51bcc']) { const t = await seedTenant(prisma, label, RUN_ID); await makeSiteVendor(prisma, app.get(SubscriptionsService), t, RUN_ID, {}); vendors.push({ t, token: vendorToken(t.vendorId, t.email) }); }
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => app?.close(), () => prisma?.$disconnect()]); vendors = []; }, 180000);

  it('the same idempotency key sent five times at once: one order', async () => {
    const [v] = vendors; const key = `v3test-${RUN_ID}-cc1`;
    const rs = await Promise.all(Array.from({ length: 5 }, () => api('post', '/v3/me/billing/orders', v.token, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: key })));
    expect(rs.every((r) => r.status === 200)).toBe(true); expect(new Set(rs.map((r) => r.body.data.id)).size).toBe(1); expect(await prisma.v3PlanOrder.count({ where: { vendorId: v.t.vendorId, idempotencyKey: key } })).toBe(1);
  });

  it('a browser confirmation racing the webhook, several times each: exactly one subscription extension, one invoice, a PAID order', async () => {
    const [v] = vendors; const c = await api('post', '/v3/me/billing/orders', v.token, { planKey: 'handyman_pro', termMonths: 6, idempotencyKey: `v3test-${RUN_ID}-cc2` }); const id = c.body.data.id as string;
    const p = fake.pay(c.body.data.providerOrderId); const h = fake.webhook('payment.captured', p.paymentId, { eventId: evId('cc2') });
    const before = await prisma.v3PlanSubscription.count({ where: { vendorId: v.t.vendorId } });
    await Promise.all([...Array.from({ length: 3 }, () => api('post', `/v3/me/billing/orders/${id}/confirm`, v.token, { paymentId: p.paymentId, signature: p.signature })), ...Array.from({ length: 3 }, () => hook(h.raw, h.signature, h.eventId))]);
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id } })).status).toBe('PAID'); expect(await prisma.v3PlanInvoice.count({ where: { orderId: id } })).toBe(1);
    expect(await prisma.v3PlanSubscription.count({ where: { vendorId: v.t.vendorId } })).toBe(before + 1);   // exactly one new subscription row
    expect(await prisma.v3PlanSubscription.count({ where: { vendorId: v.t.vendorId, currentVendorId: v.t.vendorId } })).toBe(1);
  });

  it('invoice numbers are distinct and consecutive when several vendors\' orders are settled at the same moment', async () => {
    const orders = [];
    for (const v of vendors) orders.push({ v, c: await api('post', '/v3/me/billing/orders', v.token, { planKey: 'handyman_pro', termMonths: 12, idempotencyKey: `v3test-${RUN_ID}-cc3-${v.t.label}` }) });
    await Promise.all(orders.map(({ v, c }) => { const p = fake.pay(c.body.data.providerOrderId); return api('post', `/v3/me/billing/orders/${c.body.data.id}/confirm`, v.token, { paymentId: p.paymentId, signature: p.signature }); }));
    const invs = await prisma.v3PlanInvoice.findMany({ where: { orderId: { in: orders.map((o) => o.c.body.data.id as string) } } });
    expect(invs).toHaveLength(3); const nums = invs.map((i) => Number(i.invoiceNumber.split('/').pop())).sort((a, b) => a - b);
    expect(new Set(nums).size).toBe(3);
    expect(invs.every((i) => i.financialYear === invs[0].financialYear)).toBe(true);
    expect(nums[2] - nums[0]).toBe(2);   // gap free: three settlements, three consecutive numbers (the suite runs in band, so no other invoice interleaves)
  });
});
