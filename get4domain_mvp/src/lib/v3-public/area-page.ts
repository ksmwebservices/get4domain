import type { PageModel, PageType } from './types';

/**
 * The category-in-area pages of the directory ("plumbers in Vadapalani"): a category in a city, a locality or a postal area, and a whole category.
 * Titles, descriptions, canonical and robots come from the backend page model as given (nothing is computed here, so indexing stays under the existing flags).
 * What this module adds is only what the model may leave out: an item list of the local businesses on the page, and the rules for the empty state and the claim or list block.
 */
export const AREA_TYPES: readonly PageType[] = ['cityCategory', 'localityCategory', 'pincodeCategory'];

export const isAreaPage = (m: Pick<PageModel, 'type'>): boolean => AREA_TYPES.includes(m.type);

/** A page that lists businesses and can carry an item list (the area pages and the whole-category and city pages). */
export const isListingPage = (m: Pick<PageModel, 'type'>): boolean => isAreaPage(m) || m.type === 'category' || m.type === 'city';

/**
 * An ItemList of LocalBusiness entries for the businesses on the page, or null when there are none or the model already carries an ItemList of its own.
 * Only facts the card has: name, the business page address, the locality. No phone, e-mail, rating, review or price.
 */
export function localBusinessListLd(m: PageModel): Record<string, unknown> | null {
  if (!isListingPage(m) || m.cards.length === 0) return null;
  if (m.jsonLd.some((x) => (x as { '@type'?: string })['@type'] === 'ItemList')) return null;
  const abs = (p: string): string => { try { return new URL(p, m.meta.canonical).toString(); } catch { return p; } };
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: m.h1,
    numberOfItems: m.cards.length,
    itemListElement: m.cards.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: c.name,
        url: abs(c.profilePath),
        ...(c.locality ? { address: { '@type': 'PostalAddress', addressLocality: c.locality, addressCountry: 'IN' } } : {}),
      },
    })),
  };
}

/** The honest empty state shows whenever an area page has no business, even when it has links to other areas. */
export const showEmptyState = (m: PageModel): boolean => m.cards.length === 0 && (isAreaPage(m) || !m.facets.some((f) => f.items.length > 0));

/** The block that invites an owner to list or claim shows on every area page, with businesses or without. */
export const showListOrClaim = (m: Pick<PageModel, 'type'>): boolean => isAreaPage(m);

/** The intro when the model carries none: plain words from the heading, never a claim. */
export const introFallback = (m: Pick<PageModel, 'h1' | 'intro'>): string => (m.intro.trim() ? m.intro : `${m.h1}: the businesses listed in the Get4Domain directory for this category and area.`);
