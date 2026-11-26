import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { AdminPayLinkController, MePayLinkController } from '../src/plan-billing/api/pay-link.controllers';
import { PaymentsWebhookController } from '../src/plan-billing/api/payments-webhook.controller';
import { normalizeRazorpayEvent } from '../src/plan-billing/gateway/gateway-core';
import { PaymentLinkGate } from '../src/plan-billing/pay-link/payment-link.gate';
import { PaymentLinkMade, PaymentLinkPort, PaymentLinkRequest } from '../src/plan-billing/pay-link/payment-link.port';
import { PlanPayLinkService } from '../src/plan-billing/pay-link/plan-pay-link.service';
import { RAZORPAY_LINKS_URL, RazorpayPaymentLinkAdapter } from '../src/plan-billing/pay-link/razorpay-payment-link.adapter';
import { PlanOrderService } from '../src/plan-billing/plan-order.service';
import { PaymentsGate } from '../src/plan-billing/razorpay/payments-gate';
import { billingSettingProblem, BillingSettings, DEFAULT_BILLING_SETTINGS } from '../src/plan-billing/settings/billing-settings';
import { PaymentSettlementService } from '../src/plan-billing/settlement.service';
import { PartnersService } from '../src/v3-partners/partners.service';
import { TelecallerSelfController } from '../src/v3-telecaller/telecaller.controllers';
import { TelecallerService } from '../src/v3-telecaller/telecaller.service';
import { advance, billingWorld, BillingWorld, currentOf, STAFF, VENDOR } from './support/billing-world';
import { FakeRazorpay } from './support/fake-razorpay';

/**
 * E11e: the payment link. The real order, link, webhook and settlement services over the in-memory billing store; the checkout gateway and the link gateway are
 * fakes. No key exists, and nothing is sent anywhere.
 */
jest.setTimeout(180_000);

class FakeLinks extends PaymentLinkPort {
  made: Array<PaymentLinkRequest & { linkId: string }> = []; fail = false; private n = 0;
  async createLink(r: PaymentLinkRequest): Promise<PaymentLinkMade> {
    if (this.fail) throw new Error('gateway down');
    const linkId = `plink_Test${++this.n}`; this.made.push({ ...r, linkId });
    return { linkId, url: `https://rzp.invalid/i/${linkId}` };
  }
}
class FakeLinkGate extends PaymentLinkGate {
  constructor(settings: { get: () => Promise<BillingSettings> }, keys: PaymentsGate, readonly fake: FakeLinks) { super(settings, keys); }
  protected build(): PaymentLinkPort { return this.fake; }
}
/** The real keys gate over made-up values: the rules that decide whether a key set is usable are the shipped ones. */
type Env = Record<string, string | undefined>;
const TEST_ENV: Env = { RAZORPAY_TEST_KEY_ID: 'rzp_test_unit', RAZORPAY_TEST_KEY_SECRET: 's', RAZORPAY_TEST_WEBHOOK_SECRET: 'w' };
function keysGate(env: Env = TEST_ENV, stored?: Record<string, string>): PaymentsGate {
  const g = new PaymentsGate({} as never, stored ? ({ resolve: async () => stored, version: () => 0 } as never) : undefined);
  g.env = { ...env };
  return g;
}

interface World extends BillingWorld { links: FakeLinks; gateL: FakeLinkGate; keys: PaymentsGate; pay: PlanPayLinkService; hours: { v: number | null }; commission: string[]; settle2: PaymentSettlementService; get: () => Promise<BillingSettings> }
function world(on = true): World {
  const w = billingWorld();
  if (on) w.settings.over = { paymentsMode: 'test', payLinkEnabled: true };
  const get = async (): Promise<BillingSettings> => ({ ...DEFAULT_BILLING_SETTINGS, graceDays: 7, upgradeProration: 'NONE', renewalReminderDays: [14, 7, 1], ...w.settings.over });
  const links = new FakeLinks(); const keys = keysGate(); const gateL = new FakeLinkGate({ get }, keys, links); const hours = { v: 48 as number | null }; const commission: string[] = [];
  const settle2 = new PaymentSettlementService(w.repo, { get }, w.gate, { invalidate: (v: string) => { w.invalidated.push(v); } }, undefined, undefined, undefined,
    { onPlanPaid: async (i) => { commission.push(`${i.vendorId}:${i.orderId}:${i.via}`); }, onPaymentReversed: async () => undefined });
  settle2.clock = () => new Date(w.now.t);
  const pay = new PlanPayLinkService(w.repo, w.orders, gateL, { get }, { get: async () => ({ payLinkExpiryHours: hours.v }) as never }); pay.clock = () => new Date(w.now.t);
  return { ...w, links, gateL, keys, pay, hours, commission, settle2, get };
}

