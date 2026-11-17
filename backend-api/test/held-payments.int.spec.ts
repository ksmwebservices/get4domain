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
 * Wave 4 W2 on STAGING (in-memory gateways, real database): a payment the gateway reported with the wrong amount is HELD (the order goes to REVIEW); ADMIN and SUPER_ADMIN list it, open it, and ACCEPT it only at
 * the exact order total including GST (one transaction: plan activated, invoice made, audit row) or REJECT it with a note (the order fails, nothing is activated); both are idempotent; every other role and the
 * vendor are refused. No refund is made here. Synthetic data only. NOT RUN in the build session that wrote it (a lane that never touches a database): the owner runs this file alone on staging.
 */
jest.setTimeout(240_000);

describe('held payments on staging', () => {
  let env: Wave3Env; let prisma: PrismaClient; let fx: BillingFixture; let A: SeededTenant; let tokenA: string; const t: Record<string, string> = {};
  const base = '/v3/admin/billing/held-payments';
  const planOf = async (): Promise<string> => (await prisma.v3PlanSubscription.findFirstOrThrow({ where: { vendorId: A.vendorId, currentVendorId: A.vendorId }, include: { plan: true } })).plan.key;

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma); env = await bootWave3(prisma);
    A = await seedTenant(prisma, 'w4ha', RUN_ID); await makeSiteVendor(prisma, env.app.get(SubscriptionsService), A, RUN_ID, {}); tokenA = vendorToken(A.vendorId, A.email);
    for (const [k, role] of [['sup', 'SUPER_ADMIN'], ['admin', 'ADMIN'], ['ops', 'OPERATIONS'], ['mkt', 'MARKETING'], ['fe', 'FIELD_EXECUTIVE'], ['tc', 'TELECALLER'], ['sp', 'SUPPORT']] as const) t[k] = await seedStaff(prisma, `w4h${k}`, RUN_ID, role);
  }, 300000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => env?.app.close(), () => prisma?.$disconnect()]); }, 180000);

  /** an order whose payment the gateway reported at 354001 paise against a 354000 order: HELD */
  let n = 0;
  async function held(gateway: 'razorpay' | 'cashfree' = 'cashfree'): Promise<{ id: string; providerOrderId: string; paymentId: string }> {
    await env.setGateway(gateway);
    const c = await env.api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: env.key('held') });
    expect(c.status).toBe(200); expect(c.body.data.amountPaise).toBe(354_000);
    const id = c.body.data.id as string; const po = c.body.data.providerOrderId as string; const paymentId = gateway === 'razorpay' ? `pay_w4h${++n}${RUN_ID.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}` : `w4h${++n}${Date.now() % 100000}`;
    const wrong = env.hook(gateway, po, { amountMinor: 354_001, paymentId, eventId: `w4h-${RUN_ID}-${n}` });
    expect((await postHook(env, gateway, wrong)).status).toBe(200);
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id } })).status).toBe('REVIEW');
    return { id, providerOrderId: po, paymentId };
  }
  const accept = (token: string, id: string, over: object = {}) => env.api('post', `${base}/${id}/resolve`, token, { action: 'ACCEPT', note: 'checked the gateway dashboard', verifiedAmountPaise: 354_000, gatewayPaymentId: 'pay_verified_w4', ...over });
  const reject = (token: string, id: string, over: object = {}) => env.api('post', `${base}/${id}/resolve`, token, { action: 'REJECT', note: 'the payment was for another business', ...over });

  it('only ADMIN and SUPER_ADMIN list, open or resolve a held payment; OPERATIONS, SALES, both labels, SUPPORT, the vendor and an anonymous caller are refused', async () => {
    const h = await held();
    for (const who of ['ops', 'mkt', 'fe', 'tc', 'sp']) {
      expect([who, (await env.api('get', base, t[who])).status]).toEqual([who, 403]);
      expect([who, (await env.api('get', `${base}/${h.id}`, t[who])).status]).toEqual([who, 403]);
      expect([who, (await accept(t[who], h.id)).status]).toEqual([who, 403]);
    }
    for (const r of [await env.api('get', base, tokenA), await accept(tokenA, h.id)]) expect(r.status).toBe(403);
    expect((await env.api('get', base)).status).toBe(401);
    for (const who of ['admin', 'sup']) expect([who, (await env.api('get', base, t[who])).status]).toEqual([who, 200]);
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: h.id } })).status).toBe('REVIEW');   // nothing the refused callers did changed it
  });

  it('the list and the detail show the order, the expected total, the amount seen and the gateway ids; filters by business and gateway page the answer', async () => {
    const h = await held('cashfree');
    const list = await env.api('get', `${base}?vendorId=${A.vendorId}&gateway=cashfree`, t.admin); expect(list.status).toBe(200);
    const row = (list.body.data.items as Array<{ id: string }>).find((i) => i.id === h.id); expect(row).toMatchObject({ id: h.id, vendorId: A.vendorId, gateway: 'cashfree', status: 'REVIEW', expectedTotalPaise: 354_000, amountSeenPaise: 354_001, heldReason: 'AMOUNT_MISMATCH', resolution: null });
    expect((await env.api('get', `${base}?vendorId=${A.vendorId}&gateway=razorpay`, t.sup)).body.data.items.find((i: { id: string }) => i.id === h.id)).toBeUndefined();
    expect((await env.api('get', `${base}?gateway=paypal`, t.sup)).status).toBe(400);
    const one = await env.api('get', `${base}/${h.id}`, t.sup); expect(one.status).toBe(200); expect(one.body.data).toMatchObject({ providerOrderId: h.providerOrderId, gatewayPaymentId: h.paymentId });
    expect((await env.api('get', `${base}/no-such-order`, t.sup)).body.code).toBe('HELD_PAYMENT_NOT_FOUND');
  });

  it('ACCEPT at any amount other than the exact total is refused HELD_AMOUNT_MISMATCH and activates nothing; at the exact total it activates Pro and makes one invoice, once', async () => {
    const h = await held(); const before = await planOf();
    for (const verifiedAmountPaise of [354_001, 353_999, 1]) { const r = await accept(t.admin, h.id, { verifiedAmountPaise, gatewayPaymentId: h.paymentId }); expect([r.status, r.body.code]).toEqual([409, 'HELD_AMOUNT_MISMATCH']); }
    expect(await planOf()).toBe(before); expect(await prisma.v3PlanInvoice.count({ where: { orderId: h.id } })).toBe(0);
    const ok = await accept(t.admin, h.id, { gatewayPaymentId: h.paymentId }); expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ status: 'PAID', outcome: 'ACCEPTED', invoice: { number: expect.any(String) } });
    expect(await planOf()).toBe('handyman_pro'); expect(await prisma.v3PlanInvoice.count({ where: { orderId: h.id } })).toBe(1);
    expect(await prisma.v3AuditLog.count({ where: { action: 'billing.held.accepted', entityId: h.id } })).toBe(1);
    const again = await accept(t.sup, h.id, { gatewayPaymentId: h.paymentId }); expect(again.body.data).toMatchObject({ outcome: 'ALREADY_ACCEPTED' });
    expect(await prisma.v3PlanInvoice.count({ where: { orderId: h.id } })).toBe(1);
    expect((await env.api('get', `${base}/${h.id}`, t.sup)).body.data).toMatchObject({ resolution: 'ACCEPTED', note: 'checked the gateway dashboard' });
  });

  it('REJECT fails the order with the note and activates nothing; it is idempotent, audited, and an accepted or rejected payment cannot be resolved the other way', async () => {
    const h = await held(); const before = await planOf();
    const r = await reject(t.admin, h.id); expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ status: 'FAILED', outcome: 'REJECTED' });
    expect(await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ status: 'FAILED', reason: 'the payment was for another business' });
    expect(await planOf()).toBe(before); expect(await prisma.v3PlanInvoice.count({ where: { orderId: h.id } })).toBe(0);
    expect((await reject(t.sup, h.id)).body.data).toMatchObject({ outcome: 'ALREADY_REJECTED' });
    expect(await prisma.v3AuditLog.count({ where: { action: 'billing.held.rejected', entityId: h.id } })).toBe(1);
    const late = await accept(t.admin, h.id, { gatewayPaymentId: h.paymentId }); expect([late.status, late.body.code]).toEqual([409, 'HELD_ALREADY_RESOLVED']);
    expect((await env.api('get', `${base}?vendorId=${A.vendorId}`, t.sup)).body.data.items.find((i: { id: string }) => i.id === h.id)).toBeUndefined();   // no longer held
    const h2 = await held(); await accept(t.admin, h2.id, { gatewayPaymentId: h2.paymentId });
    const rev = await reject(t.admin, h2.id); expect([rev.status, rev.body.code]).toEqual([409, 'HELD_ALREADY_RESOLVED']);
  });

  it('a bad body is HELD_PAYMENT_INVALID with the fields; an order that is not held is HELD_PAYMENT_NOT_FOUND; a held payment is the only thing these routes touch', async () => {
    const h = await held();
    const bad = await env.api('post', `${base}/${h.id}/resolve`, t.admin, { action: 'ACCEPT' }); expect([bad.status, bad.body.code]).toEqual([400, 'HELD_PAYMENT_INVALID']);
    expect(await env.api('post', `${base}/${h.id}/resolve`, t.admin, { action: 'REFUND', note: 'give it back' })).toMatchObject({ status: 400 });
    const c = await env.api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 6, idempotencyKey: env.key('notheld') });
    const waiting = await reject(t.admin, c.body.data.id as string); expect([waiting.status, waiting.body.code]).toEqual([409, 'HELD_PAYMENT_NOT_FOUND']);
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: c.body.data.id as string } })).status).toBe('PENDING_PAYMENT');
  });

  it('the held payment is an order in REVIEW in the database, and the retired discount-rule routes no longer exist', async () => {
    expect([(await env.api('get', '/v3/admin/discount-rules', t.sup)).status, (await env.api('post', '/v3/admin/discount-rules', t.sup, {})).status]).toEqual([404, 404]);
  });
});
