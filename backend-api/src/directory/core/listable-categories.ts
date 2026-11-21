import { CATALOGUE_CATEGORIES } from './catalogue-categories';

/**
 * Which categories a seeded listing can be made in (Wave 2 job K1). Pure: no database, no clock.
 *
 * WHY ONLY 37 PASSED. The seeded-site category check asked the theme kit (`kit.hasCategory`) and the kit has 41 categories, of which 37 are in the 196 of the catalogue sheet. The directory category tree
 * was loaded from the kit as well, so it had the same 41. The catalogue is the list of what a business can be; the kit is only the list of site designs. They are now separate:
 *   - LISTABLE = every catalogue category (196) plus every kit category (the four the sheet does not name: auto-mechanic, tutor, salon-spa, gym-yoga, which already worked and keep working).
 *   - A listing's SITE is still built from a kit category. A category the kit has is used as it is; any other uses the kit category of its pack (PACK_KIT_FALLBACK), so the page has the right
 *     kind of call to action (book, order, enquire) until a design of its own exists. The directory category row keeps the catalogue id as its slug, so the listing shows its real category.
 */
export const KIT_ONLY_PACK: Readonly<Record<string, string>> = { 'auto-mechanic': 'VEHICLE_SERVICE', tutor: 'EDUCATION', 'salon-spa': 'MEMBERSHIP_WELLNESS', 'gym-yoga': 'MEMBERSHIP_WELLNESS' };

/** The kit category whose page suits a pack, for catalogue categories the kit has no design for. Each value is a kit category (a test checks it against the built kit). */
export const PACK_KIT_FALLBACK: Readonly<Record<string, string>> = {
  PROPERTY: 'real-estate-agent', CLINIC: 'doctor-clinic', LAB: 'diagnostics-lab', PHARMACY: 'grocery-kirana', RETAIL: 'electronics-mobile', FOOD_SERVICE: 'restaurant-cafe',
  FIELD_SERVICE: 'plumber', VEHICLE_SERVICE: 'auto-mechanic', LOGISTICS: 'packers-movers', MEMBERSHIP_WELLNESS: 'salon-spa', EDUCATION: 'coaching-centre',
  PRACTICE_LEGAL_FINANCE: 'ca-tax-consultant', AGENCY_CONSULTING: 'it-consultant', HOSPITALITY_EVENTS: 'hotel-homestay', RENTAL_FLEET: 'travel-agency', B2B_DEALER: 'it-consultant',
};

const BY_ID: ReadonlyMap<string, (typeof CATALOGUE_CATEGORIES)[number]> = new Map(CATALOGUE_CATEGORIES.map((c) => [c.id, c]));
export const catalogueCategory = (id: string): (typeof CATALOGUE_CATEGORIES)[number] | null => BY_ID.get(id) ?? null;

/** Is this key a category a seeded listing may be made in? `kitHas` says whether the theme kit has a design with that id. */
export const isListableCategory = (id: unknown, kitHas: (id: string) => boolean): boolean => typeof id === 'string' && id !== '' && (BY_ID.has(id) || kitHas(id));

/** The kit category the site of a listing in this category is built from: the category itself when the kit has it, else the kit category of its pack; null for a key nobody knows. */
export function kitCategoryFor(id: string, kitHas: (id: string) => boolean): string | null {
  if (kitHas(id)) return id;
  const pack = BY_ID.get(id)?.pack;
  const fb = pack ? PACK_KIT_FALLBACK[pack] : undefined;
  return fb && kitHas(fb) ? fb : null;
}

export interface KitCategoryInfo { id: string; label: string; family: string }
export interface ListableCategory { key: string; name: string; family: string; pack: string; source: 'CATALOGUE' | 'KIT'; kitCategory: string | null; hasOwnDesign: boolean }

/** Every listable category with its pack and family, for the admin form: the 196 of the catalogue in the sheet's order, then the kit categories the sheet does not name. */
export function listableCategories(kit: readonly KitCategoryInfo[]): ListableCategory[] {
  const has = new Set(kit.map((k) => k.id)); const kitHas = (id: string): boolean => has.has(id);
  const out: ListableCategory[] = CATALOGUE_CATEGORIES.map((c) => ({ key: c.id, name: c.name, family: c.family, pack: c.pack, source: 'CATALOGUE' as const, kitCategory: kitCategoryFor(c.id, kitHas), hasOwnDesign: kitHas(c.id) }));
  for (const k of kit) if (!BY_ID.has(k.id)) out.push({ key: k.id, name: k.label, family: k.family, pack: KIT_ONLY_PACK[k.id] ?? '', source: 'KIT', kitCategory: k.id, hasOwnDesign: true });
  return out;
}

/** A family name as a directory slug: "Hardware, building and auto parts" -> "hardware-building-and-auto-parts". */
export const familySlug = (name: string): string => String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
