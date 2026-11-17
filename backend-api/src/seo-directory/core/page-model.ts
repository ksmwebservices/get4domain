import { PublicListingState } from '../../directory/core/listing-state';
import { cutWords, titleCase } from './template-engine';
import { PageSpec, buildPath, withPageNumber } from './url-scheme';
import { isUnsafeSeoText } from '../../site-publish/seo/seo-text';

/**
 * SEO block slice 2: the JSON the Next.js site renders. Types and the pure builders (cards, pagination, breadcrumbs, JSON-LD, FAQ, intro). Nothing here reads a database, a clock or the
 * environment. No price, rating, review count or offer ever appears: only stored facts.
 */
export type NoindexReason = 'FLAG_OFF' | 'THIN' | 'EMPTY' | 'NOT_INDEXABLE' | 'UNCLAIMED' | 'SUSPENDED';
export interface Crumb { name: string; path: string; url: string }
export interface Card {
  name: string; slug: string; profilePath: string; locality: string | null; category: string | null; description: string | null;
  claimed: boolean; verified: boolean; hoursText: string | null; imageUrl: string | null;
  /** the click-out address (section 3); null when the business has no site on a subdomain: the card is then a listing only */
  visitUrl: string | null; listingOnly: boolean;
}
export interface Link { name: string; path: string; count?: number }
export interface Facet { kind: 'locality' | 'category' | 'city' | 'pincode'; items: Link[] }
export interface Pagination { number: number; totalPages: number; pageSize: number; total: number; prev: string | null; next: string | null; prevPath: string | null; nextPath: string | null }
export interface FaqItem { question: string; answer: string }
export interface PageModel {
  type: PageSpec['type']; path: string; page: Pagination | null;
  meta: { title: string; description: string; canonical: string; robots: string; indexable: boolean; noindexReason: NoindexReason | null; hreflang: Array<{ lang: string; href: string }> };
  h1: string; intro: string; breadcrumbs: Crumb[]; jsonLd: Array<Record<string, unknown>>;
  cards: Card[]; facets: Facet[]; related: { nearbyLocalities: Link[]; relatedCategories: Link[]; parents: Link[] }; faq: FaqItem[];
  /** only on a business page */
  business?: BusinessFacts;
}
export interface BusinessFacts { name: string; claimed: boolean; verified: boolean; category: string | null; locality: string | null; city: string | null; description: string | null; address: { street?: string; locality?: string; city?: string; pincode?: string } | null; geo: { lat: number; lng: number } | null; hoursText: string | null; imageUrl: string | null; visitUrl: string | null; listingOnly: boolean;
  /** G4: UNCLAIMED_LISTING, CLAIMED or LIVE (never DRAFT_SITE) */
  listingState: PublicListingState;
  /** G5: the directory business id, the id of the click-out address and of the backlink block */
  businessId: string;
  /** G5: the services a CLAIMED business listed; always empty for an unclaimed listing (its owner has not consented to show them) */
  services: Array<{ name: string; description: string }> }

export const ROBOTS_INDEX = 'index, follow, max-image-preview:large';
export const ROBOTS_NOINDEX = 'noindex, follow';

export function paginate(spec: PageSpec, total: number, pageSize: number, page: number, origin: string): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const at = (n: number): string => buildPath(withPageNumber(spec, n));
  const prevPath = page > 1 ? at(page - 1) : null; const nextPath = page < totalPages ? at(page + 1) : null;
  return { number: page, totalPages, pageSize, total, prev: prevPath ? `${origin}${prevPath}` : null, next: nextPath ? `${origin}${nextPath}` : null, prevPath, nextPath };
}

/** A short plain description for a card: the stored text cut at a word boundary, null when empty or unsafe (a price or a retired product name). */
export function shortDescription(text: string | null | undefined, max = 140): string | null {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || isUnsafeSeoText(t)) return null;
  const cut = cutWords(t, max - 1);
  return t.length <= max ? t : `${cut}…`;
}

export function hoursTextOf(hours: unknown): string | null {
  const t = hours && typeof hours === 'object' && !Array.isArray(hours) ? (hours as Record<string, unknown>).text : null;
  return typeof t === 'string' && t.trim() && !isUnsafeSeoText(t) ? t.trim().slice(0, 200) : null;
}

export function breadcrumbList(crumbs: Crumb[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) };
}

export function publisherOf(origin: string): Record<string, unknown> { return { '@type': 'Organization', name: 'Get4Domain', url: origin }; }

/** CollectionPage with an ItemList of the businesses on this page (names and profile addresses only). */
export function collectionJsonLd(o: { name: string; description: string; url: string; origin: string; /** the main site (where the Get4Domain brand lives); defaults to `origin` when there is no separate directory host */ mainOrigin?: string; cards: Card[]; firstPosition: number }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: o.name, description: o.description, url: o.url, publisher: publisherOf(o.mainOrigin ?? o.origin),
    mainEntity: { '@type': 'ItemList', numberOfItems: o.cards.length, itemListElement: o.cards.map((c, i) => ({ '@type': 'ListItem', position: o.firstPosition + i, name: c.name, url: `${o.origin}${c.profilePath}` })) },
  };
}

/** LocalBusiness for a profile page. Address, position and hours appear only when the owner has claimed the profile (their consent). No telephone, price, rating or review. */
export function localBusinessJsonLd(b: BusinessFacts, url: string, mainOrigin: string): Record<string, unknown> {
  const a = b.address;
  const out: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: b.name, url, ...(b.description ? { description: b.description } : {}), ...(b.imageUrl ? { image: b.imageUrl } : {}),
    ...(a && (a.street || a.locality || a.city || a.pincode) ? { address: { '@type': 'PostalAddress', ...(a.street ? { streetAddress: a.street } : {}), ...(a.locality ? { addressLocality: a.locality } : {}), ...(a.city && a.city !== a.locality ? { addressRegion: a.city } : {}), ...(a.pincode ? { postalCode: a.pincode } : {}), addressCountry: 'IN' } } : {}),
    ...(b.geo ? { geo: { '@type': 'GeoCoordinates', latitude: b.geo.lat, longitude: b.geo.lng } } : {}),
    ...(b.hoursText ? { openingHours: b.hoursText } : {}),
    isPartOf: { '@type': 'WebSite', name: 'Get4Domain', url: mainOrigin },
  };
  return out;
}

/** Unique, stable list: the first N of the items by the order given, dropping any path already used. */
export function takeLinks(items: Link[], max: number, exclude: ReadonlySet<string> = new Set()): Link[] {
  const seen = new Set(exclude); const out: Link[] = [];
  for (const l of items) { if (seen.has(l.path)) continue; seen.add(l.path); out.push(l); if (out.length >= max) break; }
  return out;
}

export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
export const listNames = (names: string[], max = 6): string => { const s = names.slice(0, max); return s.length > 1 ? `${s.slice(0, -1).join(', ')} and ${s[s.length - 1]}` : s[0] ?? ''; };
export { titleCase };

export const CLAIM_ANSWER = 'If you own a business listed here, you can claim the listing by confirming the contact details held for it. Once claimed, you can manage the listing and its website yourself.';
