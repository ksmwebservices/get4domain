import { MissingField } from '../site.errors';

export type MotionLevel = 'OFF' | 'LOW' | 'MEDIUM' | 'RICH';
export type PublicationStatus = 'DRAFT_PREVIEW' | 'PUBLISHED' | 'SUPERSEDED' | 'ROLLED_BACK';
export type ActorKind = 'STAFF' | 'VENDOR' | 'SYSTEM';

export interface SiteSettingsRow { vendorId: string; themeId: string | null; language: string; variant: string | null; motionIntensity: MotionLevel; forceNoindex: boolean; updatedAt: Date }
export interface PublicationRow {
  id: string; vendorId: string; version: number; status: PublicationStatus; themeId: string; themeHash: string; contentHash: string; settingsHash: string;
  indexable: boolean; indexHeader: string; missingFieldsJson: MissingField[]; warningsJson: string[]; languages: string; totalBytes: number;
  rolledBackFromVersion: number | null; createdByType: ActorKind; createdById: string | null; createdAt: Date; publishedAt: Date | null; currentVendorId: string | null;
}
export interface PageRow { publicationId: string; vendorId: string; path: string; lang: string; html: string; seoJson: Record<string, unknown>; bytes: number; sha256: string }
export interface NewPublication {
  vendorId: string; themeId: string; themeHash: string; contentHash: string; settingsHash: string; indexable: boolean; indexHeader: string;
  missingFieldsJson: MissingField[]; warningsJson: string[]; languages: string; totalBytes: number; createdByType: ActorKind; createdById: string | null;
}
export type NewPage = Omit<PageRow, 'publicationId' | 'vendorId'>;
export interface SiteEventInput { type: 'BUILT' | 'PUBLISHED' | 'ROLLED_BACK' | 'THEME_CHANGED' | 'NOINDEX_CHANGED'; actorType: ActorKind; actorId: string | null; detail: Record<string, unknown> }
/** Runs inside the repository's transaction so the audit row and the change are saved together or not at all (Prisma passes its transaction client). */
export type TxHook = (tx: unknown) => Promise<void>;

export interface PublishOptions { now: Date; validate: (p: PublicationRow) => Promise<void>; event: SiteEventInput; audit?: TxHook }
export interface RollbackOptions { now: Date; validate: (source: PublicationRow) => Promise<void>; actor: { type: ActorKind; id: string | null }; event: (newVersion: number) => SiteEventInput; audit?: TxHook }

/**
 * Everything the site slice stores. Two implementations: Prisma, and an in-memory twin for the unit tests that keeps the rules that matter (one lock per
 * vendor, one PUBLISHED per vendor, monotonic versions). publish and rollback run under a per-vendor advisory lock in one transaction.
 */
export abstract class SiteRepository {
  abstract getSettings(vendorId: string): Promise<SiteSettingsRow | null>;
  abstract upsertSettings(vendorId: string, patch: Partial<Pick<SiteSettingsRow, 'themeId' | 'language' | 'variant' | 'motionIntensity' | 'forceNoindex'>>): Promise<SiteSettingsRow>;
  abstract newestPublication(vendorId: string): Promise<PublicationRow | null>;
  abstract currentPublication(vendorId: string): Promise<PublicationRow | null>;
  abstract getPublication(id: string): Promise<PublicationRow | null>;
  abstract listPublications(vendorId: string, take: number): Promise<PublicationRow[]>;
  abstract pagesOf(publicationId: string): Promise<PageRow[]>;
  abstract getPage(publicationId: string, path: string, lang: string): Promise<PageRow | null>;
  /** Creates the next version (under the build lock) with its pages, one event and the audit hook. */
  abstract createPublication(data: NewPublication, pages: NewPage[], event: SiteEventInput, audit?: TxHook): Promise<PublicationRow>;
  /** PUBLICATION_NOT_FOUND for an unknown id or another vendor's; an already PUBLISHED one is returned unchanged. */
  abstract publish(vendorId: string, publicationId: string, o: PublishOptions): Promise<PublicationRow>;
  /** Copies an older, once-published snapshot into a new PUBLISHED version. PUBLICATION_NOT_FOUND when that version was never published. */
  abstract rollback(vendorId: string, toVersion: number, o: RollbackOptions): Promise<PublicationRow>;
  abstract recordEvent(vendorId: string, publicationId: string | null, event: SiteEventInput, audit?: TxHook): Promise<void>;
  abstract listSites(filter: { skip: number; take: number }): Promise<{ items: Array<{ vendorId: string; businessName: string; settings: SiteSettingsRow | null; current: PublicationRow | null; newest: PublicationRow | null }>; total: number }>;
}