let k = 0;
const input = (over: Partial<{ planKey: string; termMonths: number; idempotencyKey: string }> = {}) => ({ planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `link-key-${++k}-abcdefgh`, ...over });
const refusal = (code: string) => ({ response: { code } });

/** What Razorpay sends when a link is paid (signed with the fake provider's webhook secret). */
function linkPaid(linkId: string, o: { amount?: number; currency?: string; linkStatus?: string; paymentStatus?: string; eventId?: string; signWith?: string; event?: string } = {}) {
  const amount = o.amount ?? 354_000; const currency = o.currency ?? 'INR';
  const raw = JSON.stringify({ entity: 'event', event: o.event ?? 'payment_link.paid', payload: {
    payment_link: { entity: { id: linkId, status: o.linkStatus ?? 'paid', amount_paid: amount, currency, customer: { contact: '+919876543210', email: 'buyer@example.com' } } },
    payment: { entity: { id: 'pay_Link1', order_id: 'order_madeByTheGateway', amount, currency, status: o.paymentStatus ?? 'captured', contact: '+919876543210' } },
    order: { entity: { id: 'order_madeByTheGateway', amount_paid: amount, currency } },
  } });
  return { raw, signature: createHmac('sha256', o.signWith ?? FakeRazorpay.WEBHOOK_SECRET).update(raw).digest('hex'), eventId: o.eventId ?? `evt_link_${++k}` };
}
const deliver = (w: World, e: { raw: string; signature: string; eventId: string }) => w.settle2.handleWebhook(Buffer.from(e.raw), e.signature, e.eventId);
const invoices = async (w: World) => (await w.repo.listInvoicesForVendor('v1', 0, 50)).items;
const orderOf = async (w: World, id: string) => (await w.repo.getOrder(id))!;
const orderCount = async (w: World) => (await w.repo.listOrdersForVendor('v1', 0, 100)).total;
const linkOf = async (w: World, orderId: string) => (await orderOf(w, orderId)).providerOrderId!;

