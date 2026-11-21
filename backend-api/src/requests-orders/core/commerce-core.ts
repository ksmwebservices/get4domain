import { createHmac, timingSafeEqual } from 'crypto';

/** Pure rules of the commerce half of slice 5.14: payment readiness, the cart in whole paise, stock, vendor-gateway events, invoice numbers. Integer paise only; no floats near money. */

// ── payment readiness (owner rule 7) ────────────────────────────────────────────────────────────────────────────

export type MethodKind = 'OWN_GATEWAY' | 'UPI' | 'PAY_ON_DELIVERY' | 'PAY_AT_VISIT' | 'BANK_TRANSFER';
export type MethodStatus = 'UNVERIFIED' | 'ACTIVE' | 'DISABLED';
export type Readiness = 'FULL_CHECKOUT' | 'ORDER_REQUEST_ONLY' | 'ENQUIRY_ONLY';

/**
 * Cart payment readiness. A gateway or UPI that is ACTIVE gives full online checkout. Otherwise, if the vendor has ANY active way to be paid (pay on delivery, at the visit, a bank
 * transfer they arrange), the cart sends an ORDER REQUEST. With nothing active the site offers product enquiry and booking requests only and shows no checkout button.
 * A gateway is required only for online payment. An UNVERIFIED or DISABLED method counts for nothing.
 */
export function paymentReadiness(methods: ReadonlyArray<{ kind: MethodKind; status: MethodStatus }>): Readiness {
  const active = methods.filter((m) => m.status === 'ACTIVE');
  if (active.some((m) => m.kind === 'OWN_GATEWAY' || m.kind === 'UPI')) return 'FULL_CHECKOUT';
  return active.length > 0 ? 'ORDER_REQUEST_ONLY' : 'ENQUIRY_ONLY';
}

// ── the cart ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface CartLine { productRef: string; name: string; unitPaise: number; qty: number; taxPercent: number; hsnSac?: string | null }
export interface OfferTerms { kind: 'BANNER' | 'COUPON'; code?: string | null; percentOff?: number | null; flatPaise?: number | null; minOrderPaise: number; startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; usedCount: number; status: 'ACTIVE' | 'PAUSED' | 'ENDED' }
export interface PricedLine extends CartLine { lineSubtotalPaise: number; discountPaise: number; taxPaise: number; lineTotalPaise: number }
export interface PricedCart { lines: PricedLine[]; subtotalPaise: number; discountPaise: number; taxPaise: number; totalPaise: number; offerCode: string | null }

const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 1_000_000_000;
const roundDiv = (num: number, den: number): number => Math.floor((num * 2 + den) / (den * 2));   // half up, integers only

/** Why an offer does not apply now, or null when it does. */
export function offerProblem(o: OfferTerms, subtotalPaise: number, now: Date): 'NOT_ACTIVE' | 'NOT_STARTED' | 'ENDED' | 'USED_UP' | 'MINIMUM' | 'NO_VALUE' | null {
  if (o.status !== 'ACTIVE') return 'NOT_ACTIVE';
  if (o.startsAt && now.getTime() < o.startsAt.getTime()) return 'NOT_STARTED';
  if (o.endsAt && now.getTime() >= o.endsAt.getTime()) return 'ENDED';
  if (o.usageLimit !== null && o.usedCount >= o.usageLimit) return 'USED_UP';
  if (subtotalPaise < o.minOrderPaise) return 'MINIMUM';
  if (!(o.percentOff && o.percentOff > 0) && !(o.flatPaise && o.flatPaise > 0)) return 'NO_VALUE';
  return null;
}

/**
 * The cart in whole paise. The discount comes off the subtotal (a percentage rounded half up, or a flat amount, never more than the subtotal) and is shared across lines by the largest-remainder
 * rule so the lines add up to the discount EXACTLY; tax is each line's own percentage on its discounted amount, rounded half up. Prices are tax-exclusive. Throws on a bad line.
 */
