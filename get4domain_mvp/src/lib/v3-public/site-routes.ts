/**
 * The addresses of the marketing pages added in dispatch G3, as data (no framework import: the middleware and the tests read it).
 * Product pages: /product and /product/{slug}. Guides: /guides and /guides/{slug}. Partner programme: /partners.
 * They are served only on the canonical main host with the flag on (see host-routing.ts); the segments are not live routes, so no live page is shadowed.
 */
export const PRODUCT_SLUGS: readonly string[] = ['website', 'search-visibility', 'enquiries', 'directory', 'reports', 'ai-studio', 'domains', 'business-tools'];

export const GUIDE_SLUGS: readonly string[] = [
  'what-a-business-website-needs', 'choosing-your-site-address', 'how-search-engines-find-your-site', 'handling-enquiries-well', 'from-trial-to-paid-plan',
];

/** Fixed addresses that exist as pages of their own. */
export const MARKETING_FIXED_PATHS: readonly string[] = ['/product', '/partners', '/guides'];

export const productPath = (slug: string): string => `/product/${slug}`;
export const guidePath = (slug: string): string => `/guides/${slug}`;

/** The three segments are reserved for the marketing pages (the backend list of reserved directory segments should carry them: gap G45). */
export const MARKETING_SEGMENTS: readonly string[] = ['product', 'partners', 'guides'];

export type MarketingRoute =
  | { kind: 'fixed'; path: string }
  | { kind: 'product'; slug: string }
  | { kind: 'guide'; slug: string }
  | { kind: 'category'; pack: string; id: string };

/** Which marketing page family an address belongs to, or null. A family member with an unknown slug is still reported, so the caller can answer a real 404. */
export function marketingRoute(pathname: string): MarketingRoute | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (MARKETING_FIXED_PATHS.includes(clean)) return { kind: 'fixed', path: clean };
  let m = /^\/product\/([^/]+)$/.exec(clean);
  if (m) return { kind: 'product', slug: m[1] };
  m = /^\/guides\/([^/]+)$/.exec(clean);
  if (m) return { kind: 'guide', slug: m[1] };
  m = /^\/industries\/([^/]+)\/([^/]+)$/.exec(clean);
  if (m) return { kind: 'category', pack: m[1], id: m[2] };
  return null;
}
