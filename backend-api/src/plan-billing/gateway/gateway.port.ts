import { GatewayName, NormalizedEvent } from './gateway-core';

/**
 * THE payment port (Wave 3 Part C). Razorpay and Cashfree sit behind it, and so does the in-memory fake the tests use. Everything the checkout, the webhooks and the wallet need from a gateway is here, in
 * the gateway's own words turned into ours: integer minor units, a status of SUCCESS, PENDING or FAILED, and a normalised webhook event. A gateway secret never leaves its adapter.
 */
export type GatewayMode = 'test' | 'live';
export interface GatewayOrder { providerOrderId: string; /** what the browser checkout needs besides the public key (Cashfree's payment session); null when none */ clientToken: string | null; amountMinor: number; currency: string }
export type GatewayPaymentStatus = 'SUCCESS' | 'PENDING' | 'FAILED';
export interface GatewayPayment { paymentId: string; providerOrderId: string; amountMinor: number; currency: string; status: GatewayPaymentStatus }
export interface GatewayCustomer { id: string; phone?: string | null; email?: string | null }
export type GatewayHeaders = Record<string, string | undefined>;

export abstract class PaymentGatewayPort {
  abstract readonly gateway: GatewayName;
  abstract readonly mode: GatewayMode;
  /** The PUBLIC key the browser checkout needs; null when the gateway has none. Never a secret. */
  abstract publicKeyId(): string | null;
  abstract createOrder(i: { amountMinor: number; currency: string; receipt: string; customer: GatewayCustomer }): Promise<GatewayOrder>;
  /** What the gateway itself says about the payments of an order, asked server side. `paymentId` is the one the browser reported (Razorpay needs it; Cashfree ignores it). */
  abstract fetchOrderPayments(providerOrderId: string, hint?: { paymentId?: string | null }): Promise<GatewayPayment[]>;
  /** The browser's return, where the gateway signs it (Razorpay). A gateway that does not (Cashfree) answers true: the server-side fetch is then the only authority. */
  abstract verifyReturn(i: { providerOrderId: string; paymentId?: string | null; signature?: string | null }): boolean;
  abstract verifyWebhook(rawBody: Buffer | string, headers: GatewayHeaders, now: Date): boolean;
  abstract parseWebhook(rawBody: Buffer | string, headers: GatewayHeaders): NormalizedEvent | null;
}
