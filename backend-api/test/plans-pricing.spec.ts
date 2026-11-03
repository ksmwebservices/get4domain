import { priceQuote, resolveApplicableDiscounts, selectTaxRate, QuoteDiscount, DiscountRuleRow } from '../src/plans/pricing/price-quote';

/** S51.5: the pure pricing helper. No payments. Every amount is an integer number of paise; rounding is half up. */
const pct = (percentOff: number, over: Partial<QuoteDiscount> = {}): QuoteDiscount => ({ name: `${percentOff}%`, type: 'PROMO', percentOff, stackable: true, ...over });
const flat = (amountOffPaise: number, over: Partial<QuoteDiscount> = {}): QuoteDiscount => ({ name: `-${amountOffPaise}`, type: 'PROMO', amountOffPaise, stackable: true, ...over });

describe('priceQuote: no discount, no tax', () => {
  it('returns the base as the total', () => {
    expect(priceQuote({ basePaise: 149700, taxInclusive: false, discounts: [], taxRatePercent: 0 })).toMatchObject({
      baseMinor: 149700, discountMinor: 0, taxableMinor: 149700, taxMinor: 0, totalMinor: 149700, discounts: [],
    });
  });
});

describe('tax exclusive (GST added on top)', () => {
  it('adds the tax and rounds half up to the paisa', () => {
    // 149700 x 18% = 26946 exactly
    expect(priceQuote({ basePaise: 149700, taxInclusive: false, discounts: [], taxRatePercent: 18 })).toMatchObject({ taxMinor: 26946, totalMinor: 176646 });
    // 12345 x 18% = 2222.1 -> 2222 ; 12350 x 18% = 2223 ; 10025 x 18% = 1804.5 -> 1805
    expect(priceQuote({ basePaise: 12345, taxInclusive: false, discounts: [], taxRatePercent: 18 }).taxMinor).toBe(2222);
    expect(priceQuote({ basePaise: 10025, taxInclusive: false, discounts: [], taxRatePercent: 18 }).taxMinor).toBe(1805);
  });

  it('works for any rate, including fractions (5.125 percent) and zero', () => {
    expect(priceQuote({ basePaise: 100000, taxInclusive: false, discounts: [], taxRatePercent: 5.125 }).taxMinor).toBe(5125);
    expect(priceQuote({ basePaise: 100000, taxInclusive: false, discounts: [], taxRatePercent: 0 }).taxMinor).toBe(0);
  });
});

describe('tax inclusive (the price already contains the tax)', () => {
  it('the total equals the (discounted) price and the tax is the part inside it', () => {
    // 118000 inclusive of 18%: net 100000, tax 18000
    expect(priceQuote({ basePaise: 118000, taxInclusive: true, discounts: [], taxRatePercent: 18 })).toMatchObject({ taxableMinor: 118000, taxMinor: 18000, totalMinor: 118000 });
  });
  it('rounds the net half up, so net + tax always equals the total', () => {
    const q = priceQuote({ basePaise: 100001, taxInclusive: true, discounts: [], taxRatePercent: 18 });
    expect(q.totalMinor).toBe(100001);
    expect(q.taxMinor + (q.totalMinor - q.taxMinor)).toBe(100001);
    expect(q.taxMinor).toBe(100001 - Math.floor((100001 * 100) / 118 + 0.5));
  });
});

