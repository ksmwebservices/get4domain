import { netAmountPaise, PUBLIC_TERMS, type PublicPlans } from './plans';
import { SITE } from './site-strings';
import { mainOrigin } from './site-metadata';

/** JSON-LD of the commercial pages, as data (serialised and escaped by the JsonLd component). Prices only through offersLd, from the public price route; no ratings, no review markup. */
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

/**
 * One Product per paid plan with one Offer per billing term, built ONLY from the public price route (net of GST, so valueAddedTaxIncluded is false).
 * A term without a real price gets no Offer; a plan with no Offer at all is left out; with nothing priced the block is null (nothing is written).
 */
export function offersLd(data: PublicPlans, termNames: Record<number, string>): Record<string, unknown> | null {
  const products = data.plans.map((p) => {
    const offers = PUBLIC_TERMS.flatMap((t) => {
      const price = p.prices.find((x) => x.termMonths === t);
      const net = price ? netAmountPaise(price, data.tax) : null;
      if (net === null) return [];
      return [{
        '@type': 'Offer', name: `${p.name}, ${termNames[t] ?? t}`, price: (net / 100).toFixed(2), priceCurrency: 'INR',
        priceSpecification: { '@type': 'PriceSpecification', price: (net / 100).toFixed(2), priceCurrency: 'INR', valueAddedTaxIncluded: false },
      }];
    });
    return offers.length ? { '@type': 'Product', name: p.name, ...(p.description ? { description: p.description } : {}), offers } : null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  if (products.length === 0) return null;
  return { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: products.map((item, i) => ({ '@type': 'ListItem', position: i + 1, item })) };
}
