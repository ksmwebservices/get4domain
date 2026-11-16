import { SITE } from './site-strings';
import { mainOrigin } from './site-metadata';

/** JSON-LD of the commercial pages, as data (serialised and escaped by the JsonLd component). No price schema, no ratings, no review markup. */
export function organizationLd(): Record<string, unknown> {
  const origin = mainOrigin();
  return { '@context': 'https://schema.org', '@type': 'Organization', name: SITE.brand, ...(origin ? { url: `${origin}/` } : {}) };
}

export function webSiteLd(): Record<string, unknown> {
  const origin = mainOrigin();
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.brand, ...(origin ? { url: `${origin}/` } : {}) };
}

export function faqLd(items: ReadonlyArray<{ q: string; a: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
}

export function breadcrumbLd(items: ReadonlyArray<{ name: string; path: string }>): Record<string, unknown> | null {
  const origin = mainOrigin();
  if (!origin) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${origin}${c.path === '/' ? '/' : c.path}` })),
  };
}
