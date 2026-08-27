/**
 * Canonical plan pricing (in paise, GST-EXCLUSIVE base) and the welcome wallet
 * bonus tied to each billing term. Single source of truth for the backend so the
 * "quarterly = ₹100, yearly = ₹400" incentive (dispatch 26-Aug-2026, Phase 1
 * item 3) is derived from the paid subscription rather than hard-coded at call
 * sites. Mirrors the frontend src/lib/pricing.ts values.
 *
 * NOTE: base amounts are GST-exclusive. A subscription's stored `amount` may be
 * either the base or the GST-inclusive total depending on how the plan invoice
 * was raised, so term detection tolerates both (see planBonusForAmount).
 */
export const QUARTERLY_BASE_PAISE = 299700; // ₹2,997 / 3 months (₹999/mo effective)
export const YEARLY_BASE_PAISE = 999900; // ₹9,999 / year

export const QUARTERLY_WELCOME_BONUS_PAISE = 10000; // ₹100 free wallet credit
export const YEARLY_WELCOME_BONUS_PAISE = 40000; // ₹400 free wallet credit

const GST_RATE = 0.18;

/**
 * Resolve the welcome wallet bonus (paise) for a paid plan, given the amount
 * charged. Matches the base or the GST-inclusive total for each term (±1% to
 * absorb rounding). Returns 0 for anything that isn't a recognised quarterly or
 * yearly plan amount — e.g. a single-month top-up or a custom invoice — so no
 * bonus is granted where none is due.
 */
export function planBonusForAmount(amountPaise: number): number {
  const within = (value: number, target: number): boolean =>
    Math.abs(value - target) <= Math.round(target * 0.01);

  const yearlyGross = Math.round(YEARLY_BASE_PAISE * (1 + GST_RATE));
  const quarterlyGross = Math.round(QUARTERLY_BASE_PAISE * (1 + GST_RATE));

  if (within(amountPaise, YEARLY_BASE_PAISE) || within(amountPaise, yearlyGross)) {
    return YEARLY_WELCOME_BONUS_PAISE;
  }
  if (within(amountPaise, QUARTERLY_BASE_PAISE) || within(amountPaise, quarterlyGross)) {
    return QUARTERLY_WELCOME_BONUS_PAISE;
  }
  return 0;
}

/**
 * Billing-term length in months for a paid plan amount: 12 for yearly, 3 for
 * quarterly, null when the amount isn't a recognised plan (leave the term
 * untouched rather than guess). Used to set a subscription's endDate on payment.
 */
export function planTermMonthsForAmount(amountPaise: number): number | null {
  const within = (value: number, target: number): boolean =>
    Math.abs(value - target) <= Math.round(target * 0.01);
  const yearlyGross = Math.round(YEARLY_BASE_PAISE * (1 + GST_RATE));
  const quarterlyGross = Math.round(QUARTERLY_BASE_PAISE * (1 + GST_RATE));

  if (within(amountPaise, YEARLY_BASE_PAISE) || within(amountPaise, yearlyGross)) return 12;
  if (within(amountPaise, QUARTERLY_BASE_PAISE) || within(amountPaise, quarterlyGross)) return 3;
  return null;
}
