/**
 * Slice 5.17a (owner amendment 06, UPI only): the pure rules for a vendor's payment methods. No I/O.
 */

/** Kinds that exist in the database but are NOT offered to V3 vendors: rejected on write, hidden from every response. Nothing is deleted. */
export const HIDDEN_GATEWAY_KINDS: readonly string[] = ['OWN_GATEWAY', 'GATEWAY_RAZORPAY', 'GATEWAY_CASHFREE', 'GATEWAY_PAYTM'];
const OFFERED_KINDS: readonly string[] = ['UPI', 'PAY_ON_DELIVERY', 'PAY_AT_VISIT', 'BANK_TRANSFER'];

export const isVendorOfferedKind = (kind: unknown): boolean => typeof kind === 'string' && OFFERED_KINDS.includes(kind);

const UPI_RE = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{2,63}$/;

/** A UPI id is handle@bank. Returns it trimmed and in lower case, or null when the format is wrong. */
export function normaliseUpiId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  return UPI_RE.test(t) ? t : null;
}

const PAYEE_RE = /^[\p{L}\p{N} .,&'-]{2,99}$/u;

/** The payee name the customer sees in their UPI app: 2 to 99 characters, spacing folded, case kept. */
export function normalisePayeeName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  return PAYEE_RE.test(t) ? t : null;
}

/** Saving a different UPI id than the stored one needs an explicit confirm. The first save and a re-save of the same id do not. */
export function upiChangeNeedsConfirm(current: string | null | undefined, next: string): boolean {
  if (!current) return false;
  return current.trim().toLowerCase() !== next.trim().toLowerCase();
}

/** Staff never see the full id: the first two characters and the bank handle. */
export function maskUpiId(id: string | null | undefined): string | null {
  if (!id) return null;
  const at = id.indexOf('@');
  if (at < 0) return '•••';
  return `${id.slice(0, Math.min(2, at))}•••${id.slice(at)}`;
}
