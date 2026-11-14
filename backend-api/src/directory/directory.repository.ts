import { RemovalStatus } from './core/removal';

export type BusinessStatus = 'DRAFT' | 'UNCLAIMED' | 'CLAIMED' | 'SUSPENDED' | 'REMOVED';
export type OtpStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'LOCKED' | 'REVOKED';
export type LocationKind = 'STATE' | 'DISTRICT' | 'CITY';

export interface LocationRow { id: string; parentId: string | null; parentKey: string; kind: LocationKind; name: string; slug: string; sortOrder: number; proposed: boolean; active: boolean }
export interface CategoryRow { id: string; parentId: string | null; parentKey: string; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number; proposed: boolean; active: boolean }
export interface Address { line1?: string; line2?: string; pin?: string; city?: string }
export interface BusinessRow {
  id: string; vendorId: string | null; slug: string; name: string; categoryId: string; locationId: string | null; address: Address; phoneE164: string | null; emailMasked: string | null;
  hours: Record<string, unknown>; geo: { lat: number; lng: number } | null; descriptionText: string; status: BusinessStatus; indexable: boolean; source: string;
  claimedAt: Date | null; removedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface ServiceRow { id: string; businessId: string; name: string; description: string; sortOrder: number }
export interface MediaRow { id: string; businessId: string; url: string; kind: string; altText: string; sortOrder: number }
export interface PlacementRow { id: string; businessId: string; kind: 'SPONSORED'; startsAt: Date; endsAt: Date; label: string; createdByStaffId: string | null; revokedAt: Date | null; createdAt: Date }
export interface ChallengeRow {
  id: string; subjectType: string; subjectId: string; channel: 'SMS' | 'EMAIL'; phoneHash: string; codeHash: string; salt: string; attempts: number; maxAttempts: number; expiresAt: Date;
  usedAt: Date | null; requestIpHash: string | null; status: OtpStatus; sandboxBody: string | null; createdAt: Date;
}
export interface RemovalRow {
  id: string; businessId: string; tokenHash: string; status: RemovalStatus; reason: string | null; requesterContactMasked: string | null; confirmedAt: Date | null;
  handledByStaffId: string | null; handledAt: Date | null; executedAt: Date | null; expiresAt: Date; createdAt: Date;
}
export interface OverrideRow { id: string; businessId: string; phoneE164: string; phoneHash: string; reason: string; approvedByStaffId: string; revokedAt: Date | null; createdAt: Date }
export interface GrantRow { id: string; vendorId: string; tokenHash: string; status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED'; expiresAt: Date; usedAt: Date | null; createdAt: Date }

export type NewBusiness = Omit<BusinessRow, 'id' | 'createdAt' | 'updatedAt' | 'claimedAt' | 'removedAt'> & { claimedAt?: Date | null };
export type BusinessPatch = Partial<Omit<BusinessRow, 'id' | 'createdAt' | 'updatedAt'>>;
export interface SearchQuery { tokens: string[]; text: string; categoryIds?: string[]; locationIds?: string[]; skip: number; take: number }
export interface StaffBusinessQuery { status?: BusinessStatus; categoryId?: string; locationId?: string; q?: string; skip: number; take: number }

/** The one port the directory services use. A Prisma implementation and an in-memory twin (tests) implement it. */
export abstract class DirectoryRepository {
  // tree
  abstract listLocations(): Promise<LocationRow[]>;
  abstract getLocation(id: string): Promise<LocationRow | null>;
  abstract createLocation(d: { parentId: string | null; kind: LocationKind; name: string; slug: string; sortOrder: number }): Promise<LocationRow>;
  abstract updateLocation(id: string, p: Partial<Pick<LocationRow, 'name' | 'slug' | 'sortOrder' | 'active' | 'proposed'>>): Promise<LocationRow>;
  abstract listCategories(): Promise<CategoryRow[]>;
  abstract getCategory(id: string): Promise<CategoryRow | null>;
  abstract createCategory(d: { parentId: string | null; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number }): Promise<CategoryRow>;
  abstract updateCategory(id: string, p: Partial<Pick<CategoryRow, 'name' | 'slug' | 'sortOrder' | 'active' | 'proposed' | 'themeCategoryId' | 'family'>>): Promise<CategoryRow>;

  // businesses
  abstract getBusiness(id: string): Promise<BusinessRow | null>;
  abstract getBusinessBySlug(slug: string): Promise<BusinessRow | null>;
  abstract getBusinessByVendor(vendorId: string): Promise<BusinessRow | null>;
  abstract slugTaken(slug: string): Promise<boolean>;
  abstract createBusiness(d: NewBusiness): Promise<BusinessRow>;
  abstract updateBusiness(id: string, p: BusinessPatch): Promise<BusinessRow>;
  abstract getServices(businessId: string): Promise<ServiceRow[]>;
  abstract getMedia(businessId: string): Promise<MediaRow[]>;
  abstract replaceServices(businessId: string, items: Array<{ name: string; description: string }>): Promise<void>;
  abstract replaceMedia(businessId: string, items: Array<{ url: string; altText: string; kind?: string }>): Promise<void>;
  /** public search: only CLAIMED and UNCLAIMED businesses; organic order only (relevance, then name) */
  abstract search(q: SearchQuery): Promise<{ items: BusinessRow[]; total: number }>;
  abstract countPublic(scope: { categoryIds?: string[]; locationIds?: string[] }): Promise<number>;
  abstract sitemapPage(skip: number, take: number): Promise<{ items: Array<{ slug: string; updatedAt: Date }>; total: number }>;
  abstract listForStaff(q: StaffBusinessQuery): Promise<{ items: BusinessRow[]; total: number }>;

