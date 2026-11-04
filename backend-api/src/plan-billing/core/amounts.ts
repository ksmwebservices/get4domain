import { addMonths } from '../../plans/admin/admin-validation';

/** Pure money and date rules of plan purchases (slice 5.1b). Integer paise end to end. No clock, no randomness, no database. */
const DAY_MS = 86_400_000;

// ───────────────────────────────────────────────────────────────────────────────────────── amounts
export type AmountCheck = 'OK' | 'AMOUNT_MISMATCH' | 'CURRENCY_MISMATCH';

/** The paid amount and currency must equal the order snapshot exactly. Anything else is a mismatch and never activates a plan. */
export function verifyPaidAmount(order: { amountPaise: number; currency: string }, paid: { amount: number; currency: string }): AmountCheck {
  if (!paid || typeof paid.amount !== 'number' || !Number.isInteger(paid.amount) || paid.amount !== order.amountPaise) return 'AMOUNT_MISMATCH';
  return paid.currency === order.currency ? 'OK' : 'CURRENCY_MISMATCH';
}

// ───────────────────────────────────────────────────────────────────────────────────────── what kind of purchase
export interface CurrentPlan { planKey: string; level: 'FREE' | 'PRO'; monthlyPaise: number; endsAt: Date | null; status: 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED' }
export interface TargetPlan { planKey: string; level: 'FREE' | 'PRO'; monthlyPaise: number }
export type ChangeKind = 'NEW' | 'RENEWAL' | 'UPGRADE' | 'DOWNGRADE';

/**
 * NEW: no paid plan now (none, Free, ended, cancelled). RENEWAL: the same plan while it is paid (also in its grace period). UPGRADE: a dearer plan while a paid term runs.
 * DOWNGRADE: a cheaper plan while a paid term runs: it is NOT sold mid-term (the rule is "downgrades take effect at term end": the vendor renews or buys it once the term has ended).
 */
export function classifyChange(current: CurrentPlan | null, target: TargetPlan, now: Date): ChangeKind {
  const paidNow = !!current && current.level === 'PRO' && (current.status === 'ACTIVE' || current.status === 'GRACE') && (current.status === 'GRACE' || !current.endsAt || current.endsAt.getTime() > now.getTime());
  if (!current || !paidNow) return 'NEW';
  if (current.planKey === target.planKey) return 'RENEWAL';
  return target.monthlyPaise > current.monthlyPaise ? 'UPGRADE' : 'DOWNGRADE';
}

/**
 * upgradeProration = PRORATE: the unused WHOLE months of the current paid term, at the old plan's monthly rate (floor of price / term months), are credited against the new plan.
 * NONE: no credit. Part months never count. The credit is a whole number of paise and never negative.
 */
export function upgradeCreditPaise(mode: 'NONE' | 'PRORATE', cur: { amountPaise: number | null; termMonths: number; endsAt: Date | null }, now: Date): number {
  if (mode !== 'PRORATE' || cur.amountPaise === null || !Number.isInteger(cur.amountPaise) || cur.amountPaise <= 0 || !Number.isInteger(cur.termMonths) || cur.termMonths <= 0 || !cur.endsAt) return 0;
  if (cur.endsAt.getTime() <= now.getTime()) return 0;
  let whole = 0;
  while (whole < cur.termMonths && addMonths(now, whole + 1).getTime() <= cur.endsAt.getTime()) whole++;
  return whole * Math.floor(cur.amountPaise / cur.termMonths);
}

/** A renewal extends from the LATER of now and the current end (so paying early never loses time, and paying late never backdates). */
export function renewalEnd(currentEndsAt: Date | null, now: Date, termMonths: number): Date {
  const from = currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
  return addMonths(from, termMonths);
}

// ───────────────────────────────────────────────────────────────────────────────────────── invoice numbers
const IST_OFFSET_MS = 330 * 60_000;

/** The Indian financial year (April to March, in India time) a moment falls in, for example 2026-27. */
export function financialYearOf(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear(); const m = ist.getUTCMonth();
  const start = m >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function formatInvoiceNumber(prefix: string, financialYear: string, n: number): string { return `${prefix}/${financialYear}/${String(n).padStart(6, '0')}`; }

// ───────────────────────────────────────────────────────────────────────────────────────── reminders
export interface ReminderSub { id: string; endsAt: Date | null; status: string }
export interface ReminderAction { subscriptionId: string; daysBefore: number; endsAt: Date; action: 'SEND' | 'SKIP' }

/**
 * For each ACTIVE paid term whose end is in the future: the offsets already inside their window and not yet logged. The NEAREST one is sent; larger ones that were missed
 * (for example the cron was down) are logged as SKIPPED, so one email goes out, not three. `logged` holds `subscriptionId|daysBefore|endsAtISO` keys: the log's unique rule.
 */
export function dueReminders(subs: readonly ReminderSub[], now: Date, offsets: readonly number[], logged: ReadonlySet<string>): ReminderAction[] {
  const out: ReminderAction[] = [];
  const sorted = [...new Set(offsets)].filter((d) => Number.isInteger(d) && d >= 0).sort((a, b) => b - a);
  for (const s of subs) {
    if (s.status !== 'ACTIVE' || !s.endsAt || s.endsAt.getTime() <= now.getTime()) continue;
    const due = sorted.filter((d) => now.getTime() >= s.endsAt!.getTime() - d * DAY_MS && !logged.has(`${s.id}|${d}|${s.endsAt!.toISOString()}`));
    if (!due.length) continue;
    const nearest = due[due.length - 1];
    for (const d of due) out.push({ subscriptionId: s.id, daysBefore: d, endsAt: s.endsAt, action: d === nearest ? 'SEND' : 'SKIP' });
  }
  return out;
}
