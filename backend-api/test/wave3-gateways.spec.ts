import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { CashfreeGateway } from '../src/plan-billing/gateway/cashfree.gateway';
import { cashfreeSignature, decimalToPaise, normalizeCashfreeEvent, normalizeRazorpayEvent, paiseToDecimal, verifyCashfreeWebhook, WEBHOOK_MAX_SKEW_MS, GatewayName } from '../src/plan-billing/gateway/gateway-core';
import { PaymentGatewaySettingsService } from '../src/plan-billing/gateway/gateway-settings.service';
import { PaymentGatewayPort } from '../src/plan-billing/gateway/gateway.port';
import { InMemoryGateway } from '../src/plan-billing/gateway/in-memory.gateway';
import { PlanOrderService } from '../src/plan-billing/plan-order.service';
import { PaymentsGate } from '../src/plan-billing/razorpay/payments-gate';
import { DEFAULT_BILLING_SETTINGS, BillingSettings } from '../src/plan-billing/settings/billing-settings';
import { PaymentSettlementService } from '../src/plan-billing/settlement.service';
import { billingWorld, currentOf, STAFF, VENDOR } from './support/billing-world';

/**
 * Wave 3 Part C: the payment port, Razorpay and Cashfree, signed webhooks, the amount check, the hold for review, the admin setting.
 * Every secret in this file is made by the test itself (randomBytes) at run time: no key, real or fake-looking, is stored in the repository.
 */
const secret = (): string => randomBytes(16).toString('hex');
const T = new Date('2026-11-20T10:00:00.000Z');
const code = (e: unknown): string => ((e as { response?: { code?: string }; getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };

describe('gateway core: money text and the Cashfree signature', () => {
  it('paise and rupee text round-trip exactly, with no float', () => {
    for (const p of [0, 1, 9, 10, 99, 100, 101, 176646, 354000, 12345678]) expect(decimalToPaise(paiseToDecimal(p))).toBe(p);
    expect(paiseToDecimal(176646)).toBe('1766.46');
    expect(paiseToDecimal(5)).toBe('0.05');
    expect(decimalToPaise(1766.46)).toBe(176646);   // a JSON number is read through its text
    expect(decimalToPaise('1766.4')).toBe(176640);
    expect(decimalToPaise('1766')).toBe(176600);
  });
  it('refuses anything that is not a plain rupee amount with at most two decimals', () => {
    for (const bad of ['1766.456', '-1', '1e3', '', ' ', 'abc', '1,000.00', '1766.', '.5', null, undefined, NaN, Infinity, -5, {}, '99999999999']) expect(decimalToPaise(bad)).toBeNull();
    expect(() => paiseToDecimal(-1)).toThrow();
    expect(() => paiseToDecimal(1.5)).toThrow();
  });

  const key = secret();
  const body = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: 'ord_1' } } });
  const ts = String(T.getTime());
  it('verifies a correct signature over timestamp + raw body', () => {
    expect(verifyCashfreeWebhook(key, body, cashfreeSignature(key, ts, body), ts, T)).toBe(true);
    expect(verifyCashfreeWebhook(key, Buffer.from(body), cashfreeSignature(key, ts, Buffer.from(body)), ts, T)).toBe(true);
    expect(verifyCashfreeWebhook(key, body, cashfreeSignature(key, String(Math.floor(T.getTime() / 1000)), body), String(Math.floor(T.getTime() / 1000)), T)).toBe(true);   // seconds form
  });
  it('refuses a wrong secret, a changed body, a missing header, and a stale or future timestamp', () => {
    const good = cashfreeSignature(key, ts, body);
    expect(verifyCashfreeWebhook(secret(), body, good, ts, T)).toBe(false);
    expect(verifyCashfreeWebhook(key, body + ' ', good, ts, T)).toBe(false);
    expect(verifyCashfreeWebhook(key, body, undefined, ts, T)).toBe(false);
    expect(verifyCashfreeWebhook(key, body, good, undefined, T)).toBe(false);
    expect(verifyCashfreeWebhook(key, body, good, 'not-a-time', T)).toBe(false);
    expect(verifyCashfreeWebhook('', body, good, ts, T)).toBe(false);
    const old = String(T.getTime() - WEBHOOK_MAX_SKEW_MS - 1000);
    expect(verifyCashfreeWebhook(key, body, cashfreeSignature(key, old, body), old, T)).toBe(false);
    const future = String(T.getTime() + WEBHOOK_MAX_SKEW_MS + 1000);
    expect(verifyCashfreeWebhook(key, body, cashfreeSignature(key, future, body), future, T)).toBe(false);
    expect(verifyCashfreeWebhook(key, body, 'x'.repeat(good.length), ts, T)).toBe(false);
  });
});

