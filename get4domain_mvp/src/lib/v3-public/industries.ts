import { PACKS, type Pack } from './packs';

/**
 * The industry landing pages: one per published pack, at /industries/{slug}. Pure data and helpers (no framework import) so every rule can be tested.
 *
 * Health, legal and finance packs stay unpublished until counsel signs off: CLINIC, LAB, PHARMACY and PRACTICE_LEGAL_FINANCE have no public page and are not listed
 * unless V3_REGULATED_PACKS_PUBLIC is exactly "true" (default off). With it off their addresses answer notFound.
 *
 * The slugs are chosen so that none equals an id of the live industry pages (retail, logistics, finance and so on): the live /industries/{id} pages are never shadowed.
 */
type Env = Record<string, string | undefined>;

export const REGULATED_PACKS: ReadonlySet<string> = new Set(['CLINIC', 'LAB', 'PHARMACY', 'PRACTICE_LEGAL_FINANCE']);

/** On only when the value is exactly "true". */
export function regulatedPacksPublic(env: Env = process.env): boolean {
  return (env.V3_REGULATED_PACKS_PUBLIC ?? '').trim().toLowerCase() === 'true';
}

export const PACK_SLUGS: Readonly<Record<string, string>> = {
  PROPERTY: 'property-and-real-estate', CLINIC: 'clinic-and-patient-care', LAB: 'lab-and-diagnostics', PHARMACY: 'pharmacy-and-medical-store', RETAIL: 'retail-and-ecommerce',
  FOOD_SERVICE: 'food-service', FIELD_SERVICE: 'field-services-and-trades', VEHICLE_SERVICE: 'vehicle-services', LOGISTICS: 'logistics-and-freight', MEMBERSHIP_WELLNESS: 'gym-salon-and-wellness',
  EDUCATION: 'education-and-training', PRACTICE_LEGAL_FINANCE: 'legal-and-finance-practice', AGENCY_CONSULTING: 'consulting-and-creative', HOSPITALITY_EVENTS: 'hospitality-travel-and-events',
  RENTAL_FLEET: 'rentals-and-fleet', B2B_DEALER: 'b2b-supplier-and-dealer',
};

/** The kinds of business each pack suits, in plain words (a description, never a claim about customers or results). */
export const PACK_SUITS: Readonly<Record<string, readonly string[]>> = {
  PROPERTY: ['Real estate agents', 'Builders and developers', 'Property managers'],
  CLINIC: ['General clinics', 'Dental clinics', 'Specialist practices'],
  LAB: ['Diagnostic labs', 'Collection centres'],
  PHARMACY: ['Pharmacies', 'Medical stores'],
  RETAIL: ['General stores', 'Specialty shops', 'Online sellers'],
  FOOD_SERVICE: ['Restaurants', 'Cafes', 'Cloud kitchens', 'Caterers'],
  FIELD_SERVICE: ['Plumbers', 'Electricians', 'Repair and installation teams', 'Maintenance contractors'],
  VEHICLE_SERVICE: ['Car workshops', 'Two-wheeler garages', 'Detailing studios'],
  LOGISTICS: ['Transport companies', 'Freight forwarders', 'Courier services'],
  MEMBERSHIP_WELLNESS: ['Gyms', 'Salons', 'Spas', 'Yoga studios'],
  EDUCATION: ['Tuition centres', 'Coaching classes', 'Training institutes'],
  PRACTICE_LEGAL_FINANCE: ['Law practices', 'Accounting practices'],
  AGENCY_CONSULTING: ['Design studios', 'Marketing agencies', 'Independent consultants'],
  HOSPITALITY_EVENTS: ['Travel agencies', 'Hotels and stays', 'Event organisers'],
  RENTAL_FLEET: ['Car rental', 'Equipment rental', 'Fleet operators'],
  B2B_DEALER: ['Machinery dealers', 'Wholesale suppliers', 'Vehicle and equipment dealers'],
};

/** Page title: the pack name and one word (the brand is added when it fits in 60 characters). */
export const industryTitle = (name: string): string => `${name} website`;

const DESCRIPTION = 'What the {name} pack gives your business, the kinds of business it suits, and how to start with a free trial site.';
/** Meta description of a landing page. */
export const industryDescription = (name: string): string => DESCRIPTION.replace('{name}', name);

export interface IndustryPage { pack: Pack; slug: string; suits: readonly string[]; regulated: boolean }

const ALL: readonly IndustryPage[] = PACKS.map((pack) => ({ pack, slug: PACK_SLUGS[pack.key], suits: PACK_SUITS[pack.key] ?? [], regulated: REGULATED_PACKS.has(pack.key) }));

/** The pages that may be shown now: every pack, except the regulated four while V3_REGULATED_PACKS_PUBLIC is off. */
export function publishedIndustries(env: Env = process.env): readonly IndustryPage[] {
  return regulatedPacksPublic(env) ? ALL : ALL.filter((p) => !p.regulated);
}

/** The page of a slug, or null when there is none or it is not published (the page then answers notFound). */
export function industryBySlug(slug: string, env: Env = process.env): IndustryPage | null {
  return publishedIndustries(env).find((p) => p.slug === slug) ?? null;
}

/** Every slug that exists as data, published or not (the host routing sends all of them to the page, which decides). */
export const ALL_INDUSTRY_SLUGS: readonly string[] = ALL.map((p) => p.slug);

/**
 * The ids of the live /industries/{id} pages (the prerendered ones: `industryContent` in data/industry-content.ts). A literal list so the middleware does not bundle the page copy;
 * a unit test compares it with `industryContent`, so a new live industry cannot be missed (it would be a 404 with the flag on).
 */
export const LIVE_INDUSTRY_IDS: ReadonlySet<string> = new Set([
  'restaurant', 'travel', 'clinic', 'education', 'realestate', 'retail', 'salon', 'gym', 'construction', 'professional', 'events', 'finance', 'automobile', 'logistics', 'hotel', 'diagnostics',
  'photography', 'technology', 'agriculture', 'coaching', 'petcare', 'movers', 'astrology', 'pestcontrol', 'interior', 'homeservices', 'rentalservices', 'printing', 'recruitment', 'government',
]);

/** The address of the sitemap that lists the landing pages. */
export const INDUSTRIES_SITEMAP_PATH = '/sitemap-industries.xml';

/**
 * True for `/industries/{id}` (one segment) when `id` is not a live industry page. With the flag on the middleware answers these with a real 404:
 * the live page cannot render an id that was not prerendered once the root layout reads headers() (it answered 500), and a page cannot send a 404 itself (root loading.tsx).
 */
export function isUnknownLiveIndustryPath(pathname: string, liveIds: ReadonlySet<string>): boolean {
  const m = /^\/industries\/([^/]+)\/?$/.exec(pathname);
  if (!m) return false;
  let id = m[1];
  try { id = decodeURIComponent(id); } catch { return true; } // a malformed escape is not a live id
  return !liveIds.has(id) && !liveIds.has(id.toLowerCase());
}
