/**
 * The one tax rule of the wallet and the services (slice 5.16a-2). PURE: no database, no clock (the caller passes `now`).
 *
 * A sale to a buyer in the SAME state as Get4Domain is taxed with CGST plus SGST; a sale to a buyer in ANOTHER state with IGST. The state codes are compared as given. EVERY RATE COMES FROM
 * THE TAX-RATE ROWS (g4d_tax_rates): the rows are recognised by their name (IGST, CGST, SGST) and nothing here knows what any rate is. When a state or a row is missing the answer is a plain
 * reason, never a guess, and the caller refuses to sell ("tax not set up"). Integer paise throughout; each line is rounded half up; the lines always add up to the total.
 * The invoice wording and the treatment of an advance are for the accountant (OPEN QUESTIONS in docs/v3/B4_LOG.md).
 */
export interface TaxRateLite { name: string; ratePercent: number; appliesTo: string; active: boolean; validFrom: Date }
export type TaxComponent = 'IGST' | 'CGST' | 'SGST';
export type TaxProblem = 'SELLER_STATE_MISSING' | 'BUYER_STATE_MISSING' | 'RATES_MISSING' | 'AMOUNT_INVALID';
export interface TaxLine { name: TaxComponent; ratePercent: number; amountMinor: number }
export interface TaxResult { ok: true; intraState: boolean | null; taxInclusive: boolean; taxableMinor: number; lines: TaxLine[]; taxMinor: number; totalMinor: number }
export type TaxOutcome = TaxResult | { ok: false; problem: TaxProblem };

const COMPONENTS: readonly TaxComponent[] = ['IGST', 'CGST', 'SGST'];
const STATE = /^[0-9]{2}$/;
const DENOM = 100_000;   // a rate in thousandths of a percent against 100 percent

/** For each component, the row that applies now: active, started, for this category or for ALL, the exact category preferred, then the newest start date. */
export function pickComponentRates(rows: readonly TaxRateLite[], now: Date, category: string): Partial<Record<TaxComponent, TaxRateLite>> {
  const out: Partial<Record<TaxComponent, TaxRateLite>> = {};
  for (const c of COMPONENTS) {
    const ok = rows.filter((r) => r.active && r.validFrom.getTime() <= now.getTime() && r.name.trim().toUpperCase() === c && (r.appliesTo === category || r.appliesTo === 'ALL'));
    ok.sort((a, b) => Number(b.appliesTo === category) - Number(a.appliesTo === category) || b.validFrom.getTime() - a.validFrom.getTime());
    if (ok[0]) out[c] = ok[0];
  }
  return out;
}

const milli = (ratePercent: number): number => Math.round(ratePercent * 1000);
const halfUp = (num: number, den: number): number => Math.floor((num + Math.floor(den / 2)) / den);

export function computeTax(i: { amountMinor: number; taxInclusive: boolean; buyerStateCode: string | null; sellerStateCode: string | null; rates: readonly TaxRateLite[]; now: Date; category: string }): TaxOutcome {
  if (typeof i.amountMinor !== 'number' || !Number.isSafeInteger(i.amountMinor) || i.amountMinor <= 0) return { ok: false, problem: 'AMOUNT_INVALID' };
  if (!i.sellerStateCode || !STATE.test(i.sellerStateCode)) return { ok: false, problem: 'SELLER_STATE_MISSING' };
  if (!i.buyerStateCode || !STATE.test(i.buyerStateCode)) return { ok: false, problem: 'BUYER_STATE_MISSING' };
  const intraState = i.buyerStateCode === i.sellerStateCode;
  const picked = pickComponentRates(i.rates, i.now, i.category);
  const needed: TaxComponent[] = intraState ? ['CGST', 'SGST'] : ['IGST'];
  if (needed.some((c) => !picked[c])) return { ok: false, problem: 'RATES_MISSING' };

  const rates = needed.map((c) => ({ name: c, ratePercent: picked[c]!.ratePercent, milli: milli(picked[c]!.ratePercent) }));
  const sumMilli = rates.reduce((t, r) => t + r.milli, 0);
  const taxableMinor = i.taxInclusive ? halfUp(i.amountMinor * DENOM, DENOM + sumMilli) : i.amountMinor;
  const lines: TaxLine[] = rates.map((r) => ({ name: r.name, ratePercent: r.ratePercent, amountMinor: halfUp(taxableMinor * r.milli, DENOM) }));
  const totalMinor = i.taxInclusive ? i.amountMinor : taxableMinor + lines.reduce((t, l) => t + l.amountMinor, 0);
  if (i.taxInclusive) {   // rounding must not change what the buyer pays: the last line absorbs the difference
    const diff = totalMinor - taxableMinor - lines.reduce((t, l) => t + l.amountMinor, 0);
    lines[lines.length - 1].amountMinor += diff;
  }
  return { ok: true, intraState, taxInclusive: i.taxInclusive, taxableMinor, lines, taxMinor: lines.reduce((t, l) => t + l.amountMinor, 0), totalMinor };
}

/**
 * What a wallet DEDUCTION costs (owner decision, 5 November 2026): exactly its price. The GST was added on top when the money was added (at the refill, where the tax invoice is issued), so a
 * service, a pack, a theme switch, a message or a campaign carries no tax of its own and no invoice of its own. The result has the same shape as computeTax so callers read it the same way.
 */
export function deductionOutcome(amountMinor: number): TaxOutcome {
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return { ok: false, problem: 'AMOUNT_INVALID' };
  return { ok: true, intraState: null, taxInclusive: false, taxableMinor: amountMinor, lines: [], taxMinor: 0, totalMinor: amountMinor };
}