describe('E11e: the switch stays off until staff turn it on, and never goes live', () => {
  it('payLinkEnabled is off by default and only true or false', () => {
    expect(DEFAULT_BILLING_SETTINGS.payLinkEnabled).toBe(false);
    expect([billingSettingProblem('payLinkEnabled', true), billingSettingProblem('payLinkEnabled', 'yes')]).toEqual([null, 'must be true or false']);
  });

  it.each([
    ['the switch off (the default)', { paymentsMode: 'test' }, 'PAYMENT_LINKS_DISABLED'],
    ['payments off', { paymentsMode: 'off', payLinkEnabled: true }, 'PAYMENTS_DISABLED'],
    ['live mode', { paymentsMode: 'live', payLinkEnabled: true }, 'PAYMENT_LINKS_TEST_ONLY'],
    ['another gateway', { paymentsMode: 'test', payLinkEnabled: true, paymentGateway: 'cashfree' }, 'PAYMENTS_NOT_CONFIGURED'],
  ] as const)('refuses with %s, and writes no order', async (_n, over, code) => {
    const w = world(false); w.settings.over = over;
    await expect(w.pay.create('v1', input(), VENDOR)).rejects.toMatchObject(refusal(code));
    expect(await orderCount(w)).toBe(0); expect(w.links.made).toHaveLength(0);
  });

  it('refuses live mode even with the live flag on, and never builds a link adapter from live keys', async () => {
    const w = world(); w.settings.over = { paymentsMode: 'live', payLinkEnabled: true }; w.keys.env = { PLAN_PAYMENTS_LIVE_ENABLED: 'true', RAZORPAY_LIVE_KEY_ID: 'rzp_live_x', RAZORPAY_LIVE_KEY_SECRET: 's', RAZORPAY_LIVE_WEBHOOK_SECRET: 'w' };
    await expect(w.pay.create('v1', input(), VENDOR)).rejects.toMatchObject(refusal('PAYMENT_LINKS_TEST_ONLY'));
    w.settings.over = { paymentsMode: 'test', payLinkEnabled: true }; w.keys.env = { RAZORPAY_TEST_KEY_ID: 'rzp_live_x', RAZORPAY_TEST_KEY_SECRET: 's', RAZORPAY_TEST_WEBHOOK_SECRET: 'w' };
    await expect(w.pay.create('v1', input(), VENDOR)).rejects.toMatchObject(refusal('PAYMENTS_NOT_CONFIGURED'));
  });

  it('refuses without a complete set of test keys (the webhook secret too), and takes the keys stored in the admin app first', async () => {
    const w = world();
    for (const missing of ['RAZORPAY_TEST_KEY_ID', 'RAZORPAY_TEST_KEY_SECRET', 'RAZORPAY_TEST_WEBHOOK_SECRET']) {
      const env = { ...TEST_ENV }; delete env[missing];
      const gate = new FakeLinkGate({ get: w.get }, keysGate(env), w.links);
      await expect(gate.port()).rejects.toMatchObject(refusal('PAYMENTS_NOT_CONFIGURED'));
    }
    const seen: string[] = [];
    class Spy extends PaymentLinkGate { protected build(keys: { keyId: string }): PaymentLinkPort { seen.push(keys.keyId); return w.links; } }
    const stored = new Spy({ get: w.get }, keysGate({ ...TEST_ENV, RAZORPAY_TEST_KEY_ID: 'rzp_test_env' }, { keyId: 'rzp_test_stored', keySecret: 's', webhookSecret: 'w' }));
    await stored.port(); expect(seen).toEqual(['rzp_test_stored']);
  });

  it('refuses until staff have set how long a link stays open', async () => {
    const w = world(); w.hours.v = null;
    await expect(w.pay.create('v1', input(), VENDOR)).rejects.toMatchObject(refusal('PAYMENT_LINK_EXPIRY_NOT_SET'));
    expect(await orderCount(w)).toBe(0);
  });
});