describe('gateway core: webhook events are normalised and redacted', () => {
  const cf = (type: string, status: string, over: Record<string, unknown> = {}) => JSON.stringify({ type, event_time: '2026-11-20T10:00:00+05:30', data: { order: { order_id: 'ord_9', order_amount: 3540.0, order_currency: 'INR' }, payment: { cf_payment_id: 555, payment_status: status, payment_amount: 3540.0, payment_currency: 'INR', payment_group: 'upi', ...over }, customer_details: { customer_phone: '9999999999', customer_email: 'buyer@example.com' } } });
  it('Cashfree: success is PAID with the PAYMENT amount in paise; failed and dropped are FAILED; the rest is OTHER', () => {
    const ok = normalizeCashfreeEvent(cf('PAYMENT_SUCCESS_WEBHOOK', 'SUCCESS'))!;
    expect(ok).toMatchObject({ kind: 'PAID', providerOrderId: 'ord_9', paymentId: '555', amountMinor: 354000, currency: 'INR', eventId: 'cf-555-PAYMENT_SUCCESS_WEBHOOK' });
    expect(normalizeCashfreeEvent(cf('PAYMENT_FAILED_WEBHOOK', 'FAILED'))!.kind).toBe('FAILED');
    expect(normalizeCashfreeEvent(cf('PAYMENT_USER_DROPPED_WEBHOOK', 'USER_DROPPED'))!.kind).toBe('FAILED');
    expect(normalizeCashfreeEvent(cf('SETTLEMENT_WEBHOOK', 'SUCCESS'))!.kind).toBe('OTHER');
    expect(normalizeCashfreeEvent(cf('PAYMENT_SUCCESS_WEBHOOK', 'PENDING'))!.kind).toBe('OTHER');   // the type says success but the payment is not: not paid
  });
  it('an amount that is not an exact rupee amount reads as no amount (so the settlement holds it)', () => {
    expect(normalizeCashfreeEvent(cf('PAYMENT_SUCCESS_WEBHOOK', 'SUCCESS', { payment_amount: '3540.001' }))!.amountMinor).toBeNull();
  });
  it('the stored copy holds ids, status and amount only: no phone, email, group or free text', () => {
    const r = normalizeCashfreeEvent(cf('PAYMENT_SUCCESS_WEBHOOK', 'SUCCESS'))!.redacted;
    expect(Object.keys(r).sort()).toEqual(['cf_payment_id', 'order_id', 'payment_amount_minor', 'payment_currency', 'payment_status', 'type']);
    expect(JSON.stringify(r)).not.toMatch(/9999999999|buyer@|upi/);
  });
  it('an unreadable body is null; a body with no payment id still gets a stable event id from its digest', () => {
    expect(normalizeCashfreeEvent('not json')).toBeNull();
    expect(normalizeCashfreeEvent('[1]')).toBeNull();
    const a = normalizeCashfreeEvent(JSON.stringify({ type: 'X' }))!; const b = normalizeCashfreeEvent(JSON.stringify({ type: 'X' }))!;
    expect(a.eventId).toBe(b.eventId); expect(a.eventId).toMatch(/^cf-[0-9a-f]{40}$/);
  });
  it('Razorpay: captured and order.paid are PAID, failed is FAILED, the event id is the header', () => {
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_a1', order_id: 'order_b2', amount: 354000, currency: 'INR', status: 'captured', email: 'a@b.c', contact: '+919999999999', card: { last4: '1111' } } } } });
    const n = normalizeRazorpayEvent(raw, 'evt_test_123456')!;
    expect(n).toMatchObject({ kind: 'PAID', providerOrderId: 'order_b2', paymentId: 'pay_a1', amountMinor: 354000, currency: 'INR', eventId: 'evt_test_123456' });
    expect(JSON.stringify(n.redacted)).not.toMatch(/a@b\.c|9999999999|1111/);
    expect(normalizeRazorpayEvent(JSON.stringify({ event: 'payment.failed', payload: {} }), undefined)!.kind).toBe('FAILED');
    expect(normalizeRazorpayEvent(JSON.stringify({ event: 'order.paid', payload: { order: { entity: { id: 'order_z', amount_paid: 100, currency: 'INR' } } } }), 'bad id!')!).toMatchObject({ kind: 'PAID', providerOrderId: 'order_z', amountMinor: 100, eventId: expect.stringMatching(/^evt-/) });
    expect(normalizeRazorpayEvent('nope', undefined)).toBeNull();
  });
});

