/** The lifecycle state of a site that came from the seeded-sites list (slice 5.13a). A site that was never seeded has none (null). */
export type SeededLifecycle = 'SEEDED' | 'INVITED' | 'CLAIMED_FREE' | 'PRO' | 'REMOVED';

/**
 * What the site build needs to know about seeding, as a port so site-publish does not depend on the seeded-sites tables (the same shape as VendorHosts).
 * `quality` is the pure seededSiteQuality() result for the site: true = every mandatory public field is there, a source is recorded and the business is not on the register.
 */
export abstract class SiteLifecycle {
  abstract lifecycleOf(vendorId: string): Promise<SeededLifecycle | null>;
  abstract qualityOk(vendorId: string): Promise<boolean>;
}