describe('E11e: making a link', () => {
  it('is a plan order at the server price with GST, open for the set hours, in test mode', async () => {
    const w = world();
    const r = await w.pay.create('v1', input(), STAFF);
    expect(r).toMatchObject({ status: 'PENDING_PAYMENT', planKey: 'handyman_pro', termMonths: 3, amountPaise: 354_000, currency: 'INR', reused: false, testMode: true, url: 'https://rzp.invalid/i/plink_Test1' });
    expect(r.expiresAt.getTime() - w.now.t.getTime()).toBe(48 * 3_600_000);
    const checkout = await w.buy({}, 'v2').catch(() => null);
    expect(checkout?.amountPaise).toBe(r.amountPaise);   // the same price as the online checkout
    expect(w.links.made).toEqual([expect.objectContaining({ amountMinor: 354_000, reference: r.orderId, customer: { name: 'Owner v1', phone: '+919876543210', email: 'v1@x.invalid' } })]);
    expect(await orderOf(w, r.orderId)).toMatchObject({ providerOrderId: 'plink_Test1', gateway: 'razorpay', createdByType: 'STAFF', quote: expect.objectContaining({ payLink: true }) });
    expect(currentOf(w).planId).toBe(w.ids.free);   // nothing is activated by making a link
    expect(await invoices(w)).toHaveLength(0);
  });

  it('the same key returns the same link; another key for the same purchase returns the open link; two clicks at once make one', async () => {
    const w = world(); const first = input();
    const a = await w.pay.create('v1', first, VENDOR);
    expect(await w.pay.create('v1', first, VENDOR)).toMatchObject({ orderId: a.orderId, reused: true });
    expect(await w.pay.create('v1', input(), STAFF)).toMatchObject({ orderId: a.orderId, reused: true, url: a.url });
    expect(w.links.made).toHaveLength(1);
    const x = world(); const two = await Promise.all([x.pay.create('v1', input(), VENDOR), x.pay.create('v1', input(), STAFF)]);
    expect(two[0].orderId).toBe(two[1].orderId); expect(x.links.made).toHaveLength(1);
  });

  it('a different term makes its own link; an expired link is replaced; a new price closes the old order', async () => {
    const w = world();
    const three = await w.pay.create('v1', input(), VENDOR);
    expect((await w.pay.create('v1', input({ termMonths: 6 }), VENDOR)).orderId).not.toBe(three.orderId);
    advance(w, 49 * 3600);
    const later = await w.pay.create('v1', input(), VENDOR); expect(later.orderId).not.toBe(three.orderId);
    w.repo.prices.filter((p) => p.planId === w.ids.pro && p.termMonths === 3).forEach((p) => { p.row.amountPaise = 400_000; });
    const dearer = await w.pay.create('v1', input(), VENDOR);
    expect(dearer).toMatchObject({ reused: false, amountPaise: 472_000 }); expect(dearer.orderId).not.toBe(later.orderId);
    expect((await orderOf(w, later.orderId)).status).toBe('CANCELLED');
    expect(await deliver(w, linkPaid(await linkOf(w, later.orderId)))).toMatchObject({ status: 'OK', result: 'REVIEW' });   // money on the old link is held, never lost
    expect(await invoices(w)).toHaveLength(0);
  });

  it('a gateway failure leaves a failed order and a plain code; a new key then works', async () => {
    const w = world(); w.links.fail = true; const first = input();
    await expect(w.pay.create('v1', first, VENDOR)).rejects.toMatchObject(refusal('PAYMENT_PROVIDER_ERROR'));
    expect(await w.pay.create('v1', first, VENDOR)).toMatchObject({ status: 'FAILED', url: null });
    w.links.fail = false;
    expect(await w.pay.create('v1', input(), VENDOR)).toMatchObject({ status: 'PENDING_PAYMENT' });
  });

  it('keys are not shared between a link and a checkout or cash order, in either direction', async () => {
    const w = world(); const used = input();
    await w.pay.create('v1', used, VENDOR);
    await expect(w.orders.create('v1', used, VENDOR)).rejects.toMatchObject(refusal('IDEMPOTENCY_CONFLICT'));
    await expect(w.orders.createCashOrder('v1', used, STAFF)).rejects.toMatchObject(refusal('IDEMPOTENCY_CONFLICT'));
    const checkout = input(); await w.orders.create('v1', checkout, VENDOR);
    await expect(w.pay.create('v1', checkout, VENDOR)).rejects.toMatchObject(refusal('IDEMPOTENCY_CONFLICT'));
    await expect(w.pay.create('v1', { ...used, termMonths: 6 }, VENDOR)).rejects.toMatchObject(refusal('IDEMPOTENCY_CONFLICT'));
  });
});

