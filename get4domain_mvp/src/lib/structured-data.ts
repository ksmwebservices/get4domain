import { siteConfig } from '@/constants/site';

export interface BreadcrumbItem {
  name: string;
  /** Site path, e.g. '/industries'. Use '/' for home. */
  path: string;
}

const abs = (path: string): string => (path === '/' || path === '' ? siteConfig.url : `${siteConfig.url}${path}`);

/** The ONE builder for BreadcrumbList JSON-LD. Home is always the first item. */
export function breadcrumbJsonLd(trail: BreadcrumbItem[]): Record<string, unknown> {
  const items = [{ name: 'Home', path: '/' }, ...trail];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

/**
 * Real social profile URLs for Organization.sameAs, taken from siteConfig.social.
 * Placeholder values ("#", empty, or anything that is not an absolute http(s) URL) are skipped, so an
 * unfilled profile never reaches the structured data.
 */
export function organizationSameAs(): string[] {
  return Object.values(siteConfig.social)
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v !== '' && v !== '#' && /^https?:\/\//i.test(v));
}
