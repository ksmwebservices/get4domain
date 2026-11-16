import { getJson, unwrap } from './api';
import { apiBase, defaultRevalidate } from './config';
import { useMocks } from './flag';
import type { Fetched } from './types';

/**
 * The public plan comparison (GET /v3/plans, which exists). Only what a visitor may see: public plans, approved term prices, feature rows that are not hidden.
 * The page shows these as given. Prices are shown WITHOUT GST: a price the API marks tax inclusive is taken back to its net amount with the API's own tax rate, and a price that
 * cannot be shown without GST is treated as not set (never guessed, never a pending number).
 */
export type FeatureState = 'ACTIVE' | 'LIMITED' | 'LOCKED_PREVIEW' | 'HIDDEN';
export interface PlanPrice { termMonths: number; amountPaise: number; currency: string; taxInclusive: boolean }
export interface PlanFeature { key: string; name: string; group: string; kind: string; unit: string | null; state: FeatureState; limit: number | null; enumValue: string | null; upsellText: string | null }
export interface PublicPlan { key: string; track: string; level: string; name: string; description: string | null; prices: PlanPrice[]; features: PlanFeature[] }
export interface PublicPlans { plans: PublicPlan[]; terms: number[]; tax: { name: string; ratePercent: number } | null }

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
    plans: raw.plans.map((p) => ({
      ...p,
      prices: p.prices.filter((x) => PUBLIC_TERMS.includes(x.termMonths)),
      features: p.features.filter((f) => f.state !== 'HIDDEN'),
    })),
  };
}

// Sample data for review (mock mode only). The numbers are samples, not prices. Ecommerce has no price at all, to show the pending state.
const F = (key: string, name: string, group: string, state: FeatureState, limit: number | null = null, unit: string | null = null): PlanFeature => ({ key, name, group, kind: limit === null ? 'BOOLEAN' : 'LIMIT', unit, state, limit, enumValue: null, upsellText: null });
const P = (term: number, rupees: number): PlanPrice => ({ termMonths: term, amountPaise: rupees * 100, currency: 'INR', taxInclusive: false });
export const MOCK_PLANS: PublicPlans = {
  terms: [3, 6, 12],
  tax: { name: 'GST', ratePercent: 18 },
  plans: [
    { key: 'handyman', track: 'handyman', level: 'PRO', name: 'Handyman', description: 'For one-person service businesses.', prices: [P(3, 1000), P(6, 1900), P(12, 3600)],
      features: [F('site.cta', 'Buttons, forms and contact links', 'Site', 'ACTIVE'), F('site.pages', 'Site pages', 'Site', 'LIMITED', 5, 'pages'), F('site.domain', 'Your own domain name', 'Site', 'ACTIVE'), F('shop', 'Online shop', 'Selling', 'LOCKED_PREVIEW')] },
    { key: 'professional', track: 'professional', level: 'PRO', name: 'Professional', description: 'For firms and practices.', prices: [P(3, 2000), P(6, 3800), P(12, 7200)],
      features: [F('site.cta', 'Buttons, forms and contact links', 'Site', 'ACTIVE'), F('site.pages', 'Site pages', 'Site', 'LIMITED', 12, 'pages'), F('site.domain', 'Your own domain name', 'Site', 'ACTIVE'), F('shop', 'Online shop', 'Selling', 'LOCKED_PREVIEW')] },
    { key: 'ecommerce', track: 'ecommerce', level: 'PRO', name: 'Ecommerce', description: 'For businesses that sell online.', prices: [],
      features: [F('site.cta', 'Buttons, forms and contact links', 'Site', 'ACTIVE'), F('site.pages', 'Site pages', 'Site', 'LIMITED', 20, 'pages'), F('site.domain', 'Your own domain name', 'Site', 'ACTIVE'), F('shop', 'Online shop', 'Selling', 'ACTIVE')] },
  ],
};

/** The plans for the pricing page and the home page. */
export async function fetchPlans(): Promise<Fetched<PublicPlans>> {
  if (useMocks()) return { kind: 'ok', data: cleanPlans(MOCK_PLANS) };
  const base = apiBase();
  if (!base) return { kind: 'error', status: null };
  const r = await getJson<PublicPlans>(`${base}/v3/plans`, defaultRevalidate());
  if (r.kind !== 'ok') return r;
  const data = unwrap<PublicPlans>(r.data);
  if (!data || !Array.isArray(data.plans)) return { kind: 'error', status: null };
  return { kind: 'ok', data: cleanPlans({ plans: data.plans, terms: Array.isArray(data.terms) ? data.terms : [], tax: data.tax ?? null }) };
}

/** The add-on packs a visitor can be told about. Prices are pending: no number is ever shown. (Fixed list until the API lists add-on packs publicly; see PUBLIC_GAPS.) */
export const ADDON_PACKS: readonly { key: string; name: string }[] = [
  { key: 'SHOP', name: 'Online shop' },
  { key: 'ONLINE_ORDERING_DELIVERY', name: 'Online ordering and delivery' },
  { key: 'PHARMACY_COUNTER', name: 'Pharmacy counter' },
  { key: 'HOME_SAMPLE_COLLECTION', name: 'Home sample collection' },
];
