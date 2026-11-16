/** The shapes the backend sends (docs/v3/PUBLIC_SITE_CONTRACT.md section 2). The pages render these as given and compute nothing of their own. */
export type PageType = 'home' | 'state' | 'city' | 'category' | 'cityCategory' | 'localityCategory' | 'pincodeCategory' | 'business';
export type NoindexReason = 'FLAG_OFF' | 'THIN' | 'EMPTY' | 'NOT_INDEXABLE' | 'UNCLAIMED' | 'SUSPENDED';

export interface Crumb { name: string; path: string; url: string }
export interface Card {
  name: string; slug: string; profilePath: string; locality: string | null; category: string | null; description: string | null;
  claimed: boolean; verified: boolean; hoursText: string | null; imageUrl: string | null;
  /** the API-host click-out address; null when the business has no site on a subdomain */
  visitUrl: string | null; listingOnly: boolean;
}
export interface Link { name: string; path: string; count?: number }
export interface Facet { kind: 'locality' | 'category' | 'city' | 'pincode'; items: Link[] }
export interface Pagination { number: number; totalPages: number; pageSize: number; total: number; prev: string | null; next: string | null; prevPath: string | null; nextPath: string | null }
export interface FaqItem { question: string; answer: string }
export interface BusinessFacts {
  name: string; claimed: boolean; verified: boolean; category: string | null; locality: string | null; city: string | null; description: string | null;
  address: { street?: string; locality?: string; city?: string; pincode?: string } | null; geo: { lat: number; lng: number } | null;
  hoursText: string | null; imageUrl: string | null; visitUrl: string | null; listingOnly: boolean;
}
export interface PageModel {
  type: PageType; path: string; page: Pagination | null;
  meta: { title: string; description: string; canonical: string; robots: string; indexable: boolean; noindexReason: NoindexReason | null; hreflang: Array<{ lang: string; href: string }> };
  h1: string; intro: string; breadcrumbs: Crumb[]; jsonLd: Array<Record<string, unknown>>;
  cards: Card[]; facets: Facet[]; related: { nearbyLocalities: Link[]; relatedCategories: Link[]; parents: Link[] }; faq: FaqItem[];
  business?: BusinessFacts;
}
export interface BacklinkLink { href: string; text: string }
export interface BacklinkBlock { brand: BacklinkLink; links: BacklinkLink[]; html: string }

export type Fetched<T> = { kind: 'ok'; data: T } | { kind: 'notFound' } | { kind: 'gone' } | { kind: 'error'; status: number | null };
