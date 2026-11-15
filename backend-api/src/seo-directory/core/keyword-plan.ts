import { cleanKeyword } from './keyword-text';
import { ListingPath } from './sitemap';
import { MAX_IMPORT_ROWS, TargetInput } from './keyword-target';

/**
 * SEO block slice 5: the keyword plan generator. For every listing page the sitemap would list (a city + category page or a locality + category page, not thin, not empty) it proposes the
 * keywords a person would type to find that page: "{plural} in {place}", "{singular} in {place}" and, for each synonym staff entered, "{synonym} in {place}". Nothing is invented: the words
 * come from the category keyword set and the place names. A plan is only a list of PLANNED rows (source PLAN) for staff to read, edit in a spreadsheet and import back; importing it
 * changes no page until a row is made ACTIVE. Pure and deterministic: the same inputs give the same rows in the same order.
 */
export interface PlanOptions { /** staff synonyms by category slug */ synonyms?: ReadonlyMap<string, readonly string[]>; max?: number }
export interface KeywordPlan { rows: TargetInput[]; truncated: boolean; pages: number }

export function generateKeywordPlan(listing: readonly ListingPath[], o: PlanOptions = {}): KeywordPlan {
  const max = Math.min(o.max ?? MAX_IMPORT_ROWS, MAX_IMPORT_ROWS);
  const rows: TargetInput[] = []; const seen = new Set<string>(); let truncated = false; let pages = 0;
  const sorted = [...listing].filter((l) => (l.ctx.type === 'cityCategory' || l.ctx.type === 'localityCategory') && !!l.ctx.cat).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const l of sorted) {
    const place = l.ctx.type === 'localityCategory' ? l.ctx.localityName : l.ctx.cityName;
    const cat = l.ctx.cat;
    if (!place || !cat) continue;
    const forms: Array<[string, number]> = [[`${cat.plural} in ${place}`, 1], [`${cat.singular} in ${place}`, 2]];
    for (const syn of o.synonyms?.get(cat.row.slug) ?? []) forms.push([`${syn} in ${place}`, 3]);
    pages++;
    for (const [phrase, priority] of forms) {
      const keyword = cleanKeyword(phrase);
      if (!keyword) continue;
      const key = `${keyword}\u0000${l.path}`;
      if (seen.has(key)) continue;
      if (rows.length >= max) { truncated = true; break; }
      seen.add(key);
      rows.push({ keyword, path: l.path, pageType: l.ctx.type, status: 'PLANNED', priority, titleOverride: null, descriptionOverride: null, h1Override: null, notes: null, source: 'PLAN' });
    }
    if (truncated) break;
  }
  return { rows, truncated, pages };
}
