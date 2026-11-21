/**
 * Price rows from base rates and term discounts (S51.3). PURE: no database, no Nest. No price exists anywhere else in the code;
 * change a base rate or a TERM percentage in the seed (or in admin) and the rows regenerate.
 *
 * amount (rupees) = round_half_up( base rupees per month x months x (100 - discount percent) / 100 ), stored in paise (x 100).
 * All arithmetic is on integers (paise x basis points), so there is no floating-point drift.
 */
export interface GeneratorPlan { key: string; level: 'FREE' | 'PRO' }
export interface TermRule { termMonths: number; percentOff: number }
export interface GeneratedPrice {
  planKey: string;
  termMonths: number;
  amountPaise: number;
  taxInclusive: boolean;
  status: 'PROPOSED';
  effectiveFrom: string;
}
export interface GenerateArgs {
  plans: GeneratorPlan[];
  /** plan key -> base monthly-equivalent rate in paise */
  baseMonthlyPaise: Record<string, number>;
  termRules: TermRule[];
  /** terms that may be sold (3, 6, 12; 1 only when the allowMonthly setting is on) */
  allowedTerms: number[];
  effectiveFrom: string;
}

export const roundHalfUpRupees = (x: number): number => Math.floor(x + 0.5);

/** Whole rupees, in paise, for one plan and term. */
export function termAmountPaise(baseMonthlyPaise: number, termMonths: number, percentOff: number): number {
  const bp = Math.round(percentOff * 100);                      // 10 percent = 1000 basis points
  const numerator = baseMonthlyPaise * termMonths * (10000 - bp); // paise x basis points
  const rupees = Math.floor((numerator + 500000) / 1000000);     // /10000 for basis points, /100 for rupees, +0.5 rupee to round half up
  return rupees * 100;
}

export function generatePriceRows(args: GenerateArgs): GeneratedPrice[] {
  const rows: GeneratedPrice[] = [];
  for (const plan of args.plans) {
    if (plan.level !== 'PRO') continue;                          // FREE plans have no price rows
    const base = args.baseMonthlyPaise[plan.key];
    if (!Number.isInteger(base) || base <= 0) continue;
    for (const rule of args.termRules) {
      if (!args.allowedTerms.includes(rule.termMonths)) continue;
      rows.push({
        planKey: plan.key,
        termMonths: rule.termMonths,
        amountPaise: termAmountPaise(base, rule.termMonths, rule.percentOff),
        taxInclusive: false,
        status: 'PROPOSED',
        effectiveFrom: args.effectiveFrom,
      });
    }
  }
  return rows;
}
