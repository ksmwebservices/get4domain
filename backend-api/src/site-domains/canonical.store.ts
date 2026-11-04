import { Actor } from '../plans/admin/audit.service';

export interface CanonicalSwitchRecord { vendorId: string; from: string | null; to: string; reason: 'ADDON_STARTED' | 'ADDON_ENDED' | 'DOMAIN_CHANGED' | 'BASELINE'; actor: Actor }

/**
 * What the controlled canonical switch (slice 5.6b) stores: the canonical host the published pages were last built for, one site event per switch (before and after) and an audit
 * row, in ONE transaction; plus the lookups the add-on routes and the tick need. A Prisma implementation and an in-memory twin (tests).
 */
export abstract class CanonicalStore {
  abstract storedCanonical(vendorId: string): Promise<string | null>;
  /** Moves the stored canonical host and writes the site event and the audit row together (or none). Never touches the pages. */
  abstract recordSwitch(r: CanonicalSwitchRecord): Promise<void>;
  /** The first time a vendor is seen on the default (subdomain) address: remember it, with no event. */
  abstract recordBaseline(vendorId: string, host: string): Promise<void>;
  /** Vendors whose published pages were built for a canonical host (the tick re-checks these; an ended add-on moves them back). */
  abstract vendorsWithStoredCanonical(limit: number): Promise<string[]>;
  /** Unexpired ACTIVE add-on override rows of a vendor. */
  abstract activeAddonOverrideIds(vendorId: string, now: Date): Promise<string[]>;
}

/** Rebuilds and republishes a vendor's site (new canonical tags and sitemap). Bound lazily to the site build and publish services; absent = the switch only records. */
export abstract class SiteRebuild {
  abstract rebuildAndPublish(vendorId: string, actor: Actor): Promise<void>;
}
