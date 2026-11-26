import { PaymentLinkMade, PaymentLinkPort, PaymentLinkRequest } from './payment-link.port';

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export const RAZORPAY_LINKS_URL = 'https://api.razorpay.com/v1/payment_links';
const TIMEOUT_MS = 15_000;

/**
 * Razorpay payment links, TEST keys only: it refuses to be built with any other key, so no live money can move through this class. The request and answer fields
 * follow Razorpay's Payment Links API as documented; they have NEVER been sent to Razorpay from this code (TO VERIFY with the owner's test keys).
 * Razorpay is told not to message the customer itself: staff share the link.
 */
export class RazorpayPaymentLinkAdapter extends PaymentLinkPort {
  #keys: { keyId: string; keySecret: string };
  constructor(keys: { keyId: string; keySecret: string }, private readonly fetchFn: FetchLike = (u, i) => fetch(u, i) as never) {
    super();
    if (!/^rzp_test_[A-Za-z0-9]+$/.test(keys.keyId) || !keys.keySecret) throw new Error('payment links accept Razorpay TEST keys only');
    this.#keys = { keyId: keys.keyId, keySecret: keys.keySecret };
  }

  async createLink(r: PaymentLinkRequest): Promise<PaymentLinkMade> {
    const customer = { name: r.customer.name, ...(r.customer.phone ? { contact: r.customer.phone } : {}), ...(r.customer.email ? { email: r.customer.email } : {}) };
    const res = await this.fetchFn(RAZORPAY_LINKS_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${this.#keys.keyId}:${this.#keys.keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: r.amountMinor, currency: r.currency, accept_partial: false, reference_id: r.reference, description: r.description, customer,
        notify: { sms: false, email: false }, reminder_enable: false, expire_by: Math.floor(r.expiresAt.getTime() / 1000), notes: { planOrderId: r.reference },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const j = (await res.json()) as { id?: unknown; short_url?: unknown };
    if (!res.ok || typeof j.id !== 'string' || !/^plink_[A-Za-z0-9]+$/.test(j.id) || typeof j.short_url !== 'string' || !j.short_url.startsWith('https://')) throw new Error(`payment link failed (${res.status})`);
    return { linkId: j.id, url: j.short_url };
  }
}