describe('CashfreeGateway (no network: fetch is injected)', () => {
  const keys = { appId: 'app-' + secret().slice(0, 8), secretKey: secret() };
  const make = (mode: 'test' | 'live', responses: Array<{ ok: boolean; status: number; json: unknown }>) => {
    const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body?: string } }> = [];
    const gw = new CashfreeGateway(keys, mode, async (url, init) => { calls.push({ url, init }); const r = responses.shift()!; return { ok: r.ok, status: r.status, json: async () => r.json }; });
    return { gw, calls };
  };
  it('creates an order with the amount as rupee TEXT, our order id as theirs, and the right host for the mode', async () => {
    const t = make('test', [{ ok: true, status: 200, json: { order_id: 'ord_1', payment_session_id: 'session_x', order_amount: 3540, order_currency: 'INR' } }]);
    const o = await t.gw.createOrder({ amountMinor: 354000, currency: 'INR', receipt: 'ord_1', customer: { id: 'vendor_1', phone: '+91 98765 43210', email: 'a@b.c' } });
    expect(o).toEqual({ providerOrderId: 'ord_1', clientToken: 'session_x', amountMinor: 354000, currency: 'INR' });
    expect(t.calls[0].url).toBe('https://sandbox.cashfree.com/pg/orders');
    const sent = JSON.parse(t.calls[0].init.body!);
    expect(sent).toMatchObject({ order_id: 'ord_1', order_amount: '3540.00', order_currency: 'INR' });
    expect(sent.customer_details.customer_phone).toBe('+919876543210');
    expect(t.calls[0].init.headers['x-client-id']).toBe(keys.appId);
    const l = make('live', [{ ok: true, status: 200, json: { order_id: 'ord_2', payment_session_id: 's', order_amount: '1.00', order_currency: 'INR' } }]);
    await l.gw.createOrder({ amountMinor: 100, currency: 'INR', receipt: 'ord_2', customer: { id: 'v' } });
    expect(l.calls[0].url).toBe('https://api.cashfree.com/pg/orders');
  });
  it('refuses a failed or unreadable create, and an order id Cashfree would not accept', async () => {
    await expect(make('test', [{ ok: false, status: 500, json: {} }]).gw.createOrder({ amountMinor: 100, currency: 'INR', receipt: 'ord_1', customer: { id: 'v' } })).rejects.toThrow(/provider order failed/);
    await expect(make('test', [{ ok: true, status: 200, json: { order_id: 'o', payment_session_id: 's', order_amount: '1.005' } }]).gw.createOrder({ amountMinor: 100, currency: 'INR', receipt: 'ord_1', customer: { id: 'v' } })).rejects.toThrow();
    await expect(make('test', []).gw.createOrder({ amountMinor: 100, currency: 'INR', receipt: 'bad id/../x', customer: { id: 'v' } })).rejects.toThrow(/order id/);
  });
  it('reads the payments of an order into minor units and our statuses; an entry it cannot read exactly is not a payment', async () => {
    const t = make('test', [{ ok: true, status: 200, json: [
      { cf_payment_id: 1, payment_status: 'SUCCESS', payment_amount: 3540, payment_currency: 'INR' },
      { cf_payment_id: '2', payment_status: 'FAILED', payment_amount: '3540.00', payment_currency: 'INR' },
      { cf_payment_id: 3, payment_status: 'NOT_ATTEMPTED', payment_amount: 3540, payment_currency: 'INR' },
      { cf_payment_id: 4, payment_status: 'SUCCESS', payment_amount: '12.345', payment_currency: 'INR' },
      { payment_status: 'SUCCESS', payment_amount: 1 },
    ] }]);
    const p = await t.gw.fetchOrderPayments('ord_1');
    expect(p.map((x) => [x.paymentId, x.status, x.amountMinor])).toEqual([['1', 'SUCCESS', 354000], ['2', 'FAILED', 354000], ['3', 'PENDING', 354000]]);
    expect(t.calls[0].url).toBe('https://sandbox.cashfree.com/pg/orders/ord_1/payments');
    await expect(make('test', [{ ok: false, status: 401, json: {} }]).gw.fetchOrderPayments('ord_1')).rejects.toThrow(/lookup failed/);
    await expect(make('test', []).gw.fetchOrderPayments('../x')).rejects.toThrow();
  });
  it('needs both keys, has no public key, and trusts no browser return (the server fetch is the authority)', () => {
    expect(() => new CashfreeGateway({ appId: '', secretKey: 'x' })).toThrow();
    const g = new CashfreeGateway(keys);
    expect(g.publicKeyId()).toBeNull(); expect(g.verifyReturn()).toBe(true);
  });
  it('never logs or returns a key: the gateway object exposes no key field in its JSON', () => {
    expect(JSON.stringify(new CashfreeGateway(keys))).not.toContain(keys.secretKey);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────── the gate and the full flow
class TestGate extends PaymentsGate {
  readonly gws = new Map<string, InMemoryGateway>();
  protected buildGateway(name: GatewayName): PaymentGatewayPort | null { return this.gws.get(name) ?? null; }
}

function flow(chosen: GatewayName = 'razorpay') {
  const w = billingWorld();
  w.settings.over = { paymentsMode: 'test', paymentGateway: chosen };
  const settings = { get: async (): Promise<BillingSettings> => ({ ...DEFAULT_BILLING_SETTINGS, graceDays: 7, upgradeProration: 'NONE', renewalReminderDays: [14, 7, 1], ...w.settings.over }) } as never;
  const gate = new TestGate(settings);
  const gws = { razorpay: new InMemoryGateway('razorpay', { signing: secret(), webhook: secret() }), cashfree: new InMemoryGateway('cashfree', { signing: secret(), webhook: secret() }) };
  gate.gws.set('razorpay', gws.razorpay); gate.gws.set('cashfree', gws.cashfree);
  const settlement = new PaymentSettlementService(w.repo, settings, gate, { invalidate: () => undefined }); settlement.clock = () => new Date(w.now.t);
  const orders = new PlanOrderService(w.repo, settings, gate, settlement); orders.clock = () => new Date(w.now.t);
  let k = 0;
  const buy = (over: Partial<{ planKey: string; termMonths: number }> = {}, vendorId = 'v1') => orders.create(vendorId, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `wave3-key-${++k}-abcdef`, ...over }, VENDOR);
  const invoices = () => w.repo.invoices.length;
  return { w, gate, gws, settlement, orders, buy, invoices, gw: gws[chosen], set: (over: Partial<BillingSettings>) => { w.settings.over = { ...w.settings.over, ...over }; } };
}
type Flow = ReturnType<typeof flow>;

/** the body and headers a gateway would POST for a payment, signed with the secret the test made */
function deliver(f: Flow, gateway: GatewayName, order: { providerOrderId: string | null }, o: { amountMinor: number; paymentId: string; eventId?: string; sign?: boolean; kind?: 'PAID' | 'FAILED'; currency?: string }) {
  const gw = f.gws[gateway];
  const raw = gateway === 'cashfree'
    ? JSON.stringify({ type: o.kind === 'FAILED' ? 'PAYMENT_FAILED_WEBHOOK' : 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: order.providerOrderId }, payment: { cf_payment_id: o.paymentId, payment_status: o.kind === 'FAILED' ? 'FAILED' : 'SUCCESS', payment_amount: paiseToDecimal(o.amountMinor), payment_currency: o.currency ?? 'INR' } } })
    : JSON.stringify({ event: o.kind === 'FAILED' ? 'payment.failed' : 'payment.captured', payload: { payment: { entity: { id: o.paymentId, order_id: order.providerOrderId, amount: o.amountMinor, currency: o.currency ?? 'INR', status: o.kind === 'FAILED' ? 'failed' : 'captured' } } } });
  const headers = o.sign === false ? gw.signedHeaders(raw + ' tampered', f.w.now.t, o.eventId) : gw.signedHeaders(raw, f.w.now.t, o.eventId);
  return { raw, headers };
}

