import { createHmac } from 'crypto';
import { cashfreeSignature, normalizeCashfreeEvent, normalizeRazorpayEvent, paiseToDecimal, verifyCashfreeWebhook } from './gateway-core';
import { GatewayCustomer, GatewayHeaders, GatewayMode, GatewayOrder, GatewayPayment, PaymentGatewayPort } from './gateway.port';
import { hmacHex, safeHexEqual } from '../razorpay/razorpay.port';

/**
 * An in-memory payment gateway for TESTS ONLY. It is never registered as a provider. The secrets are made by the test itself, at test time, so no real key exists anywhere in the repository.
 * It signs and verifies exactly like the real gateway it stands in for (`as`), so a webhook signed with the wrong secret is refused by the same rule the real adapter applies.
 */
export class InMemoryGateway extends PaymentGatewayPort {
  readonly mode: GatewayMode = 'test';
  /** payments the "gateway" holds, by provider order id; a test adds to it to simulate a customer paying */
  readonly payments = new Map<string, GatewayPayment[]>();
  readonly orders = new Map<string, GatewayOrder>();
  calls: string[] = [];
  failCreate = false;
  constructor(readonly gateway: 'razorpay' | 'cashfree', private readonly secrets: { signing: string; webhook: string }) { super(); }

  publicKeyId(): string | null { return this.gateway === 'razorpay' ? 'rzp_test_inmemory' : null; }

  async createOrder(i: { amountMinor: number; currency: string; receipt: string; customer: GatewayCustomer }): Promise<GatewayOrder> {
    this.calls.push('createOrder');
    if (this.failCreate) throw new Error('gateway down');
    const o: GatewayOrder = { providerOrderId: this.gateway === 'cashfree' ? i.receipt : `order_${i.receipt}`, clientToken: this.gateway === 'cashfree' ? `session_${i.receipt}` : null, amountMinor: i.amountMinor, currency: i.currency };
    this.orders.set(o.providerOrderId, o);
    return o;
  }

  async fetchOrderPayments(providerOrderId: string): Promise<GatewayPayment[]> { this.calls.push('fetchOrderPayments'); return [...(this.payments.get(providerOrderId) ?? [])]; }

  /** a test simulates the customer paying (or a payment failing) */
  addPayment(p: GatewayPayment): void { this.payments.set(p.providerOrderId, [...(this.payments.get(p.providerOrderId) ?? []), p]); }

  verifyReturn(i: { providerOrderId: string; paymentId?: string | null; signature?: string | null }): boolean {
    if (this.gateway === 'cashfree') return true;
    return !!i.paymentId && !!i.signature && safeHexEqual(hmacHex(this.secrets.signing, `${i.providerOrderId}|${i.paymentId}`), i.signature);
  }
  /** the signature a customer's browser would hand back (Razorpay) */
  returnSignature(providerOrderId: string, paymentId: string): string { return hmacHex(this.secrets.signing, `${providerOrderId}|${paymentId}`); }

  verifyWebhook(rawBody: Buffer | string, headers: GatewayHeaders, now: Date): boolean {
    if (this.gateway === 'cashfree') return verifyCashfreeWebhook(this.secrets.webhook, rawBody, headers['x-webhook-signature'], headers['x-webhook-timestamp'], now);
    return !!headers['x-razorpay-signature'] && safeHexEqual(hmacHex(this.secrets.webhook, rawBody), headers['x-razorpay-signature']);
  }
  parseWebhook(rawBody: Buffer | string, headers: GatewayHeaders) { return this.gateway === 'cashfree' ? normalizeCashfreeEvent(rawBody) : normalizeRazorpayEvent(rawBody, headers['x-razorpay-event-id']); }

  /** the headers a real gateway would send for this body, signed with the webhook secret the test made */
  signedHeaders(rawBody: Buffer | string, now: Date, eventId?: string): GatewayHeaders {
    if (this.gateway === 'cashfree') { const ts = String(now.getTime()); return { 'x-webhook-signature': cashfreeSignature(this.secrets.webhook, ts, rawBody), 'x-webhook-timestamp': ts }; }
    return { 'x-razorpay-signature': createHmac('sha256', this.secrets.webhook).update(rawBody).digest('hex'), ...(eventId ? { 'x-razorpay-event-id': eventId } : {}) };
  }
}

export { paiseToDecimal };
