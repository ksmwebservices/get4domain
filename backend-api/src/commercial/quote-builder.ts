import { BadRequestException } from '@nestjs/common';
import {
  BillingCycle, GstMode, Line, Totals, MAX_CUSTOM_MONTHS,
  computeTotals, cycleMonths, discountFromPercent, isBigDiscount, planListPaise, subtotalOf,
} from './pricing-math';
import { PlanKey } from './entitlements';

/**
 * Turns an admin's deal spec into server-authoritative lines + totals. The PLAN line is priced here from
 * the platform rate (never from the client); add-on/custom lines carry admin-entered amounts (this is an
 * admin-only tool — a payer can never influence any amount). Pure given the annual rates.
 */

export interface AddonLineInput { kind: 'ADDON' | 'CUSTOM'; label: string; amountPaise: number; qty?: number }

export interface DiscountInput {
  mode: 'NONE' | 'PERCENT' | 'FLAT' | 'PROMO';
  /** PERCENT: whole/fractional percent; FLAT: paise. */
  value?: number;
  reason?: string;
  /** Must be exactly "CONFIRM" when the discount exceeds 20% of the subtotal. */
  confirm?: string;
}

export interface QuoteSpec {
  planKey?: PlanKey | null;
  billingCycle?: BillingCycle | null;
  customMonths?: number | null;
  addons?: AddonLineInput[];
  discount?: DiscountInput;
  gstMode: GstMode;
}

export interface AnnualRates { WORKSPACE: number; BOS: number }

export interface BuiltQuote {
  lines: Line[];
  months: number | null;
  totals: Totals;
  discountReason: string | null;
  bigDiscount: boolean;
  /** Set when mode === 'PROMO' — the caller resolves the code and calls `withPromoDiscount`. */
  wantsPromo: boolean;
}

export function planLabel(planKey: PlanKey, months: number): string {
  const term = months === 12 ? 'annual' : months === 6 ? 'half-yearly' : months === 1 ? 'monthly' : `${months}-month`;
  return `DomainApp ${planKey === 'BOS' ? 'BOS' : 'Workspace'} plan — ${term}`;
}

export function buildQuote(spec: QuoteSpec, rates: AnnualRates, promoDiscountPaise = 0): BuiltQuote {
  const lines: Line[] = [];
  let months: number | null = null;

  if (spec.planKey) {
    if (!spec.billingCycle) throw new BadRequestException('Choose a billing cycle for the plan');
    try { months = cycleMonths(spec.billingCycle, spec.customMonths); } catch (e) { throw new BadRequestException((e as Error).message); }
    const annual = rates[spec.planKey];
    if (!Number.isInteger(annual) || annual <= 0) throw new BadRequestException('Plan price is not configured');
    lines.push({ kind: 'PLAN', label: planLabel(spec.planKey, months), amountPaise: planListPaise(annual, months), qty: 1 });
  }

  for (const a of spec.addons ?? []) {
    const label = (a.label ?? '').trim();
    if (!label || label.length > 120) throw new BadRequestException('Every add-on / custom line needs a label (max 120 characters)');
    if (!Number.isInteger(a.amountPaise) || a.amountPaise <= 0 || a.amountPaise > 100_00_00_000) throw new BadRequestException(`Amount for "${label}" must be a positive whole number of paise`);
    const qty = a.qty ?? 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new BadRequestException(`Quantity for "${label}" must be 1–1000`);
    lines.push({ kind: a.kind === 'ADDON' ? 'ADDON' : 'CUSTOM', label, amountPaise: a.amountPaise, qty });
  }
  if (!lines.length) throw new BadRequestException('Add a plan or at least one line item');

  const subtotal = subtotalOf(lines);
  const d = spec.discount ?? { mode: 'NONE' as const };
  let discountPaise = 0;
  let reason: string | null = null;

  if (d.mode === 'PERCENT') {
    if (typeof d.value !== 'number' || !(d.value > 0 && d.value <= 100)) throw new BadRequestException('Discount percent must be between 0 and 100');
    discountPaise = discountFromPercent(subtotal, d.value);
  } else if (d.mode === 'FLAT') {
    if (!Number.isInteger(d.value) || (d.value as number) <= 0) throw new BadRequestException('Flat discount must be a positive whole number of paise');
    if ((d.value as number) > subtotal) throw new BadRequestException('Discount cannot exceed the subtotal');
    discountPaise = d.value as number;
  } else if (d.mode === 'PROMO') {
    discountPaise = promoDiscountPaise;
  }

  const bigDiscount = isBigDiscount(subtotal, discountPaise);
  if (d.mode === 'PERCENT' || d.mode === 'FLAT') {
    reason = (d.reason ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('A reason is required for every manual discount');
    if (reason.length > 300) throw new BadRequestException('Discount reason is too long (max 300)');
    if (bigDiscount && d.confirm !== 'CONFIRM') throw new BadRequestException('Discounts above 20% need you to type CONFIRM');
  } else if (d.mode === 'PROMO') {
    reason = (d.reason ?? '').trim() || 'Promo code';
  }

  let totals: Totals;
  try { totals = computeTotals(lines, discountPaise, spec.gstMode); } catch (e) { throw new BadRequestException((e as Error).message); }
  return { lines, months, totals, discountReason: reason, bigDiscount, wantsPromo: d.mode === 'PROMO' };
}

export const CUSTOM_MONTHS_HINT = `1–${MAX_CUSTOM_MONTHS} months`;
