/**
 * Canonical plan pricing (in paise, GST-EXCLUSIVE base) for DomainApp.
 *
 * Dispatch 01-Oct-2026 — pricing restructure: DomainApp is now two ANNUAL-ONLY
 * tiers, Workspace and BOS. Quarterly billing is RETIRED for new purchases
 * (new-signup go-live and renewal offers only show these two annual tiers).
 * The legacy QUARTERLY_BASE_PAISE/YEARLY_BASE_PAISE constants below are kept
 * so planBonusForAmount/planTermMonthsForAmount still correctly classify
 * amounts already on the books from vendors who bought under the old
 * structure — their current paid term runs its course unchanged (billing is
 * one-off Orders, not an auto-recurring Razorpay subscription, so retiring
 * quarterly does not cancel anyone's active term; it only removes quarterly
 * as a choice on the NEXT purchase/renewal).
 *
 * Mirrors the frontend src/lib/pricing.ts values.
 */
export const WORKSPACE_YEARLY_PAISE = 1198800; // ₹11,988/year (₹999/mo equivalent)
export const BOS_YEARLY_PAISE = 2398800; // ₹23,988/year (₹1,999/mo equivalent)

/** One-time AI Studio wallet credit granted on the FIRST annual payment only. */
export const WORKSPACE_AI_CREDIT_PAISE = 49900; // ₹499
export const BOS_AI_CREDIT_PAISE = 129900; // ₹1,299

export const WORKSPACE_FREE_SEO_KEYWORDS = 3;
export const BOS_FREE_SEO_KEYWORDS = 6;

export const WORKSPACE_THEME_CHANGE_LIMIT = 2;
export const BOS_THEME_CHANGE_LIMIT = 4;

/** @deprecated Retired for new purchases (dispatch 01-Oct-2026). Kept only to
 *  classify amounts already recorded against existing quarterly subscribers. */
export const QUARTERLY_BASE_PAISE = 299700; // ₹2,997 / 3 months (₹999/mo effective)
/** @deprecated Retired for new purchases (dispatch 01-Oct-2026) — superseded by
 *  WORKSPACE_YEARLY_PAISE. Kept only to classify amounts already on the books. */
export const YEARLY_BASE_PAISE = 999900; // ₹9,999 / year (old single-tier yearly)

export const QUARTERLY_WELCOME_BONUS_PAISE = 10000; // ₹100 free wallet credit (legacy tier only)
export const YEARLY_WELCOME_BONUS_PAISE = 40000; // ₹400 free wallet credit (legacy tier only)

const GST_RATE = 0.18;

const within = (value: number, target: number): boolean =>
  Math.abs(value - target) <= Math.round(target * 0.01);

export type PlanTier = 'workspace' | 'bos' | 'legacy_quarterly' | 'legacy_yearly';

/**
 * Resolve which tier a charged amount (paise) corresponds to, matching either
 * the GST-exclusive base or the GST-inclusive total (±1% to absorb rounding).
 * Returns null for anything that isn't a recognised DomainApp plan amount.
 */
export function planTierForAmount(amountPaise: number): PlanTier | null {
  const workspaceGross = Math.round(WORKSPACE_YEARLY_PAISE * (1 + GST_RATE));
  const bosGross = Math.round(BOS_YEARLY_PAISE * (1 + GST_RATE));
  const yearlyGross = Math.round(YEARLY_BASE_PAISE * (1 + GST_RATE));
  const quarterlyGross = Math.round(QUARTERLY_BASE_PAISE * (1 + GST_RATE));

  if (within(amountPaise, WORKSPACE_YEARLY_PAISE) || within(amountPaise, workspaceGross)) return 'workspace';
  if (within(amountPaise, BOS_YEARLY_PAISE) || within(amountPaise, bosGross)) return 'bos';
  if (within(amountPaise, YEARLY_BASE_PAISE) || within(amountPaise, yearlyGross)) return 'legacy_yearly';
  if (within(amountPaise, QUARTERLY_BASE_PAISE) || within(amountPaise, quarterlyGross)) return 'legacy_quarterly';
  return null;
}

/**
 * Resolve the welcome wallet bonus (paise) for a paid plan, given the amount
 * charged. Only the LEGACY tiers carry this generic "welcome credit" bonus —
 * Workspace/BOS replace it with the tier-specific AI Studio credit instead
 * (see aiStudioBonusForAmount), so this returns 0 for new-tier amounts.
 */
export function planBonusForAmount(amountPaise: number): number {
  const tier = planTierForAmount(amountPaise);
  if (tier === 'legacy_yearly') return YEARLY_WELCOME_BONUS_PAISE;
  if (tier === 'legacy_quarterly') return QUARTERLY_WELCOME_BONUS_PAISE;
  return 0;
}

/**
 * The one-time AI Studio wallet credit (paise) for a paid plan amount, granted
 * only on the vendor's first annual payment. 0 for anything that isn't a
 * recognised Workspace/BOS amount (legacy tiers never had this credit).
 */
export function aiStudioBonusForAmount(amountPaise: number): number {
  const tier = planTierForAmount(amountPaise);
  if (tier === 'workspace') return WORKSPACE_AI_CREDIT_PAISE;
  if (tier === 'bos') return BOS_AI_CREDIT_PAISE;
  return 0;
}

/** Theme-change allowance per billing year for a paid plan amount, or null if
 *  the amount isn't a recognised Workspace/BOS tier (legacy tiers have no
 *  tracked limit — the feature launches with the new tiers only). */
export function themeChangeLimitForAmount(amountPaise: number): number | null {
  const tier = planTierForAmount(amountPaise);
  if (tier === 'workspace') return WORKSPACE_THEME_CHANGE_LIMIT;
  if (tier === 'bos') return BOS_THEME_CHANGE_LIMIT;
  return null;
}

/**
 * Billing-term length in months for a paid plan amount: 12 for every
 * DomainApp tier (Workspace, BOS, and the old single-tier yearly), 3 for the
 * legacy quarterly tier, null when the amount isn't a recognised plan (leave
 * the term untouched rather than guess). Used to set a subscription's endDate
 * on payment.
 */
export function planTermMonthsForAmount(amountPaise: number): number | null {
  const tier = planTierForAmount(amountPaise);
  if (tier === 'workspace' || tier === 'bos' || tier === 'legacy_yearly') return 12;
  if (tier === 'legacy_quarterly') return 3;
  return null;
}
