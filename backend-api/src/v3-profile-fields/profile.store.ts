import { ProfileField, SiteMapRow } from './core/profile-core';

export interface CategoryRef { categoryKey: string; packKey: string }

/** Platform data: the field sets and the map into the site content. No vendor id. A row that exists is never overwritten by a loader. */
export abstract class ProfileFieldStore {
  /** Every field row of every pack and category, active or not. */
  abstract listFields(): Promise<ProfileField[]>;
  abstract listMaps(): Promise<SiteMapRow[]>;
  abstract createFields(rows: ProfileField[]): Promise<void>;
  abstract createMaps(rows: SiteMapRow[]): Promise<void>;
  /** Staff edit: change or add one field (the label, type, switch and order), by its three-part key. */
  abstract upsertField(row: ProfileField, staffId: string | null): Promise<ProfileField>;
  abstract upsertMap(row: SiteMapRow, staffId: string | null): Promise<SiteMapRow>;
  /** The pack of a category (one of the 196), or null for a slug that is not one. */
  abstract categoryByKey(categoryKey: string): Promise<CategoryRef | null>;
  /** The category a business registered under, or null before it registered. */
  abstract categoryOfVendor(vendorId: string): Promise<CategoryRef | null>;
}

/**
 * The business's Offerings (the services a site lists), as the profile fills them. Tenant scoped: every call names the vendor. A service the profile created is kept in sync (description changed, a service no longer named is
 * retired, never deleted); a service the vendor made themselves is never touched. Prices are never written (a service made here has none).
 */
export abstract class OfferingsPort {
  abstract sync(vendorId: string, items: ReadonlyArray<{ name: string; description?: string }>): Promise<{ created: number; updated: number; retired: number }>;
}

/** Tenant data: what a business gave for its profile fields. Every method names the vendor. */
export abstract class ProfileValueStore {
  abstract get(vendorId: string): Promise<Record<string, unknown>>;
  /** Writes the given values and removes the cleared ones, in one transaction. */
  abstract replace(vendorId: string, values: Record<string, unknown>, by: { type: string; id: string | null }): Promise<void>;
  /** The business behind a listing made on behalf, or null when the listing does not exist or was removed. */
  abstract vendorOfListing(seededSiteId: string): Promise<string | null>;
}
