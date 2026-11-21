import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * The pure rules of the payment gateways (Wave 3 Part C). No database, no network, no environment, no clock (the caller passes `now`).
 * Money is integer minor units (paise) everywhere. Cashfree speaks decimal rupees on the wire, so the two conversions below work on the TEXT of the number and never on a float.
 */
export type GatewayName = 'razorpay' | 'cashfree';
export const GATEWAY_NAMES: readonly GatewayName[] = ['razorpay', 'cashfree'];
export const isGatewayName = (v: unknown): v is GatewayName => typeof v === 'string' && (GATEWAY_NAMES as readonly string[]).includes(v);

/** 176646 -> "1766.46". Whole non-negative integers only. */
export function paiseToDecimal(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) throw new Error('an amount must be a whole number of paise, 0 or more');
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;
}

/** "1766.46" or 1766.46 -> 176646. Null for anything that is not a plain rupee amount with at most two decimals (so an odd or tampered amount can never match an order). */
export function decimalToPaise(v: unknown): number | null {
  // a JSON number is read through its shortest text form (1766.46 -> "1766.46"), so no float arithmetic ever touches an amount; more than two decimals, an exponent or a sign is refused
  const text = typeof v === 'number' ? (Number.isFinite(v) && v >= 0 ? String(v) : '') : typeof v === 'string' ? v.trim() : '';
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}

const hmacBase64 = (secret: string, data: string | Buffer): string => createHmac('sha256', secret).update(data).digest('base64');
const equalText = (a: string, b: string): boolean => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

/** Cashfree signs `timestamp + rawBody` with the secret key (HMAC SHA-256, base64). */
export function cashfreeSignature(secret: string, timestamp: string, rawBody: Buffer | string): string { return hmacBase64(secret, Buffer.concat([Buffer.from(timestamp), Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)])); }

export const WEBHOOK_MAX_SKEW_MS = 10 * 60_000;
/** The signature must match AND the timestamp must be a recent moment (a captured request cannot be replayed an hour later). */
export function verifyCashfreeWebhook(secret: string, rawBody: Buffer | string, signature: string | undefined, timestamp: string | undefined, now: Date): boolean {
  if (!secret || !signature || !timestamp || !/^\d{10,16}$/.test(timestamp)) return false;
  const ms = timestamp.length <= 11 ? Number(timestamp) * 1000 : Number(timestamp);
  if (!Number.isFinite(ms) || Math.abs(now.getTime() - ms) > WEBHOOK_MAX_SKEW_MS) return false;
  return equalText(cashfreeSignature(secret, timestamp, rawBody), signature);
}

/** What a gateway event means to the order, whichever gateway sent it. */
export type EventKind = 'PAID' | 'FAILED' | 'OTHER';
export interface NormalizedEvent {
  eventId: string; type: string; kind: EventKind;
  providerOrderId: string | null; paymentId: string | null; amountMinor: number | null; currency: string | null;
  /** a whitelisted copy that is safe to store: ids, amounts, statuses; never a contact, card, bank or free text */
  redacted: Record<string, unknown>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 80): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
const digestOf = (raw: Buffer | string): string => createHash('sha256').update(raw).digest('hex');
const SAFE_ID = /^[A-Za-z0-9_.:-]{3,80}$/;
const cleanId = (s: string | null): string | null => (s !== null && SAFE_ID.test(s) ? s : null);

export function parseJson(raw: Buffer | string): unknown { try { return JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)); } catch { return null; } }

/** A Cashfree webhook body: PAYMENT_SUCCESS_WEBHOOK, PAYMENT_FAILED_WEBHOOK, PAYMENT_USER_DROPPED_WEBHOOK, and others (ignored). The paid amount is the PAYMENT's amount, not the order's. */
export function normalizeCashfreeEvent(raw: Buffer | string): NormalizedEvent | null {
  const body = parseJson(raw);
  if (!isObj(body)) return null;
  const type = str(body.type, 60) ?? 'unknown';
  const data = isObj(body.data) ? body.data : {};
  const order = isObj(data.order) ? data.order : {};
  const pay = isObj(data.payment) ? data.payment : {};
  const paymentId = cleanId(typeof pay.cf_payment_id === 'number' ? String(pay.cf_payment_id) : str(pay.cf_payment_id));
  const status = str(pay.payment_status, 30);
  const kind: EventKind = type === 'PAYMENT_SUCCESS_WEBHOOK' && status === 'SUCCESS' ? 'PAID' : type === 'PAYMENT_FAILED_WEBHOOK' || type === 'PAYMENT_USER_DROPPED_WEBHOOK' ? 'FAILED' : 'OTHER';
  const amountMinor = decimalToPaise(pay.payment_amount);
  const currency = str(pay.payment_currency, 8);
  const providerOrderId = cleanId(str(order.order_id));
  const eventId = paymentId ? `cf-${paymentId}-${type}`.slice(0, 80) : `cf-${digestOf(raw).slice(0, 40)}`;
  const redacted: Record<string, unknown> = { type };
  if (providerOrderId) redacted.order_id = providerOrderId;
  if (paymentId) redacted.cf_payment_id = paymentId;
  if (status) redacted.payment_status = status;
  if (amountMinor !== null) redacted.payment_amount_minor = amountMinor;
  if (currency) redacted.payment_currency = currency;
  return { eventId, type, kind, providerOrderId, paymentId, amountMinor, currency, redacted };
}

/** A Razorpay webhook body: payment.captured and order.paid are PAID, payment.failed is FAILED. The event id is Razorpay's own header (else a digest of the body). */
export function normalizeRazorpayEvent(raw: Buffer | string, eventIdHeader: string | undefined): NormalizedEvent | null {
  const body = parseJson(raw);
  if (!isObj(body)) return null;
  const type = str(body.event, 60) ?? 'unknown';
  const payload = isObj(body.payload) ? body.payload : {};
  const pay = isObj(payload.payment) && isObj(payload.payment.entity) ? payload.payment.entity : {};
  const ord = isObj(payload.order) && isObj(payload.order.entity) ? payload.order.entity : {};
  const providerOrderId = cleanId(str(pay.order_id) ?? str(ord.id));
  const paymentId = cleanId(str(pay.id));
  const amount = typeof pay.amount === 'number' ? pay.amount : typeof ord.amount_paid === 'number' ? ord.amount_paid : null;
  const amountMinor = typeof amount === 'number' && Number.isInteger(amount) && amount >= 0 ? amount : null;
  const currency = str(pay.currency, 8) ?? str(ord.currency, 8);
  const kind: EventKind = type === 'payment.captured' || type === 'order.paid' ? 'PAID' : type === 'payment.failed' ? 'FAILED' : 'OTHER';
  const eventId = typeof eventIdHeader === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(eventIdHeader) ? eventIdHeader : `evt-${digestOf(raw).slice(0, 40)}`;
  const redacted: Record<string, unknown> = { event: type };
  if (providerOrderId) redacted.order_id = providerOrderId;
  if (paymentId) redacted.payment_id = paymentId;
  if (amountMinor !== null) redacted.amount = amountMinor;
  if (currency) redacted.currency = currency;
  return { eventId, type, kind, providerOrderId, paymentId, amountMinor, currency, redacted };
}

/** The id Cashfree wants for an order: letters, digits, underscore and dash, up to 45 characters. Our own order id already fits; anything else is refused rather than altered. */
export const isCashfreeOrderId = (id: string): boolean => /^[A-Za-z0-9_-]{3,45}$/.test(id);
