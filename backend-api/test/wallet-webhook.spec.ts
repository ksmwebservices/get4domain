import { ActivityBus } from '../src/common/activity-bus';
import { DEFAULT_BILLING_SETTINGS } from '../src/plan-billing/settings/billing-settings';
import { PaymentSettlementService } from '../src/plan-billing/settlement.service';
import { WalletActivationListener } from '../src/v3-wallet/wallet-activation.listener';
import { billingWorld, BillingWorld } from './support/billing-world';
import { V1, walletWorld, WalletWorld } from './support/wallet-world';

/**
 * The wallet and plan payments share ONE Razorpay webhook. A top-up payment is credited by the wallet; a plan payment is settled by the plan billing exactly as before (the slice 5.1b tests
 * pass unchanged); a payment for an order that is neither is NO_ORDER. Plan payments and top-ups share one provider here, so a clash of order ids would show.
 */
let bw: BillingWorld; let ww: WalletWorld; let settlement: PaymentSettlementService; let bus: ActivityBus;
const settingsService = { get: async () => ({ ...DEFAULT_BILLING_SETTINGS, graceDays: 7, upgradeProration: 'NONE', renewalReminderDays: [14, 7, 1], paymentsMode: 'test' }) } as never;

beforeEach(async () => {
  bw = billingWorld(); ww = walletWorld({ fake: bw.fake }); bus = ww.bus;
  settlement = new PaymentSettlementService(bw.repo, settingsService, bw.gate, { invalidate: () => undefined }, ww.svc, bus);
  settlement.clock = () => new Date(bw.now.t); ww.now.t = bw.now.t;
  new WalletActivationListener(ww.svc, bus).onModuleInit();
});
const deliver = (paymentId: string, eventId: string, event = 'payment.captured') => { const h = bw.fake.webhook(event, paymentId, { eventId }); return settlement.handleWebhook(h.raw, h.signature, h.eventId); };

describe('a top-up paid through the shared webhook', () => {
  beforeEach(async () => { await ww.open('v1'); });
  const topup = async (amount = 20_000, k = 'wh-topup-key-01') => { const t = await ww.svc.createTopup('v1', { amountPaise: amount, idempotencyKey: k }, V1); return { t, p: bw.fake.pay(t.providerOrderId!) }; };

  it('credits the wallet once, records the result on the event, and answers a replay of the same event with a duplicate', async () => {
    const { p } = await topup();
    expect(await deliver(p.paymentId, 'evt_topup_001')).toMatchObject({ status: 'OK', result: 'TOPUP_CREDITED' });
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(20_000);
    expect(await deliver(p.paymentId, 'evt_topup_001')).toMatchObject({ status: 'OK', duplicate: true });
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(20_000);
    expect(bw.repo.events.get('evt_topup_001')).toMatchObject({ result: 'TOPUP_CREDITED', signatureValid: true });
  });
  it('a different event for the same payment (a provider retry with a new id) credits nothing more', async () => {
    const { p } = await topup();
    await deliver(p.paymentId, 'evt_topup_002'); const again = await deliver(p.paymentId, 'evt_topup_003', 'order.paid');
    expect(again).toMatchObject({ status: 'OK', result: 'TOPUP_ALREADY_PAID' });
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(20_000);
    expect(ww.store.ledger.filter((e) => e.kind === 'TOPUP')).toHaveLength(1);
  });
  it('the browser confirm and the webhook racing each other credit exactly once', async () => {
    const { t, p } = await topup();
    await Promise.all([ww.svc.confirmTopup('v1', t.id, { paymentId: p.paymentId, signature: p.signature }, V1), deliver(p.paymentId, 'evt_topup_004'), deliver(p.paymentId, 'evt_topup_005')]);
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(20_000);
    expect(ww.store.receipts).toHaveLength(1);
  });
  it('a wrong amount is flagged for review and credits nothing', async () => {
    const { p } = await topup(); bw.fake.payments.get(p.paymentId)!.amount = 19_999;
    expect(await deliver(p.paymentId, 'evt_topup_006')).toMatchObject({ result: 'TOPUP_REVIEW' });
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(0);
  });
  it('a bad signature is refused before anything is read, and a failed payment event does nothing', async () => {
    const { p } = await topup(); const h = bw.fake.webhook('payment.captured', p.paymentId, { eventId: 'evt_topup_007', signWith: 'wrong-secret' });
    expect((await settlement.handleWebhook(h.raw, h.signature, h.eventId)).status).toBe('BAD_SIGNATURE');
    expect(await deliver(p.paymentId, 'evt_topup_008', 'payment.failed')).toMatchObject({ result: 'IGNORED' });
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(0);
  });
});

describe('plan payments are untouched', () => {
  it('a plan order paid by webhook is settled as before, opens the wallet through the event, and credits no wallet money', async () => {
    const o = await bw.buy({ planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'plan-key-000001' });
    const p = bw.fake.pay(o.providerOrderId!);
    expect(await deliver(p.paymentId, 'evt_plan_001')).toMatchObject({ status: 'OK', result: 'PAID' });
    expect(bw.repo.orders.get(o.id)!.status).toBe('PAID');
    await new Promise((r) => setImmediate(r));
    expect(await ww.store.wallet('v1')).toMatchObject({ status: 'ACTIVE', activatedByEventId: `order:${o.id}`, balancePaise: 0 });
    expect(ww.store.ledger).toHaveLength(0);
  });
  it('a plan webhook replay is still a duplicate, and the wallet is opened once', async () => {
    const o = await bw.buy({ planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'plan-key-000002' }); const p = bw.fake.pay(o.providerOrderId!);
    await deliver(p.paymentId, 'evt_plan_002'); expect(await deliver(p.paymentId, 'evt_plan_002')).toMatchObject({ duplicate: true });
    await new Promise((r) => setImmediate(r));
    expect(ww.store.audits.filter((a) => a.action === 'wallet.activated')).toHaveLength(1);
  });
  it('a vendor that only has a Free plan (no paid order) never gets a wallet from any event', async () => {
    await ww.svc.onEvidence('v2', { kind: 'SUBSCRIPTION', level: 'FREE', source: 'REGISTRATION', reason: null }, 'free-sub');
    expect(await ww.store.wallet('v2')).toBeNull();
  });
  it('a payment for an order that is neither a plan order nor a top-up is NO_ORDER, with or without the wallet', async () => {
    const stranger = bw.fake.pay((await bw.fake.createOrder({ amountPaise: 5_000, currency: 'INR', receipt: 'x' })).id);
    expect(await deliver(stranger.paymentId, 'evt_none_001')).toMatchObject({ result: 'NO_ORDER' });
    const plain = new PaymentSettlementService(bw.repo, settingsService, bw.gate, { invalidate: () => undefined });
    const h = bw.fake.webhook('payment.captured', stranger.paymentId, { eventId: 'evt_none_002' });
    expect(await plain.handleWebhook(h.raw, h.signature, h.eventId)).toMatchObject({ result: 'NO_ORDER' });
  });
  it('the event bus: a handler that throws never fails the payment', async () => {
    bus.on('plan.order.paid', () => { throw new Error('listener bug'); });
    const o = await bw.buy({ planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'plan-key-000003' }); const p = bw.fake.pay(o.providerOrderId!);
    expect(await deliver(p.paymentId, 'evt_plan_003')).toMatchObject({ result: 'PAID' });
  });
});
