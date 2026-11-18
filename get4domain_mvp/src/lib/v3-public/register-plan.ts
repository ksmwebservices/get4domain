import { trackOfTier, TRACKS, PRO_PLAN_KEYS } from './register';

/**
 * The plan-aware parts of the register page. Pure (no framework import), so the form and the tests share the rules.
 * A category belongs to a track by its minimum tier (the API's `minTier`: HANDYMAN, PROFESSIONAL or ECOMMERCE). A Pro plan key is its track's name, so a track picks its plan.
 */
export type Track = (typeof TRACKS)[number];

/** A category as the picker shows it. `sub` is the sub category line when the data carries one (the API list has family and category only today). */
export interface CatOption { key: string; name: string; industry: string; packKey?: string; family: string; track: Track | null; sub?: string | null }

/** What the server works out for one Pro plan: its prices as text per term, from the public price route only (without GST). */
export interface PlanChoice { key: string; name: string; track: Track; pending: boolean; monthly: Record<number, string | null>; total: Record<number, string | null> }

/** "FIELD_SERVICE" and "field-service" to "Field service"; a name that already reads as words is kept. */
export function familyLabel(raw: string): string {
  const t = String(raw ?? '').trim();
  if (!t) return 'Other';
  if (/^[A-Za-z0-9]+([_-][A-Za-z0-9]+)+$/.test(t) || (t === t.toUpperCase() && /^[A-Z0-9 ]+$/.test(t))) {
    const w = t.replace(/[_-]+/g, ' ').toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return t;
}

export const trackOfCategory = (c: Pick<CatOption, 'track'>): Track | null => c.track;

/** The categories whose track is the plan's track. */
export const categoriesForTrack = (list: readonly CatOption[], track: Track): CatOption[] => list.filter((c) => c.track === track);

/** Search text over name, family and sub category: every typed word must start a word of one of them. */
export function matchesQuery(c: CatOption, query: string): boolean {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${c.name} ${familyLabel(c.family)} ${c.sub ?? ''}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.every((w) => hay.some((h) => h.startsWith(w)));
}

export interface CategoryGroup { family: string; items: CatOption[] }

/** Family, then category (then its sub category line): groups in name order, items in name order, only what matches the search. */
export function groupByFamily(list: readonly CatOption[], query: string): CategoryGroup[] {
  const m = new Map<string, CatOption[]>();
  for (const c of list) {
    if (!matchesQuery(c, query)) continue;
    const f = familyLabel(c.family);
    m.set(f, [...(m.get(f) ?? []), c]);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([family, items]) => ({ family, items: [...items].sort((a, b) => a.name.localeCompare(b.name)) }));
}

export const planForTrack = (plans: readonly PlanChoice[], track: Track | null): PlanChoice | null => (track ? plans.find((p) => p.track === track) ?? null : null);

/**
 * A category was picked while a Pro plan is chosen. Same track (or a category with no track): nothing changes. Another track: the plan becomes that track's plan, when the price list has it.
 * `switched` is true only when the plan really changed, so the screen shows its notice only then.
 */
export function planAfterPick(plans: readonly PlanChoice[], currentKey: string, c: Pick<CatOption, 'track'>): { plan: PlanChoice | null; switched: boolean } {
  const current = plans.find((p) => p.key === currentKey) ?? null;
  if (!c.track || !current || current.track === c.track) return { plan: current, switched: false };
  const next = planForTrack(plans, c.track);
  return next ? { plan: next, switched: true } : { plan: current, switched: false };
}

export const isProPlan = (key: string): boolean => PRO_PLAN_KEYS.includes(key);

/** The track of a raw category row's minimum tier. */
export const trackOfMinTier = (minTier: string | undefined | null): Track | null => trackOfTier(minTier);

/** The business app's own page for plan and billing, where the payment is made. The plan and the term ride along; the app decides what it does with them. */
export const CHECKOUT_PATH = '/app/more/plan';

/** `/app/more/plan?plan=professional&term=12`: the address to continue to after sign-in. Only a known Pro plan and a known term are carried. */
export function checkoutNextPath(plan: string, term: number | null): string {
  const q = new URLSearchParams();
  if (isProPlan(plan)) q.set('plan', plan);
  if (term !== null && [3, 6, 12].includes(term)) q.set('term', String(term));
  const s = q.toString();
  return s ? `${CHECKOUT_PATH}?${s}` : CHECKOUT_PATH;
}

/** The business app's sign-in address carrying that checkout address as `next`. null when no business app address is set or it is not http(s). */
export function signInWithNext(vendorUrl: string | null, plan: string, term: number | null): string | null {
  if (!vendorUrl) return null;
  let u: URL;
  try { u = new URL(vendorUrl); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.search = '';
  u.hash = '';
  u.pathname = `${u.pathname.replace(/\/+$/, '')}/login`;
  u.searchParams.set('next', checkoutNextPath(plan, term));
  return u.toString();
}
