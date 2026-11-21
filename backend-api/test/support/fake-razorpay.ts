import { hmacHex, ProviderOrder, ProviderPayment, RazorpayPort, safeHexEqual } from '../../src/plan-billing/razorpay/razorpay.port';

/** The fake provider the tests (and the staging integration tests) use: deterministic, no network, same signature scheme as the real one. */
export class FakeRazorpay extends RazorpayPort {
  static KEY_SECRET = 'fake-key-secret'; static WEBHOOK_SECRET = 'fake-webhook-secret';
  orders = new Map<string, ProviderOrder>(); payments = new Map<string, ProviderPayment>();
  calls = { createOrder: 0, fetchPayment: 0 }; failNextCreate = false; failNextFetch = false;
  private n = 0;

  publicKeyId(): string { return 'rzp_test_fakekey'; }
  async createOrder(i: { amountPaise: number; currency: string; receipt: string }): Promise<ProviderOrder> {
    this.calls.createOrder++;
    if (this.failNextCreate) { this.failNextCreate = false; throw new Error('provider down'); }
    const o = { id: `order_${++this.n}`, amount: i.amountPaise, currency: i.currency, status: 'created' }; this.orders.set(o.id, o); return o;
  }
  async fetchPayment(id: string): Promise<ProviderPayment> {
    this.calls.fetchPayment++;
    if (this.failNextFetch) { this.failNextFetch = false; throw new Error('provider down'); }
    const p = this.payments.get(id); if (!p) throw new Error('no such payment'); return { ...p };
  }
  verifyPaymentSignature(i: { orderId: string; paymentId: string; signature: string }): boolean { return safeHexEqual(hmacHex(FakeRazorpay.KEY_SECRET, `${i.orderId}|${i.paymentId}`), String(i.signature ?? '')); }
  verifyWebhookSignature(raw: Buffer | string, signature: string | undefined): boolean { return !!signature && safeHexEqual(hmacHex(FakeRazorpay.WEBHOOK_SECRET, raw), signature); }

  // ── helpers the tests use to play the customer and the provider
  /** The customer pays (or tries to). Returns the payment id and the signature the checkout would hand back. */
  pay(providerOrderId: string, o: { amount?: number; currency?: string; status?: string } = {}): { paymentId: string; signature: string } {
    const order = this.orders.get(providerOrderId)!; const paymentId = `pay_${++this.n}`;
    this.payments.set(paymentId, { id: paymentId, orderId: providerOrderId, amount: o.amount ?? order.amount, currency: o.currency ?? order.currency, status: o.status ?? 'captured' });
    return { paymentId, signature: hmacHex(FakeRazorpay.KEY_SECRET, `${providerOrderId}|${paymentId}`) };
  }
  signature(providerOrderId: string, paymentId: string): string { return hmacHex(FakeRazorpay.KEY_SECRET, `${providerOrderId}|${paymentId}`); }
  /** A signed webhook delivery. */
  webhook(event: string, paymentId: string, o: { eventId?: string; signWith?: string; extra?: Record<string, unknown> } = {}): { raw: string; signature: string; eventId: string } {
    const p = this.payments.get(paymentId)!;
    const body = {
      entity: 'event', account_id: 'acc_test', event, created_at: 1730800000,
      payload: { payment: { entity: { id: p.id, entity: 'payment', amount: p.amount, currency: p.currency, status: p.status, order_id: p.orderId, method: 'card', captured: p.status === 'captured', email: 'buyer@example.com', contact: '+919876543210', card: { last4: '1111', network: 'Visa' }, vpa: 'x@upi', ...(o.extra ?? {}) } } },
    };
    const raw = JSON.stringify(body);
    return { raw, signature: hmacHex(o.signWith ?? FakeRazorpay.WEBHOOK_SECRET, raw), eventId: o.eventId ?? `evt_test_${++this.n}` };
  }
}
