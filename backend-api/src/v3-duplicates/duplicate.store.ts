import { DuplicatePath, Match, NameCandidate } from './core/duplicate-core';

/** A vendor or directory listing a strong signal matched. `attachable` = an UNCLAIMED listing with no vendor yet. */
export interface Hit { vendorId: string | null; businessId: string | null; attachable: boolean }
export interface HostHit { vendorId: string; via: 'WEBSITE' | 'CUSTOM_DOMAIN' }
/** What anybody may see of a listing: the same facts the public directory page shows. */
export interface PublicListing { businessId: string; slug: string; name: string; category: string | null; city: string | null; area: string | null; claimable: boolean }
/** The few facts staff need about a held vendor: what it called itself and its address, never contact details. */
export interface VendorBasics { id: string; businessName: string; subdomain: string | null; industry: string | null; createdAt: Date }
export interface NameQuery { name: string; pincode: string | null; area: string | null; category: string | null; ownerName: string | null; address: string | null; excludeVendorId: string | null }
export interface OverrideRecord { path: DuplicatePath; staffId: string; staffRole: string; reason: string; outcome: 'BLOCKED' | 'POSSIBLE'; matches: Match[]; newVendorId: string | null }
export interface ReviewRow { id: string; path: string; vendorId: string; status: string; matchedVendorId: string | null; matchedBusinessId: string | null; matchedSignals: string[]; score: number | null; decidedByStaffId: string | null; decisionReason: string | null; decidedAt: Date | null; createdAt: Date }

/** What the duplicate check needs from storage. A Prisma implementation and an in-memory twin (tests) implement it. Demo sandboxes (isSandbox with an expiry) never count as existing businesses. */
export abstract class DuplicateStore {
  abstract vendorsByEmail(email: string, excludeVendorId: string | null): Promise<string[]>;
  /** vendors by phone key (and, while a row has no key yet, by its raw phone) and listings by E.164 number */
  abstract byPhone(key: string, e164: string | null, excludeVendorId: string | null): Promise<Hit[]>;
  abstract vendorsByGstin(gstin: string, excludeVendorId: string | null): Promise<string[]>;
  abstract byHosts(hosts: string[], excludeVendorId: string | null): Promise<HostHit[]>;
  /** rows whose NAME is near the given one (pg_trgm; the same rule in the application when the extension is missing), each already judged for location, category, owner and address */
  abstract nameCandidates(q: NameQuery): Promise<NameCandidate[]>;
  /** existing subdomains that may look like the slug (narrowed in the database; the look-alike rule is applied by the caller) */
  abstract subdomainsNear(slug: string): Promise<string[]>;
  abstract publicListings(businessIds: string[], vendorIds: string[]): Promise<PublicListing[]>;
  abstract vendorBasics(vendorIds: string[]): Promise<VendorBasics[]>;
  abstract recordOverride(o: OverrideRecord): Promise<{ id: string }>;
  abstract isHeld(vendorId: string): Promise<boolean>;
  abstract listReviews(status: string | null, skip: number, take: number): Promise<{ items: ReviewRow[]; total: number }>;
  abstract getReview(id: string): Promise<ReviewRow | null>;
  abstract decideReview(id: string, d: { status: 'CLEARED' | 'REJECTED'; staffId: string; reason: string; now: Date }): Promise<boolean>;
}

/** Lets the publish step ask "is this business held for duplicate review?" without importing the duplicate module's internals. */
export abstract class DuplicateHoldPort { abstract isHeld(vendorId: string): Promise<boolean> }
