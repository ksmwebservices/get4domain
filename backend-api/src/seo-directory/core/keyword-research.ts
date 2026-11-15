import { csvCell } from './keyword-target';
import { cleanKeyword } from './keyword-text';
import { ListingPath } from './sitemap';

/**
 * SEO block (prompt 8d): the keyword RESEARCH list, built only from our own data, for Google Keyword Planner and for choosing which pages to work on. Pure and deterministic.
 * Only combinations that map to a page that exists (not thin, not empty) or to a listed profile are produced; every row carries the page path it maps to.
 *   - place:    {plural | singular | synonym} in {city | locality}
 *   - pincode:  {plural | singular | synonym} in {pincode}
 *   - modifier: each modifier from the settings list applied to the place rows ("best", "top", "24 hours" in front; "services" after the word; "near me" on the category page; an entry
 *               with {locality} such as "in {locality}" on locality pages only)
 *   - service:  {service} in {city}, only where at least the minimum number of listed businesses offer that service in that city, mapped to the city + category page
 *   - vendor:   {business name} {locality} and {business name} {city}, mapped to the profile
 * Modifiers are for RESEARCH and keyword targets ONLY: this file never writes into a page title or description, and a target made from one still passes through the page-text checks
 * before any page uses it (so "best" can be searched for but is never promised).
 */
export type ResearchKind = 'place' | 'pincode' | 'modifier' | 'service' | 'vendor';
export const RESEARCH_KINDS: readonly ResearchKind[] = ['place', 'pincode', 'modifier', 'service', 'vendor'];
export interface ResearchRow { keyword: string; path: string; kind: ResearchKind }
export interface ServiceCityCount { name: string; catId: string; cityId: string; cityName: string; count: number }
export interface ProfileFact { name: string; slug: string; localityName: string | null; cityName: string | null }
export interface ResearchInput {
  listing: readonly ListingPath[]; synonyms: ReadonlyMap<string, readonly string[]>; modifiers: readonly string[];
  serviceCounts: readonly ServiceCityCount[]; profiles: readonly ProfileFact[]; min: number; max?: number;
}
export interface ResearchPlan { rows: ResearchRow[]; counts: Record<ResearchKind, number>; total: number; truncated: boolean }
export const RESEARCH_MAX = 50_000;

const NEAR_ME = 'near me';
const byPath = (a: ListingPath, b: ListingPath): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function generateResearchPlan(i: ResearchInput): ResearchPlan {
  const max = Math.min(i.max ?? RESEARCH_MAX, RESEARCH_MAX);
  const rows: ResearchRow[] = []; const seen = new Set<string>(); let truncated = false;
  const counts: Record<ResearchKind, number> = { place: 0, pincode: 0, modifier: 0, service: 0, vendor: 0 };
  const add = (phrase: string, path: string, kind: ResearchKind): void => {
    if (truncated) return;
    const keyword = cleanKeyword(phrase); if (!keyword) return;
    const key = `${keyword}\u0000${path}`; if (seen.has(key)) return;
    if (rows.length >= max) { truncated = true; return; }
    seen.add(key); rows.push({ keyword, path, kind }); counts[kind]++;
  };
  const sorted = [...i.listing].sort(byPath);
  const forms = (l: ListingPath): string[] => { const c = l.ctx.cat; return c ? [...new Set([c.plural, c.singular, ...(i.synonyms.get(c.row.slug) ?? [])].map((x) => x.trim()).filter(Boolean))] : []; };
  const categoryPage = new Map<string, string>();   // catId -> /category/{slug}
  for (const l of sorted) if (l.ctx.type === 'category' && l.ctx.catId) categoryPage.set(l.ctx.catId, l.path);
  const modifiers = [...new Set(i.modifiers.map((m) => m.trim().toLowerCase()).filter(Boolean))];

  // 1. place rows, then pincode rows
  for (const l of sorted) {
    if (l.ctx.type !== 'cityCategory' && l.ctx.type !== 'localityCategory') continue;
    const place = l.ctx.type === 'localityCategory' ? l.ctx.localityName : l.ctx.cityName; if (!place) continue;
    for (const f of forms(l)) add(`${f} in ${place}`, l.path, 'place');
  }
  for (const l of sorted) {
    if (l.ctx.type !== 'pincodeCategory' || !l.ctx.pincode) continue;
    for (const f of forms(l)) add(`${f} in ${l.ctx.pincode}`, l.path, 'pincode');
  }
  // 2. modifiers over the place rows
  for (const l of sorted) {
    if (l.ctx.type !== 'cityCategory' && l.ctx.type !== 'localityCategory') continue;
    const isLocality = l.ctx.type === 'localityCategory'; const place = isLocality ? l.ctx.localityName : l.ctx.cityName; if (!place) continue;
    for (const f of forms(l)) for (const m of modifiers) {
      if (m === NEAR_ME) { const p = l.ctx.catId ? categoryPage.get(l.ctx.catId) : undefined; if (p) add(`${f} near me`, p, 'modifier'); }
      else if (m.includes('{locality}')) { if (isLocality) add(`${f} ${m.replace('{locality}', place)}`, l.path, 'modifier'); }
      else if (m === 'services') add(`${f} services in ${place}`, l.path, 'modifier');
      else add(`${m} ${f} in ${place}`, l.path, 'modifier');
    }
  }
  // 3. service x city, only where enough businesses offer it
  const cityPage = new Map<string, string>();   // `${cityId}|${catId}` -> page
  for (const l of sorted) if (l.ctx.type === 'cityCategory' && l.ctx.cityId && l.ctx.catId) cityPage.set(`${l.ctx.cityId}|${l.ctx.catId}`, l.path);
  for (const s of [...i.serviceCounts].sort((a, b) => (a.cityName + a.name < b.cityName + b.name ? -1 : 1))) {
    if (s.count < Math.max(1, i.min)) continue;
    const p = cityPage.get(`${s.cityId}|${s.catId}`); if (p) add(`${s.name} in ${s.cityName}`, p, 'service');
  }
  // 4. vendor name x locality and x city
  for (const v of [...i.profiles].sort((a, b) => (a.slug < b.slug ? -1 : 1))) {
    const path = `/business/${v.slug}`;
    if (v.localityName) add(`${v.name} ${v.localityName}`, path, 'vendor');
    if (v.cityName) add(`${v.name} ${v.cityName}`, path, 'vendor');
  }
  return { rows, counts, total: rows.length, truncated };
}

/** The research list as a CSV with the page each keyword maps to (formula-looking cells are guarded). */
export const researchToCsv = (rows: readonly ResearchRow[]): string => ['keyword,path,type', ...rows.map((r) => [r.keyword, r.path, r.kind].map(csvCell).join(','))].join('\n') + '\n';
/** One keyword per row, each once, in first-seen order, under the header Keyword Planner reads: ready to upload. */
export function plannerCsv(rows: readonly ResearchRow[]): string {
  const seen = new Set<string>(); const out: string[] = ['Keyword'];
  for (const r of rows) if (!seen.has(r.keyword)) { seen.add(r.keyword); out.push(csvCell(r.keyword)); }
  return out.join('\n') + '\n';
}
