import { ListableCategory } from '../directory/core/listable-categories';

/** What the admin picker shows for one category. `subCategories` are the specialisations of the owner's category sheet (the starter services), e.g. Driving school: "Driving School". */
export interface TreeCategory { key: string; name: string; pack: string; tier: string | null; subCategories: string[]; hasOwnDesign: boolean; source: 'CATALOGUE' | 'KIT' }
export interface TreeFamily { family: string; categories: TreeCategory[] }
export interface CategoryTree { families: TreeFamily[]; total: number; matched: number; query: string }
export interface PackRow { minTier: string; starterServices: string[] }

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The picker tree: family -> category -> sub categories. Pure. `q` matches by name: every word of it must appear in the category name, key, family or one of its sub categories
 * (a word of the family name alone shows the whole family). Order is the catalogue order; the kit-only categories come last. No query = everything.
 */
export function buildCategoryTree(listable: readonly ListableCategory[], packs: ReadonlyMap<string, PackRow>, q = ''): CategoryTree {
  const words = norm(q).split(' ').filter(Boolean);
  const families = new Map<string, TreeCategory[]>();
  let matched = 0;
  for (const c of listable) {
    const p = packs.get(c.key);
    const cat: TreeCategory = { key: c.key, name: c.name, pack: c.pack, tier: p?.minTier ?? null, subCategories: p?.starterServices ?? [], hasOwnDesign: c.hasOwnDesign, source: c.source };
    const own = norm([c.name, c.key, ...cat.subCategories].join(' '));
    const fam = norm(c.family);
    if (words.length && !words.every((w) => own.includes(w) || fam.includes(w))) continue;
    matched++;
    const list = families.get(c.family) ?? [];
    list.push(cat);
    families.set(c.family, list);
  }
  return { families: [...families].map(([family, categories]) => ({ family, categories })), total: listable.length, matched, query: q };
}