describe('PaymentsGate: which gateway, which mode', () => {
  const settingsOf = (over: Partial<BillingSettings>) => ({ get: async () => ({ ...DEFAULT_BILLING_SETTINGS, ...over }) }) as never;
  it('is OFF by default: no gateway, no webhook adapter', async () => {
    const g = new PaymentsGate(settingsOf({})); g.env = {};
    expect(code(await err(g.gatewayPort()))).toBe('PAYMENTS_DISABLED');
    expect(await g.webhookGatewayPort('cashfree')).toBeNull(); expect(await g.webhookGatewayPort('razorpay')).toBeNull();
    expect(code(await err(g.portFor('cashfree')))).toBe('PAYMENTS_DISABLED');
  });
  it('test mode builds the CHOSEN gateway from its test keys, and refuses when they are missing', async () => {
    const env = { CASHFREE_TEST_APP_ID: 'a1', CASHFREE_TEST_SECRET_KEY: secret(), RAZORPAY_TEST_KEY_ID: 'rzp_test_abc123', RAZORPAY_TEST_KEY_SECRET: secret(), RAZORPAY_TEST_WEBHOOK_SECRET: secret() };
    const cf = new PaymentsGate(settingsOf({ paymentsMode: 'test', paymentGateway: 'cashfree' })); cf.env = env;
    expect((await cf.gatewayPort()).gateway).toBe('cashfree');
    const rz = new PaymentsGate(settingsOf({ paymentsMode: 'test', paymentGateway: 'razorpay' })); rz.env = env;
    const p = await rz.gatewayPort(); expect(p.gateway).toBe('razorpay'); expect(p.mode).toBe('test');
    const none = new PaymentsGate(settingsOf({ paymentsMode: 'test', paymentGateway: 'cashfree' })); none.env = { RAZORPAY_TEST_KEY_ID: env.RAZORPAY_TEST_KEY_ID, RAZORPAY_TEST_KEY_SECRET: env.RAZORPAY_TEST_KEY_SECRET, RAZORPAY_TEST_WEBHOOK_SECRET: env.RAZORPAY_TEST_WEBHOOK_SECRET };
    expect(code(await err(none.gatewayPort()))).toBe('PAYMENTS_NOT_CONFIGURED');
    expect(await none.webhookGatewayPort('cashfree')).toBeNull();
    expect((await none.webhookGatewayPort('razorpay'))?.gateway).toBe('razorpay');   // an order started on Razorpay is still settled after the switch
  });
  it('live needs the setting AND PLAN_PAYMENTS_LIVE_ENABLED=true AND that gateway live keys; anything less is refused', async () => {
    const live = { CASHFREE_LIVE_APP_ID: 'a1', CASHFREE_LIVE_SECRET_KEY: secret(), RAZORPAY_LIVE_KEY_ID: 'rzp_live_abc123', RAZORPAY_LIVE_KEY_SECRET: secret(), RAZORPAY_LIVE_WEBHOOK_SECRET: secret() };
    for (const gateway of ['cashfree', 'razorpay'] as const) {
      const noFlag = new PaymentsGate(settingsOf({ paymentsMode: 'live', paymentGateway: gateway })); noFlag.env = live;
      expect(code(await err(noFlag.gatewayPort()))).toBe('PAYMENTS_NOT_CONFIGURED');
      expect(await noFlag.webhookGatewayPort(gateway)).toBeNull();
      const ok = new PaymentsGate(settingsOf({ paymentsMode: 'live', paymentGateway: gateway })); ok.env = { ...live, PLAN_PAYMENTS_LIVE_ENABLED: 'true' };
      const p = await ok.gatewayPort(); expect([p.gateway, p.mode]).toEqual([gateway, 'live']);
      const noKeys = new PaymentsGate(settingsOf({ paymentsMode: 'live', paymentGateway: gateway })); noKeys.env = { PLAN_PAYMENTS_LIVE_ENABLED: 'true' };
      expect(code(await err(noKeys.gatewayPort()))).toBe('PAYMENTS_NOT_CONFIGURED');
    }
    const testKeyAsLive = new PaymentsGate(settingsOf({ paymentsMode: 'live', paymentGateway: 'razorpay' })); testKeyAsLive.env = { PLAN_PAYMENTS_LIVE_ENABLED: 'true', RAZORPAY_LIVE_KEY_ID: 'rzp_test_abc', RAZORPAY_LIVE_KEY_SECRET: 'x', RAZORPAY_LIVE_WEBHOOK_SECRET: 'y' };
    expect(code(await err(testKeyAsLive.gatewayPort()))).toBe('PAYMENTS_NOT_CONFIGURED');   // a test key is never accepted as a live key
  });
});

