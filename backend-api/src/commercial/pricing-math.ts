/**
 * Commercial Engine v1 — money math. PURE (no I/O) so it can be asserted exhaustively.
 * Everything is integer paise. GST is always computed on the NET after discount.
 */

export type GstMode = 'EXCLUSIVE' | 'INCLUSIVE' | 'NONE';
export type BillingCycle = 'MONTHLY' | 'HALF_YEARLY' | 'ANNUAL' | 'CUSTOM_MONTHS';
export type LineKind = 'PLAN' | 'ADDON' | 'CUSTOM' | 'CREDIT';

export const GST_PERCENT = 18;
/** A discount above this share of the subtotal needs the admin to type CONFIRM. */
export const BIG_DISCOUNT_RATIO = 0.2;
export const MAX_CUSTOM_MONTHS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Line {
  kind: LineKind;
  label: string;
  /** Per-unit amount in paise. CREDIT lines are negative (proration credit). */
  amountPaise: number;
  qty?: number;
}

export interface Totals {
  /** Sum of lines before discount. */
  subtotalPaise: number;
  discountPaise: number;
  /** subtotal − discount (the "net after discount"; GST base for EXCLUSIVE). */
  netPaise: number;
  /** Stored as Invoice.amount. */
  taxablePaise: number;
  /** Stored as Invoice.gstAmount. */
  gstPaise: number;
  /** Stored as Invoice.totalAmount — what the payer owes. */
  totalPaise: number;
}

export function lineTotal(l: Line): number {
  return Math.round(l.amountPaise) * (l.qty ?? 1);
}

