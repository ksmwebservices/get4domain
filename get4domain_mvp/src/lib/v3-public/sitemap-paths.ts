import { categoryPath, publishedCategories } from './catalogue';
import { LEGAL_PAGE_PATHS } from './legal-paths';
import { publishedIndustries } from './industries';
import { GUIDE_SLUGS, guidePath, MARKETING_FIXED_PATHS, PRODUCT_SLUGS, productPath } from './site-routes';

type Env = Record<string, string | undefined>;

export interface SitemapEntry { path: string; changefreq: 'monthly' | 'yearly'; priority: string }

/**
 * Every page the flag-on sitemap (/sitemap-industries.xml, main host only) lists, in order: the industry pages, their category pages, the marketing pages (product, partners, guides), the policy pages.
 * The live sitemap.xml is not touched: it already lists the pages that have a live twin, and these are new addresses.
 */
export function siteSitemapEntries(env: Env = process.env): SitemapEntry[] {
  const industries = publishedIndustries(env).map((p): SitemapEntry => ({ path: `/industries/${p.slug}`, changefreq: 'monthly', priority: '0.85' }));
  const categories = publishedCategories(env).map(({ category }): SitemapEntry => ({ path: categoryPath(category), changefreq: 'monthly', priority: '0.7' }));
  const marketing: SitemapEntry[] = [
    ...MARKETING_FIXED_PATHS.map((path): SitemapEntry => ({ path, changefreq: 'monthly', priority: '0.8' })),
    ...PRODUCT_SLUGS.map((s): SitemapEntry => ({ path: productPath(s), changefreq: 'monthly', priority: '0.75' })),
    ...GUIDE_SLUGS.map((s): SitemapEntry => ({ path: guidePath(s), changefreq: 'monthly', priority: '0.6' })),
  ];
  const legal = LEGAL_PAGE_PATHS.map((path): SitemapEntry => ({ path, changefreq: 'yearly', priority: '0.4' }));
  return [...industries, ...categories, ...marketing, ...legal];
}
