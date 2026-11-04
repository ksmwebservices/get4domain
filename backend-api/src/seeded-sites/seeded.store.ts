import { Actor } from '../plans/admin/audit.service';
import { DupKeys, OutreachStatus, SeededLifecycle, SourceKind } from './core/seeded';

export interface SeededRow {
  id: string; vendorId: string; directoryBusinessId: string | null; lifecycle: SeededLifecycle; sourceKind: SourceKind; sourceNote: string | null; publicFactsConfirmed: boolean;
  phoneHash: string; emailHash: string | null; nameKey: string; outreachStatus: OutreachStatus; outreachOwnerStaffId: string | null; lastContactAt: Date | null; nextFollowUpAt: Date | null;
  ownerAgreedToContact: boolean; ownerAgreedAt: Date | null; ownerAgreedBy: string | null; createdByStaffId: string | null; batchId: string | null; removedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export type NewSeededRow = Omit<SeededRow, 'id' | 'createdAt' | 'updatedAt' | 'removedAt'>;
export type SeededPatch = Partial<Pick<SeededRow, 'lifecycle' | 'outreachStatus' | 'outreachOwnerStaffId' | 'lastContactAt' | 'nextFollowUpAt' | 'ownerAgreedToContact' | 'ownerAgreedAt' | 'ownerAgreedBy' | 'removedAt' | 'directoryBusinessId'>>;
export interface SeededListFilter { lifecycle?: SeededLifecycle; outreachStatus?: OutreachStatus; batchId?: string; q?: string; skip: number; take: number }
export interface BatchRow { id: string; createdBy: string | null; fileName: string; rowsTotal: number; rowsCreated: number; rowsRejected: number; mode: 'DRY_RUN' | 'APPLIED'; reportJson: unknown; createdAt: Date }
export interface OutreachLogRow { id: string; seededSiteId: string; kind: 'CALL' | 'NOTE' | 'CLAIM_LINK' | 'REMOVAL'; at: Date; staffId: string | null; outcome: string | null; note: string | null }
export interface RegisterRow { id: string; phoneHash: string; reason: string; source: string; addedBy: string | null; addedAt: Date }

/** Everything slice 5.13a stores, behind one port: a Prisma implementation and an in-memory twin for the unit tests. The register is append-only (no delete or update exists here). */
export abstract class SeededStore {
  abstract create(r: NewSeededRow): Promise<SeededRow>;
  abstract get(id: string): Promise<SeededRow | null>;
  abstract getByVendor(vendorId: string): Promise<SeededRow | null>;
  abstract update(id: string, p: SeededPatch): Promise<SeededRow>;
  abstract list(f: SeededListFilter): Promise<{ items: SeededRow[]; total: number }>;
  /** every existing seeded site (REMOVED ones included: a removed business must not be recreated) that shares a key with one of these */
  abstract findKeyMatches(k: { phoneHashes: string[]; emailHashes: string[]; nameKeys: string[] }): Promise<DupKeys[]>;

  abstract createBatch(b: Omit<BatchRow, 'id' | 'createdAt'>): Promise<BatchRow>;
  abstract updateBatch(id: string, p: Partial<Pick<BatchRow, 'rowsCreated' | 'rowsRejected' | 'reportJson'>>): Promise<void>;
  abstract getBatch(id: string): Promise<BatchRow | null>;

  abstract addLog(l: Omit<OutreachLogRow, 'id' | 'at'>, at: Date): Promise<OutreachLogRow>;
  abstract listLogs(seededSiteId: string): Promise<OutreachLogRow[]>;

  abstract onRegister(phoneHash: string): Promise<boolean>;
  /** idempotent; never overwrites an existing row */
  abstract addToRegister(phoneHash: string, reason: string, source: string, addedBy: string | null): Promise<boolean>;
  abstract listRegister(skip: number, take: number): Promise<{ items: RegisterRow[]; total: number }>;
  abstract registerHashesAmong(phoneHashes: string[]): Promise<Set<string>>;

  abstract recordAudit(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}
