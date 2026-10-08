import { WORKSPACE_AI_CREDIT_PAISE, BOS_AI_CREDIT_PAISE } from '../payments/plan-pricing.constants';

/**
 * AI Studio credit, prorated by billing term (KSM decision, 2026-10-08).
 *
 * THE single source of the rule. The annual list amounts live in `plan-pricing.constants.ts`
 * (Workspace ₹499, BOS ₹1,299 — what the public, annual-only pages advertise) and are re-exported here; every
 * other piece of commercial code asks `aiStudioCreditPaise()` / `resolveAiCredit()`. The admin UI does not
 * re-implement the rule: the deal preview endpoint returns the computed value for whatever plan/cycle is chosen.
 *
 *   credit = round(annual × months / 12 to the nearest whole rupee, halves up), capped at the annual amount.
 *   Workspace: 12 mo ₹499 · 6 mo ₹250 · 3 mo ₹125 · 1 mo ₹42.   BOS: 12 mo ₹1,299 · 6 mo ₹650.
 */
export type CreditPlanKey = 'WORKSPACE' | 'BOS';

export const AI_CREDIT_ANNUAL_PAISE: Record<CreditPlanKey, number> = { WORKSPACE: WORKSPACE_AI_CREDIT_PAISE, BOS: BOS_AI_CREDIT_PAISE };

/** Admin override range per deal: ₹0 … ₹5,000. */
export const AI_CREDIT_OVERRIDE_MIN_PAISE = 0;
export const AI_CREDIT_OVERRIDE_MAX_PAISE = 500_000;

const PAISE_PER_RUPEE = 100;

export function aiStudioCreditPaise(plan: CreditPlanKey, cycleMonths: number): number {
  const annual = AI_CREDIT_ANNUAL_PAISE[plan];
  if (annual === undefined) throw new RangeError(`Unknown plan: ${String(plan)}`);
  if (!Number.isInteger(cycleMonths) || cycleMonths < 1) throw new RangeError('Term must be a whole number of months, 1 or more');
  // annual × months / 12 paise → rupees = annual × months / 1200. Round half UP to a whole rupee with integer maths
  // (no float error): floor((annual × months + 600) / 1200).
  const rupees = Math.floor((annual * cycleMonths + 600) / 1200);
  return Math.min(annual, rupees * PAISE_PER_RUPEE);
}

export interface ResolvedAiCredit { computedPaise: number; paise: number; overridden: boolean; /** the annual list credit the amount is prorated from (for display) */ annualPaise: number }

/**
 * The credit a deal/term carries: the computed amount, or the admin's override (whole paise, ₹0…₹5,000;
 * 0 means "no credit"). `overridden` is true only when the entered value differs from the computed one.
 */
export function resolveAiCredit(plan: CreditPlanKey, cycleMonths: number, overridePaise?: number | null): ResolvedAiCredit {
  const computedPaise = aiStudioCreditPaise(plan, cycleMonths);
  const annualPaise = AI_CREDIT_ANNUAL_PAISE[plan];
  if (overridePaise === undefined || overridePaise === null) return { computedPaise, paise: computedPaise, overridden: false, annualPaise };
  if (!Number.isInteger(overridePaise) || overridePaise < AI_CREDIT_OVERRIDE_MIN_PAISE || overridePaise > AI_CREDIT_OVERRIDE_MAX_PAISE) {
    throw new RangeError('The AI Studio credit must be between ₹0 and ₹5,000');
  }
  return { computedPaise, paise: overridePaise, overridden: overridePaise !== computedPaise, annualPaise };
}