describe('E11e: paying a link ends in the same one invoice and one commission', () => {
  it('payment_link.paid starts the plan, makes one invoice and one commission call, however many events follow', async () => {
    const w = world(); const r = await w.pay.create('v1', input(), STAFF); const link = await linkOf(w, r.orderId);
    const paidEvent = linkPaid(link);
    expect(await deliver(w, paidEvent)).toMatchObject({ status: 'OK', result: 'PAID' });
    expect(await deliver(w, paidEvent)).toMatchObject({ status: 'OK', duplicate: true });
    expect(await deliver(w, linkPaid(link))).toMatchObject({ status: 'OK', result: 'ALREADY_PAID' });
    // the gateway also reports the payment against the order it made behind the link: that id is not ours and changes nothing
    for (const event of ['payment.captured', 'order.paid']) {
      const raw = JSON.stringify({ event, payload: { payment: { entity: { id: 'pay_Link1', order_id: 'order_madeByTheGateway', amount: 354_000, currency: 'INR', status: 'captured' } } } });
      expect(await deliver(w, { raw, signature: createHmac('sha256', FakeRazorpay.WEBHOOK_SECRET).update(raw).digest('hex'), eventId: `evt_internal_${++k}` })).toMatchObject({ status: 'OK', result: 'NO_ORDER' });
    }
    await new Promise((done) => setImmediate(done));
    const inv = await invoices(w);
    expect(inv).toHaveLength(1);
    expect(inv[0]).toMatchObject({ invoiceNumber: 'INV/2026-27/000001', orderId: r.orderId });
    expect(inv[0].snapshot).toMatchObject({ amountPaise: 354_000, payment: { method: 'GATEWAY', gateway: 'razorpay', reference: 'pay_Link1' }, order: { providerOrderId: link, via: 'WEBHOOK' } });
    expect(w.commission).toEqual([`v1:${r.orderId}:WEBHOOK`]);
    expect(w.repo.plans.get(currentOf(w).planId)!.key).toBe('handyman_pro');
    expect(w.repo.subs.filter((s) => s.vendorId === 'v1' && s.planId === w.ids.pro)).toHaveLength(1);
    expect(await w.pay.create('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: (await orderOf(w, r.orderId)).idempotencyKey }, STAFF)).toMatchObject({ status: 'PAID', url: null });
    expect(JSON.stringify((await w.repo.listEvents({ skip: 0, take: 20 })).items)).not.toMatch(/9876543210|buyer@example/);
  });

  it('turning the switch off later does not lose a payment already on its way', async () => {
    const w = world(); const r = await w.pay.create('v1', input(), VENDOR);
    w.settings.over = { paymentsMode: 'test', payLinkEnabled: false };
    expect(await deliver(w, linkPaid(await linkOf(w, r.orderId)))).toMatchObject({ result: 'PAID' });
  });

  it.each([
    ['a smaller amount', { amount: 100 }], ['another currency', { currency: 'USD' }],
  ])('holds %s for review and activates nothing', async (_n, over) => {
    const w = world(); const r = await w.pay.create('v1', input(), VENDOR);
    expect(await deliver(w, linkPaid(await linkOf(w, r.orderId), over))).toMatchObject({ result: 'REVIEW' });
    expect((await orderOf(w, r.orderId)).status).toBe('REVIEW'); expect(await invoices(w)).toHaveLength(0); expect(w.commission).toEqual([]); expect(currentOf(w).planId).toBe(w.ids.free);
  });

  it('holds money that arrives after the link expired', async () => {
    const w = world(); const r = await w.pay.create('v1', input(), VENDOR);
    advance(w, 49 * 3600); await w.settle2.expireStale();
    expect(await deliver(w, linkPaid(await linkOf(w, r.orderId)))).toMatchObject({ result: 'REVIEW' });
    expect(await invoices(w)).toHaveLength(0);
  });

  it('a wrong signature, an unpaid or partly paid link, an uncaptured payment and an unknown link activate nothing', async () => {
    const w = world(); const r = await w.pay.create('v1', input(), VENDOR); const link = await linkOf(w, r.orderId);
    expect(await deliver(w, linkPaid(link, { signWith: 'not-the-secret' }))).toMatchObject({ status: 'BAD_SIGNATURE' });
    for (const over of [{ linkStatus: 'created' }, { linkStatus: 'partially_paid' }, { paymentStatus: 'authorized' }, { event: 'payment_link.cancelled', linkStatus: 'cancelled' }, { event: 'payment_link.expired', linkStatus: 'expired' }]) {
      expect(await deliver(w, linkPaid(link, over))).toMatchObject({ status: 'OK', result: 'IGNORED' });
    }
    expect(await deliver(w, linkPaid('plink_Unknown'))).toMatchObject({ result: 'NO_ORDER' });
    expect((await orderOf(w, r.orderId)).status).toBe('PENDING_PAYMENT'); expect(await invoices(w)).toHaveLength(0);
  });

  it('a link order cannot be "confirmed" like a checkout or marked as cash', async () => {
    const w = world(); const r = await w.pay.create('v1', input(), VENDOR);
    await expect(w.orders.confirm('v1', r.orderId, { paymentId: 'pay_x', signature: 'a'.repeat(64) }, VENDOR)).rejects.toMatchObject(refusal('PAYMENT_SIGNATURE_INVALID'));
    await expect(w.settle2.confirmCash(r.orderId, { method: 'CASH', reference: 'R1', receivedOn: '2026-11-05', amountPaise: 354_000, note: 'counter' } as never, STAFF, 'Staff')).rejects.toBeDefined();
    expect((await orderOf(w, r.orderId)).status).toBe('PENDING_PAYMENT');
  });

  it('the event reading: the link id is the order, never the gateway order behind it', () => {
    const e = linkPaid('plink_Abc123');
    expect(normalizeRazorpayEvent(e.raw, e.eventId)).toMatchObject({ kind: 'PAID', providerOrderId: 'plink_Abc123', paymentId: 'pay_Link1', amountMinor: 354_000, currency: 'INR', redacted: { event: 'payment_link.paid', payment_link_id: 'plink_Abc123' } });
    const noId = JSON.stringify({ event: 'payment_link.paid', payload: { payment_link: { entity: { status: 'paid' } }, payment: { entity: { order_id: 'order_x', status: 'captured' } } } });
    expect(normalizeRazorpayEvent(noId, undefined)).toMatchObject({ providerOrderId: null });
  });
});

describe('E11e: the Razorpay adapter (never sent anywhere here)', () => {
  const ask: PaymentLinkRequest = { amountMinor: 354_000, currency: 'INR', reference: 'ord_1', description: 'Pro, 3 months', customer: { name: 'Ravi', phone: null, email: 'r@x.invalid' }, expiresAt: new Date('2026-11-07T10:00:00Z') };
  it('refuses any key that is not a test key', () => {
    for (const keyId of ['rzp_live_abc', 'abc', '']) expect(() => new RazorpayPaymentLinkAdapter({ keyId, keySecret: 's' })).toThrow('TEST keys');
    expect(() => new RazorpayPaymentLinkAdapter({ keyId: 'rzp_test_abc', keySecret: '' })).toThrow();
  });
  it('asks for one link with the exact amount, no part payment and no message from the gateway', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown>; headers: Record<string, string> }> = [];
    const adapter = new RazorpayPaymentLinkAdapter({ keyId: 'rzp_test_abc', keySecret: 'shh-secret' }, async (url, init) => { calls.push({ url, body: JSON.parse(init.body), headers: init.headers }); return { ok: true, status: 200, json: async () => ({ id: 'plink_Xy1', short_url: 'https://rzp.io/i/abc' }) }; });
    expect(await adapter.createLink(ask)).toEqual({ linkId: 'plink_Xy1', url: 'https://rzp.io/i/abc' });
    expect(calls[0].url).toBe(RAZORPAY_LINKS_URL);
    expect(calls[0].body).toEqual({ amount: 354_000, currency: 'INR', accept_partial: false, reference_id: 'ord_1', description: 'Pro, 3 months', customer: { name: 'Ravi', email: 'r@x.invalid' }, notify: { sms: false, email: false }, reminder_enable: false, expire_by: 1_794_045_600, notes: { planOrderId: 'ord_1' } });
    expect(calls[0].headers.Authorization).toMatch(/^Basic /);
    expect(JSON.stringify(adapter)).not.toContain('shh-secret');
  });
  it.each([
    ['a refusal', false, {}], ['no id', true, { short_url: 'https://rzp.io/i/a' }], ['an id of another kind', true, { id: 'order_1', short_url: 'https://rzp.io/i/a' }], ['a link that is not https', true, { id: 'plink_1', short_url: 'http://x' }],
  ])('fails on %s', async (_n, ok, body) => {
    const adapter = new RazorpayPaymentLinkAdapter({ keyId: 'rzp_test_abc', keySecret: 's' }, async () => ({ ok, status: ok ? 200 : 400, json: async () => body }));
    await expect(adapter.createLink(ask)).rejects.toThrow('payment link failed');
  });
});

