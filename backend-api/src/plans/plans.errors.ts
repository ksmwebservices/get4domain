/**
 * The stable machine codes of the plans slice (V3_S1_PLANS_ENTITLEMENTS.md section 7). A screen switches on `code`, never on the sentence.
 * The HTTP exception filter passes these codes (and the few safe fields below) through to the client; nothing else from an error body leaks.
 */
export const PLAN_ERROR_CODES = [
  'FEATURE_LOCKED', 'LIMIT_REACHED', 'STALE_WRITE', 'PLAN_IN_USE', 'FEATURE_IN_USE', 'INVALID_AMOUNT', 'INVALID_TERM',
  'FREE_PLAN_HAS_NO_PRICE', 'REASON_REQUIRED', 'UNKNOWN_PLAN', 'UNKNOWN_VENDOR',
  // Wave 4 W7: the GST rate setting
  'GST_RATE_INVALID', 'GST_RATE_EXISTS',
  // A rate that has already started was used to price orders: the generic tax-rate PUT and DELETE refuse to rewrite or remove it (add a new rate that starts later instead)
  'TAX_RATE_IN_FORCE',
] as const;
export type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];

export interface PlanErrorExtra { feature?: string; upsellText?: string | null; limit?: number | null; requiredPlan?: string }

/** The body for `new ForbiddenException(...)`, `new ConflictException(...)` and friends. */
export function planError(code: PlanErrorCode, message: string, extra: PlanErrorExtra = {}): { message: string; code: PlanErrorCode } & PlanErrorExtra {
  return { message, code, ...extra };
}
