/** Pure credit rules of AI Studio (slice 5.11). Integers only. No clock, no database. */
const IST_OFFSET_MS = 330 * 60_000;

/** The calendar month, in India time, that credits are counted in (for example 2026-11). */
export function periodOf(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface CreditAllowance { allowed: boolean; unlimited: boolean; total: number }

/**
 * What the plan allows this month: the entitlement ai.credits_included (LIMITED with a number, ACTIVE with or without one) plus the credits staff granted for the month. A feature that is
 * LOCKED_PREVIEW or HIDDEN allows nothing, whatever was granted: the plan gate comes first.
 */
export function creditAllowance(feature: { state: string; limit: number | null }, granted: number): CreditAllowance {
  if (feature.state !== 'ACTIVE' && feature.state !== 'LIMITED') return { allowed: false, unlimited: false, total: 0 };
  const extra = Number.isInteger(granted) && granted > 0 ? granted : 0;
  if (feature.state === 'ACTIVE' && feature.limit === null) return { allowed: true, unlimited: true, total: Infinity };
  return { allowed: true, unlimited: false, total: (typeof feature.limit === 'number' && feature.limit > 0 ? feature.limit : 0) + extra };
}

export function canSpend(a: CreditAllowance, used: number, cost: number): boolean {
  if (!a.allowed || !Number.isInteger(cost) || cost <= 0 || !Number.isInteger(used) || used < 0) return false;
  return a.unlimited || used + cost <= a.total;
}

/** null = unlimited */
export function remainingCredits(a: CreditAllowance, used: number): number | null { return a.unlimited ? null : Math.max(0, a.total - used); }