describe.each<GatewayName>(['razorpay', 'cashfree'])('checkout and webhooks on %s', (name) => {
  const pay = (f: Flow, o: { providerOrderId: string | null; amountPaise: number }, over: Partial<{ amountMinor: number; id: string; status: 'SUCCESS' | 'FAILED' | 'PENDING' }> = {}) => {
    const paymentId = over.id ?? (name === 'razorpay' ? 'pay_test1' : '777001');
    f.gw.addPayment({ paymentId, providerOrderId: o.providerOrderId!, amountMinor: over.amountMinor ?? o.amountPaise, currency: 'INR', status: over.status ?? 'SUCCESS' });
    return { paymentId, signature: name === 'razorpay' ? f.gw.returnSignature(o.providerOrderId!, paymentId) : undefined };
  };

  it('creates the order on the chosen gateway with the amount made ONLY on the server: price book plus GST, in paise', async () => {
    const f = flow(name);
    const o = await f.buy();
    expect(o.gateway).toBe(name);
    expect(o.amountPaise).toBe(354000);                                   // 300000 plus 18 percent GST
    expect(o.quote).toMatchObject({ base: 300000, taxMinor: 54000, totalMinor: 354000 });
    expect(o.status).toBe('PENDING_PAYMENT');
    expect(o.providerOrderId).toBe(name === 'cashfree' ? o.id : `order_${o.id}`);
    expect(o.clientToken).toBe(name === 'cashfree' ? `session_${o.id}` : null);
    expect(o.keyId).toBe(name === 'razorpay' ? 'rzp_test_inmemory' : null);
    expect(f.gw.orders.get(o.providerOrderId!)!.amountMinor).toBe(354000);
    expect(JSON.stringify(o)).not.toMatch(/secret|signing|webhook/i);
  });

  it('a different term costs its own price book total plus GST (never a client amount)', async () => {
    const f = flow(name);
    expect((await f.buy({ termMonths: 6 })).amountPaise).toBe(Math.round(540000 * 1.18));
    expect((await f.buy({ termMonths: 12 })).amountPaise).toBe(Math.round(960000 * 1.18));
  });

  it('refuses before any order exists when payments are off or the gateway is not set up', async () => {
    const f = flow(name); f.set({ paymentsMode: 'off' });
    expect(code(await err(f.buy()))).toBe('PAYMENTS_DISABLED');
    expect(f.w.repo.orders.size).toBe(0);
    const g2 = flow(name); g2.gate.gws.delete(name);
    expect(code(await err(g2.buy()))).toBe('PAYMENTS_NOT_CONFIGURED');
    expect(g2.w.repo.orders.size).toBe(0);
  });

  it('a gateway that cannot make the order fails the order and says so', async () => {
    const f = flow(name); f.gw.failCreate = true;
    expect(code(await err(f.buy()))).toBe('PAYMENT_PROVIDER_ERROR');
    expect([...f.w.repo.orders.values()].map((o) => o.status)).toEqual(['FAILED']);
  });

  it('the same idempotency key gives the same order and one gateway order', async () => {
    const f = flow(name);
    const a = await f.orders.create('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'same-key-12345' }, VENDOR);
    const b = await f.orders.create('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'same-key-12345' }, VENDOR);
    expect(b.id).toBe(a.id); expect(f.gw.calls.filter((c) => c === 'createOrder')).toHaveLength(1);
  });

  it('confirm asks the GATEWAY: a successful payment of exactly this order activates the plan and makes the invoice, once', async () => {
    const f = flow(name); const o = await f.buy();
    const p = pay(f, o);
    const r = await f.orders.confirm('v1', o.id, p, VENDOR);
    expect(r.status).toBe('PAID');
    expect(currentOf(f.w).planId).toBe(f.w.ids.pro);
    expect(f.invoices()).toBe(1);
    expect(f.gw.calls).toContain('fetchOrderPayments');
    const again = await f.orders.confirm('v1', o.id, p, VENDOR);   // a second confirm changes nothing
    expect(again.status).toBe('PAID'); expect(f.invoices()).toBe(1);
  });

  it('confirm with nothing paid yet is still in progress; a failed payment is not a purchase', async () => {
    const f = flow(name); const o = await f.buy();
    if (name === 'cashfree') {
      const r = await f.orders.confirm('v1', o.id, {}, VENDOR);
      expect(r).toMatchObject({ pending: true, status: 'PENDING_PAYMENT' });
    }
    const p = pay(f, o, { status: 'FAILED' });
    expect(code(await err(f.orders.confirm('v1', o.id, p, VENDOR)))).toBe('PAYMENT_NOT_CAPTURED');
    expect(currentOf(f.w).planId).toBe(f.w.ids.free); expect(f.invoices()).toBe(0);
  });

  it('confirm never trusts the browser alone: an amount that differs from the order is HELD, not activated', async () => {
    const f = flow(name); const o = await f.buy();
    const p = pay(f, o, { amountMinor: 100 });
    const r = await f.orders.confirm('v1', o.id, p, VENDOR);
    expect(r.status).toBe('REVIEW');
    expect(currentOf(f.w).planId).toBe(f.w.ids.free); expect(f.invoices()).toBe(0);
  });

  it('a signed webhook settles the order; the same event again is a duplicate that changes nothing', async () => {
    const f = flow(name); const o = await f.buy();
    const d = deliver(f, name, o, { amountMinor: 354000, paymentId: name === 'razorpay' ? 'pay_hook1' : '888001', eventId: 'evt_hook_0001' });
    const first = await f.settlement.handleGatewayWebhook(name, d.raw, d.headers);
    expect(first).toMatchObject({ status: 'OK', result: 'PAID' });
    expect(currentOf(f.w).planId).toBe(f.w.ids.pro); expect(f.invoices()).toBe(1);
    const second = await f.settlement.handleGatewayWebhook(name, d.raw, d.headers);
    expect(second).toMatchObject({ status: 'OK', duplicate: true });
    expect(f.invoices()).toBe(1);
    expect([...f.w.repo.events.values()].every((e) => e.provider === name)).toBe(true);
  });

  it('a webhook with a bad signature is refused, stored as unverified, and activates nothing', async () => {
    const f = flow(name); const o = await f.buy();
    const d = deliver(f, name, o, { amountMinor: 354000, paymentId: name === 'razorpay' ? 'pay_bad1' : '888002', sign: false });
    expect(await f.settlement.handleGatewayWebhook(name, d.raw, d.headers)).toEqual({ status: 'BAD_SIGNATURE' });
    expect(currentOf(f.w).planId).toBe(f.w.ids.free); expect(f.invoices()).toBe(0);
    expect([...f.w.repo.events.values()].map((e) => [e.type, e.signatureValid])).toEqual([['unverified', false]]);
    expect(await f.settlement.handleGatewayWebhook(name, d.raw, {})).toEqual({ status: 'BAD_SIGNATURE' });   // no signature header at all
  });

  it('a signed webhook with the WRONG AMOUNT or currency holds the payment for review and never activates', async () => {
    const f = flow(name); const a = await f.buy();
    const wrongAmount = deliver(f, name, a, { amountMinor: 354001, paymentId: name === 'razorpay' ? 'pay_amt1' : '888003', eventId: 'evt_amt_00001' });
    expect(await f.settlement.handleGatewayWebhook(name, wrongAmount.raw, wrongAmount.headers)).toMatchObject({ result: 'REVIEW' });
    expect(f.w.repo.orders.get(a.id)!.status).toBe('REVIEW');
    expect(currentOf(f.w).planId).toBe(f.w.ids.free); expect(f.invoices()).toBe(0);
    const f2 = flow(name); const b = await f2.buy();
    const wrongCurrency = deliver(f2, name, b, { amountMinor: 354000, currency: 'USD', paymentId: name === 'razorpay' ? 'pay_cur1' : '888004', eventId: 'evt_cur_00001' });
    expect(await f2.settlement.handleGatewayWebhook(name, wrongCurrency.raw, wrongCurrency.headers)).toMatchObject({ result: 'REVIEW' });
    expect(f2.invoices()).toBe(0);
  });

  it('a signed webhook for an order we do not know activates nothing and is recorded', async () => {
    const f = flow(name);
    const d = deliver(f, name, { providerOrderId: 'order_unknown_1' }, { amountMinor: 354000, paymentId: name === 'razorpay' ? 'pay_unk1' : '888005', eventId: 'evt_unk_00001' });
    expect(await f.settlement.handleGatewayWebhook(name, d.raw, d.headers)).toMatchObject({ status: 'OK', result: 'NO_ORDER' });
    expect(f.invoices()).toBe(0); expect(f.w.repo.subs.filter((s) => s.current).every((s) => s.planId === f.w.ids.free)).toBe(true);
  });

  it('a failed payment attempt leaves the order payable; a closed order that receives money is held, not activated', async () => {
    const f = flow(name); const o = await f.buy();
    const fail = deliver(f, name, o, { amountMinor: 354000, paymentId: name === 'razorpay' ? 'pay_f1' : '888006', eventId: 'evt_fail_0001', kind: 'FAILED' });
    expect(await f.settlement.handleGatewayWebhook(name, fail.raw, fail.headers)).toMatchObject({ result: 'FAILED_ATTEMPT' });
    expect(f.w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT');
    await f.orders.cancel('v1', o.id, VENDOR);
    expect(f.w.repo.orders.get(o.id)!.status).toBe('CANCELLED');
    const late = deliver(f, name, o, { amountMinor: 354000, paymentId: name === 'razorpay' ? 'pay_late1' : '888007', eventId: 'evt_late_0001' });
    expect(await f.settlement.handleGatewayWebhook(name, late.raw, late.headers)).toMatchObject({ result: 'REVIEW' });
    expect(currentOf(f.w).planId).toBe(f.w.ids.free); expect(f.invoices()).toBe(0);
  });

  it('an order expires, and money for an expired order is held', async () => {
    const f = flow(name); const o = await f.buy();
    f.w.now.t = new Date(f.w.now.t.getTime() + 31 * 60_000);
    expect(await f.settlement.expireStale()).toBe(1);
    expect(f.w.repo.orders.get(o.id)!.status).toBe('EXPIRED');
    const d = deliver(f, name, o, { amountMinor: 354000, paymentId: name === 'razorpay' ? 'pay_exp1' : '888008', eventId: 'evt_exp_00001' });
    expect(await f.settlement.handleGatewayWebhook(name, d.raw, d.headers)).toMatchObject({ result: 'REVIEW' });
    expect(f.invoices()).toBe(0);
  });

  it('the confirm and the webhook racing give exactly one activation and one invoice', async () => {
    const f = flow(name); const o = await f.buy();
    const p = pay(f, o);
    const d = deliver(f, name, o, { amountMinor: 354000, paymentId: p.paymentId, eventId: 'evt_race_0001' });
    await Promise.all([f.orders.confirm('v1', o.id, p, VENDOR), f.settlement.handleGatewayWebhook(name, d.raw, d.headers)]);
    expect(f.invoices()).toBe(1); expect(f.w.repo.subs.filter((s) => s.vendorId === 'v1' && s.current)).toHaveLength(1);
  });

  it('with payments off, a webhook is ignored (nothing to verify against)', async () => {
    const f = flow(name); const o = await f.buy(); f.set({ paymentsMode: 'off' });
    const d = deliver(f, name, o, { amountMinor: 354000, paymentId: name === 'razorpay' ? 'pay_off1' : '888009' });
    expect(await f.settlement.handleGatewayWebhook(name, d.raw, d.headers)).toEqual({ status: 'IGNORED' });
    expect(f.invoices()).toBe(0);
  });

  it("an owner can cancel only an unpaid order of their own; a paid one cannot be cancelled", async () => {
    const f = flow(name); const o = await f.buy();
    expect(code(await err(f.orders.cancel('v2', o.id, VENDOR)))).toBe('ORDER_NOT_FOUND');
    const p = pay(f, o); await f.orders.confirm('v1', o.id, p, VENDOR);
    expect(code(await err(f.orders.cancel('v1', o.id, VENDOR)))).toBe('ORDER_STATE_INVALID');
  });
});

describe('gateway boundaries', () => {
  it('an event from the OTHER gateway for an order is not accepted: the order stays unpaid', async () => {
    const f = flow('cashfree'); const o = await f.buy();
    const d = deliver(f, 'razorpay', o, { amountMinor: 354000, paymentId: 'pay_cross1', eventId: 'evt_cross_001' });
    expect(await f.settlement.handleGatewayWebhook('razorpay', d.raw, d.headers)).toMatchObject({ result: 'GATEWAY_MISMATCH' });
    expect(f.w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT'); expect(f.invoices()).toBe(0);
  });

  it('a signature made with the OTHER gateway secret is refused', async () => {
    const f = flow('cashfree'); const o = await f.buy();
    const raw = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: o.providerOrderId }, payment: { cf_payment_id: 99, payment_status: 'SUCCESS', payment_amount: '3540.00', payment_currency: 'INR' } } });
    const ts = String(f.w.now.t.getTime());
    expect(await f.settlement.handleGatewayWebhook('cashfree', raw, { 'x-webhook-signature': cashfreeSignature(secret(), ts, raw), 'x-webhook-timestamp': ts })).toEqual({ status: 'BAD_SIGNATURE' });
    expect(f.invoices()).toBe(0);
  });

  it('a replayed Cashfree request outside the time window is refused even with a valid signature', async () => {
    const f = flow('cashfree'); const o = await f.buy();
    const d = deliver(f, 'cashfree', o, { amountMinor: 354000, paymentId: '999001' });
    f.w.now.t = new Date(f.w.now.t.getTime() + WEBHOOK_MAX_SKEW_MS + 60_000);
    expect(await f.settlement.handleGatewayWebhook('cashfree', d.raw, d.headers)).toEqual({ status: 'BAD_SIGNATURE' });
    expect(f.invoices()).toBe(0);
  });

  it('switching the gateway never moves an order already in flight: it is confirmed on the gateway it started on', async () => {
    const f = flow('razorpay'); const o = await f.buy();
    f.set({ paymentGateway: 'cashfree' });
    const p = { paymentId: 'pay_inflight', signature: f.gws.razorpay.returnSignature(o.providerOrderId!, 'pay_inflight') };
    f.gws.razorpay.addPayment({ paymentId: 'pay_inflight', providerOrderId: o.providerOrderId!, amountMinor: 354000, currency: 'INR', status: 'SUCCESS' });
    expect((await f.orders.confirm('v1', o.id, p, VENDOR)).status).toBe('PAID');
    const next = await f.buy({ termMonths: 6 });
    expect(next.gateway).toBe('cashfree');   // the next order uses the new choice
  });

  it('a Razorpay confirm with no or a wrong signature is refused before the gateway is asked', async () => {
    const f = flow('razorpay'); const o = await f.buy();
    f.gws.razorpay.addPayment({ paymentId: 'pay_sig1', providerOrderId: o.providerOrderId!, amountMinor: 354000, currency: 'INR', status: 'SUCCESS' });
    for (const input of [{}, { paymentId: 'pay_sig1' }, { paymentId: 'pay_sig1', signature: secret() + secret() }]) expect(code(await err(f.orders.confirm('v1', o.id, input, VENDOR)))).toBe('PAYMENT_SIGNATURE_INVALID');
    expect(f.gws.razorpay.calls).not.toContain('fetchOrderPayments');
    expect(f.invoices()).toBe(0);
  });

  it('no card data is stored anywhere: an order and its events hold ids, amounts and states only', async () => {
    const f = flow('cashfree'); const o = await f.buy();
    const d = deliver(f, 'cashfree', o, { amountMinor: 354000, paymentId: '999002', eventId: 'evt_nocard_01' });
    await f.settlement.handleGatewayWebhook('cashfree', d.raw, d.headers);
    expect(JSON.stringify([...f.w.repo.events.values()])).not.toMatch(/card|cvv|pan|upi|vpa|email|phone|contact/i);
  });
});

