import { priceQuote } from '../src/plans/pricing/price-quote';
import { PublicPricingPageController } from '../src/plans/public/public-pricing.controller';
import { PRICING_CACHE_TTL_MS, PublicPricingService } from '../src/plans/public/public-pricing.service';
import { PricingRows, shapePublicPricing } from '../src/plans/public/public-pricing.shape';

/** Wave 3 Part B: the public pricing answer. Prices before GST, GST as its own line, pending is never a number, no discount anywhere. */

const NOW = new Date('2026-11-20T00:00:00Z');
const PAST = new Date('2026-01-01T00:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');

const plan = (key: string, track: string, level: string, sortOrder: number, over: Partial<PricingRows['plans'][number]> = {}) => ({ id: `id-${key}`, key, track, level, name: key, description: null as string | null, status: 'ACTIVE', isPublic: true, sortOrder, ...over });
const price = (planKey: string, termMonths: number, amountPaise: number, over: Partial<PricingRows['prices'][number]> = {}) => ({ planId: `id-${planKey}`, termMonths, amountPaise, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: PAST, ...over });

function rows(over: Partial<PricingRows> = {}): PricingRows {
  return {
    now: NOW,
    plans: [plan('handyman_free', 'handyman', 'FREE', 0, { description: 'A simple site to start' }), plan('handyman_pro', 'handyman', 'PRO', 1), plan('professional_pro', 'professional', 'PRO', 3), plan('ecommerce_pro', 'ecommerce', 'PRO', 5)],
    prices: [
      price('handyman_pro', 3, 149700), price('handyman_pro', 6, 299400), price('handyman_pro', 12, 598800),
      price('professional_pro', 3, 299700), price('professional_pro', 6, 599400),   // 12 months: no price yet
    ],
    tax: { name: 'GST', ratePercent: 18 },
    capabilities: [
      { key: 'SITE', name: 'Website', description: 'Your own site', active: true, sortOrder: 1 },
      { key: 'SHOP', name: 'Online shop', description: null, active: true, sortOrder: 2 },
      { key: 'OLD', name: 'Old thing', description: null, active: false, sortOrder: 3 },
      { key: 'HIDE', name: 'LeadSpace tools', description: null, active: true, sortOrder: 4 },
    ],
    tierCells: [
      { tier: 'HANDYMAN', capabilityKey: 'SITE', allowed: true }, { tier: 'HANDYMAN', capabilityKey: 'OLD', allowed: true }, { tier: 'HANDYMAN', capabilityKey: 'HIDE', allowed: true },
      { tier: 'ECOMMERCE', capabilityKey: 'SITE', allowed: true }, { tier: 'ECOMMERCE', capabilityKey: 'SHOP', allowed: true }, { tier: 'PROFESSIONAL', capabilityKey: 'SHOP', allowed: false },
    ],
    addonPacks: [
      { id: 'a1', key: 'POSTERS', name: 'Poster pack', description: 'Three posters', status: 'ACTIVE' },
      { id: 'a2', key: 'REELS', name: 'Reel pack', description: 'Two reels', status: 'ACTIVE' },
      { id: 'a3', key: 'RETIRED', name: 'Gone', description: 'x', status: 'RETIRED' },
    ],
    addonPrices: [{ packId: 'a1', amountPaise: 49900, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: PAST }],
    ...over,
  };
}

const allKeys = (v: unknown, out: string[] = []): string[] => { if (Array.isArray(v)) v.forEach((x) => allKeys(x, out)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); allKeys(x, out); } return out; };
const allStrings = (v: unknown, out: string[] = []): string[] => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => allStrings(x, out)); return out; };

