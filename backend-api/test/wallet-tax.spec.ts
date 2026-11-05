import { computeTax, deductionOutcome, pickComponentRates, TaxRateLite } from '../src/v3-wallet/core/tax-core';

/**
 * The one tax rule of the wallet and the services (slice 5.16a-2): inter-state is IGST, intra-state is CGST plus SGST, picked by comparing the buyer's state code with Get4Domain's. Every
 * rate comes from the tax-rate rows (g4d_tax_rates); this file proves nothing is hard coded by using rates no real tax uses. Integer paise, half-up, and the lines always add up to the total.
 */
const D = (s: string): Date => new Date(s);
const NOW = D('2026-11-05T10:00:00.000Z');
const row = (name: string, ratePercent: number, over: Partial<TaxRateLite> = {}): TaxRateLite => ({ name, ratePercent, appliesTo: 'ALL', active: true, validFrom: D('2026-01-01T00:00:00Z'), ...over });
const RATES = [row('IGST', 12.5), row('CGST', 6.25), row('SGST', 6.25)];
const base = { amountMinor: 100_000, taxInclusive: false, buyerStateCode: '33', sellerStateCode: '33', rates: RATES, now: NOW, category: 'ALL' };

describe('which tax applies', () => {
  it('the same state is CGST plus SGST, with the rates read from the rows', () => {
    const r = computeTax(base);
    expect(r).toEqual({ ok: true, intraState: true, taxInclusive: false, taxableMinor: 100_000, lines: [{ name: 'CGST', ratePercent: 6.25, amountMinor: 6_250 }, { name: 'SGST', ratePercent: 6.25, amountMinor: 6_250 }], taxMinor: 12_500, totalMinor: 112_500 });
  });
  it('a different state is IGST', () => {
    expect(computeTax({ ...base, buyerStateCode: '29' })).toEqual({ ok: true, intraState: false, taxInclusive: false, taxableMinor: 100_000, lines: [{ name: 'IGST', ratePercent: 12.5, amountMinor: 12_500 }], taxMinor: 12_500, totalMinor: 112_500 });
  });
  it('uses whatever rates staff set: change them and the answer follows (nothing is hard coded)', () => {
    const r = computeTax({ ...base, buyerStateCode: '29', rates: [row('IGST', 3)] });
    expect(r).toMatchObject({ ok: true, taxMinor: 3_000, totalMinor: 103_000 });
    const zero = computeTax({ ...base, rates: [row('CGST', 0), row('SGST', 0)] });
    expect(zero).toMatchObject({ ok: true, taxMinor: 0, totalMinor: 100_000 });
  });
  it('names are matched without regard to case or spaces', () => {
    expect(computeTax({ ...base, buyerStateCode: '29', rates: [row(' igst ', 5)] })).toMatchObject({ ok: true, lines: [{ name: 'IGST', amountMinor: 5_000 }] });
  });
});

describe('what cannot be priced is said plainly, never guessed', () => {
  it('no seller state, no buyer state, or a malformed state code', () => {
    expect(computeTax({ ...base, sellerStateCode: '' })).toEqual({ ok: false, problem: 'SELLER_STATE_MISSING' });
    expect(computeTax({ ...base, sellerStateCode: null })).toEqual({ ok: false, problem: 'SELLER_STATE_MISSING' });
    expect(computeTax({ ...base, buyerStateCode: null })).toEqual({ ok: false, problem: 'BUYER_STATE_MISSING' });
    expect(computeTax({ ...base, buyerStateCode: '3' })).toEqual({ ok: false, problem: 'BUYER_STATE_MISSING' });
  });
  it('the rows a sale needs are missing: IGST for another state, CGST and SGST (both) for the same state', () => {
    expect(computeTax({ ...base, buyerStateCode: '29', rates: [row('CGST', 9), row('SGST', 9)] })).toEqual({ ok: false, problem: 'RATES_MISSING' });
    expect(computeTax({ ...base, rates: [row('IGST', 18), row('CGST', 9)] })).toEqual({ ok: false, problem: 'RATES_MISSING' });
    expect(computeTax({ ...base, rates: [] })).toEqual({ ok: false, problem: 'RATES_MISSING' });
  });
  it('an inactive row, a row that starts in the future and a row of another category are not used', () => {
    expect(computeTax({ ...base, buyerStateCode: '29', rates: [row('IGST', 18, { active: false })] })).toEqual({ ok: false, problem: 'RATES_MISSING' });
    expect(computeTax({ ...base, buyerStateCode: '29', rates: [row('IGST', 18, { validFrom: D('2026-12-01T00:00:00Z') })] })).toEqual({ ok: false, problem: 'RATES_MISSING' });
    expect(computeTax({ ...base, buyerStateCode: '29', rates: [row('IGST', 18, { appliesTo: 'OTHER' })] })).toEqual({ ok: false, problem: 'RATES_MISSING' });
  });
});