describe('discounts', () => {
  it('a percentage is taken from the running amount, rounded half up', () => {
    const q = priceQuote({ basePaise: 100000, taxInclusive: false, discounts: [pct(10)], taxRatePercent: 0 });
    expect(q).toMatchObject({ discountMinor: 10000, taxableMinor: 90000, totalMinor: 90000 });
    expect(q.discounts).toEqual([{ name: '10%', type: 'PROMO', amountPaise: 10000 }]);
    expect(priceQuote({ basePaise: 12345, taxInclusive: false, discounts: [pct(10)], taxRatePercent: 0 }).discountMinor).toBe(1235);   // 1234.5 -> 1235
  });

  it('a fixed amount is capped at what is left (the total never goes below zero)', () => {
    expect(priceQuote({ basePaise: 5000, taxInclusive: false, discounts: [flat(9000)], taxRatePercent: 18 })).toMatchObject({ discountMinor: 5000, taxableMinor: 0, taxMinor: 0, totalMinor: 0 });
  });

  it('stackable discounts apply one after the other, PROMO before MIGRATION, each on the running amount', () => {
    const q = priceQuote({
      basePaise: 100000, taxInclusive: false, taxRatePercent: 0,
      discounts: [pct(10, { type: 'MIGRATION', name: 'migration' }), pct(10, { name: 'promo' })],
    });
    expect(q.discounts.map((d) => [d.name, d.amountPaise])).toEqual([['promo', 10000], ['migration', 9000]]);
    expect(q.totalMinor).toBe(81000);
  });

  it('when any candidate is NOT stackable, only the single best saving applies', () => {
    const q = priceQuote({
      basePaise: 100000, taxInclusive: false, taxRatePercent: 0,
      discounts: [pct(10, { name: 'small', stackable: true }), pct(30, { name: 'big', stackable: false }), flat(5000, { name: 'flat', stackable: true })],
    });
    expect(q.discounts.map((d) => d.name)).toEqual(['big']);
    expect(q.totalMinor).toBe(70000);
  });

  it('one non-stackable discount alone is applied normally; ties go to the first', () => {
    expect(priceQuote({ basePaise: 1000, taxInclusive: false, taxRatePercent: 0, discounts: [pct(50, { stackable: false })] }).totalMinor).toBe(500);
    const tie = priceQuote({ basePaise: 1000, taxInclusive: false, taxRatePercent: 0, discounts: [pct(10, { name: 'a', stackable: false }), flat(100, { name: 'b', stackable: true })] });
    expect(tie.discounts.map((d) => d.name)).toEqual(['a']);
  });

  it('tax is taken AFTER the discount (exclusive) and inside the discounted price (inclusive)', () => {
    expect(priceQuote({ basePaise: 100000, taxInclusive: false, discounts: [pct(10)], taxRatePercent: 18 })).toMatchObject({ taxableMinor: 90000, taxMinor: 16200, totalMinor: 106200 });
    expect(priceQuote({ basePaise: 118000, taxInclusive: true, discounts: [pct(50)], taxRatePercent: 18 })).toMatchObject({ taxableMinor: 59000, taxMinor: 9000, totalMinor: 59000 });
  });

  it('rejects an invalid base, rate or discount instead of guessing', () => {
    expect(() => priceQuote({ basePaise: -1, taxInclusive: false, discounts: [], taxRatePercent: 0 })).toThrow(/base/i);
    expect(() => priceQuote({ basePaise: 1.5, taxInclusive: false, discounts: [], taxRatePercent: 0 })).toThrow(/base/i);
    expect(() => priceQuote({ basePaise: 100, taxInclusive: false, discounts: [], taxRatePercent: -1 })).toThrow(/tax/i);
    expect(() => priceQuote({ basePaise: 100, taxInclusive: false, discounts: [{ name: 'x', type: 'PROMO', stackable: true }], taxRatePercent: 0 })).toThrow(/discount/i);
    expect(() => priceQuote({ basePaise: 100, taxInclusive: false, discounts: [pct(101)], taxRatePercent: 0 })).toThrow(/discount/i);
  });
});

describe('resolveApplicableDiscounts', () => {
  const now = new Date('2027-03-01T00:00:00Z');
  const rule = (over: Partial<DiscountRuleRow>): DiscountRuleRow => ({
    type: 'PROMO', name: 'r', percentOff: 10, amountOffPaise: null, conditions: {}, stackable: true, active: true, status: 'APPROVED',
    validFrom: new Date('2027-01-01Z'), validTo: null, ...over,
  });

  it('TERM rules are already inside the generated price: they are reported, never subtracted again', () => {
    const r = resolveApplicableDiscounts([rule({ type: 'TERM', name: 'Annual', percentOff: 20, conditions: { termMonths: 12 } }), rule({ name: 'welcome', conditions: { code: 'WELCOME' } })], { now, termMonths: 12, planKey: 'handyman_pro', code: 'welcome' });
    expect(r.applicable.map((d) => d.name)).toEqual(['welcome']);
    expect(r.termInfo).toMatchObject({ name: 'Annual', percentOff: 20, includedInPrice: true });
  });

  it('only active, APPROVED rules inside their dates apply', () => {
    const rules = [
      rule({ name: 'off', active: false }), rule({ name: 'proposed', status: 'PROPOSED' }), rule({ name: 'future', validFrom: new Date('2027-06-01Z') }),
      rule({ name: 'ended', validTo: new Date('2027-02-01Z') }), rule({ name: 'ok' }),
    ];
    expect(resolveApplicableDiscounts(rules, { now, termMonths: 6, planKey: 'p' }).applicable.map((d) => d.name)).toEqual(['ok']);
  });

  it('conditions: promo code, terms and plans must all match', () => {
    const rules = [
      rule({ name: 'code', conditions: { code: 'SAVE' } }),
      rule({ name: 'terms', conditions: { termMonths: [12] } }),
      rule({ name: 'plans', conditions: { planKeys: ['ecommerce_pro'] } }),
    ];
    const names = (ctx: { termMonths: number; planKey: string; code?: string }) => resolveApplicableDiscounts(rules, { now, ...ctx }).applicable.map((d) => d.name);
    expect(names({ termMonths: 3, planKey: 'handyman_pro' })).toEqual([]);
    expect(names({ termMonths: 12, planKey: 'handyman_pro', code: 'save' })).toEqual(['code', 'terms']);
    expect(names({ termMonths: 6, planKey: 'ecommerce_pro' })).toEqual(['plans']);
  });
});

describe('selectTaxRate', () => {
  const now = new Date('2027-03-01T00:00:00Z');
  it('takes the active row with the latest validFrom that has started', () => {
    expect(selectTaxRate([
      { name: 'old', ratePercent: 12, appliesTo: 'ALL', active: true, validFrom: new Date('2020-01-01Z') },
      { name: 'GST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: new Date('2025-01-01Z') },
      { name: 'future', ratePercent: 28, appliesTo: 'ALL', active: true, validFrom: new Date('2030-01-01Z') },
      { name: 'off', ratePercent: 5, appliesTo: 'ALL', active: false, validFrom: new Date('2026-01-01Z') },
    ], now)?.name).toBe('GST');
  });
  it('returns null when there is none (tax 0 is then the caller\'s explicit choice)', () => {
    expect(selectTaxRate([], now)).toBeNull();
  });
});
