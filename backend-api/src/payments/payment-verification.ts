import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Server-side payment confirmation (security patch 2026-10-02).
 *
 * The checkout HMAC only proves "Razorpay issued this {order, payment} pair" — NOT that the
 * payment is for THIS invoice/cart/plan, for the right amount, or that it was captured. Every
 * flow that grants value from a payment must therefore ALSO confirm, against Razorpay's API:
 *   1. the HMAC is valid (compared in constant time),
 *   2. the order's amount equals what the server expects (never a client-supplied figure),
 *   3. the order's notes (purpose + vendor + reference) were written by OUR server when it
 *      created the order, so a payment for a different purpose/vendor/invoice cannot be reused,
 *   4. the payment belongs to that order, is `captured`, and was for the same amount.
 * If Razorpay cannot be reached we fail closed (503), never open.
 */

const logger = new Logger('PaymentVerification');

interface RazorpayOrderLike {
  id: string;
  amount: number | string;
  currency: string;
  notes?: Record<string, unknown> | unknown[];
}
interface RazorpayPaymentLike {
  id: string;
  order_id: string;
  amount: number | string;
  currency: string;
  status: string;
}

/** The slice of the Razorpay SDK this module needs (platform or per-vendor client). */
export interface RazorpayFetchClient {
  orders: { fetch(orderId: string): Promise<RazorpayOrderLike> };
  payments: { fetch(paymentId: string): Promise<RazorpayPaymentLike> };
}

/** Constant-time HMAC-SHA256 check of `order_id|payment_id` — false on any missing input. */
export function checkoutSignatureValid(
  secret: string | undefined,
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface CapturedPaymentCheck {
  /** Razorpay key secret for the account that created the order. */
  secret: string | undefined;
  orderId: string;
  paymentId: string;
  signature: string;
  /** Amount in paise the SERVER expects. Omit only when the order amount itself is the source of truth (wallet top-up). */
  expectedAmountPaise?: number;
  /** Notes our server stamped on the order at creation; each must match exactly. */
  expectedNotes: Record<string, string>;
}

export interface CapturedPayment {
  orderId: string;
  paymentId: string;
  amountPaise: number;
}

function gatewayStatus(err: unknown): number | undefined {
  const e = err as { statusCode?: number; status?: number } | null;
  return e?.statusCode ?? e?.status;
}

export async function assertCapturedPayment(client: RazorpayFetchClient, check: CapturedPaymentCheck): Promise<CapturedPayment> {
  if (!checkoutSignatureValid(check.secret, check.orderId, check.paymentId, check.signature)) {
    throw new BadRequestException('Payment signature verification failed');
  }

  let order: RazorpayOrderLike;
  let payment: RazorpayPaymentLike;
  try {
    order = await client.orders.fetch(check.orderId);
    payment = await client.payments.fetch(check.paymentId);
  } catch (err) {
    const status = gatewayStatus(err);
    if (status === 400 || status === 404) throw new BadRequestException('Payment could not be found');
    logger.error(`Razorpay lookup failed: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    throw new ServiceUnavailableException('Could not confirm the payment with the payment gateway. Please retry shortly.');
  }

  const orderAmount = Number(order.amount);
  const expected = check.expectedAmountPaise ?? orderAmount;
  const notes = (order.notes && !Array.isArray(order.notes) ? order.notes : {}) as Record<string, unknown>;

  const problems: string[] = [];
  if (order.id !== check.orderId) problems.push('order id');
  if (order.currency !== 'INR') problems.push('order currency');
  if (!Number.isInteger(expected) || expected <= 0) problems.push('expected amount');
  if (orderAmount !== expected) problems.push('order amount');
  for (const [key, value] of Object.entries(check.expectedNotes)) {
    if (String(notes[key] ?? '') !== value) problems.push(`order ${key}`);
  }
  if (payment.id !== check.paymentId) problems.push('payment id');
  if (payment.order_id !== check.orderId) problems.push('payment order');
  if (payment.status !== 'captured') problems.push(`payment status (${payment.status})`);
  if (payment.currency !== 'INR') problems.push('payment currency');
  if (Number(payment.amount) !== expected) problems.push('payment amount');

  if (problems.length) {
    logger.warn(`Payment ${check.paymentId} / order ${check.orderId} rejected: ${problems.join(', ')}`);
    throw new BadRequestException('Payment could not be verified for this purchase');
  }
  return { orderId: check.orderId, paymentId: check.paymentId, amountPaise: expected };
}

/** Serialise concurrent confirmations of the same payment (call inside a Prisma transaction). */
export async function lockPayment(
  tx: { $queryRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown> },
  paymentId: string,
): Promise<void> {
  await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `payment:${paymentId}`);
}
