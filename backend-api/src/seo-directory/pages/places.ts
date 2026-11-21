import { CategoryRow, DirectoryRepository, LocationRow } from '../../directory/directory.repository';
import { SeoKeywordStore } from '../keywords/seo-keyword.store';
import { titleCase } from '../core/template-engine';
import { slugify } from '../core/url-scheme';

/** A category as the pages name it: display forms and the slugs the URLs use. */
export interface CatInfo { row: CategoryRow; singular: string; plural: string; pluralSlug: string; singularSlug: string }
export interface Places { locs: LocationRow[]; cats: CategoryRow[]; catInfo: Map<string, CatInfo> }

/**
 * The active places and categories with their keyword forms. An empty plural (the loader leaves it for staff when the name is ambiguous) falls back to the singular form: honest, never a
 * guessed plural.
 */
export async function loadPlaces(repo: Pick<DirectoryRepository, 'listLocations' | 'listCategories'>, keywords: Pick<SeoKeywordStore, 'all'>): Promise<Places> {
  const [locs, cats, kws] = await Promise.all([repo.listLocations(), repo.listCategories(), keywords.all()]);
  const kw = new Map(kws.map((k) => [k.categorySlug, k]));
  const catInfo = new Map<string, CatInfo>();
  for (const c of cats.filter((x) => x.active)) {
    const k = kw.get(c.slug);
    const singular = (k?.singular || c.name).trim().toLowerCase();
    const pl = (k?.plural || '').trim().toLowerCase();
    catInfo.set(c.id, { row: c, singular: titleCase(singular), plural: titleCase(pl || singular), pluralSlug: slugify(pl || singular), singularSlug: slugify(singular) });
  }
  return { locs: locs.filter((l) => l.active), cats: cats.filter((c) => c.active), catInfo };
}
