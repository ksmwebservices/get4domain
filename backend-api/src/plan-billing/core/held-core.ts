/**
 * Held payments (Wave 4 W2). Pure. A held payment is an order in REVIEW: the gateway reported money whose amount or currency did not match the order, or money arrived for a closed order.
 * An ADMIN or SUPER_ADMIN checks the gateway dashboard, then either ACCEPTS it (only when the verified amount received equals the order total including GST, to the paise) or REJECTS it with a note.
 * Any refund is done in the gateway dashboard, never here.
 */
export type HeldAction = 'ACCEPT' | 'REJECT';
export interface HeldResolveInput { action?: unknown; note?: unknown; verifiedAmountPaise?: unknown; gatewayPaymentId?: unknown }
export type HeldResolveValue = { action: 'ACCEPT'; note: string; verifiedAmountPaise: number; gatewayPaymentId: string } | { action: 'REJECT'; note: string };
export type HeldResolveCheck = { ok: true; value: HeldResolveValue } | { ok: false; code: 'HELD_PAYMENT_INVALID'; fields: Record<string, string> };

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]+/g;
const clean = (v: unknown): string | null => (typeof v === 'string' ? v.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim() : null);

export function checkHeldResolution(i: HeldResolveInput): HeldResolveCheck {
  const fields: Record<string, string> = {};
  const action = i.action === 'ACCEPT' || i.action === 'REJECT' ? i.action : null;
  if (!action) fields.action = 'action must be ACCEPT or REJECT';
  const note = clean(i.note);
  if (note === null || note.length < 3 || note.length > 300) fields.note = 'a note of 3 to 300 characters is required';
  let amount = 0; let payId = '';
  if (action === 'ACCEPT') {
    if (typeof i.verifiedAmountPaise !== 'number' || !Number.isInteger(i.verifiedAmountPaise) || i.verifiedAmountPaise <= 0) fields.verifiedAmountPaise = 'the verified amount received, in whole paise, is required';
    else amount = i.verifiedAmountPaise;
    const p = clean(i.gatewayPaymentId);
    if (p === null || p.length < 3 || p.length > 80) fields.gatewayPaymentId = 'the gateway payment id (3 to 80 characters) is required';
    else payId = p;
  }
  if (Object.keys(fields).length > 0 || !action || note === null) return { ok: false, code: 'HELD_PAYMENT_INVALID', fields };
  return action === 'ACCEPT' ? { ok: true, value: { action, note, verifiedAmountPaise: amount, gatewayPaymentId: payId } } : { ok: true, value: { action, note } };
}

/** Why the payment is held, as a stable word a screen can show. A different amount seen is an AMOUNT_MISMATCH; the rest is money for an order that was already closed (or a currency difference). */
export function heldReason(o: { amountPaise: number; paidAmountPaise: number | null }): 'AMOUNT_MISMATCH' | 'CURRENCY_OR_LATE_PAYMENT' {
  return o.paidAmountPaise !== null && o.paidAmountPaise !== o.amountPaise ? 'AMOUNT_MISMATCH' : 'CURRENCY_OR_LATE_PAYMENT';
}
