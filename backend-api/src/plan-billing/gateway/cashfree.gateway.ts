import { decimalToPaise, isCashfreeOrderId, normalizeCashfreeEvent, paiseToDecimal, verifyCashfreeWebhook } from './gateway-core';
import { GatewayCustomer, GatewayHeaders, GatewayMode, GatewayOrder, GatewayPayment, GatewayPaymentStatus, PaymentGatewayPort } from './gateway.port';

export interface CashfreeKeys { appId: string; secretKey: string }
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const API_VERSION = '2023-08-01';
const HOSTS: Record<GatewayMode, string> = { test: 'https://sandbox.cashfree.com', live: 'https://api.cashfree.com' };
const statusOf = (s: unknown): GatewayPaymentStatus => (s === 'SUCCESS' ? 'SUCCESS' : s === 'FAILED' || s === 'USER_DROPPED' || s === 'CANCELLED' || s === 'VOID' ? 'FAILED' : 'PENDING');

/**
 * Cashfree behind the payment port. The key values arrive from the environment at the moment the adapter is built and are never logged, returned or stored. Amounts go out and come back as the TEXT of a
 * rupee amount with two decimals (see gateway-core), never as a float. Our own order id is Cashfree's order id, so a webhook finds its order by it.
 * Cashfree does not sign the browser's return: the server-side fetch of the order's payments is the authority, and the webhook is signed over `timestamp + body`.
 */
/** The keys live in this WeakMap, not on the object: JSON.stringify, a log line or a debugger dump of the gateway can never show them. */
const KEYS = new WeakMap<object, CashfreeKeys>();

export class CashfreeGateway extends PaymentGatewayPort {
  readonly gateway = 'cashfree' as const;
  constructor(keys: CashfreeKeys, readonly mode: GatewayMode = 'test', private readonly fetchFn: FetchLike = (u, i) => fetch(u, i) as never) {
    super();
    if (!keys.appId || !keys.secretKey) throw new Error('Cashfree needs an app id and a secret key');
    KEYS.set(this, { appId: keys.appId, secretKey: keys.secretKey });
    Object.defineProperty(this, 'fetchFn', { enumerable: false });
  }
  private get keys(): CashfreeKeys { return KEYS.get(this)!; }

  publicKeyId(): string | null { return null; }   // the browser checkout uses the payment session, not a key

  private headers(): Record<string, string> { return { 'x-client-id': this.keys.appId, 'x-client-secret': this.keys.secretKey, 'x-api-version': API_VERSION, 'Content-Type': 'application/json' }; }

  async createOrder(i: { amountMinor: number; currency: string; receipt: string; customer: GatewayCustomer }): Promise<GatewayOrder> {
    if (!isCashfreeOrderId(i.receipt)) throw new Error('not an order id Cashfree accepts');
    const body = {
      order_id: i.receipt, order_amount: paiseToDecimal(i.amountMinor), order_currency: i.currency,
      customer_details: { customer_id: i.customer.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50) || 'customer', customer_phone: i.customer.phone && /^\+?[0-9]{8,15}$/.test(i.customer.phone.replace(/[\s()-]/g, '')) ? i.customer.phone.replace(/[\s()-]/g, '') : '9999999999', ...(i.customer.email ? { customer_email: i.customer.email } : {}) },
    };
    const r = await this.fetchFn(`${HOSTS[this.mode]}/pg/orders`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    const j = (await r.json()) as { order_id?: string; payment_session_id?: string; order_amount?: unknown; order_currency?: string };
    const paise = decimalToPaise(j.order_amount);
    if (!r.ok || !j.order_id || !j.payment_session_id || paise === null) throw new Error(`provider order failed (${r.status})`);
    return { providerOrderId: j.order_id, clientToken: j.payment_session_id, amountMinor: paise, currency: String(j.order_currency ?? i.currency) };
  }

  async fetchOrderPayments(providerOrderId: string): Promise<GatewayPayment[]> {
    if (!isCashfreeOrderId(providerOrderId)) throw new Error('not an order id');
    const r = await this.fetchFn(`${HOSTS[this.mode]}/pg/orders/${providerOrderId}/payments`, { method: 'GET', headers: this.headers() });
    const j = (await r.json()) as unknown;
    if (!r.ok || !Array.isArray(j)) throw new Error(`provider payment lookup failed (${r.status})`);
    const out: GatewayPayment[] = [];
    for (const p of j as Array<Record<string, unknown>>) {
      const amount = decimalToPaise(p.payment_amount);
      const id = typeof p.cf_payment_id === 'number' ? String(p.cf_payment_id) : typeof p.cf_payment_id === 'string' ? p.cf_payment_id : null;
      if (id === null || amount === null) continue;   // an entry we cannot read exactly is never treated as a payment
      out.push({ paymentId: id, providerOrderId, amountMinor: amount, currency: String(p.payment_currency ?? ''), status: statusOf(p.payment_status) });
    }
    return out;
  }

  verifyReturn(): boolean { return true; }

  verifyWebhook(rawBody: Buffer | string, headers: GatewayHeaders, now: Date): boolean { return verifyCashfreeWebhook(this.keys.secretKey, rawBody, headers['x-webhook-signature'], headers['x-webhook-timestamp'], now); }
  parseWebhook(rawBody: Buffer | string) { return normalizeCashfreeEvent(rawBody); }
}
