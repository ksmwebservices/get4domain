import { Actor } from '../plans/admin/audit.service';

export type ThemeStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type ThemeVisibility = 'PUBLIC' | 'PRIVATE';
export const THEME_STATUSES: readonly ThemeStatus[] = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];

/** A theme row without its bytes (what lists and details carry). */
export interface ThemeRow {
  id: string; key: string; version: number; name: string; description: string | null; tier: string; status: ThemeStatus; visibility: ThemeVisibility;
  privateVendorId: string | null; sourceVendorId: string | null; starter: boolean; licence: string;
  tracks: string[]; packs: string[]; addons: string[]; capabilities: string[]; tags: string[]; catalogueCategories: string[]; kitCategories: string[];
  manifest: unknown; contentHash: string; sizeBytes: number; fileCount: number;
  consentObtained: boolean | null; consentNote: string | null; consentAt: Date | null; consentById: string | null; reviewNote: string | null;
  createdByType: string; createdById: string | null; createdAt: Date; updatedAt: Date; submittedAt: Date | null; publishedAt: Date | null; publishedById: string | null; archivedAt: Date | null;
}
export interface ThemeRowWithBytes extends ThemeRow { bytes: Buffer }
export type NewTheme = Omit<ThemeRow, 'id' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'publishedAt' | 'publishedById' | 'archivedAt' | 'consentAt' | 'consentById' | 'reviewNote'> & { bytes: Buffer };
export interface AuditSpec { actor: Actor; action: string; before: unknown; after: unknown }
export interface ThemeFilter { status?: ThemeStatus; visibility?: ThemeVisibility; pack?: string; addon?: string; capability?: string; tag?: string; category?: string; tier?: string; key?: string; privateVendorId?: string; q?: string; starter?: boolean }
export type ThemePatch = Partial<Pick<ThemeRow, 'status' | 'visibility' | 'privateVendorId' | 'reviewNote' | 'consentObtained' | 'consentNote' | 'consentAt' | 'consentById' | 'submittedAt' | 'publishedAt' | 'publishedById' | 'archivedAt'>>;

/**
 * Where theme packages are kept. A change and its audit row are saved together or not at all (the store takes the audit spec). Rows are never deleted.
 * The Prisma adapter is the real one; an in-memory one serves the unit tests.
 */
export abstract class ThemeMarketStore {
  /** null when (key, version) already exists */
  abstract create(row: NewTheme, audit: AuditSpec): Promise<ThemeRow | null>;
  abstract find(id: string): Promise<ThemeRow | null>;
  abstract findWithBytes(id: string): Promise<ThemeRowWithBytes | null>;
  abstract findByKeyVersion(key: string, version: number): Promise<ThemeRow | null>;
  abstract maxVersion(key: string): Promise<number>;
  abstract list(filter: ThemeFilter, skip: number, take: number): Promise<{ items: ThemeRow[]; total: number }>;
  /** moves a row only while its status is one of `from`; null when it is not (a concurrent change) */
  abstract transition(id: string, from: readonly ThemeStatus[], patch: ThemePatch, audit: AuditSpec, alsoArchiveOlderPublishedOfKey?: { key: string; below: number }): Promise<ThemeRow | null>;
  /** every row a vendor site may need to draw (PUBLISHED and ARCHIVED), with its bytes, for the runtime loader (M3) */
  abstract loadServable(): Promise<ThemeRowWithBytes[]>;
  /** the metadata (no bytes) of every PUBLISHED and ARCHIVED row, newest version of a key first: what the marketplace listing is built from */
  abstract servableMeta(): Promise<ThemeRow[]>;
  abstract vendorExists(vendorId: string): Promise<boolean>;
  /** the facts of the business a private theme is for, used to refuse a package that carries them (M4) */
  abstract vendorFacts(vendorId: string): Promise<{ name: string; email: string | null; phone: string | null; subdomain: string | null; customDomain: string | null; mediaHashes: string[] } | null>;
}
