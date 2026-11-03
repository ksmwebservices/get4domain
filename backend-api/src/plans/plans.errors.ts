/**
 * The stable machine codes of the plans slice (V3_S1_PLANS_ENTITLEMENTS.md section 7). A screen switches on `code`, never on the sentence.
 * The HTTP exception filter passes these codes (and the few safe fields below) through to the client; nothing else from an error body leaks.
 */
export const PLAN_ERROR_CODES = [
  'FEATURE_LOCKED', 'LIMIT_REACHED', 'STALE_WRITE', 'PLAN_IN_USE', 'FEATURE_IN_USE', 'INVALID_AMOUNT', 'INVALID_TERM',
  'FREE_PLAN_HAS_NO_PRICE', 'REASON_REQUIRED', 'UNKNOWN_PLAN', 'UNKNOWN_VENDOR',
] as const;
export type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];

export interface PlanErrorExtra { feature?: string; upsellText?: string | null; limit?: number | null; requiredPlan?: string }

/** The body for `new ForbiddenException(...)`, `new ConflictException(...)` and friends. */
export function planError(code: PlanErrorCode, message: string, extra: PlanErrorExtra = {}): { message: string; code: PlanErrorCode } & PlanErrorExtra {
  return { message, code, ...extra };
}
