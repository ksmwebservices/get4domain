import { RazorpayPort } from '../razorpay/razorpay.port';
import { normalizeRazorpayEvent } from './gateway-core';
import { GatewayCustomer, GatewayHeaders, GatewayMode, GatewayOrder, GatewayPayment, GatewayPaymentStatus, PaymentGatewayPort } from './gateway.port';

/** captured is paid; authorized and created are still in progress; anything else (failed, refunded) is not a payment of this order */
const statusOf = (s: string): GatewayPaymentStatus => (s === 'captured' ? 'SUCCESS' : s === 'authorized' || s === 'created' ? 'PENDING' : 'FAILED');

/** Razorpay behind the payment port. It wraps the existing RazorpayPort (the TEST adapter, a live adapter, or a test double), so the signature and the call code is written once. */
/** The wrapped port (which holds the keys) is kept off the object's own properties, so a dump of the gateway can never show them. */
const PORTS = new WeakMap<object, RazorpayPort>();

export class RazorpayGateway extends PaymentGatewayPort {
  readonly gateway = 'razorpay' as const;
  constructor(port: RazorpayPort, readonly mode: GatewayMode = 'test') { super(); PORTS.set(this, port); }
  private get port(): RazorpayPort { return PORTS.get(this)!; }

  publicKeyId(): string | null { return this.port.publicKeyId(); }

  async createOrder(i: { amountMinor: number; currency: string; receipt: string; customer: GatewayCustomer }): Promise<GatewayOrder> {
    const o = await this.port.createOrder({ amountPaise: i.amountMinor, currency: i.currency, receipt: i.receipt });
    return { providerOrderId: o.id, clientToken: null, amountMinor: o.amount, currency: o.currency };
  }

  async fetchOrderPayments(providerOrderId: string, hint?: { paymentId?: string | null }): Promise<GatewayPayment[]> {
    if (!hint?.paymentId) return [];
    const p = await this.port.fetchPayment(hint.paymentId);
    return [{ paymentId: p.id, providerOrderId: p.orderId, amountMinor: p.amount, currency: p.currency, status: statusOf(p.status) }];   // the payment's OWN order id: the caller refuses one that is not this order's
  }

  verifyReturn(i: { providerOrderId: string; paymentId?: string | null; signature?: string | null }): boolean {
    return !!i.paymentId && !!i.signature && this.port.verifyPaymentSignature({ orderId: i.providerOrderId, paymentId: i.paymentId, signature: i.signature });
  }

  verifyWebhook(rawBody: Buffer | string, headers: GatewayHeaders): boolean { return this.port.verifyWebhookSignature(rawBody, headers['x-razorpay-signature']); }
  parseWebhook(rawBody: Buffer | string, headers: GatewayHeaders) { return normalizeRazorpayEvent(rawBody, headers['x-razorpay-event-id']); }
}