describe('shapePublicPricing', () => {
  it('lists the paid plans by the three terms only, with the price before GST and GST as separate amounts', () => {
    const p = shapePublicPricing(rows());
    expect(p.terms).toEqual([3, 6, 12]);
    expect(p.pricesExcludeGst).toBe(true);
    expect(p.gst).toEqual({ name: 'GST', ratePercent: 18 });
    const h = p.plans.find((x) => x.key === 'handyman_pro')!;
    expect(h.terms.map((t) => t.termMonths)).toEqual([3, 6, 12]);
    expect(h.terms[0]).toEqual({ termMonths: 3, state: 'AVAILABLE', price: { priceMinor: 149700, gstMinor: 26946, totalMinor: 176646 }, purchasable: true });
    expect(h.terms.map((t) => t.termMonths)).not.toContain(1);
  });

  it('shows exactly what the checkout would charge: the same priceQuote split with no discount', () => {
    for (const t of shapePublicPricing(rows()).plans.flatMap((x) => x.terms).filter((x) => x.price)) {
      const q = priceQuote({ basePaise: t.price!.priceMinor, taxInclusive: false, discounts: [], taxRatePercent: 18 });
      expect(t.price).toEqual({ priceMinor: q.taxableMinor, gstMinor: q.taxMinor, totalMinor: q.totalMinor });
    }
  });

  it('a term with no approved price that has started is PRICE_PENDING: no number, not purchasable', () => {
    const pro = shapePublicPricing(rows()).plans.find((x) => x.key === 'professional_pro')!;
    expect(pro.terms[2]).toEqual({ termMonths: 12, state: 'PRICE_PENDING', price: null, purchasable: false });
    const eco = shapePublicPricing(rows()).plans.find((x) => x.key === 'ecommerce_pro')!;
    expect(eco.terms.every((t) => t.state === 'PRICE_PENDING' && t.price === null && !t.purchasable)).toBe(true);
  });

  it('ignores a proposed, retired or not yet started price, and takes the latest started approved one', () => {
    const p = shapePublicPricing(rows({ prices: [
      price('handyman_pro', 3, 100000, { status: 'PROPOSED' }), price('handyman_pro', 3, 110000, { status: 'RETIRED' }), price('handyman_pro', 3, 120000, { effectiveFrom: FUTURE }),
      price('handyman_pro', 3, 130000, { effectiveFrom: new Date('2026-02-01T00:00:00Z') }), price('handyman_pro', 3, 140000, { effectiveFrom: new Date('2026-03-01T00:00:00Z') }),
    ] }));
    expect(p.plans.find((x) => x.key === 'handyman_pro')!.terms[0].price!.priceMinor).toBe(140000);
  });

  it('an inclusive price is split so the amount shown is before GST', () => {
    const p = shapePublicPricing(rows({ prices: [price('handyman_pro', 3, 118000, { taxInclusive: true })] }));
    const t = p.plans.find((x) => x.key === 'handyman_pro')!.terms[0];
    expect(t.price).toEqual({ priceMinor: 100000, gstMinor: 18000, totalMinor: 118000 });
  });

  it('with no tax rate: the price before GST is shown, GST and total are null, and nothing can be bought; an inclusive price is pending', () => {
    const p = shapePublicPricing(rows({ tax: null, prices: [price('handyman_pro', 3, 149700), price('handyman_pro', 6, 299400, { taxInclusive: true })] }));
    expect(p.gst).toBeNull();
    const h = p.plans.find((x) => x.key === 'handyman_pro')!;
    expect(h.terms[0]).toEqual({ termMonths: 3, state: 'AVAILABLE', price: { priceMinor: 149700, gstMinor: null, totalMinor: null }, purchasable: false });
    expect(h.terms[1]).toEqual({ termMonths: 6, state: 'PRICE_PENDING', price: null, purchasable: false });
  });

  it('Free is one neutral informational entry: it borrows nothing from any one track Free plan (B3.0)', () => {
    const expected = { key: 'free', name: 'Free plan', kind: 'FREE', description: 'A free website and directory listing for any kind of business.', informational: true };
    expect(shapePublicPricing(rows()).free).toEqual(expected);
    expect(shapePublicPricing(rows({ plans: [] })).free).toEqual(expected);
    expect(JSON.stringify(shapePublicPricing(rows()).free)).not.toMatch(/handyman|TRIAL|trial/i);
  });

  it('shows only active public paid plans, in their order, with the capabilities their tier allows', () => {
    const p = shapePublicPricing(rows({ plans: [plan('b', 'handyman', 'PRO', 2), plan('a', 'ecommerce', 'PRO', 1), plan('hidden', 'handyman', 'PRO', 0, { isPublic: false }), plan('draft', 'handyman', 'PRO', 0, { status: 'DRAFT' })] }));
    expect(p.plans.map((x) => x.key)).toEqual(['a', 'b']);
    expect(p.plans[0].capabilities.map((c) => c.key)).toEqual(['SITE', 'SHOP']);   // ecommerce: allowed cells only
    expect(p.plans[1].capabilities.map((c) => c.key)).toEqual(['SITE']);           // handyman: OLD is inactive, HIDE names a banned product word
  });

  it('add-on packs: an approved started price is a number, a missing one is PRICE_PENDING, a retired pack is not listed', () => {
    const a = shapePublicPricing(rows()).addons;
    expect(a.map((x) => x.key)).toEqual(['POSTERS', 'REELS']);
    expect(a[0]).toMatchObject({ state: 'AVAILABLE', purchasable: true, price: { priceMinor: 49900, gstMinor: 8982, totalMinor: 58882 } });
    expect(a[1]).toEqual({ key: 'REELS', name: 'Reel pack', description: 'Two reels', state: 'PRICE_PENDING', price: null, purchasable: false });
    const none = shapePublicPricing(rows({ addonPrices: [{ packId: 'a1', amountPaise: 49900, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: null }, { packId: 'a2', amountPaise: 1, currency: 'INR', taxInclusive: false, status: 'PROPOSED', effectiveFrom: PAST }] })).addons;
    expect(none.every((x) => x.state === 'PRICE_PENDING' && x.price === null)).toBe(true);
  });

  it('never carries a discount, coupon, offer or promo field or word, and never the banned product words', () => {
    const p = shapePublicPricing(rows());
    expect(allKeys(p).filter((k) => /discount|coupon|offer|promo|deal|saving/i.test(k))).toEqual([]);
    expect(allStrings(p).filter((s) => /discount|coupon|offer|promo|workspace|\bbos\b|leadspace|leads\b|rank|best|cheapest/i.test(s))).toEqual([]);
  });

  it('is the same answer twice (pure)', () => { expect(shapePublicPricing(rows())).toEqual(shapePublicPricing(rows())); });
});

