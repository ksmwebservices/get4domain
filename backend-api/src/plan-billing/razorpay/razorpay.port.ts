import { createHmac, timingSafeEqual } from 'crypto';

/**
 * The provider seam for plan purchases (slice 5.1b). Tests use a fake implementation; the real adapter below is built ONLY when the plan setting paymentsMode is "test" AND test keys
 * are present in the environment (see PaymentsGate). Key values are read from the environment at the moment the adapter is built and are never logged, returned or stored.
 */
export interface ProviderOrder { id: string; amount: number; currency: string; status: string }
export interface ProviderPayment { id: string; orderId: string; amount: number; currency: string; status: string }

export abstract class RazorpayPort {
  /** The PUBLIC key id the browser checkout needs. Never the secret. */
  abstract publicKeyId(): string;
  abstract createOrder(i: { amountPaise: number; currency: string; receipt: string }): Promise<ProviderOrder>;
  abstract fetchPayment(paymentId: string): Promise<ProviderPayment>;
  /** order_id|payment_id signed with the key secret (what the browser checkout hands back) */
  abstract verifyPaymentSignature(i: { orderId: string; paymentId: string; signature: string }): boolean;
  /** the raw request body signed with the webhook secret */
  abstract verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean;
}

export function hmacHex(secret: string, data: Buffer | string): string { return createHmac('sha256', secret).update(data).digest('hex'); }
export function safeHexEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export interface RazorpayKeys { keyId: string; keySecret: string; webhookSecret: string }
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Talks to api.razorpay.com with TEST keys only (the key id must start with rzp_test_). */
export class RazorpayTestAdapter extends RazorpayPort {
  constructor(private readonly keys: RazorpayKeys, private readonly fetchFn: FetchLike = (u, i) => fetch(u, i) as never) {
    super();
    if (!/^rzp_test_[A-Za-z0-9]+$/.test(keys.keyId)) throw new Error('the Razorpay adapter only accepts TEST keys');
  }
  publicKeyId(): string { return this.keys.keyId; }
  private auth(): Record<string, string> { return { Authorization: `Basic ${Buffer.from(`${this.keys.keyId}:${this.keys.keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' }; }

  async createOrder(i: { amountPaise: number; currency: string; receipt: string }): Promise<ProviderOrder> {
    const r = await this.fetchFn('https://api.razorpay.com/v1/orders', { method: 'POST', headers: this.auth(), body: JSON.stringify({ amount: i.amountPaise, currency: i.currency, receipt: i.receipt }) });
    const j = (await r.json()) as { id?: string; amount?: number; currency?: string; status?: string };
    if (!r.ok || !j.id) throw new Error(`provider order failed (${r.status})`);
    return { id: j.id, amount: Number(j.amount), currency: String(j.currency), status: String(j.status ?? 'created') };
  }
  async fetchPayment(paymentId: string): Promise<ProviderPayment> {
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new Error('not a payment id');
    const r = await this.fetchFn(`https://api.razorpay.com/v1/payments/${paymentId}`, { method: 'GET', headers: this.auth() });
    const j = (await r.json()) as { id?: string; order_id?: string; amount?: number; currency?: string; status?: string };
    if (!r.ok || !j.id) throw new Error(`provider payment lookup failed (${r.status})`);
    return { id: j.id, orderId: String(j.order_id ?? ''), amount: Number(j.amount), currency: String(j.currency), status: String(j.status) };
  }
  verifyPaymentSignature(i: { orderId: string; paymentId: string; signature: string }): boolean { return safeHexEqual(hmacHex(this.keys.keySecret, `${i.orderId}|${i.paymentId}`), String(i.signature ?? '')); }
  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean { return !!signature && safeHexEqual(hmacHex(this.keys.webhookSecret, rawBody), signature); }
}