describe('PaymentGatewaySettingsService', () => {
  function make(env: Record<string, string | undefined>, initial: Partial<BillingSettings> = {}) {
    let stored: Partial<BillingSettings> = { ...initial };
    const upserts: Array<{ key: string; value: unknown }> = [];
    const prisma = { v3PlanSetting: { upsert: async (a: { where: { key: string }; update: { valueJson: unknown } }) => { upserts.push({ key: a.where.key, value: a.update.valueJson }); (stored as Record<string, unknown>)[a.where.key] = a.update.valueJson; } } };
    let invalidated = 0; const recorded: unknown[] = [];
    const settings = { get: async () => ({ ...DEFAULT_BILLING_SETTINGS, ...stored }), invalidate: () => { invalidated++; } };
    const svc = new PaymentGatewaySettingsService(prisma as never, settings as never, { record: async (r: unknown) => { recorded.push(r); } } as never);
    svc.env = env;
    return { svc, upserts, recorded, invalidated: () => invalidated };
  }
  const keys = { CASHFREE_TEST_APP_ID: 'a', CASHFREE_TEST_SECRET_KEY: secret(), RAZORPAY_TEST_KEY_ID: 'rzp_test_x', RAZORPAY_TEST_KEY_SECRET: secret(), RAZORPAY_TEST_WEBHOOK_SECRET: secret() };

  it('starts OFF on Razorpay and shows only whether keys exist, never a key', async () => {
    const m = make({ ...keys });
    const v = await m.svc.get();
    expect(v).toEqual({ gateway: 'razorpay', mode: 'off', liveAllowedByEnvironment: false, configured: { razorpay: { test: true, live: false }, cashfree: { test: true, live: false } } });
    expect(JSON.stringify(v)).not.toContain(keys.CASHFREE_TEST_SECRET_KEY); expect(JSON.stringify(v)).not.toContain(keys.RAZORPAY_TEST_KEY_SECRET);
  });
  it('switches the gateway and mode, saves both settings, forgets the cache and audits the change', async () => {
    const m = make({ ...keys });
    const v = await m.svc.update({ gateway: 'cashfree', mode: 'test' }, { id: 'admin-1' });
    expect(v).toMatchObject({ gateway: 'cashfree', mode: 'test' });
    expect(m.upserts).toEqual([{ key: 'paymentGateway', value: 'cashfree' }, { key: 'paymentsMode', value: 'test' }]);
    expect(m.invalidated()).toBe(1);
    expect(m.recorded).toHaveLength(1); expect(m.recorded[0]).toMatchObject({ actionKey: 'billing.gateway.changed', actor: { type: 'STAFF', id: 'admin-1' } });
    await m.svc.update({ mode: 'test' }, { id: 'admin-1' });   // nothing changed: nothing written, nothing audited
    expect(m.upserts).toHaveLength(2); expect(m.recorded).toHaveLength(1);
  });
  it('refuses a bad value, an empty request, live without the flag, and a mode whose keys are not on the server', async () => {
    const m = make({ ...keys });
    expect(code(await err(m.svc.update({ gateway: 'paypal' as never }, { id: 'a' })))).toBe('GATEWAY_SETTING_INVALID');
    expect(code(await err(m.svc.update({ mode: 'on' as never }, { id: 'a' })))).toBe('GATEWAY_SETTING_INVALID');
    expect(code(await err(m.svc.update({}, { id: 'a' })))).toBe('GATEWAY_SETTING_INVALID');
    expect(code(await err(m.svc.update({ mode: 'live' }, { id: 'a' })))).toBe('LIVE_NOT_ENABLED');
    const live = make({ PLAN_PAYMENTS_LIVE_ENABLED: 'true', ...keys });
    expect(code(await err(live.svc.update({ mode: 'live' }, { id: 'a' })))).toBe('GATEWAY_NOT_READY');   // the flag is on but no live keys
    const bare = make({});
    expect(code(await err(bare.svc.update({ gateway: 'cashfree', mode: 'test' }, { id: 'a' })))).toBe('GATEWAY_NOT_READY');
    expect(bare.upserts).toEqual([]);
    await expect(bare.svc.update({ mode: 'off' }, { id: 'a' })).resolves.toMatchObject({ mode: 'off' });   // switching OFF is always allowed
  });
});