  // placements
  abstract createPlacement(d: { businessId: string; startsAt: Date; endsAt: Date; label: string; createdByStaffId: string | null }): Promise<PlacementRow>;
  abstract getPlacement(id: string): Promise<PlacementRow | null>;
  abstract listPlacements(businessId: string): Promise<PlacementRow[]>;
  abstract revokePlacement(id: string, now: Date): Promise<boolean>;
  abstract activePlacements(now: Date, scope: { categoryIds?: string[]; locationIds?: string[] }, limit: number): Promise<Array<{ placement: PlacementRow; business: BusinessRow }>>;

  // OTP
  abstract createChallenge(d: Omit<ChallengeRow, 'id' | 'createdAt' | 'attempts' | 'usedAt' | 'status'>): Promise<ChallengeRow>;
  abstract latestChallenge(subjectType: string, subjectId: string): Promise<ChallengeRow | null>;
  abstract countChallengesSince(by: { phoneHash?: string; ipHash?: string }, since: Date): Promise<number>;
  /** compare-and-set: applies only if the row still has `expectedAttempts` and is PENDING; false means another request got there first */
  abstract applyAttempt(id: string, expectedAttempts: number, next: { attempts: number; status: OtpStatus; usedAt: Date | null }): Promise<boolean>;
  abstract revokePendingChallenges(subjectType: string, subjectId: string): Promise<void>;

  // claim helpers
  abstract latestOverride(businessId: string): Promise<OverrideRow | null>;
  abstract addOverride(d: { businessId: string; phoneE164: string; phoneHash: string; reason: string; approvedByStaffId: string }): Promise<OverrideRow>;
  abstract vendorBasics(vendorId: string): Promise<{ id: string; name: string; phone: string | null; email: string } | null>;
  /** Part B (B7): the vendor owning this login email, if any, and the credentials set after a claim (a null email keeps the one on file). */
  /** Part B (B1): is a version of the vendor's site published now? */
  abstract hasPublishedSite(vendorId: string): Promise<boolean>;
  abstract createGrant(d: { vendorId: string; tokenHash: string; expiresAt: Date }): Promise<GrantRow>;
  abstract findGrantByHash(tokenHash: string): Promise<GrantRow | null>;
  /** marks an ACTIVE, unexpired grant USED; false if another request used it first */
  abstract consumeGrant(id: string, now: Date): Promise<boolean>;

  // removal
  abstract createRemoval(d: { businessId: string; tokenHash: string; reason: string | null; requesterContactMasked: string | null; expiresAt: Date }): Promise<RemovalRow>;
  abstract findRemovalByHash(tokenHash: string): Promise<RemovalRow | null>;
  abstract getRemoval(id: string): Promise<RemovalRow | null>;
  abstract listRemovals(q: { status?: RemovalStatus; skip: number; take: number }): Promise<{ items: RemovalRow[]; total: number }>;
  abstract confirmRemoval(id: string, now: Date): Promise<boolean>;
  /** compare-and-set on the status */
  abstract moveRemoval(id: string, from: RemovalStatus, to: RemovalStatus, patch: { handledByStaffId?: string | null; handledAt?: Date; executedAt?: Date; reason?: string | null }): Promise<boolean>;
  abstract countRecentRemovals(businessId: string, since: Date): Promise<number>;

  // visits (slice 5.7b): counts only, no visitor data
  /** atomic: one statement adds to the day's counters, creating the row on the first visit (safe under any concurrency) */
  abstract incrementVisit(businessId: string, day: string, fromSearch: boolean): Promise<void>;
  abstract visitDays(businessId: string, fromDay: string, toDay: string): Promise<Array<{ day: string; count: number; searchCount: number }>>;
  /** per business totals over a day range (staff report); optional filter by vendor */
  abstract visitTotals(fromDay: string, toDay: string, o: { vendorId?: string; skip: number; take: number }): Promise<{ items: Array<{ businessId: string; slug: string; name: string; count: number; searchCount: number }>; total: number }>;
  abstract createVisitRef(d: { refHash: string; businessId: string; expiresAt: Date }): Promise<void>;
  /** compare-and-set: marks an unexpired, unused reference of THIS business used; false when it is unknown, expired, used or another business reference (all the same answer) */
  abstract consumeVisitRef(refHash: string, businessId: string, now: Date): Promise<boolean>;
  /** the facts the public view needs about the own sites of the businesses, for many vendors at once */
  abstract siteFacts(vendorIds: string[], now: Date): Promise<Map<string, { subdomain: string | null; proActive: boolean }>>;

  /** audit rows are written by the caller through DirectoryAudit; the repository itself writes none */
}
