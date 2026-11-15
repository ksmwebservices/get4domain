import { Detected } from './core/media-upload-core';

export interface MediaRow {
  id: string; vendorId: string | null; scopeKey: string; ownerKind: 'VENDOR_SITE' | 'LISTING_DRAFT'; kind: 'IMAGE' | 'DOCUMENT'; contentType: string; bytes: number; sha256: string; width: number | null; height: number | null;
  key: string; url: string; altText: string | null; status: 'ACTIVE' | 'REMOVED'; uploadedByType: string; uploadedById: string | null; createdAt: Date; removedAt: Date | null;
}
export interface NewMedia { vendorId: string | null; scopeKey: string; ownerKind: MediaRow['ownerKind']; kind: Detected['kind']; contentType: string; bytes: number; sha256: string; width: number | null; height: number | null; key: string; url: string; altText: string | null; uploadedByType: string; uploadedById: string | null }

/** Uploaded files. Every method names the scope (vendor:<id> or draft:<staffId>); one scope never sees another's rows. Removal is soft. */
export abstract class MediaUploadStore {
  abstract findBySha(scopeKey: string, sha256: string): Promise<MediaRow | null>;
  abstract create(row: NewMedia): Promise<MediaRow>;
  /** Brings a removed row back (the same file uploaded again); null when the row is not in this scope. */
  abstract revive(scopeKey: string, id: string, altText: string | null): Promise<MediaRow | null>;
  abstract list(scopeKey: string, skip: number, take: number): Promise<{ items: MediaRow[]; total: number }>;
  abstract get(scopeKey: string, id: string): Promise<MediaRow | null>;
  abstract softRemove(scopeKey: string, id: string, at: Date): Promise<boolean>;
  /** The vendor behind a seeded listing, or null when the listing does not exist or was removed. */
  abstract vendorOfListing(seededSiteId: string): Promise<string | null>;
}
