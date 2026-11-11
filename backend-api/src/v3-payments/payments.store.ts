import { PayStatus } from './core/pay-core';

export type PaySource = 'MANUAL' | 'REQUEST' | 'ORDER';
export interface PayRequestRow {
  id: string; vendorId: string; code: string; amountPaise: number; note: string | null; customerName: string; customerPhone: string | null; source: PaySource; requestId: string | null; orderId: string | null;
  methodId: string; status: PayStatus; expiresAt: Date; customerSaidAt: Date | null; customerUtr: string | null; createdBy: string | null; createdAt: Date; updatedAt: Date;
}
export interface PaymentRow { id: string; paymentRequestId: string; vendorId: string; amountPaise: number; level: number; provider: string; providerPaymentId: string; utr: string | null; confirmedBy: 'VENDOR' | 'GATEWAY'; confirmedAt: Date; idempotencyKey: string | null }
export type NewPayRequest = Pick<PayRequestRow, 'vendorId' | 'code' | 'amountPaise' | 'note' | 'customerName' | 'customerPhone' | 'source' | 'requestId' | 'orderId' | 'methodId' | 'expiresAt' | 'createdBy'>;
export class PayCodeTaken extends Error {}

/**
 * Everything slice 5.17b stores, behind one port: a Prisma implementation and an in-memory twin for the unit tests. Every vendor-side read and write carries the vendor id in its WHERE; the public
 * pay page finds a row only by its unguessable code. The status changes are compare-and-set, so two taps or two confirmations can never both win.
 */
export abstract class PaymentsStore {
  abstract create(d: NewPayRequest): Promise<PayRequestRow>;
  abstract byCode(code: string): Promise<PayRequestRow | null>;
  abstract byId(id: string, vendorId: string): Promise<PayRequestRow | null>;
  abstract list(vendorId: string, f: { status?: PayStatus; orderId?: string; skip: number; take: number }): Promise<{ items: PayRequestRow[]; total: number }>;
  /** AWAITING to CUSTOMER_SAYS_PAID, once. Null when the row is not AWAITING any more. */
  abstract customerTaps(id: string, utr: string | null, now: Date): Promise<PayRequestRow | null>;
  /** AWAITING or CUSTOMER_SAYS_PAID to CANCELLED, the vendor's own row only. */
  abstract cancel(id: string, vendorId: string): Promise<PayRequestRow | null>;
  /** AWAITING to EXPIRED once its time is past. */
  abstract expire(id: string, now: Date): Promise<boolean>;
  abstract expirable(now: Date, limit: number): Promise<PayRequestRow[]>;
  /**
   * The vendor's "Mark as paid", in ONE transaction: the request goes to PAID from AWAITING, CUSTOMER_SAYS_PAID or EXPIRED and its single payment row is written. Called again, it changes nothing and
   * returns alreadyPaid. Null when the request is not this vendor's or is CANCELLED.
   */
  abstract confirmPaid(id: string, vendorId: string, p: { utr: string | null; idempotencyKey: string | null; now: Date }): Promise<{ request: PayRequestRow; payment: PaymentRow; alreadyPaid: boolean } | null>;
  abstract paymentOf(requestId: string, vendorId: string): Promise<PaymentRow | null>;
  /** The pay request a payment belongs to, vendor's own only. */
  abstract requestOfPayment(paymentId: string, vendorId: string): Promise<PayRequestRow | null>;
}
