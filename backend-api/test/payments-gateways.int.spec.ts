// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { BillingFixture, setUpBilling, tearDownBilling } from './support/billing-staging';
import { runCleanup } from './support/cleanup-guard';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { makeSiteVendor } from './support/site-staging';
import { bootWave3, postHook, Wave3Env } from './support/wave3-staging';

/**
 * Wave 3 Part C on STAGING, with the real database and IN-MEMORY gateways (no Razorpay or Cashfree call is ever made; the secrets are made by this run): the order on the chosen gateway, the amount made only
 * on the server, the confirm that asks the gateway, the signed webhook (bad signature, replay, wrong amount, unknown order), the other gateway's event, and who may change the setting.
 * Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(240_000);

describe('payment gateways on staging (in-memory gateways)', () => {
  let env: Wave3Env; let prisma: PrismaClient; let fx: BillingFixture; let A: SeededTenant; let tokenA: string; let sup: string; let admin: string; let ops: string; let mkt: string;
  const order = (over: object = {}) => env.api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: env.key('order'), ...over });
  const planOf = async (): Promise<string> => (await prisma.v3PlanSubscription.findFirstOrThrow({ where: { vendorId: A.vendorId, currentVendorId: A.vendorId }, include: { plan: true } })).plan.key;

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma);
    env = await bootWave3(prisma);
    A = await seedTenant(prisma, 'w3ga', RUN_ID); await makeSiteVendor(prisma, env.app.get(SubscriptionsService), A, RUN_ID, {}); tokenA = vendorToken(A.vendorId, A.email);
    sup = await seedStaff(prisma, 'w3gsup', RUN_ID, 'SUPER_ADMIN'); admin = await seedStaff(prisma, 'w3gadm', RUN_ID, 'ADMIN'); ops = await seedStaff(prisma, 'w3gops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'w3gmkt', RUN_ID, 'MARKETING');
  }, 300000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => env?.app.close(), () => prisma?.$disconnect()]); }, 180000);

  it('the gateway setting: OPERATIONS reads it, ADMIN and SUPER_ADMIN change it, SALES is refused, a bad value or live without the flag is refused with a code, and no key is ever shown', async () => {
    const read = await env.api('get', '/v3/admin/payment-gateway', ops); expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject({ mode: 'test', liveAllowedByEnvironment: false }); expect(JSON.stringify(read.body)).not.toMatch(/secret|rzp_|app[-_ ]?id/i);
    expect((await env.api('get', '/v3/admin/payment-gateway', mkt)).status).toBe(403);
    expect((await env.api('put', '/v3/admin/payment-gateway', ops, { mode: 'off' })).status).toBe(403); expect((await env.api('put', '/v3/admin/payment-gateway', mkt, { mode: 'off' })).status).toBe(403);
    expect((await env.api('put', '/v3/admin/payment-gateway', admin, { gateway: 'paypal' })).status).toBe(400);
    const live = await env.api('put', '/v3/admin/payment-gateway', admin, { mode: 'live' }); expect([live.status, live.body.code]).toEqual([409, 'LIVE_NOT_ENABLED']);
    const empty = await env.api('put', '/v3/admin/payment-gateway', sup, {}); expect([empty.status, empty.body.code]).toEqual([400, 'GATEWAY_SETTING_INVALID']);
  });

  it('on Cashfree: the order carries the gateway and the session token, the amount is the price book plus GST made on the server, and a client amount is refused', async () => {
    await env.setGateway('cashfree');
    const c = await order(); expect(c.status).toBe(200);
    expect(c.body.data).toMatchObject({ gateway: 'cashfree', status: 'PENDING_PAYMENT', amountPaise: 354_000, keyId: null }); expect(c.body.data.clientToken).toBeTruthy();
    expect((await order({ amountPaise: 1 })).status).toBe(400); expect((await order({ promoCode: 'ANY' })).status).toBe(400);
    expect(await planOf()).toBe('handyman_free');
  });

  it('confirm asks the gateway: nothing paid is pending, a successful payment activates Pro once, and a repeat changes nothing', async () => {
    const c = await order(); const id = c.body.data.id as string; const po = c.body.data.providerOrderId as string;
    const pending = await env.api('post', `/v3/me/billing/orders/${id}/confirm`, tokenA, {}); expect(pending.body.data).toMatchObject({ pending: true, status: 'PENDING_PAYMENT' });
    env.gws.cashfree.addPayment({ paymentId: '5100001', providerOrderId: po, amountMinor: 354_000, currency: 'INR', status: 'SUCCESS' });
    const done = await env.api('post', `/v3/me/billing/orders/${id}/confirm`, tokenA, {}); expect(done.body.data.status).toBe('PAID');
    await env.api('post', `/v3/me/billing/orders/${id}/confirm`, tokenA, {});
    expect(await planOf()).toBe('handyman_pro'); expect(await prisma.v3PlanInvoice.count({ where: { orderId: id } })).toBe(1);
  });

  it('a signed Cashfree webhook settles an order; a replay is a duplicate; a bad signature is 401; a wrong amount is HELD; an unknown order is recorded and activates nothing', async () => {
    const a = await order(); const idA = a.body.data.id as string; const poA = a.body.data.providerOrderId as string;
    const good = env.hook('cashfree', poA, { amountMinor: 354_000, paymentId: '5100002', eventId: 'cf-5100002' });
    const first = await postHook(env, 'cashfree', good); expect([first.status, first.body.data?.received ?? first.body.received]).toEqual([200, true]);
    const again = await postHook(env, 'cashfree', good); expect(again.status).toBe(200); expect(JSON.stringify(again.body)).toContain('duplicate');
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: idA } })).status).toBe('PAID');
    const b = await order({ termMonths: 6 }); const idB = b.body.data.id as string;
    const bad = env.hook('cashfree', b.body.data.providerOrderId, { amountMinor: 637_200, paymentId: '5100003', sign: false }); expect((await postHook(env, 'cashfree', bad)).status).toBe(401);
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: idB } })).status).toBe('PENDING_PAYMENT');
    const wrong = env.hook('cashfree', b.body.data.providerOrderId, { amountMinor: 100, paymentId: '5100004', eventId: 'cf-5100004' }); expect((await postHook(env, 'cashfree', wrong)).status).toBe(200);
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: idB } })).status).toBe('REVIEW'); expect(await prisma.v3PlanInvoice.count({ where: { orderId: idB } })).toBe(0);
    const unknown = env.hook('cashfree', `v3test-${RUN_ID}-nope`, { amountMinor: 354_000, paymentId: '5100005', eventId: 'cf-5100005' }); expect((await postHook(env, 'cashfree', unknown)).status).toBe(200);
    const events = await prisma.v3PaymentEvent.findMany({ where: { providerEventId: { in: ['cf-5100002', 'cf-5100004', 'cf-5100005'] } } });
    expect(events.map((e) => e.provider)).toEqual(['cashfree', 'cashfree', 'cashfree']); expect(events.find((e) => e.providerEventId === 'cf-5100005')!.result).toBe('NO_ORDER');
    expect(JSON.stringify(events.map((e) => e.payloadRedactedJson))).not.toMatch(/email|phone|contact|card|vpa/i);
  });

  it('on Razorpay the same checks hold, and an event from the OTHER gateway for an order does not settle it', async () => {
    await env.setGateway('razorpay');
    const c = await order({ termMonths: 12 }); const id = c.body.data.id as string; const po = c.body.data.providerOrderId as string;
    expect(c.body.data).toMatchObject({ gateway: 'razorpay', clientToken: null });
    const cross = env.hook('cashfree', po, { amountMinor: c.body.data.amountPaise, paymentId: '5100006', eventId: 'cf-5100006' }); expect((await postHook(env, 'cashfree', cross)).status).toBe(200);
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING_PAYMENT');   // a Cashfree event for a Razorpay order settles nothing
    env.gws.razorpay.addPayment({ paymentId: 'pay_w3g1', providerOrderId: po, amountMinor: c.body.data.amountPaise, currency: 'INR', status: 'SUCCESS' });
    expect((await env.api('post', `/v3/me/billing/orders/${id}/confirm`, tokenA, {})).status).toBe(400);   // no signature: refused before the gateway is asked
    const ok = await env.api('post', `/v3/me/billing/orders/${id}/confirm`, tokenA, { paymentId: 'pay_w3g1', signature: env.gws.razorpay.returnSignature(po, 'pay_w3g1') }); expect(ok.body.data.status).toBe('PAID');
    const hookOrder = await order({ termMonths: 3 }); const hk = env.hook('razorpay', hookOrder.body.data.providerOrderId, { amountMinor: hookOrder.body.data.amountPaise, paymentId: 'pay_w3g2', eventId: 'evt_w3g_0002' });
    expect((await postHook(env, 'razorpay', hk)).status).toBe(200); expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: hookOrder.body.data.id } })).status).toBe('PAID');
    expect((await postHook(env, 'razorpay', env.hook('razorpay', po, { amountMinor: 1, paymentId: 'pay_w3g3', sign: false }))).status).toBe(401);
  });

  it('an order can be cancelled by its owner only while it is unpaid, and money for a cancelled order is held', async () => {
    const c = await order(); const id = c.body.data.id as string; const po = c.body.data.providerOrderId as string;
    expect((await env.api('post', `/v3/me/billing/orders/${id}/cancel`, tokenA, {})).body.data.status).toBe('CANCELLED');
    const late = env.hook('razorpay', po, { amountMinor: c.body.data.amountPaise, paymentId: 'pay_w3g4', eventId: 'evt_w3g_0004' }); expect((await postHook(env, 'razorpay', late)).status).toBe(200);
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id } })).status).toBe('REVIEW'); expect(await prisma.v3PlanInvoice.count({ where: { orderId: id } })).toBe(0);
  });
});
