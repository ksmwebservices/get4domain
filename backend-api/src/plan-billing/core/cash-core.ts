/**
 * Cash confirmed by an admin (Wave 3 Part E). PURE: no database, no clock (the caller passes `today`).
 * The vendor can NEVER pay a plan by hand. The one exception is cash, in a special case, and only an ADMIN or SUPER_ADMIN may confirm it. Every detail below is required, because each one is what an
 * accountant needs later: how it was paid (CASH, nothing else), the receipt reference, the day it was received, the amount (exactly the order total including GST), and a note that this is a special case.
 */
export interface CashInput { method?: unknown; reference?: unknown; receivedOn?: unknown; amountPaise?: unknown; specialCase?: unknown; reason?: unknown }
export interface CashDetails { reference: string; receivedOn: string; amountPaise: number; note: string }
export type CashCheck =
  | { ok: true; value: CashDetails }
  | { ok: false; code: 'CASH_ONLY' | 'CASH_DETAILS_INVALID' | 'OFFLINE_AMOUNT_MISMATCH'; fields: Record<string, string> };

export const CASH_NOTE_MIN = 10;
/** The oldest day of receipt a confirmation accepts, counted back from today. */
export const CASH_MAX_AGE_DAYS = 366;
const DAY_MS = 86_400_000;
const CONTROL = /[\u0000-\u001f\u007f]/;

/** YYYY-MM-DD that is a real calendar day, as a UTC midnight time, or null. */
function dayOf(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? t : null;
}

/**
 * Checks a cash confirmation against the order it settles. `orderTotalPaise` is what the order was made for, GST included: the amount received must equal it exactly, in whole paise.
 * A method other than CASH is refused first and by its own code, so a bank transfer or a UPI payment can never be recorded through this route.
 */
export function checkCashConfirmation(input: CashInput, orderTotalPaise: number, today: string): CashCheck {
  if (input.method !== 'CASH') return { ok: false, code: 'CASH_ONLY', fields: { method: 'only CASH can be confirmed by an admin; a plan is otherwise paid through the payment gateway' } };
  const fields: Record<string, string> = {};

  const ref = typeof input.reference === 'string' ? input.reference.replace(/\s+/g, ' ').trim() : '';
  if (ref.length < 3 || ref.length > 200 || CONTROL.test(ref)) fields.reference = 'the receipt reference is required (3 to 200 characters)';

  const on = typeof input.receivedOn === 'string' ? input.receivedOn.trim() : '';
  const onMs = dayOf(on);
  const todayMs = dayOf(today);
  if (onMs === null) fields.receivedOn = 'the day the cash was received is required, as YYYY-MM-DD';
  else if (todayMs !== null && onMs > todayMs) fields.receivedOn = 'the day received cannot be in the future';
  else if (todayMs !== null && todayMs - onMs > CASH_MAX_AGE_DAYS * DAY_MS) fields.receivedOn = 'the day received is too long ago';

  if (typeof input.amountPaise !== 'number' || !Number.isInteger(input.amountPaise) || input.amountPaise <= 0) fields.amountPaise = 'the amount received is required, in whole paise';

  if (input.specialCase !== true) fields.specialCase = 'confirm that this is a special case (set specialCase to true)';
  const note = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim() : '';
  if (note.length < CASH_NOTE_MIN || note.length > 300 || CONTROL.test(note)) fields.reason = `a note saying why this is a special case is required (${CASH_NOTE_MIN} to 300 characters)`;

  if (Object.keys(fields).length) return { ok: false, code: 'CASH_DETAILS_INVALID', fields };
  if (input.amountPaise !== orderTotalPaise) return { ok: false, code: 'OFFLINE_AMOUNT_MISMATCH', fields: { amountPaise: 'the amount received must equal the order total including GST' } };
  return { ok: true, value: { reference: ref, receivedOn: on, amountPaise: input.amountPaise as number, note } };
}
