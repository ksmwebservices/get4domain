import { categoriesOfPack, categoryPath } from '@/lib/v3-public/catalogue';
import { publishedIndustries } from '@/lib/v3-public/industries';

export interface NavCategory { id: string; name: string; path: string }
export interface NavPack { key: string; slug: string; name: string; path: string; categories: NavCategory[] }

/** The business areas that are published (the regulated four only when the owner has switched them on) with their categories, for the mega menu and the home grid. Real catalogue data. */
export function navPacks(env: Record<string, string | undefined> = process.env): NavPack[] {
  return publishedIndustries(env).map((i) => ({
    key: i.pack.key, slug: i.slug, name: i.pack.name, path: `/industries/${i.slug}`,
    categories: categoriesOfPack(i.pack.key).map((c) => ({ id: c.id, name: c.name, path: categoryPath(c) })),
  }));
}
