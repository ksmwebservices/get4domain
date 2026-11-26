/**
 * E11e: the seam for a shareable payment link. The gateway hosts the page the customer pays on, so no card or UPI detail ever reaches Get4Domain. One real adapter
 * (Razorpay, TEST keys only) and, in the tests, an in-memory fake. A key never leaves its adapter.
 */
export interface PaymentLinkRequest {
  amountMinor: number;
  currency: string;
  /** our plan order id: the gateway keeps it beside the link */
  reference: string;
  description: string;
  customer: { name: string; phone: string | null; email: string | null };
  expiresAt: Date;
}
export interface PaymentLinkMade { linkId: string; url: string }

export abstract class PaymentLinkPort {
  abstract createLink(request: PaymentLinkRequest): Promise<PaymentLinkMade>;
}
