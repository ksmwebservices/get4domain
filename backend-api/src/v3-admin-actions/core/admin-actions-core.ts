/** Pure rules of the staff actions (Amendment 09 Part A, Amendment 11 Q12). No clock reads, no database. */

const squash = (v: string): string => v.replace(/\s+/g, ' ').trim();

/** A reason staff must give for every action: 5 to 300 characters. */
export function cleanReason(v: unknown): string | null { if (typeof v !== 'string') return null; const t = squash(v); return t.length >= 5 && t.length <= 300 ? t : null; }

/** A business name: 2 to 120 characters on one line, no angle brackets (it goes into pages and notices). */
export function cleanBusinessName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = squash(v);
  return t.length >= 2 && t.length <= 120 && !/[<>\u0000-\u001f]/.test(t) ? t : null;
}

export const planKeyOk = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_]{3,60}$/.test(v);
export const termMonthsOk = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 120;

// ── merging two listings (contacts only in this slice) ──
export interface MergeCustomer { id: string; phoneKey: string | null; emailKey: string | null }
export interface MergePlan { move: string[]; conflicts: Array<{ id: string; because: 'PHONE' | 'EMAIL' }>; keepCount: number; mergeCount: number }

/**
 * Which customers of the merged listing can move to the kept one. A customer moves unless the kept listing already has the same phone or the same email (the same person is already there): that one
 * stays where it is and is reported as a conflict, nothing is overwritten. Two customers of the merged listing that share a key with each other are both moved only if the first claims it:
 * the keys moved so far count as taken, so the result can never break the one-person-one-row rule.
 */
export function planCustomerMerge(keep: readonly MergeCustomer[], merge: readonly MergeCustomer[]): MergePlan {
  const phones = new Set(keep.map((c) => c.phoneKey).filter((x): x is string => !!x)); const emails = new Set(keep.map((c) => c.emailKey).filter((x): x is string => !!x));
  const move: string[] = []; const conflicts: MergePlan['conflicts'] = [];
  for (const c of merge) {
    if (c.phoneKey && phones.has(c.phoneKey)) { conflicts.push({ id: c.id, because: 'PHONE' }); continue; }
    if (c.emailKey && emails.has(c.emailKey)) { conflicts.push({ id: c.id, because: 'EMAIL' }); continue; }
    move.push(c.id); if (c.phoneKey) phones.add(c.phoneKey); if (c.emailKey) emails.add(c.emailKey);
  }
  return { move, conflicts, keepCount: keep.length, mergeCount: merge.length };
}
// ── per-host visit counts (counts only, no personal data) ──
export type PlanChangeStatus = 'PENDING' | 'APPLYING' | 'APPLIED' | 'CANCELLED' | 'FAILED';
export const mergeWindowOpen = (untilMs: number, nowMs: number): boolean => nowMs <= untilMs;
/** Folds an in-memory counter into rows per host and day. */
export function foldCounts(counts: ReadonlyMap<string, number>, day: string): Array<{ host: string; day: string; count: number }> {
  return [...counts].filter(([, n]) => n > 0).map(([host, count]) => ({ host, day, count }));
}
