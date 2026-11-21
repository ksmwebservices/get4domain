import { PLAN_OPTION_MESSAGES, PlanOptionRows, shapePlanOptions } from '../src/plans/me/plan-options.core';

/** B6.2: the plan chooser offers the vendor's track plans and every term with an approved price in force, and only those. */
const now = new Date('2026-11-19T00:00:00Z');
const past = new Date('2026-11-01T00:00:00Z');
const future = new Date('2027-01-01T00:00:00Z');
const plan = (key: string, track: string, level = 'PRO', over: Record<string, unknown> = {}) => ({ id: `id-${key}`, key, track, level, name: key, description: null, status: 'ACTIVE', isPublic: true, sortOrder: 1, ...over });
const price = (planKey: string, termMonths: number, over: Record<string, unknown> = {}) => ({ planId: `id-${planKey}`, termMonths, amountPaise: termMonths * 100000, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: past, ...over });
const tax = { name: 'GST', ratePercent: 18 };
const rows = (over: Partial<PlanOptionRows> = {}): PlanOptionRows => ({
  now, heldTrack: 'handyman', categoryTier: null, tax,
  plans: [plan('handyman_free', 'handyman', 'FREE'), plan('handyman_pro', 'handyman'), plan('professional_pro', 'professional'), plan('ecommerce_pro', 'ecommerce')],
  prices: [],
  ...over,
});

describe('B6.2 (a) only the annual term is approved', () => {
  it('shows the vendor track plan with the 12-month term and no other term', () => {
    const r = shapePlanOptions(rows({ prices: [price('handyman_pro', 12), price('professional_pro', 12), price('ecommerce_pro', 12)] }));
    expect(r.reason).toBeNull();
    expect(r.plans.map((p) => p.key)).toEqual(['handyman_pro']);
    expect(r.plans[0].terms.map((t) => t.termMonths)).toEqual([12]);
    expect(r.plans[0].terms[0]).toMatchObject({ purchasable: true, price: { priceMinor: 1200000, gstMinor: 216000, totalMinor: 1416000 } });
  });
});

describe('B6.2 plan rows store the track in upper case (as staging does)', () => {
  it('matches the track whatever its case and answers it in lower case', () => {
    const r = shapePlanOptions(rows({ heldTrack: 'HANDYMAN', plans: [plan('handyman_pro', 'HANDYMAN'), plan('ecommerce_pro', 'ECOMMERCE')], prices: [price('handyman_pro', 12), price('ecommerce_pro', 12)] }));
    expect(r).toMatchObject({ track: 'handyman', trackSource: 'PLAN' });
    expect(r.plans.map((p) => [p.key, p.track])).toEqual([['handyman_pro', 'handyman']]);
  });
});

describe('B6.2 (b) every term approved', () => {
  it('shows 3, 6 and 12 in order, for this track only', () => {
    const r = shapePlanOptions(rows({ prices: [price('handyman_pro', 12), price('handyman_pro', 3), price('handyman_pro', 6), price('ecommerce_pro', 12)] }));
    expect(r.plans[0].terms.map((t) => t.termMonths)).toEqual([3, 6, 12]);
    expect(r.plans.every((p) => p.track === 'handyman')).toBe(true);
  });
});

describe('B6.2 (c) the track comes from the category, not the site', () => {
  it('a vendor with no held plan uses the minimum tier of the category chosen at registration (any case)', () => {
    const r = shapePlanOptions(rows({ heldTrack: null, categoryTier: 'HANDYMAN', prices: [price('handyman_pro', 12), price('professional_pro', 12)] }));
    expect(r).toMatchObject({ track: 'handyman', trackSource: 'CATEGORY', reason: null });
    expect(r.plans.map((p) => p.key)).toEqual(['handyman_pro']);
  });
  it('the held plan wins over the category', () => {
    const r = shapePlanOptions(rows({ heldTrack: 'professional', categoryTier: 'HANDYMAN', prices: [price('handyman_pro', 12), price('professional_pro', 12)] }));
    expect(r).toMatchObject({ track: 'professional', trackSource: 'PLAN' });
    expect(r.plans.map((p) => p.key)).toEqual(['professional_pro']);
  });
  it('a held track that is not one of the three falls back to the category', () => {
    const r = shapePlanOptions(rows({ heldTrack: 'banking', categoryTier: 'ECOMMERCE', prices: [price('ecommerce_pro', 12)] }));
    expect(r).toMatchObject({ track: 'ecommerce', trackSource: 'CATEGORY' });
  });
  it('neither a plan nor a category: an honest message, no plans', () => {
    const r = shapePlanOptions(rows({ heldTrack: null, categoryTier: null, prices: [price('handyman_pro', 12)] }));
    expect(r).toMatchObject({ track: null, plans: [], reason: 'TRACK_UNKNOWN', message: PLAN_OPTION_MESSAGES.TRACK_UNKNOWN });
  });
});

describe('B6.2 (d) no price at all, and prices that must never show', () => {
  it('no price rows: a clear message, not a silent empty list', () => {
    const r = shapePlanOptions(rows());
    expect(r).toMatchObject({ plans: [], reason: 'NO_APPROVED_PRICE', message: PLAN_OPTION_MESSAGES.NO_APPROVED_PRICE });
  });
  it('a draft, a future-dated, a non-rupee or a tax-inclusive price without a GST rate is never shown', () => {
    const r = shapePlanOptions(rows({ prices: [price('handyman_pro', 3, { status: 'DRAFT' }), price('handyman_pro', 6, { effectiveFrom: future }), price('handyman_pro', 12, { currency: 'USD' })] }));
    expect(r.reason).toBe('NO_APPROVED_PRICE');
    const noTax = shapePlanOptions(rows({ tax: null, prices: [price('handyman_pro', 12, { taxInclusive: true })] }));
    expect(noTax.reason).toBe('NO_APPROVED_PRICE');
  });
  it('when a newer approved price has started, the newest started one is used', () => {
    const r = shapePlanOptions(rows({ prices: [price('handyman_pro', 12), price('handyman_pro', 12, { amountPaise: 999900, effectiveFrom: new Date('2026-11-10T00:00:00Z') })] }));
    expect(r.plans[0].terms[0].price.priceMinor).toBe(999900);
  });
  it('no active public paid plan for the track: says so', () => {
    const r = shapePlanOptions(rows({ plans: [plan('handyman_free', 'handyman', 'FREE'), plan('handyman_pro', 'handyman', 'PRO', { status: 'DRAFT' }), plan('ecommerce_pro', 'ecommerce')], prices: [price('handyman_pro', 12), price('ecommerce_pro', 12)] }));
    expect(r).toMatchObject({ reason: 'NO_PLANS_FOR_TRACK', plans: [] });
  });
  it('a plan whose terms have no approved price is left out while another plan of the track is shown', () => {
    const r = shapePlanOptions(rows({ plans: [plan('handyman_pro', 'handyman'), plan('handyman_plus', 'handyman', 'PRO', { sortOrder: 2 })], prices: [price('handyman_plus', 12)] }));
    expect(r.plans.map((p) => p.key)).toEqual(['handyman_plus']);
  });
});
