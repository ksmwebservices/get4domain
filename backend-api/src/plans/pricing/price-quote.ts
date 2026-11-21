/**
 * The pricing helper (S51.5). PURE, no payments. All amounts are integer paise; every rounding is half up.
 * Rules are documented in docs/v3/V3_S1_PLANS_ENTITLEMENTS.md section 6.
 *
 * A generated price row already contains its TERM discount (annual = 20 percent off), so a quote never subtracts a TERM rule again: it only reports it.
 * PROMO and MIGRATION discounts are taken from the price, in that order, each from the running amount. If any candidate is not stackable only the single
 * best saving applies. Tax is added on top of the discounted amount (exclusive) or read out of it (inclusive).
 */
export interface QuoteDiscount {
  name: string;
  type: 'PROMO' | 'MIGRATION';
  percentOff?: number | null;
  amountOffPaise?: number | null;
  stackable: boolean;
}
export interface QuoteInput {
  basePaise: number;
  taxInclusive: boolean;
  discounts: QuoteDiscount[];
  taxRatePercent: number;
}
export interface Quote {
  baseMinor: number;
  discounts: { name: string; type: string; amountPaise: number }[];
  discountMinor: number;
  taxableMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxInclusive: boolean;
  currency: 'INR';
}

const isPaise = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
/** Round half up of a / b for non-negative integers. */
const divRound = (a: number, b: number): number => Math.floor((2 * a + b) / (2 * b));

function validate(input: QuoteInput): void {
  if (!isPaise(input.basePaise)) throw new Error('base must be a whole number of paise, 0 or more');
  if (typeof input.taxRatePercent !== 'number' || !(input.taxRatePercent >= 0)) throw new Error('tax rate must be 0 or more');
  for (const d of input.discounts) {
    const hasPct = d.percentOff !== undefined && d.percentOff !== null;
    const hasAmt = d.amountOffPaise !== undefined && d.amountOffPaise !== null;
    if (hasPct === hasAmt) throw new Error(`discount "${d.name}" needs exactly one of percentOff and amountOffPaise`);
    if (hasPct && !(d.percentOff! >= 0 && d.percentOff! <= 100)) throw new Error(`discount "${d.name}": percentOff must be 0 to 100`);
    if (hasAmt && !isPaise(d.amountOffPaise)) throw new Error(`discount "${d.name}": amountOffPaise must be a whole number of paise`);
  }
}

/** The saving a discount would give on `amount`. */
function saving(d: QuoteDiscount, amount: number): number {
  if (d.percentOff !== undefined && d.percentOff !== null) return divRound(amount * Math.round(d.percentOff * 1000), 100000);
  return Math.min(amount, d.amountOffPaise as number);
}

export function priceQuote(input: QuoteInput): Quote {
  validate(input);
  const order = { PROMO: 0, MIGRATION: 1 } as const;
  let chain = [...input.discounts].sort((a, b) => order[a.type] - order[b.type]);   // stable: input order within a type
  if (chain.length > 1 && chain.some((d) => !d.stackable)) {
    let best = chain[0];
    for (const d of chain) if (saving(d, input.basePaise) > saving(best, input.basePaise)) best = d;
    chain = [best];
  }
  let running = input.basePaise;
  const applied: Quote['discounts'] = [];
  for (const d of chain) {
    const s = saving(d, running);
    running -= s;
    applied.push({ name: d.name, type: d.type, amountPaise: s });
  }
  const discountMinor = input.basePaise - running;
  const rateMilli = Math.round(input.taxRatePercent * 1000);
  let taxMinor: number;
  let totalMinor: number;
  if (input.taxInclusive) {
    const net = divRound(running * 100000, 100000 + rateMilli);
    taxMinor = running - net;
    totalMinor = running;
  } else {
    taxMinor = divRound(running * rateMilli, 100000);
    totalMinor = running + taxMinor;
  }
  return { baseMinor: input.basePaise, discounts: applied, discountMinor, taxableMinor: running, taxMinor, totalMinor, taxInclusive: input.taxInclusive, currency: 'INR' };
}

// ---------------------------------------------------------------------------------------------------------------- choosing which rules apply
export interface DiscountRuleRow {
  type: 'TERM' | 'PROMO' | 'MIGRATION';
  name: string;
  percentOff: number | null;
  amountOffPaise: number | null;
  conditions: Record<string, unknown>;
  stackable: boolean;
  active: boolean;
  status: 'PROPOSED' | 'APPROVED';
  validFrom: Date;
  validTo: Date | null;
}
export interface DiscountContext { now: Date; termMonths: number; planKey: string; code?: string }

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

function matches(rule: DiscountRuleRow, ctx: DiscountContext): boolean {
  const c = rule.conditions ?? {};
  if (c.code !== undefined && String(c.code).toLowerCase() !== String(ctx.code ?? '').toLowerCase()) return false;
  if (c.termMonths !== undefined && !asList(c.termMonths).map(Number).includes(ctx.termMonths)) return false;
  if (c.planKeys !== undefined && !asList(c.planKeys).includes(ctx.planKey)) return false;
  return true;
}

/** Active, APPROVED rules inside their dates whose conditions match. TERM rules are reported (they are already in the price), never subtracted. */
export function resolveApplicableDiscounts(rules: DiscountRuleRow[], ctx: DiscountContext): { applicable: QuoteDiscount[]; termInfo: { name: string; percentOff: number | null; includedInPrice: true } | null } {
  const live = rules.filter((r) => r.active && r.status === 'APPROVED' && r.validFrom.getTime() <= ctx.now.getTime() && (!r.validTo || ctx.now.getTime() < r.validTo.getTime()));
  const term = rules.find((r) => r.type === 'TERM' && r.active && matches(r, ctx));
  return {
    applicable: live.filter((r) => r.type !== 'TERM' && matches(r, ctx)).map((r) => ({ name: r.name, type: r.type as 'PROMO' | 'MIGRATION', percentOff: r.percentOff, amountOffPaise: r.amountOffPaise, stackable: r.stackable })),
    termInfo: term ? { name: term.name, percentOff: term.percentOff, includedInPrice: true } : null,
  };
}

export interface TaxRateRow { name: string; ratePercent: number; appliesTo: string; active: boolean; validFrom: Date }
/** The active row with the latest validFrom that has already started, or null. */
export function selectTaxRate(rows: TaxRateRow[], now: Date): TaxRateRow | null {
  const ok = rows.filter((r) => r.active && r.validFrom.getTime() <= now.getTime()).sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
  return ok[0] ?? null;
}