describe('which row wins', () => {
  it('the newest valid row of a name, and a row for the exact category beats one for ALL', () => {
    const picked = pickComponentRates([row('IGST', 5, { validFrom: D('2026-01-01T00:00:00Z') }), row('IGST', 7, { validFrom: D('2026-06-01T00:00:00Z') }), row('IGST', 9, { appliesTo: 'SPECIAL', validFrom: D('2026-02-01T00:00:00Z') })], NOW, 'ALL');
    expect(picked.IGST!.ratePercent).toBe(7);
    expect(pickComponentRates([row('IGST', 7), row('IGST', 9, { appliesTo: 'SPECIAL', validFrom: D('2026-02-01T00:00:00Z') })], NOW, 'SPECIAL').IGST!.ratePercent).toBe(9);
  });
});

describe('integer paise: rounding and a price that already includes tax', () => {
  it('rounds half up per line', () => {
    expect(computeTax({ ...base, amountMinor: 1_001, buyerStateCode: '29', rates: [row('IGST', 12.5)] })).toMatchObject({ taxMinor: 125, totalMinor: 1_126 });   // 125.125 rounds to 125
    expect(computeTax({ ...base, amountMinor: 1_004, buyerStateCode: '29', rates: [row('IGST', 12.5)] })).toMatchObject({ taxMinor: 126, totalMinor: 1_130 });   // 125.5 rounds up to 126
  });
  it('an inclusive price keeps its total and carves the tax out of it, and the lines add up exactly', () => {
    for (const amount of [1, 7, 99, 100, 29_900, 118_000, 123_457, 9_999_999]) for (const state of ['33', '29']) {
      const r = computeTax({ ...base, amountMinor: amount, taxInclusive: true, buyerStateCode: state });
      expect(r.ok).toBe(true);
      if (r.ok) { expect(r.totalMinor).toBe(amount); expect(r.taxableMinor + r.lines.reduce((t, l) => t + l.amountMinor, 0)).toBe(amount); expect(r.lines.every((l) => Number.isInteger(l.amountMinor) && l.amountMinor >= 0)).toBe(true); }
    }
  });
  it('an exclusive price always adds up too, over many amounts', () => {
    for (let amount = 1; amount < 4_000; amount += 37) for (const state of ['33', '29']) {
      const r = computeTax({ ...base, amountMinor: amount, buyerStateCode: state });
      if (r.ok) expect(r.taxableMinor + r.taxMinor).toBe(r.totalMinor);
    }
  });
  it('refuses an amount that is not a positive whole number of paise', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity]) expect(computeTax({ ...base, amountMinor: bad })).toEqual({ ok: false, problem: 'AMOUNT_INVALID' });
  });
});

describe('a deduction carries no tax (owner 5 November 2026: GST is added at the refill, never at a deduction)', () => {
  it('takes exactly its price: no lines, no tax, the total is the price', () => {
    expect(deductionOutcome(29_900)).toEqual({ ok: true, intraState: null, taxInclusive: false, taxableMinor: 29_900, lines: [], taxMinor: 0, totalMinor: 29_900 });
    expect(deductionOutcome(10)).toMatchObject({ ok: true, totalMinor: 10, taxMinor: 0 });
  });
  it('needs no state and no tax row: it works when tax is not set up at all', () => {
    expect(deductionOutcome(55)).toMatchObject({ ok: true, totalMinor: 55 });
  });
  it('refuses an amount that is not a positive whole number of paise', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity]) expect(deductionOutcome(bad)).toEqual({ ok: false, problem: 'AMOUNT_INVALID' });
  });
});
