import { Detected } from './core/media-upload-core';

export interface MediaRow {
  id: string; vendorId: string | null; scopeKey: string; ownerKind: 'VENDOR_SITE' | 'LISTING_DRAFT'; kind: 'IMAGE' | 'DOCUMENT'; contentType: string; bytes: number; sha256: string; width: number | null; height: number | null;
  key: string; url: string; altText: string | null; status: 'ACTIVE' | 'REMOVED'; uploadedByType: string; uploadedById: string | null; createdAt: Date; removedAt: Date | null; groupToken: string | null;
}
export interface NewMedia { vendorId: string | null; scopeKey: string; ownerKind: MediaRow['ownerKind']; kind: Detected['kind']; contentType: string; bytes: number; sha256: string; width: number | null; height: number | null; key: string; url: string; altText: string | null; uploadedByType: string; uploadedById: string | null; groupToken?: string | null }

/** Uploaded files. Every method names the scope (vendor:<id> or draft:<staffId>); one scope never sees another's rows. Removal is soft. */
export abstract class MediaUploadStore {
  abstract findBySha(scopeKey: string, sha256: string): Promise<MediaRow | null>;
  abstract create(row: NewMedia): Promise<MediaRow>;
  /** Brings a removed row back (the same file uploaded again); null when the row is not in this scope. */
  abstract revive(scopeKey: string, id: string, altText: string | null): Promise<MediaRow | null>;
  abstract list(scopeKey: string, skip: number, take: number): Promise<{ items: MediaRow[]; total: number }>;
  abstract get(scopeKey: string, id: string): Promise<MediaRow | null>;
  abstract softRemove(scopeKey: string, id: string, at: Date): Promise<boolean>;
  /** Puts a draft upload under the upload group of this save (the same file uploaded again under a new group follows it). */
  abstract setGroup(scopeKey: string, id: string, groupToken: string): Promise<void>;
  /**
   * Moves the ACTIVE draft uploads of one staff member that carry this group token into a business's library. Only that staff member's own drafts move: the token alone moves nothing. A file the business already has
   * (same content) is not copied: the draft is soft removed and counted as skipped. Idempotent: a second call finds no drafts left and reports what is already there.
   */
  abstract attachDrafts(staffId: string, groupToken: string, vendorId: string, at: Date): Promise<{ attached: MediaRow[]; skipped: MediaRow[]; alreadyAttached: number }>;
  /** The vendor behind a seeded listing, or null when the listing does not exist or was removed. */
  abstract vendorOfListing(seededSiteId: string): Promise<string | null>;
}
