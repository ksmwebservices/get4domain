/**
 * Slice 5.25: the per-industry modules of Version 2 are retired for V3 vendors. This is the list of them and the rule that says which route belongs to which. No clock, no database. The data of
 * these modules is never touched; only the routes are hidden, and only for a V3 vendor (see the guard).
 */
export const INDUSTRY_MODULES = [
  'agriculture', 'automobile', 'clinic', 'coaching', 'construction', 'diagnostics', 'education', 'events', 'finance', 'gym', 'hotel',
  'logistics', 'photography', 'professional', 'realestate', 'restaurant', 'retail', 'salon', 'stationery', 'technology', 'travel',
] as const;
export type IndustryModule = (typeof INDUSTRY_MODULES)[number];

/** The entitlement feature that decides whether a vendor keeps a retired module. The plan seed gives it HIDDEN on every plan. */
export const featureKeyOf = (m: IndustryModule): string => `industry.${m}`;

/** The retired module a request path belongs to, by its first path segment only (`/restaurant/orders` and `/travel/contracts/7` yes; `/v3/me/retail`, `/retailer` and `/` no). */
export function retiredModuleOf(requestPath: string): IndustryModule | null {
  const clean = requestPath.split('?')[0];
  if (!clean.startsWith('/') || clean.startsWith('//')) return null;
  const first = clean.slice(1).split('/')[0];
  return (INDUSTRY_MODULES as readonly string[]).includes(first) ? (first as IndustryModule) : null;
}
