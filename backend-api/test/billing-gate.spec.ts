import { BadRequestException } from '@nestjs/common';
import { validateSettingValue } from '../src/plans/admin/admin-validation';
import { PaymentsGate } from '../src/plan-billing/razorpay/payments-gate';
import { hmacHex, RazorpayTestAdapter } from '../src/plan-billing/razorpay/razorpay.port';
import { BillingSettings, billingSettingProblem, DEFAULT_BILLING_SETTINGS, resolveBillingSettings } from '../src/plan-billing/settings/billing-settings';

/** Slice 5.1b: the payments gate (off / test / live), the TEST adapter, and the editable settings. No network is used anywhere in this file. */
const settingsFor = (mode: BillingSettings['paymentsMode']) => ({ get: async () => ({ ...DEFAULT_BILLING_SETTINGS, paymentsMode: mode, graceDays: 7, upgradeProration: 'NONE', renewalReminderDays: [14, 7, 1] }) }) as never;
const KEYS = { RAZORPAY_TEST_KEY_ID: 'rzp_test_abc123', RAZORPAY_TEST_KEY_SECRET: 'secret-value', RAZORPAY_TEST_WEBHOOK_SECRET: 'whsec-value' };
const err = async (p: Promise<unknown>) => { try { await p; return {}; } catch (e) { const r = e as { getResponse?: () => unknown; getStatus?: () => number }; return { code: ((r.getResponse?.() ?? {}) as { code?: string }).code, status: r.getStatus?.() }; } };

describe('PaymentsGate', () => {
  it('OFF (the default): orders are refused with PAYMENTS_DISABLED and the webhook has no adapter', async () => {
    const g = new PaymentsGate(settingsFor('off')); g.env = { ...KEYS };
    expect(await err(g.port())).toEqual({ code: 'PAYMENTS_DISABLED', status: 409 }); expect(await g.webhookPort()).toBeNull();
  });
  it('TEST without keys, or with a key that is not a test key: PAYMENTS_NOT_CONFIGURED', async () => {
    for (const env of [{}, { ...KEYS, RAZORPAY_TEST_KEY_ID: undefined }, { ...KEYS, RAZORPAY_TEST_KEY_SECRET: undefined }, { ...KEYS, RAZORPAY_TEST_WEBHOOK_SECRET: undefined }, { ...KEYS, RAZORPAY_TEST_KEY_ID: 'rzp_live_abc123' }, { ...KEYS, RAZORPAY_TEST_KEY_ID: 'abc' }]) {
      const g = new PaymentsGate(settingsFor('test')); g.env = env as never;
      expect(await err(g.port())).toEqual({ code: 'PAYMENTS_NOT_CONFIGURED', status: 409 }); expect(await g.webhookPort()).toBeNull();
    }
  });
  it('TEST with test keys: the Razorpay TEST adapter, built once; the secret is never exposed (only the public key id)', async () => {
    const g = new PaymentsGate(settingsFor('test')); g.env = { ...KEYS };
    const p = await g.port(); expect(p).toBeInstanceOf(RazorpayTestAdapter); expect(p.publicKeyId()).toBe('rzp_test_abc123'); expect(await g.port()).toBe(p); expect(await g.webhookPort()).toBe(p);
    expect(JSON.stringify(p.publicKeyId())).not.toContain('secret-value');
  });
  it('LIVE is refused: with no flag, with the flag, and with live keys in the environment (this build has no live adapter)', async () => {
    for (const env of [{ ...KEYS }, { ...KEYS, PLAN_PAYMENTS_LIVE_ENABLED: 'true' }, { RAZORPAY_TEST_KEY_ID: 'rzp_live_x1', RAZORPAY_TEST_KEY_SECRET: 's', RAZORPAY_TEST_WEBHOOK_SECRET: 'w', PLAN_PAYMENTS_LIVE_ENABLED: 'true' }]) {
      const g = new PaymentsGate(settingsFor('live')); g.env = env as never;
      expect(await err(g.port())).toEqual({ code: 'PAYMENTS_NOT_CONFIGURED', status: 409 }); expect(await g.webhookPort()).toBeNull();
    }
  });
});