describe('PublicPricingService cache and controller', () => {
  function fakePrisma(counter: { n: number }) {
    const r = rows();
    const del = (data: unknown[]) => ({ findMany: async () => { counter.n++; return data; } });
    return {
      v3Plan: del(r.plans), v3PlanPrice: del(r.prices), v3TaxRate: del([{ name: 'GST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: PAST }]),
      v3Capability: del(r.capabilities), v3TierCapability: del(r.tierCells), v3AddonPack: del(r.addonPacks), v3AddonPackPrice: del(r.addonPrices), v3ServicePrice: del([]),
    };
  }

  it('reads the tables once a minute, and again after the minute or an invalidate', async () => {
    const counter = { n: 0 };
    const svc = new PublicPricingService(fakePrisma(counter) as never);
    let t = NOW.getTime();
    svc.clock = () => new Date(t);
    const first = await svc.get();
    await svc.get();
    expect(counter.n).toBe(8);
    t += PRICING_CACHE_TTL_MS - 1; await svc.get(); expect(counter.n).toBe(8);
    t += 2; await svc.get(); expect(counter.n).toBe(16);
    svc.invalidate(); await svc.get(); expect(counter.n).toBe(24);
    expect(first.gst).toEqual({ name: 'GST', ratePercent: 18 });
    expect(first.plans.find((x) => x.key === 'handyman_pro')!.terms[0].price!.totalMinor).toBe(176646);
  });

  it('the route is cacheable and returns the service answer', async () => {
    const counter = { n: 0 };
    const svc = new PublicPricingService(fakePrisma(counter) as never); svc.clock = () => NOW;
    const headers: Record<string, string> = {};
    const out = await new PublicPricingPageController(svc).get({ set: (k: string, v: string) => { headers[k] = v; } } as never);
    expect(headers['Cache-Control']).toBe('public, max-age=300');
    expect(out.terms).toEqual([3, 6, 12]);
  });
});
