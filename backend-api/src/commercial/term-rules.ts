import { addMonths, daysBetween } from './pricing-math';

/**
 * Billing-term lifecycle rules — PURE. The daily renewal job feeds these a term snapshot and `now`
 * and then performs the (idempotent) side effects they ask for.
 *
 *   DEMO ──activation paid──▶ ACTIVE ──periodEnd + grace passes unpaid──▶ LAPSED ──payment──▶ ACTIVE
 *   DEMO/ACTIVE ──"activate now, pay in N days"──▶ ACTIVE_PAYMENT_DUE ──paid──▶ ACTIVE
 *   ACTIVE_PAYMENT_DUE ──paymentDueAt + grace passes unpaid──▶ LAPSED
 *   any ──admin cancel──▶ CANCELLED (terminal; never auto-reactivated)
 */
export type TermStatus = 'DEMO' | 'ACTIVE' | 'ACTIVE_PAYMENT_DUE' | 'LAPSED' | 'CANCELLED';
export type ReminderKey = 'T15' | 'T7' | 'T1' | 'OVERDUE';

export const RENEWAL_INVOICE_LEAD_DAYS = 15;
const THRESHOLDS: { key: ReminderKey; days: number }[] = [
  { key: 'T15', days: 15 },
  { key: 'T7', days: 7 },
  { key: 'T1', days: 1 },
];

export interface TermSnapshot {
  status: TermStatus;
  periodEnd: Date | null;
  paymentDueAt: Date | null;
  graceDays: number;
  renewalInvoiceId: string | null;
  reminders: Partial<Record<ReminderKey, string>> | null;
}

export interface RenewalDecision {
  /** Create the renewal invoice now (T-15 and none exists yet). Only for ACTIVE terms. */
  createInvoice: boolean;
  /** The single most urgent reminder to send now (earlier ones that were skipped are marked sent, not spammed). */
  reminder: ReminderKey | null;
  /** All reminder keys to record as sent (the one sent plus any earlier thresholds already crossed). */
  markReminders: ReminderKey[];
  /** Move to LAPSED. */
  lapse: boolean;
  /** Days until the anchor date (negative when overdue). */
  daysLeft: number | null;
}

/** The date a payment is due: the period end for a running term, paymentDueAt for "activate now, pay later". */
export function anchorDate(t: Pick<TermSnapshot, 'status' | 'periodEnd' | 'paymentDueAt'>): Date | null {
  return t.status === 'ACTIVE_PAYMENT_DUE' ? t.paymentDueAt : t.periodEnd;
}

export function lapseDate(t: TermSnapshot): Date | null {
  const a = anchorDate(t);
  return a ? new Date(a.getTime() + Math.max(0, t.graceDays) * 24 * 60 * 60 * 1000) : null;
}

export function decideRenewalStep(t: TermSnapshot, now: Date): RenewalDecision {
  const none: RenewalDecision = { createInvoice: false, reminder: null, markReminders: [], lapse: false, daysLeft: null };
  if (t.status !== 'ACTIVE' && t.status !== 'ACTIVE_PAYMENT_DUE') return none;
  const anchor = anchorDate(t);
  if (!anchor) return none;

  const daysLeft = daysBetween(now, anchor);
  const sent = t.reminders ?? {};
  const out: RenewalDecision = { ...none, daysLeft };

  // Lapse once the grace period after the anchor has fully passed.
  const lapseAt = lapseDate(t);
  if (lapseAt && now.getTime() > lapseAt.getTime()) out.lapse = true;

  // A renewal invoice is created 15 days ahead — only for a running (ACTIVE) term; an activation
  // invoice already exists for ACTIVE_PAYMENT_DUE.
  if (t.status === 'ACTIVE' && daysLeft <= RENEWAL_INVOICE_LEAD_DAYS && !t.renewalInvoiceId) out.createInvoice = true;

  // Reminders. ACTIVE_PAYMENT_DUE skips T15 (the invoice already went out when the term was activated).
  const crossed = THRESHOLDS.filter((th) => daysLeft <= th.days && !(t.status === 'ACTIVE_PAYMENT_DUE' && th.key === 'T15'));
  const unsent = crossed.filter((th) => !sent[th.key]);
  if (daysLeft < 0 && !sent.OVERDUE && !out.lapse) {
    out.reminder = 'OVERDUE';
    out.markReminders = [...crossed.map((c) => c.key), 'OVERDUE'];
  } else if (unsent.length && daysLeft >= 0) {
    // Most urgent crossed threshold = the smallest `days`.
    const urgent = unsent.reduce((a, b) => (a.days <= b.days ? a : b));
    out.reminder = urgent.key;
    out.markReminders = crossed.map((c) => c.key);
  }
  return out;
}

/** Initial period for an activation: now → now + months. */
export function activationPeriod(now: Date, months: number): { start: Date; end: Date } {
  return { start: now, end: addMonths(now, months) };
}

/** Business rule: a downgrade (Bos → Workspace) can only take effect at renewal. */
export function isDowngrade(fromPlan: string, toPlan: string): boolean {
  return fromPlan === 'BOS' && toPlan === 'WORKSPACE';
}
