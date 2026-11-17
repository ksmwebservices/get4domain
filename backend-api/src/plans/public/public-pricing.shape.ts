import { priceQuote } from '../pricing/price-quote';

/**
 * The public pricing page data (Wave 3 Part B). PURE: table rows in, one answer out. No database, no clock, no environment.
 *
 * Rules (owner, 17 Nov 2026):
 *  - the paid plans are shown by the three terms (3, 6 and 12 months); there is no monthly billing;
 *  - every price is shown EXCLUDING GST; GST is a separate amount from the tax rate table (data the owner confirms), never typed here;
 *  - the amounts are the same function the checkout uses (priceQuote with no discount), so the page and the checkout always agree;
 *  - a price that is not approved and started (state PRICE_PENDING) is never a number and is never purchasable;
 *  - Free is the trial entry, informational only;
 *  - the answer has no discount, coupon or offer field, and no ranking or invented number.
 */
export const PRICING_TERMS = [3, 6, 12] as const;

export interface PricingRows {
  now: Date;
  plans: { id: string; key: string; track: string; level: string; name: string; description: string | null; status: string; isPublic: boolean; sortOrder: number }[];
  prices: { planId: string; termMonths: number; amountPaise: number; currency: string; taxInclusive: boolean; status: string; effectiveFrom: Date }[];
  tax: { name: string; ratePercent: number } | null;
  capabilities: { key: string; name: string; description: string | null; active: boolean; sortOrder: number }[];
  tierCells: { tier: string; capabilityKey: string; allowed: boolean }[];
  addonPacks: { id: string; key: string; name: string; description: string; status: string }[];
  addonPrices: { packId: string; amountPaise: number; currency: string; taxInclusive: boolean; status: string; effectiveFrom: Date | null }[];
  /** the price rows of the THEME_SWITCH service (the fee for a later theme switch); absent or empty means no price is set */
  themeSwitchPrices?: { amountPaise: number; currency: string; taxInclusive: boolean; status: string; effectiveFrom: Date | null }[];
}

export type PriceState = 'AVAILABLE' | 'PRICE_PENDING';
export interface PriceLine { priceMinor: number; gstMinor: number | null; totalMinor: number | null }
export interface PricingTerm { termMonths: number; state: PriceState; price: PriceLine | null; purchasable: boolean }
export interface PublicPricing {
  currency: 'INR';
  pricesExcludeGst: true;
  terms: number[];
  gst: { name: string; ratePercent: number } | null;
  free: { key: 'free'; name: string; kind: 'TRIAL'; description: string | null; informational: true };
  plans: { key: string; track: string; name: string; description: string | null; capabilities: { key: string; name: string; description: string | null }[]; terms: PricingTerm[] }[];
  addons: { key: string; name: string; description: string; state: PriceState; price: PriceLine | null; purchasable: boolean }[];
  /** the fee for a later theme switch (the first switch is included in a paid plan); PRICE_PENDING until a price is approved and started, and then never a number */
  themeSwitch: { state: PriceState; price: PriceLine | null };
}

/** Product words that never appear on a public page, whatever a data row says. */
const BANNED_WORDS = /workspace|\bbos\b|leadspace/i;
const clean = (s: string | null): string | null => (s !== null && BANNED_WORDS.test(s) ? null : s);

type Priced = { amountPaise: number; taxInclusive: boolean };
/** The line shown for one price: the amount before GST, the GST and the total, the same split the checkout makes. Without a tax rate only the amount before GST is known. */
export function priceLine(p: Priced, tax: PricingRows['tax']): PriceLine | null {
  if (!tax) return p.taxInclusive ? null : { priceMinor: p.amountPaise, gstMinor: null, totalMinor: null };   // a price that already holds GST cannot be split without the rate: it is not shown as a number
  const q = priceQuote({ basePaise: p.amountPaise, taxInclusive: p.taxInclusive, discounts: [], taxRatePercent: tax.ratePercent });
  return { priceMinor: q.taxableMinor - (q.taxInclusive ? q.taxMinor : 0), gstMinor: q.taxMinor, totalMinor: q.totalMinor };
}

export function shapePublicPricing(r: PricingRows): PublicPricing {
  const now = r.now.getTime();
  const livePlans = r.plans.filter((p) => p.status === 'ACTIVE' && p.isPublic).sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  const free = livePlans.find((p) => p.level === 'FREE');
  const capabilityByKey = new Map(r.capabilities.filter((c) => c.active && !BANNED_WORDS.test(c.name)).map((c) => [c.key, c]));

  const plans = livePlans.filter((p) => p.level === 'PRO').map((p) => {
    const tier = p.track.toUpperCase();
    const capabilities = r.tierCells
      .filter((c) => c.tier === tier && c.allowed && capabilityByKey.has(c.capabilityKey))
      .map((c) => capabilityByKey.get(c.capabilityKey)!)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
      .map((c) => ({ key: c.key, name: c.name, description: clean(c.description) }));
    const terms: PricingTerm[] = PRICING_TERMS.map((termMonths) => {
      // the latest APPROVED price of this term that has already started
      const live = r.prices.filter((x) => x.planId === p.id && x.termMonths === termMonths && x.status === 'APPROVED' && x.effectiveFrom.getTime() <= now && x.currency === 'INR').sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
      if (!live) return { termMonths, state: 'PRICE_PENDING', price: null, purchasable: false };
      const line = priceLine(live, r.tax);
      if (!line) return { termMonths, state: 'PRICE_PENDING', price: null, purchasable: false };
      return { termMonths, state: 'AVAILABLE', price: line, purchasable: line.totalMinor !== null };
    });
    return { key: p.key, track: p.track, name: p.name, description: clean(p.description), capabilities, terms };
  });

  const addons = r.addonPacks.filter((a) => a.status === 'ACTIVE').sort((a, b) => a.key.localeCompare(b.key)).map((a) => {
    const live = r.addonPrices.filter((x) => x.packId === a.id && x.status === 'APPROVED' && x.effectiveFrom !== null && x.effectiveFrom.getTime() <= now && x.currency === 'INR').sort((x, y) => y.effectiveFrom!.getTime() - x.effectiveFrom!.getTime())[0];
    if (!live) return { key: a.key, name: a.name, description: clean(a.description) ?? '', state: 'PRICE_PENDING' as const, price: null, purchasable: false };
    const line = priceLine(live, r.tax);
    if (!line) return { key: a.key, name: a.name, description: clean(a.description) ?? '', state: 'PRICE_PENDING' as const, price: null, purchasable: false };
    return { key: a.key, name: a.name, description: clean(a.description) ?? '', state: 'AVAILABLE' as const, price: line, purchasable: line.totalMinor !== null };
  });

  const ts = (r.themeSwitchPrices ?? []).filter((x) => x.status === 'APPROVED' && x.effectiveFrom !== null && x.effectiveFrom.getTime() <= now && x.currency === 'INR').sort((x, y) => y.effectiveFrom!.getTime() - x.effectiveFrom!.getTime())[0];
  const tsLine = ts ? priceLine(ts, r.tax) : null;
  const themeSwitch: PublicPricing['themeSwitch'] = tsLine ? { state: 'AVAILABLE', price: tsLine } : { state: 'PRICE_PENDING', price: null };

  return {
    currency: 'INR', pricesExcludeGst: true, terms: [...PRICING_TERMS], gst: r.tax ? { name: r.tax.name, ratePercent: r.tax.ratePercent } : null,
    free: { key: 'free', name: 'Free', kind: 'TRIAL', description: clean(free?.description ?? null), informational: true },
    plans, addons, themeSwitch,
  };
}
