/** Date helpers of the staff actions. Kept out of core/ because they build dates (the pure core has no clock and no Date construction). Nothing here reads the clock: the caller passes `now`. */

export type EffectiveWhen = { when: 'NOW' } | { when: 'LATER'; at: Date };
/** When a plan change takes effect: now (no date, or a date that is not in the future) or at the date. A date that is not a real date is refused (null). */
export function effectiveWhen(effectiveAt: unknown, now: Date): EffectiveWhen | null {
  if (effectiveAt === undefined || effectiveAt === null || effectiveAt === '') return { when: 'NOW' };
  if (typeof effectiveAt !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(effectiveAt)) return null;
  if (!realDay(effectiveAt.slice(0, 10))) return null;   // 30 February is not a day, even though a Date would roll it over to March
  const d = new Date(effectiveAt); if (Number.isNaN(d.getTime())) return null;
  return d.getTime() <= now.getTime() ? { when: 'NOW' } : { when: 'LATER', at: d };
}
/** YYYY-MM-DD that is a real calendar day. */
export function realDay(v: string): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }
export const cleanDay = (v: unknown): string | null => (typeof v === 'string' && realDay(v) ? v : null);
export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
export const reversibleUntil = (now: Date, days: number): Date => new Date(now.getTime() + days * 86_400_000);
