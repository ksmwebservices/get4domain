import { SITE } from './site-strings';
import { mainOrigin } from './site-metadata';

/** JSON-LD of the commercial pages, as data (serialised and escaped by the JsonLd component). No price schema, no ratings, no review markup. */
export function organizationLd(): Record<string, unknown> {
  const origin = mainOrigin();
  return { '@context': 'https://schema.org', '@type': 'Organization', name: SITE.brand, ...(origin ? { url: `${origin}/` } : {}) };
}

/**
 * The Organization block of the About and Contact pages, written only from the firm facts: legal name, registered office, and the GSTIN, email or phone only when they are set.
 * The country, state and city are the decided location (Chennai, Tamil Nadu, India). Nothing else is added: no logo, no founding date, no sameAs, no rating.
 */
export function firmOrganizationLd(f: { legalName: string; address: string; gstin: string; supportEmail: string; supportPhone: string }): Record<string, unknown> {
  const origin = mainOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.brand,
    legalName: f.legalName,
    ...(origin ? { url: `${origin}/` } : {}),
    address: { '@type': 'PostalAddress', streetAddress: f.address, addressLocality: 'Chennai', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
    ...(f.gstin ? { taxID: f.gstin } : {}),
    ...(f.supportEmail ? { email: f.supportEmail } : {}),
    ...(f.supportPhone ? { telephone: f.supportPhone } : {}),
  };
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
