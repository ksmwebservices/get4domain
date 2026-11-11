/**
 * Slice 5.17b (owner amendment 06, UPI only): the pure rules for a pay request. No clock, randomness or I/O: the service passes random bytes and the time in.
 * Nothing here can reach PAID except the vendor's own "Mark as paid".
 */
import { normaliseUpiId } from './method-core';

export type PayStatus = 'AWAITING' | 'CUSTOMER_SAYS_PAID' | 'PAID' | 'EXPIRED' | 'CANCELLED';
export type PayEvent = 'CUSTOMER_TAPS' | 'VENDOR_MARKS_PAID' | 'EXPIRES' | 'VENDOR_CANCELS';

/** A technical bound so the string maths stays exact (about 10 billion rupees); it is not a business limit. */
const MAX_PAISE = 1_000_000_000_000;

/** Integer paise to "rupees.paise" with two digits and NO floating point. Null for anything that is not a whole positive number of paise. */
export function amountString(paise: unknown): string | null {
  if (typeof paise !== 'number' || !Number.isSafeInteger(paise) || paise <= 0 || paise >= MAX_PAISE) return null;
  const rupees = Math.floor(paise / 100); const rest = paise - rupees * 100;
  return `${rupees}.${rest < 10 ? '0' : ''}${rest}`;
}

const enc = (s: string): string => encodeURIComponent(s);

/** The UPI intent string a QR code or a pay link carries: pa, pn, am, tn (only with a note, at most 50 characters), cu. Null when the id or amount is not valid. */
export function buildUpiIntent(i: { pa: string; pn: string; amountPaise: number; note: string | null | undefined }): string | null {
  const pa = normaliseUpiId(i.pa); const am = amountString(i.amountPaise);
  if (!pa || !am || typeof i.pn !== 'string' || !i.pn.trim()) return null;
  const note = typeof i.note === 'string' ? i.note.trim().replace(/\s+/g, ' ').slice(0, 50) : '';
  return `upi://pay?pa=${enc(pa)}&pn=${enc(i.pn.trim())}&am=${am}${note ? `&tn=${enc(note)}` : ''}&cu=INR`;
}

/** The customer's optional UPI reference: nothing, or 8 to 22 letters and digits (upper case). Anything else is refused. */
export function normaliseUtr(v: unknown): { ok: true; utr: string | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, utr: null };
  if (typeof v !== 'string') return { ok: false };
  const t = v.trim(); if (!t) return { ok: true, utr: null };
  return /^[A-Za-z0-9]{8,22}$/.test(t) ? { ok: true, utr: t.toUpperCase() } : { ok: false };
}

/**
 * The state machine. Returns the next status, or null when the event is not allowed from that status. Rules: the customer's tap gives CUSTOMER_SAYS_PAID and never PAID; PAID is reached
 * only by VENDOR_MARKS_PAID (repeating it on a PAID request returns PAID, which makes the confirmation idempotent); EXPIRES applies to AWAITING only; a CANCELLED request is final.
 * An EXPIRED request can still be marked paid by the vendor (money may have arrived late): recorded as an OPEN QUESTION.
 */
export function nextPayStatus(from: PayStatus, event: PayEvent): PayStatus | null {
  switch (event) {
    case 'CUSTOMER_TAPS': return from === 'AWAITING' ? 'CUSTOMER_SAYS_PAID' : null;
    case 'VENDOR_MARKS_PAID': return from === 'CANCELLED' ? null : 'PAID';
    case 'EXPIRES': return from === 'AWAITING' ? 'EXPIRED' : null;
    case 'VENDOR_CANCELS': return from === 'AWAITING' || from === 'CUSTOMER_SAYS_PAID' ? 'CANCELLED' : null;
  }
}

/** 32 symbols, no 0, 1, I, O so a code read aloud or typed is not confused. */
export const PAY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 24;
/** A code from random bytes (the service supplies them from the system random source): 24 characters, 120 bits. */
export function payCodeFrom(bytes: Uint8Array): string {
  let out = ''; for (let i = 0; i < CODE_LENGTH; i++) out += PAY_CODE_ALPHABET[(bytes[i % bytes.length] ?? 0) & 31];
  return out;
}
export const isPayCode = (v: unknown): v is string => typeof v === 'string' && v.length === CODE_LENGTH && [...v].every((c) => PAY_CODE_ALPHABET.includes(c));