describe('E11e over HTTP', () => {
  let app: INestApplication; let w: World;
  const send = (url: string, who: string | null, body: object) => { const r = request(app.getHttpServer()).post(url); return (who ? r.set('x-test-principal', who) : r).send(body); };
  beforeEach(async () => {
    w = world();
    const telecaller = new TelecallerService({ get: (t: unknown) => (t === PartnersService ? { forLogin: async (sub: string) => (sub.startsWith('tele') ? { id: `partner-${sub}`, name: sub } : null) } : t === PlanPayLinkService ? w.pay : undefined) } as never,
      { referralAttribution: { findUnique: async ({ where }: { where: { vendorId: string } }) => (where.vendorId === 'v1' ? { partnerId: 'partner-tele-a' } : null) } } as never, {} as never);
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MePayLinkController, AdminPayLinkController, TelecallerSelfController, PaymentsWebhookController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: PlanPayLinkService, useValue: w.pay }, { provide: TelecallerService, useValue: telecaller }, { provide: PaymentSettlementService, useValue: w.settle2 }, { provide: PlanOrderService, useValue: w.orders }],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner') req.user = { sub: 'v1', email: 'o@x.invalid', role: 'VENDOR' };
      else if (p === 'member') req.user = { sub: 'v1', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['accounts', 'wallet'] };
      else if (p?.startsWith('tele')) req.user = { sub: p, email: 't@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING', staffLabel: 'TELECALLER' };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it('the owner makes a link for their own business; the signed webhook then activates it', async () => {
    const r = await send('/v3/me/billing/pay-links', 'owner', input());
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ amountPaise: 354_000, testMode: true, url: expect.stringContaining('https://') });
    expect(JSON.stringify(r.body)).not.toMatch(/secret|vendorId|providerOrderId/);
    const e = linkPaid(await linkOf(w, r.body.data.orderId));
    const hook = await request(app.getHttpServer()).post('/v3/payments/razorpay/webhook').set('content-type', 'application/json').set('x-razorpay-signature', e.signature).set('x-razorpay-event-id', e.eventId).send(e.raw);
    expect(hook.status).toBe(200); expect((await orderOf(w, r.body.data.orderId)).status).toBe('PAID');
  });

  it('a team member and an anonymous caller cannot; no vendor id or amount can be sent', async () => {
    expect((await send('/v3/me/billing/pay-links', 'member', input())).status).toBe(403);
    expect((await send('/v3/me/billing/pay-links', null, input())).status).toBe(401);
    for (const extra of [{ vendorId: 'v2' }, { amountPaise: 1 }, { termMonths: 5 }]) expect((await send('/v3/me/billing/pay-links', 'owner', { ...input(), ...extra })).status).toBe(400);
    expect(await orderCount(w)).toBe(0);
  });

  it('staff: admin and super admin only', async () => {
    for (const who of ['SUPER_ADMIN', 'ADMIN']) expect((await send('/v3/admin/billing/vendors/v1/pay-links', who, input())).status).toBe(200);
    for (const who of ['OPERATIONS', 'MARKETING', 'SUPPORT', 'owner', 'tele-a']) expect([who, (await send('/v3/admin/billing/vendors/v1/pay-links', who, input())).status]).toEqual([who, 403]);
    expect(effectiveRolesFor('POST /v3/admin/billing/vendors/:vendorId/pay-links').slice().sort()).toEqual(['ADMIN', 'SUPER_ADMIN']);
  });

  it('a telecaller makes a link for their own business only', async () => {
    const mine = await send('/v3/admin/telecaller/vendors/v1/pay-links', 'tele-a', input());
    expect(mine.status).toBe(200); expect(await orderOf(w, mine.body.data.orderId)).toMatchObject({ createdByType: 'STAFF', createdById: 'tele-a' });
    const other = await send('/v3/admin/telecaller/vendors/v1/pay-links', 'tele-b', input());
    expect([other.status, other.body.code]).toEqual([404, 'UNKNOWN_VENDOR']);
    const unknown = await send('/v3/admin/telecaller/vendors/v2/pay-links', 'tele-a', input());
    expect(unknown.status).toBe(404);
    expect((await send('/v3/admin/telecaller/vendors/v1/pay-links', 'OPERATIONS', input())).body.code).toBe('NOT_A_TELECALLER');
    expect((await send('/v3/admin/telecaller/vendors/v1/pay-links', 'owner', input())).status).toBe(403);
    expect(await orderCount(w)).toBe(1);
  });

  it('a refusal reaches the screen with its code', async () => {
    w.settings.over = { paymentsMode: 'test', payLinkEnabled: false };
    const r = await send('/v3/me/billing/pay-links', 'owner', input());
    expect([r.status, r.body.code]).toEqual([409, 'PAYMENT_LINKS_DISABLED']);
  });
});
