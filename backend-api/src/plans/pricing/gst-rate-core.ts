/**
 * The GST rate setting (Wave 4 W7). PURE: no database, no clock (the caller passes `now`). The rate lives in the tax table that checkout, the wallet refill and the public pricing already read through
 * selectTaxRate (the row with the latest effective date that has started), so one setting moves every price. Nothing is hard-coded: with no row the platform has no rate and says so.
 *
 * A change is a NEW row with an effective-from moment. Older rows are never edited or removed by this setting, so the table is the history; an order keeps the rate it was quoted with.
 */
const IST_MS = 330 * 60_000;
export const GST_MAX_DECIMALS = 3;

/** The calendar day (YYYY-MM-DD) of a moment in India time. */
export function istDay(d: Date): string { return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10); }
/** Midnight India time at the start of a YYYY-MM-DD day, as a UTC moment; null when it is not a real day. */
export function istDayStart(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return new Date(t.getTime() - IST_MS);
}

export interface GstChangeInput { ratePercent?: unknown; effectiveFrom?: unknown; reason?: unknown }
export type GstCheck =
  | { ok: true; value: { ratePercent: number; /** null means "from now" */ validFrom: Date | null; reason: string } }
  | { ok: false; fields: Record<string, string> };

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]+/g;

/**
 * A rate is a number from 0 to 100 with at most 3 decimals (the column holds 3). The effective day, when given, is a real YYYY-MM-DD day that is today (India time) or later: a rate is never back-dated,
 * because that would rewrite what an earlier quote should have been. A reason of 3 to 300 characters is required for the audit trail. Messages name the FIELD only.
 */
export function checkGstChange(i: GstChangeInput, now: Date): GstCheck {
  const fields: Record<string, string> = {};
  const r = i.ratePercent;
  if (typeof r !== 'number' || !Number.isFinite(r) || r < 0 || r > 100) fields.ratePercent = 'must be a number from 0 to 100';
  else if (Math.round(r * 10 ** GST_MAX_DECIMALS) / 10 ** GST_MAX_DECIMALS !== r) fields.ratePercent = `must have at most ${GST_MAX_DECIMALS} decimals`;
  let validFrom: Date | null = null;
  if (i.effectiveFrom !== undefined && i.effectiveFrom !== null && i.effectiveFrom !== '') {
    const start = typeof i.effectiveFrom === 'string' ? istDayStart(i.effectiveFrom) : null;
    if (!start) fields.effectiveFrom = 'must be a day, YYYY-MM-DD';
    else if (istDay(start) < istDay(now)) fields.effectiveFrom = 'cannot be in the past';
    else validFrom = istDay(start) === istDay(now) ? null : start;   // today means "from now"; a later day starts at its midnight, India time
  }
  const reason = typeof i.reason === 'string' ? i.reason.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim() : null;
  if (reason === null || reason.length < 3 || reason.length > 300) fields.reason = 'a reason of 3 to 300 characters is required';
  if (Object.keys(fields).length > 0 || reason === null) return { ok: false, fields };
  return { ok: true, value: { ratePercent: r as number, validFrom, reason } };
}
