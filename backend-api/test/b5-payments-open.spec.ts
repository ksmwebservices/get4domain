import { PaymentsGate } from '../src/plan-billing/razorpay/payments-gate';
import { BillingSettings, DEFAULT_BILLING_SETTINGS } from '../src/plan-billing/settings/billing-settings';
import { PublicPricingPageController } from '../src/plans/public/public-pricing.controller';

/** B5.6: paymentsOpen is true only when paymentsMode is test or live AND the gateway keys are configured. No network, no key value in any answer. */
const settingsFor = (mode: BillingSettings['paymentsMode'], gateway: BillingSettings['paymentGateway'] = 'razorpay') => ({ get: async () => ({ ...DEFAULT_BILLING_SETTINGS, paymentsMode: mode, paymentGateway: gateway }) }) as never;
const TEST_KEYS = { RAZORPAY_TEST_KEY_ID: 'rzp_test_abc123', RAZORPAY_TEST_KEY_SECRET: 'secret-value', RAZORPAY_TEST_WEBHOOK_SECRET: 'whsec-value' };
const gate = (mode: BillingSettings['paymentsMode'], env: Record<string, string | undefined>, gateway: BillingSettings['paymentGateway'] = 'razorpay') => { const g = new PaymentsGate(settingsFor(mode, gateway)); g.env = env as never; return g; };

describe('PaymentsGate.isOpen', () => {
  it('off is closed, even with keys', async () => { expect(await gate('off', TEST_KEYS).isOpen()).toBe(false); });
  it('test with the three test keys is open; with any key missing or a non-test key id it is closed', async () => {
    expect(await gate('test', TEST_KEYS).isOpen()).toBe(true);
    for (const env of [{}, { ...TEST_KEYS, RAZORPAY_TEST_KEY_ID: undefined }, { ...TEST_KEYS, RAZORPAY_TEST_KEY_SECRET: undefined }, { ...TEST_KEYS, RAZORPAY_TEST_WEBHOOK_SECRET: undefined }, { ...TEST_KEYS, RAZORPAY_TEST_KEY_ID: 'rzp_live_abc123' }]) expect(await gate('test', env).isOpen()).toBe(false);
  });
  it('live is closed without the environment flag, and closed with the flag but no live keys', async () => {
    expect(await gate('live', { ...TEST_KEYS }).isOpen()).toBe(false);
    expect(await gate('live', { ...TEST_KEYS, PLAN_PAYMENTS_LIVE_ENABLED: 'true' }).isOpen()).toBe(false);
  });
  it('the Cashfree gateway in test mode is open only with its own keys', async () => {
    expect(await gate('test', { ...TEST_KEYS }, 'cashfree').isOpen()).toBe(false);
    expect(await gate('test', { CASHFREE_TEST_APP_ID: 'a', CASHFREE_TEST_SECRET_KEY: 's' }, 'cashfree').isOpen()).toBe(true);
  });
  it('a failure reading the settings is closed, not an error', async () => {
    const g = new PaymentsGate({ get: async () => { throw new Error('db down'); } } as never); await expect(g.isOpen()).resolves.toBe(false);
  });
});

describe('GET /v3/public/pricing paymentsOpen', () => {
  const res = { set: jest.fn() } as never;
  const make = (port?: { isOpen: () => Promise<boolean> }) => new PublicPricingPageController({ get: async () => ({ currency: 'INR', paymentsOpen: false, plans: [] }) } as never, port);
  it('carries the gate\'s answer, true or false, and never a key value', async () => {
    expect((await make({ isOpen: async () => true }).get(res)).paymentsOpen).toBe(true);
    const closed = await make({ isOpen: async () => false }).get(res); expect(closed.paymentsOpen).toBe(false);
    const g = gate('test', TEST_KEYS); const body = JSON.stringify(await make(g).get(res));
    for (const secret of ['secret-value', 'whsec-value', 'rzp_test_abc123']) expect(body).not.toContain(secret);
    expect(JSON.parse(body).paymentsOpen).toBe(true);
  });
  it('without the payments module loaded the answer is closed (false), never missing', async () => { expect((await make().get(res)).paymentsOpen).toBe(false); });
});
