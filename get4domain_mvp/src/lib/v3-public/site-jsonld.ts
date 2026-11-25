import { netAmountPaise, PUBLIC_TERMS, type PublicPlans } from './plans';
import { SITE } from './site-strings';
import { directoryOrigin, mainOrigin } from './site-metadata';
import { getFirm } from './firm';
import { organizationSameAs } from '../structured-data';

const ORG_DESCRIPTION = 'A local business and domain directory, a domain search, and a business web app that puts every business online, makes it visible and captures enquiries.';

/** The @id of the one Organization of the main site: the home page, About and Contact all describe THIS entity, so a crawler merges them instead of seeing three. null when MAIN_HOST is not set. */
export function organizationId(): string | null {
  const origin = mainOrigin();
  return origin ? `${origin}/#organization` : null;
}

/**
 * The Organization facts every page repeats: @id, name "Get4Domain", url, logo, the legal name (the firm), and sameAs from siteConfig.social (real http(s) URLs only: "#" and empty entries
 * are dropped, nothing is invented). Every address-dependent field is written only when MAIN_HOST is set.
 */
function organizationCore(): Record<string, unknown> {
  const origin = mainOrigin();
  const id = organizationId();
  const sameAs = organizationSameAs();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    ...(id ? { '@id': id } : {}),
    name: SITE.brand,
    legalName: getFirm().name,
    alternateName: `${SITE.brand}.com`,
    ...(origin ? { url: `${origin}/`, logo: `${origin}/logo.png` } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** JSON-LD of the commercial pages, as data (serialised and escaped by the JsonLd component). Prices only through offersLd, from the public price route; no ratings, no review markup. */
export function organizationLd(): Record<string, unknown> {
  return { ...organizationCore(), description: ORG_DESCRIPTION };
}

/**
 * The Organization block of the About and Contact pages: the same core as the home page (same @id) plus the firm facts: registered office, and the GSTIN, email or phone only when they are set.
 * The country, state and city are the decided location (Chennai, Tamil Nadu, India). Nothing else is added: no founding date, no rating.
 */
export function firmOrganizationLd(f: { legalName: string; address: string; gstin: string; supportEmail: string; supportPhone: string }): Record<string, unknown> {
  return {
    ...organizationCore(),
    legalName: f.legalName,
    address: { '@type': 'PostalAddress', streetAddress: f.address, addressLocality: 'Chennai', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
    ...(f.gstin ? { taxID: f.gstin } : {}),
    ...(f.supportEmail ? { email: f.supportEmail } : {}),
    ...(f.supportPhone ? { telephone: f.supportPhone } : {}),
  };
}

/** The WebSite block with its search action. The action points at the directory search (the q parameter) and is written only when the directory address is set: nothing is guessed. */
export function webSiteLd(): Record<string, unknown> {
  const origin = mainOrigin();
  const dir = directoryOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    ...(origin ? { '@id': `${origin}/#website` } : {}),
    name: SITE.brand,
    alternateName: `${SITE.brand}.com`,
    ...(organizationId() ? { publisher: { '@id': organizationId() } } : {}),
    description: ORG_DESCRIPTION,
    ...(origin ? { url: `${origin}/` } : {}),
    ...(dir ? { potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${dir}/search?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } } : {}),
  };
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
