import { discountFromPercent } from './pricing-math';

/**
 * Promo-code rules, evaluated SERVER-SIDE ONLY and PURELY (the service feeds in redemption counts).
 * Order of checks is stable so the returned reason is deterministic.
 */
export interface PromoShape {
  active: boolean;
  type: 'PERCENT' | 'FLAT';
  value: number;
  appliesToPlans: string[];
  appliesToCycles: string[];
  appliesToKinds: string[];
  minCycleMonths: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  maxRedemptions: number | null;
  perVendorLimit: number;
}

export interface PromoContext {
  now: Date;
  planKey: string | null;
  billingCycle: string | null;
  cycleMonths: number | null;
  kind: string | null;
  subtotalPaise: number;
  /** An ad-hoc admin discount is already baked into the invoice. */
  adminDiscountPresent: boolean;
  /** The admin explicitly allowed a promo on top of their discount. */
  allowStacking: boolean;
  /** Redemptions already recorded (PAID invoices only) — overall and by this vendor. */
  redemptionsTotal: number;
  redemptionsByVendor: number;
  /** Another promo is already applied to this invoice. */
  invoiceHasPromo: boolean;
}

export type PromoResult = { ok: true; discountPaise: number } | { ok: false; reason: string };

export function evaluatePromo(p: PromoShape, c: PromoContext): PromoResult {
  if (!p.active) return { ok: false, reason: 'This code is not active' };
  if (p.validFrom && c.now < p.validFrom) return { ok: false, reason: 'This code is not valid yet' };
  if (p.validTo && c.now > p.validTo) return { ok: false, reason: 'This code has expired' };
  if (c.invoiceHasPromo) return { ok: false, reason: 'A promo code is already applied to this invoice' };
  if (c.adminDiscountPresent && !c.allowStacking) return { ok: false, reason: 'This invoice already carries a special discount, so a promo code cannot be added' };
  if (p.appliesToKinds.length && (!c.kind || !p.appliesToKinds.includes(c.kind))) return { ok: false, reason: 'This code does not apply to this kind of invoice' };
  if (p.appliesToPlans.length && (!c.planKey || !p.appliesToPlans.includes(c.planKey))) return { ok: false, reason: 'This code does not apply to this plan' };
  if (p.appliesToCycles.length && (!c.billingCycle || !p.appliesToCycles.includes(c.billingCycle))) return { ok: false, reason: 'This code does not apply to this billing cycle' };
  if (p.minCycleMonths != null && (c.cycleMonths ?? 0) < p.minCycleMonths) return { ok: false, reason: `This code needs a billing term of at least ${p.minCycleMonths} months` };
  if (p.maxRedemptions != null && c.redemptionsTotal >= p.maxRedemptions) return { ok: false, reason: 'This code has reached its redemption limit' };
  if (c.redemptionsByVendor >= Math.max(1, p.perVendorLimit)) return { ok: false, reason: 'You have already used this code' };
  if (c.subtotalPaise <= 0) return { ok: false, reason: 'Nothing to discount on this invoice' };

  const discountPaise = p.type === 'PERCENT' ? discountFromPercent(c.subtotalPaise, p.value) : Math.min(p.value, c.subtotalPaise);
  if (discountPaise <= 0) return { ok: false, reason: 'This code gives no discount on this invoice' };
  return { ok: true, discountPaise };
}

/** Promo codes are case-insensitive, alphanumeric with - and _, 3–32 chars. */
export function normalizePromoCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,32}$/.test(c) ? c : null;
}
