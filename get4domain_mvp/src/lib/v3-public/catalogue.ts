import { CATALOGUE_ROWS } from './catalogue-data';
import { type IndustryPage, industryBySlug, PACK_SLUGS, publishedIndustries } from './industries';

/**
 * The 196 catalogue categories as static data, and the rules for which category pages exist: /industries/{pack slug}/{category id}.
 * Pure (no framework import) so the middleware, the pages, the sitemap and the tests all use the same rules.
 *
 * A category page exists when its pack is published (the regulated four are not, unless V3_REGULATED_PACKS_PUBLIC is exactly "true") and the id is in the catalogue.
 */
type Env = Record<string, string | undefined>;

export interface CatalogueCategory { id: string; name: string; packKey: string; family: string }

export const CATALOGUE: readonly CatalogueCategory[] = CATALOGUE_ROWS.map(([id, name, packKey, family]) => ({ id, name, packKey, family }));

const BY_ID: ReadonlyMap<string, CatalogueCategory> = new Map(CATALOGUE.map((c) => [c.id, c]));

export const categoryById = (id: string): CatalogueCategory | null => BY_ID.get(id) ?? null;

export const categoriesOfPack = (packKey: string): readonly CatalogueCategory[] => CATALOGUE.filter((c) => c.packKey === packKey);

/** The public address of a category page. */
export const categoryPath = (c: CatalogueCategory): string => `/industries/${PACK_SLUGS[c.packKey]}/${c.id}`;

/** The page of a pack slug and category id, or null when the pack is not published, the id is unknown, or the id belongs to another pack. */
export function categoryPage(packSlug: string, id: string, env: Env = process.env): { industry: IndustryPage; category: CatalogueCategory } | null {
  const industry = industryBySlug(packSlug, env);
  const category = BY_ID.get(id);
  if (!industry || !category || category.packKey !== industry.pack.key) return null;
  return { industry, category };
}

/** Every category page that may be shown now. */
export function publishedCategories(env: Env = process.env): ReadonlyArray<{ industry: IndustryPage; category: CatalogueCategory }> {
  const keys = new Map(publishedIndustries(env).map((i) => [i.pack.key, i]));
  return CATALOGUE.flatMap((category) => { const industry = keys.get(category.packKey); return industry ? [{ industry, category }] : []; });
}

/** A category id that may be preselected on /register: published pack, known id. */
export function preselectableCategory(id: string, env: Env = process.env): CatalogueCategory | null {
  const c = BY_ID.get(id);
  return c && publishedIndustries(env).some((i) => i.pack.key === c.packKey) ? c : null;
}