describe('RazorpayTestAdapter (with a fake fetch: no network)', () => {
  const keys = { keyId: 'rzp_test_abc123', keySecret: 'secret-value', webhookSecret: 'whsec-value' };
  const mk = (reply: { ok?: boolean; status?: number; body: unknown }) => { const calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body?: string } }> = []; const a = new RazorpayTestAdapter(keys, async (url, init) => { calls.push({ url, init }); return { ok: reply.ok ?? true, status: reply.status ?? 200, json: async () => reply.body }; }); return { a, calls }; };
  it('refuses live keys outright', () => { for (const id of ['rzp_live_abc', 'abc', '', 'rzp_test_']) expect(() => new RazorpayTestAdapter({ ...keys, keyId: id })).toThrow(/TEST keys/); });
  it('createOrder posts integer paise and the receipt to the orders endpoint with basic auth, and returns the provider order', async () => {
    const { a, calls } = mk({ body: { id: 'order_1', amount: 354000, currency: 'INR', status: 'created' } });
    expect(await a.createOrder({ amountPaise: 354000, currency: 'INR', receipt: 'ord-1' })).toEqual({ id: 'order_1', amount: 354000, currency: 'INR', status: 'created' });
    expect(calls[0].url).toBe('https://api.razorpay.com/v1/orders'); expect(JSON.parse(calls[0].init.body!)).toEqual({ amount: 354000, currency: 'INR', receipt: 'ord-1' });
    expect(calls[0].init.headers.Authorization).toBe(`Basic ${Buffer.from('rzp_test_abc123:secret-value').toString('base64')}`);
  });
  it('a provider error is an error (never a made-up order), and the error text does not contain the secret', async () => {
    const { a } = mk({ ok: false, status: 400, body: { error: { description: 'bad' } } });
    await expect(a.createOrder({ amountPaise: 100, currency: 'INR', receipt: 'r' })).rejects.toThrow('provider order failed (400)'); await expect(a.createOrder({ amountPaise: 100, currency: 'INR', receipt: 'r' })).rejects.not.toThrow(/secret-value/);
  });
  it('fetchPayment only accepts a payment id, asks the provider, and returns the amount and status the PROVIDER reports', async () => {
    const { a, calls } = mk({ body: { id: 'pay_abc', order_id: 'order_1', amount: 354000, currency: 'INR', status: 'captured' } });
    expect(await a.fetchPayment('pay_abc')).toEqual({ id: 'pay_abc', orderId: 'order_1', amount: 354000, currency: 'INR', status: 'captured' }); expect(calls[0].url).toBe('https://api.razorpay.com/v1/payments/pay_abc');
    for (const bad of ['../orders', 'pay_', 'x', 'pay_a/b', '']) await expect(a.fetchPayment(bad)).rejects.toThrow('not a payment id');
  });
  it('payment signature = HMAC-SHA256(order_id|payment_id, key secret): the right one passes; anything else, including malformed input, fails', () => {
    const { a } = mk({ body: {} }); const sig = hmacHex('secret-value', 'order_1|pay_1');
    expect(a.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig })).toBe(true);
    const tampered = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);   // always differs from sig
    for (const s of [tampered, sig.toUpperCase(), '', 'zz', sig + 'aa', null as never, undefined as never]) expect(a.verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: s })).toBe(false);
    expect(a.verifyPaymentSignature({ orderId: 'order_2', paymentId: 'pay_1', signature: sig })).toBe(false);
  });
  it('webhook signature = HMAC-SHA256(raw body, webhook secret) and a changed byte breaks it', () => {
    const { a } = mk({ body: {} }); const body = '{"event":"payment.captured"}'; const sig = hmacHex('whsec-value', body);
    expect(a.verifyWebhookSignature(body, sig)).toBe(true); expect(a.verifyWebhookSignature(Buffer.from(body), sig)).toBe(true); expect(a.verifyWebhookSignature(body + ' ', sig)).toBe(false);
    expect(a.verifyWebhookSignature(body, undefined)).toBe(false); expect(a.verifyWebhookSignature(body, hmacHex('secret-value', body))).toBe(false);   // the payment key is not the webhook key
  });
});

describe('billing settings', () => {
  it('defaults: payments OFF, reminders OFF, seller details EMPTY (nothing invented), a neutral invoice prefix, 30 minute orders', () => {
    expect(DEFAULT_BILLING_SETTINGS).toEqual({ paymentsMode: 'off', orderExpiryMinutes: 30, renewalRemindersEnabled: false, invoiceNumberPrefix: 'INV', invoiceSellerName: '', invoiceSellerAddress: '', invoiceSellerGstin: '' });
  });
  it.each([
    ['paymentsMode', 'test', true], ['paymentsMode', 'live', true], ['paymentsMode', 'on', false], ['orderExpiryMinutes', 30, true], ['orderExpiryMinutes', 4, false], ['orderExpiryMinutes', 1441, false],
    ['renewalRemindersEnabled', true, true], ['renewalRemindersEnabled', 'yes', false], ['invoiceNumberPrefix', 'INV', true], ['invoiceNumberPrefix', 'inv', false], ['invoiceNumberPrefix', 'TOOLONGPFX', false], ['invoiceNumberPrefix', '', false],
    ['invoiceSellerName', '', true], ['invoiceSellerName', 'x'.repeat(121), false], ['invoiceSellerGstin', '', true], ['invoiceSellerGstin', '29ABCDE1234F1Z5', true], ['invoiceSellerGstin', '29abcde1234f1z5', false], ['invoiceSellerGstin', '123', false],
  ] as Array<[Parameters<typeof billingSettingProblem>[0], unknown, boolean]>)('%s = %j -> %s', (k, v, ok) => { expect(billingSettingProblem(k, v) === null).toBe(ok); });
  it('the three slice 5.1 keys are read with their documented defaults when missing or invalid', () => {
    const r = resolveBillingSettings(new Map<string, unknown>([['graceDays', 'x'], ['upgradeProration', 'WEIRD'], ['renewalReminderDays', [1, 'a']]]));
    expect([r.graceDays, r.upgradeProration, r.renewalReminderDays]).toEqual([7, 'NONE', [14, 7, 1]]);
    const s = resolveBillingSettings(new Map<string, unknown>([['graceDays', 3], ['upgradeProration', 'PRORATE'], ['renewalReminderDays', [30, 3]], ['paymentsMode', 'test']]));
    expect([s.graceDays, s.upgradeProration, s.renewalReminderDays, s.paymentsMode]).toEqual([3, 'PRORATE', [30, 3], 'test']);
  });
  it('the existing plan-settings validator accepts the new keys, refuses bad values and unknown keys, and earlier keys still work', () => {
    expect(() => validateSettingValue('paymentsMode', 'test')).not.toThrow(); expect(() => validateSettingValue('paymentsMode', 'both')).toThrow(BadRequestException);
    expect(() => validateSettingValue('nope', 1)).toThrow(/is not a known plan setting/); expect(() => validateSettingValue('graceDays', 7)).not.toThrow(); expect(() => validateSettingValue('otpMaxAttempts', 5)).not.toThrow();
  });
});
