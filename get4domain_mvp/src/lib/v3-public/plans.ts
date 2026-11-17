import { getJson, unwrap } from './api';
import { apiBase, defaultRevalidate } from './config';
import { useMocks } from './flag';
import type { Fetched } from './types';

/**
 * The public plan comparison (GET /v3/public/pricing, API_CONTRACT_WAVE3). Only what a visitor may see: public plans, approved term prices, feature rows that are not hidden.
 * The page shows these as given. Prices are shown WITHOUT GST: a price the API marks tax inclusive is taken back to its net amount with the API's own tax rate, and a price that
 * cannot be shown without GST is treated as not set (never guessed, never a pending number).
 */
export type FeatureState = 'ACTIVE' | 'LIMITED' | 'LOCKED_PREVIEW' | 'HIDDEN';
export interface PlanPrice { termMonths: number; amountPaise: number; currency: string; taxInclusive: boolean }
export interface PlanFeature { key: string; name: string; group: string; kind: string; unit: string | null; state: FeatureState; limit: number | null; enumValue: string | null; upsellText: string | null }
export interface PublicPlan { key: string; track: string; level: string; name: string; description: string | null; prices: PlanPrice[]; features: PlanFeature[] }
export interface PublicAddon { key: string; name: string; description: string | null; priceMinor: number | null }
export interface PublicPlans { plans: PublicPlan[]; terms: number[]; tax: { name: string; ratePercent: number } | null; addons?: PublicAddon[] }

/** The answer of GET /v3/public/pricing as the contract documents it (money is integer paise, always before GST; PRICE_PENDING has no price). */
export interface RawPricing {
  currency?: string; pricesExcludeGst?: boolean; terms?: number[]; gst?: { name: string; ratePercent: number } | null;
  plans?: Array<{ key: string; track?: string; name: string; description?: string | null; capabilities?: Array<{ key: string; name: string; description?: string | null }>;
    terms?: Array<{ termMonths: number; state: string; price: { priceMinor: number; gstMinor: number | null; totalMinor: number | null } | null; purchasable?: boolean }> }>;
  addons?: Array<{ key: string; name: string; description?: string | null; state?: string; price?: { priceMinor: number } | null; purchasable?: boolean }>;
}

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** The contract answer to the page model. Only AVAILABLE terms with a price become a price row (a pending term has no number); capabilities are listed as included. */
export function fromPricing(raw: RawPricing): PublicPlans {
  const plans: PublicPlan[] = (Array.isArray(raw.plans) ? raw.plans : []).map((p) => ({
    key: p.key, track: p.track ?? p.key, level: 'PRO', name: p.name, description: text(p.description, 300),
    prices: (Array.isArray(p.terms) ? p.terms : [])
      .filter((t) => t.state === 'AVAILABLE' && t.price && Number.isFinite(t.price.priceMinor))
      .map((t) => ({ termMonths: t.termMonths, amountPaise: t.price!.priceMinor, currency: raw.currency ?? 'INR', taxInclusive: false })),
    features: (Array.isArray(p.capabilities) ? p.capabilities : []).map((c) => ({ key: c.key, name: c.name, group: 'Included', kind: 'BOOLEAN', unit: null, state: 'ACTIVE' as FeatureState, limit: null, enumValue: null, upsellText: null })),
  }));
  const addons: PublicAddon[] = (Array.isArray(raw.addons) ? raw.addons : []).map((a) => ({
    key: a.key, name: a.name, description: text(a.description, 300),
    priceMinor: a.state === 'AVAILABLE' && a.price && Number.isFinite(a.price.priceMinor) && a.price.priceMinor > 0 ? a.price.priceMinor : null,
  }));
  return { plans, terms: Array.isArray(raw.terms) ? raw.terms : [], tax: raw.gst ?? null, addons };
}

/** The billing terms of the public site. There is no monthly billing here, whatever the API lists. */
export const PUBLIC_TERMS: readonly number[] = [3, 6, 12];

/** The amount in paise without GST, or null when it cannot be shown without GST. */
export function netAmountPaise(price: PlanPrice, tax: PublicPlans['tax']): number | null {
  if (!Number.isFinite(price.amountPaise) || price.amountPaise <= 0 || price.currency !== 'INR') return null;
  if (!price.taxInclusive) return Math.round(price.amountPaise);
  if (!tax || !(tax.ratePercent >= 0)) return null;
  return Math.round((price.amountPaise * 100) / (100 + tax.ratePercent));
}