export function priceCart(lines: readonly CartLine[], offer: OfferTerms | null, now: Date): PricedCart {
  if (!lines.length || lines.length > 100) throw new RangeError('the cart needs 1 to 100 lines');
  for (const l of lines) {
    if (!l.productRef || !isMoney(l.unitPaise) || !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 1000 || !Number.isInteger(l.taxPercent) || l.taxPercent < 0 || l.taxPercent > 100) throw new RangeError(`line ${l.productRef || '?'} is not valid`);
  }
  const subs = lines.map((l) => l.unitPaise * l.qty);
  const subtotal = subs.reduce((a, b) => a + b, 0);
  if (!isMoney(subtotal)) throw new RangeError('the cart total is too large');
  let discount = 0;
  if (offer && offerProblem(offer, subtotal, now) === null) {
    discount = offer.percentOff && offer.percentOff > 0 ? roundDiv(subtotal * Math.min(100, offer.percentOff), 100) : Math.min(offer.flatPaise ?? 0, subtotal);
    discount = Math.min(discount, subtotal);
  }
  // largest remainder: floor each share, then give the leftover paise to the lines with the biggest remainders (ties: first line first)
  const shares = subs.map((s) => (subtotal === 0 ? 0 : Math.floor((discount * s) / subtotal)));
  let left = discount - shares.reduce((a, b) => a + b, 0);
  const order = subs.map((s, i) => ({ i, rem: subtotal === 0 ? 0 : (discount * s) % subtotal })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const o of order) { if (left <= 0) break; shares[o.i] += 1; left -= 1; }
  const priced: PricedLine[] = lines.map((l, i) => {
    const after = subs[i] - shares[i]; const tax = roundDiv(after * l.taxPercent, 100);
    return { ...l, lineSubtotalPaise: subs[i], discountPaise: shares[i], taxPaise: tax, lineTotalPaise: after + tax };
  });
  const taxPaise = priced.reduce((a, l) => a + l.taxPaise, 0);
  return { lines: priced, subtotalPaise: subtotal, discountPaise: discount, taxPaise, totalPaise: subtotal - discount + taxPaise, offerCode: discount > 0 ? offer?.code ?? null : null };
}

// ── stock ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A product with no stock row is not tracked (unlimited). With a row, what can still be promised is on hand minus what is held by live reservations. */
export function canReserve(level: { onHand: number; reserved: number } | null, qty: number): boolean { return level === null || level.onHand - level.reserved >= qty; }
export const reservationExpiry = (now: Date, minutes: number): Date => new Date(now.getTime() + minutes * 60_000);

// ── events from the vendor's own gateway ────────────────────────────────────────────────────────────────────────

export const hmacHex = (secret: string, data: Buffer | string): string => createHmac('sha256', secret).update(data).digest('hex');
export function safeHexEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
/** The signature is the HMAC-SHA256 (hex) of the RAW body with THAT vendor's own webhook secret. */
export function verifyVendorSignature(rawBody: Buffer | string | undefined, signature: string | undefined, secret: string | null): boolean {
  return !!rawBody && !!signature && !!secret && safeHexEqual(hmacHex(secret, rawBody), signature.trim());
}
export interface GatewayEvent { eventId: string; type: string; orderRef: string; amountPaise: number; currency: string }
/** The one event shape the bridge understands: { id, type, orderRef, amountPaise, currency }. Anything else is not an event we act on. */
export function parseGatewayEvent(body: unknown): GatewayEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || !b.id || b.id.length > 100 || typeof b.type !== 'string' || typeof b.orderRef !== 'string' || !b.orderRef || !isMoney(b.amountPaise) || typeof b.currency !== 'string') return null;
  return { eventId: b.id, type: b.type, orderRef: b.orderRef, amountPaise: b.amountPaise as number, currency: b.currency.toUpperCase() };
}
/** Money is checked EXACTLY (amount and currency). A mismatch never marks an order PAID: it flags the order for review. */
export function amountCheck(order: { amountPaise: number; currency: string }, ev: Pick<GatewayEvent, 'amountPaise' | 'currency'>): 'OK' | 'MISMATCH' {
  return order.amountPaise === ev.amountPaise && order.currency.toUpperCase() === ev.currency ? 'OK' : 'MISMATCH';
}
export const PAID_EVENT_TYPES: readonly string[] = ['payment.captured', 'payment.paid', 'order.paid'];

// ── numbers ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const formatInvoiceNumber = (prefix: string, seq: number): string => `${prefix}${String(seq).padStart(6, '0')}`;
/** The order number a customer sees. Gap-free per vendor (the counter is incremented by one atomic statement). */
export const formatOrderNo = (seq: number): string => `#${seq}`;

/** Order status moves the vendor may make by hand. PAID comes only from the vendor's own gateway event or the vendor recording an offline payment. */
const ORDER_NEXT: Record<string, readonly string[]> = {
  PLACED: ['AWAITING_PAYMENT', 'PAID', 'PACKED', 'CANCELLED'], AWAITING_PAYMENT: ['PAID', 'CANCELLED'], PAID: ['PACKED', 'CANCELLED', 'REFUNDED_RECORDED'],
  PACKED: ['SHIPPED', 'DELIVERED', 'CANCELLED'], SHIPPED: ['DELIVERED', 'RETURNED'], DELIVERED: ['RETURNED', 'REFUNDED_RECORDED'], RETURNED: ['REFUNDED_RECORDED'], CANCELLED: [], REFUNDED_RECORDED: [],
};
export const canMoveOrder = (from: string, to: string): boolean => (ORDER_NEXT[from] ?? []).includes(to);