export function subtotalOf(lines: Line[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

/**
 * EXCLUSIVE: GST = 18% of the net after discount, added on top.
 * INCLUSIVE: the net after discount IS the total; taxable = total / 1.18 (GST backed out).
 * NONE:      no GST at all (total = net).
 */
export function computeTotals(lines: Line[], discountPaise: number, gstMode: GstMode): Totals {
  const subtotalPaise = subtotalOf(lines);
  if (!Number.isInteger(discountPaise) || discountPaise < 0) throw new RangeError('Discount must be a non-negative whole number of paise');
  if (discountPaise > Math.max(subtotalPaise, 0)) throw new RangeError('Discount cannot exceed the subtotal');
  const netPaise = subtotalPaise - discountPaise;
  if (netPaise < 0) throw new RangeError('Invoice total cannot be negative');

  if (gstMode === 'EXCLUSIVE') {
    const gstPaise = Math.round((netPaise * GST_PERCENT) / 100);
    return { subtotalPaise, discountPaise, netPaise, taxablePaise: netPaise, gstPaise, totalPaise: netPaise + gstPaise };
  }
  if (gstMode === 'INCLUSIVE') {
    const taxablePaise = Math.round((netPaise * 100) / (100 + GST_PERCENT));
    return { subtotalPaise, discountPaise, netPaise, taxablePaise, gstPaise: netPaise - taxablePaise, totalPaise: netPaise };
  }
  return { subtotalPaise, discountPaise, netPaise, taxablePaise: netPaise, gstPaise: 0, totalPaise: netPaise };
}

/** Discount from a percentage (whole or fractional percent) of the subtotal, rounded to a paisa. */
export function discountFromPercent(subtotalPaise: number, percent: number): number {
  if (!(percent >= 0 && percent <= 100)) throw new RangeError('Percent must be between 0 and 100');
  return Math.min(subtotalPaise, Math.round((subtotalPaise * percent) / 100));
}

export function isBigDiscount(subtotalPaise: number, discountPaise: number): boolean {
  return subtotalPaise > 0 && discountPaise / subtotalPaise > BIG_DISCOUNT_RATIO;
}

export interface ApprovedNet { listPaise: number; netPaise: number; discountPaise: number; overridden: boolean; needsConfirm: boolean }

/**
 * The net price (before GST) KSM approves for a plan change. Default = the list price of the target plan/cycle.
 * An override must be a whole number of paise within [0, list] (this is a discount, never a mark-up), needs a reason,
 * and a discount above 20% of list needs the admin to have typed CONFIRM. Pure — the caller audit-logs it.
 */
export function resolveApprovedNet(listPaise: number, requestedNetPaise: number | null | undefined, reason?: string | null, confirm?: string | null): ApprovedNet {
  if (!Number.isInteger(listPaise) || listPaise < 0) throw new RangeError('List price must be a non-negative whole number of paise');
  if (requestedNetPaise == null || requestedNetPaise === listPaise) return { listPaise, netPaise: listPaise, discountPaise: 0, overridden: false, needsConfirm: false };
  if (!Number.isInteger(requestedNetPaise) || requestedNetPaise < 0) throw new RangeError('The approved price must be a whole number of paise, 0 or more');
  if (requestedNetPaise > listPaise) throw new RangeError('The approved price cannot be higher than the list price for that plan');
  if ((reason ?? '').trim().length < 3) throw new RangeError('A reason is required when the approved price differs from the list price');
  const discountPaise = listPaise - requestedNetPaise;
  const needsConfirm = isBigDiscount(listPaise, discountPaise);
  if (needsConfirm && confirm !== 'CONFIRM') throw new RangeError('Discounts above 20% need you to type CONFIRM');
  return { listPaise, netPaise: requestedNetPaise, discountPaise, overridden: true, needsConfirm };
}

export function cycleMonths(cycle: BillingCycle, customMonths?: number | null): number {
  switch (cycle) {
    case 'MONTHLY': return 1;
    case 'HALF_YEARLY': return 6;
    case 'ANNUAL': return 12;
    case 'CUSTOM_MONTHS': {
      if (!Number.isInteger(customMonths) || (customMonths as number) < 1 || (customMonths as number) > MAX_CUSTOM_MONTHS) {
        throw new RangeError(`Custom term must be 1–${MAX_CUSTOM_MONTHS} whole months`);
      }
      return customMonths as number;
    }
    default: throw new RangeError('Unknown billing cycle');
  }
}

/** List price for a term: the annual price pro-rated by months (annual / 12 × months). Public pricing stays annual-only. */
export function planListPaise(annualPaise: number, months: number): number {
  return Math.round((annualPaise * months) / 12);
}

/** Calendar-month addition in UTC that clamps the day (31 Jan + 1 month = 28/29 Feb), never overflowing into the next month. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * Renewal period: extend from the previous periodEnd so no paid days are lost on an early renewal.
 * If the vendor renews so late that the contiguous period would already be over, start from `now`.
 */
export function renewalPeriod(previousPeriodEnd: Date | null, now: Date, months: number): { start: Date; end: Date } {
  let start = previousPeriodEnd ?? now;
  let end = addMonths(start, months);
  if (end.getTime() <= now.getTime()) {
    start = now;
    end = addMonths(now, months);
  }
  return { start, end };
}

/**
 * Proration credit for an immediate plan change: unused days × the daily net rate of the current term.
 * dailyNet = netAmount / totalDays; credit = dailyNet × unusedDays (rounded to a paisa).
 */
export function prorationCreditPaise(term: { netAmountPaise: number; periodStart: Date | null; periodEnd: Date | null }, now: Date): number {
  if (!term.periodStart || !term.periodEnd || term.netAmountPaise <= 0) return 0;
  const totalDays = Math.max(1, Math.round((term.periodEnd.getTime() - term.periodStart.getTime()) / DAY_MS));
  const unusedMs = term.periodEnd.getTime() - Math.max(now.getTime(), term.periodStart.getTime());
  const unusedDays = Math.min(totalDays, Math.max(0, Math.ceil(unusedMs / DAY_MS)));
  return Math.round((term.netAmountPaise * unusedDays) / totalDays);
}

/** Whole days from `a` to `b` (negative when b is before a), by calendar day in UTC. */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const ub = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((ub - ua) / DAY_MS);
}

export const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