/** "₹1,499" or "₹1,499.50" from paise. */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  const whole = Number.isInteger(rupees);
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** The price of a plan for one term: the net amount, or null (not offered for that term). `pending` is true when the plan has no shown price for any term. */
export function priceFor(plan: PublicPlan, term: number, tax: PublicPlans['tax']): { paise: number | null; pending: boolean } {
  const anyShown = plan.prices.some((p) => PUBLIC_TERMS.includes(p.termMonths) && netAmountPaise(p, tax) !== null);
  const row = plan.prices.find((p) => p.termMonths === term);
  return { paise: row ? netAmountPaise(row, tax) : null, pending: !anyShown };
}

/** Only the three public billing terms; hidden features are dropped if one ever arrives. */
export function cleanPlans(raw: PublicPlans): PublicPlans {
  return {
    terms: PUBLIC_TERMS.filter((t) => raw.terms.length === 0 || raw.terms.includes(t)).slice(),
    tax: raw.tax ?? null,
    ...(raw.addons ? { addons: raw.addons } : {}),
    plans: raw.plans.map((p) => ({
      ...p,
      prices: p.prices.filter((x) => PUBLIC_TERMS.includes(x.termMonths)),
      features: p.features.filter((f) => f.state !== 'HIDDEN'),
    })),
  };
}

// Sample data for review (mock mode only), in the shape of the real route so that mock and real mode share one path. The numbers are samples, not prices.
// Ecommerce has no price at all (every term PRICE_PENDING) to show the pending state.
const CAPS = [{ key: 'site.cta', name: 'Buttons, forms and contact links' }, { key: 'site.pages', name: 'Site pages' }, { key: 'site.domain', name: 'Your own domain name' }];
const T = (termMonths: number, rupees: number | null) => ({ termMonths, state: rupees === null ? 'PRICE_PENDING' : 'AVAILABLE', price: rupees === null ? null : { priceMinor: rupees * 100, gstMinor: Math.round(rupees * 18), totalMinor: Math.round(rupees * 118) }, purchasable: rupees !== null });
export const MOCK_PRICING: RawPricing = {
  currency: 'INR', pricesExcludeGst: true, terms: [3, 6, 12], gst: { name: 'GST', ratePercent: 18 },
  plans: [
    { key: 'handyman', track: 'handyman', name: 'Handyman', description: 'For one-person service businesses.', capabilities: CAPS, terms: [T(3, 1000), T(6, 1900), T(12, 3600)] },
    { key: 'professional', track: 'professional', name: 'Professional', description: 'For firms and practices.', capabilities: CAPS, terms: [T(3, 2000), T(6, 3800), T(12, 7200)] },
    { key: 'ecommerce', track: 'ecommerce', name: 'Ecommerce', description: 'For businesses that sell online.', capabilities: [...CAPS, { key: 'shop', name: 'Online shop' }], terms: [T(3, null), T(6, null), T(12, null)] },
  ],
  addons: [
    { key: 'SHOP', name: 'Online shop', state: 'PRICE_PENDING', price: null, purchasable: false },
    { key: 'ONLINE_ORDERING_DELIVERY', name: 'Online ordering and delivery', state: 'PRICE_PENDING', price: null, purchasable: false },
    { key: 'PHARMACY_COUNTER', name: 'Pharmacy counter', state: 'PRICE_PENDING', price: null, purchasable: false },
    { key: 'HOME_SAMPLE_COLLECTION', name: 'Home sample collection', state: 'PRICE_PENDING', price: null, purchasable: false },
  ],
};
export const MOCK_PLANS: PublicPlans = fromPricing(MOCK_PRICING);

/** The plans for the pricing page and the home page. */
export async function fetchPlans(): Promise<Fetched<PublicPlans>> {
  if (useMocks()) return { kind: 'ok', data: cleanPlans(MOCK_PLANS) };
  const base = apiBase();
  if (!base) return { kind: 'error', status: null };
  const r = await getJson<RawPricing>(`${base}/v3/public/pricing`, defaultRevalidate());
  if (r.kind !== 'ok') return r;
  const raw = unwrap<RawPricing>(r.data);
  if (!raw || !Array.isArray(raw.plans)) return { kind: 'error', status: null };
  return { kind: 'ok', data: cleanPlans(fromPricing(raw)) };
}

/** The add-on packs a visitor can be told about. Prices are pending: no number is ever shown. (Fallback list only; the pricing route lists the add-ons itself and that list wins.) */
export const ADDON_PACKS: readonly { key: string; name: string }[] = [
  { key: 'SHOP', name: 'Online shop' },
  { key: 'ONLINE_ORDERING_DELIVERY', name: 'Online ordering and delivery' },
  { key: 'PHARMACY_COUNTER', name: 'Pharmacy counter' },
  { key: 'HOME_SAMPLE_COLLECTION', name: 'Home sample collection' },
];