describe('who may choose the gateway, and the webhook routes', () => {
  const ctx = (role: string, method: string, route: string) => ({ switchToHttp: () => ({ getRequest: () => ({ user: { sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: role }, method, route: { path: route } }) }) }) as never;
  const may = (role: string, key: string): boolean => { const [m, ...r] = key.split(' '); try { return new AdminGuard().canActivate(ctx(role, m, r.join(' '))); } catch { return false; } };
  it('reads: OPERATIONS, ADMIN, SUPER_ADMIN; changes: ADMIN and SUPER_ADMIN; SALES, SUPPORT and the labels never', () => {
    const read = 'GET /v3/admin/payment-gateway'; const write = 'PUT /v3/admin/payment-gateway';
    expect([...effectiveRolesFor(read)].sort()).toEqual(['ADMIN', 'OPERATIONS', 'SUPER_ADMIN']);
    expect([...effectiveRolesFor(write)].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']);
    expect(may('OPERATIONS', write)).toBe(false);
    for (const r of ['MARKETING', 'SUPPORT']) { expect(may(r, read)).toBe(false); expect(may(r, write)).toBe(false); }
  });
  it('both webhook controllers verify the RAW body and read no parsed body', () => {
    const c = fs.readFileSync(path.resolve(__dirname, '../src/plan-billing/api/payments-webhook.controller.ts'), 'utf8');
    expect((c.match(/req\.rawBody/g) ?? []).length).toBe(2);
    expect(c).not.toMatch(/JSON\.stringify\(req\.body\)|@Body\(/);
    expect(c).toMatch(/v3\/payments\/cashfree/); expect(c).toMatch(/@Public\(\)/);
  });
  it('the adapters never log or print a key', () => {
    for (const f of ['cashfree.gateway.ts', 'razorpay.gateway.ts', 'live-gateway.factory.ts', 'gateway-settings.service.ts', 'gateway-core.ts']) {
      expect([f, /console\.|logger\.\w+\(/i.test(fs.readFileSync(path.resolve(__dirname, '../src/plan-billing/gateway', f), 'utf8'))]).toEqual([f, false]);
    }
  });
  it('STAFF identities used above are real staff roles of the world', () => { expect(STAFF.type).toBe('STAFF'); });
});
