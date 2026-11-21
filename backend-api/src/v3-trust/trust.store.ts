import { BlockKind, ProofKind, ProofStatus, ReportStatus, ReportSubject } from './core/trust-core';

export interface Paged<T> { items: T[]; total: number }

export interface ProofRow {
  id: string; vendorId: string; kind: ProofKind; number: string; documentRef: string | null; status: ProofStatus; checkedBy: string | null; checkedAt: Date | null; note: string | null; createdAt: Date; updatedAt: Date;
}
export interface BlockRow { id: string; kind: BlockKind; valueHash: string; reason: string; createdByStaffId: string | null; at: Date }
export interface ReportRow {
  id: string; subjectType: ReportSubject; subject: string; reporterContact: string | null; reason: string; status: ReportStatus; ipHash: string | null; handledByStaffId: string | null; note: string | null; createdAt: Date; updatedAt: Date;
}
export interface TermRow { id: string; term: string; category: string; enabled: boolean; editedBy: string | null; createdAt: Date; updatedAt: Date }
export interface TakedownRow {
  id: string; vendorId: string | null; listingId: string | null; reason: string; documentRef: string | null; decidedBy: string; at: Date; status: 'ACTIVE' | 'REVERSED';
  priorListingStatus: string | null; priorIndexable: boolean | null; reversedBy: string | null; reversedAt: Date | null; reverseReason: string | null;
}
export type CreateTakedownResult = { ok: true; row: TakedownRow } | { ok: false; why: 'TARGET_UNKNOWN' | 'ALREADY_ACTIVE' };

/**
 * The only way the trust tables are read or written. Every vendor read carries the vendor id in the WHERE. A takedown is created and reversed in ONE unit together with the change to the listing
 * (the directory row goes to REMOVED and back), so a takedown can never exist without its effect or the other way round.
 */
export abstract class TrustStore {
  // proofs
  abstract upsertProof(vendorId: string, d: { kind: ProofKind; number: string; documentRef: string | null }): Promise<ProofRow>;
  abstract proofsOfVendor(vendorId: string): Promise<ProofRow[]>;
  abstract listProofs(f: { status?: ProofStatus; vendorId?: string }, skip: number, take: number): Promise<Paged<ProofRow>>;
  abstract getProof(id: string): Promise<ProofRow | null>;
  /** compare-and-set on the status the reviewer read */
  abstract reviewProof(id: string, expected: ProofStatus, patch: { status: ProofStatus; checkedBy: string; note: string | null; checkedAt: Date }): Promise<ProofRow | null>;

  // trust block list
  abstract createBlock(d: { kind: BlockKind; valueHash: string; reason: string; staffId: string | null }): Promise<BlockRow | null>;
  abstract listBlocks(f: { kind?: BlockKind }, skip: number, take: number): Promise<Paged<BlockRow>>;
  abstract deleteBlock(id: string): Promise<BlockRow | null>;
  abstract findBlock(kind: BlockKind, valueHash: string): Promise<BlockRow | null>;

  // reports
  abstract createReport(d: { subjectType: ReportSubject; subject: string; reporterContact: string | null; reason: string; ipHash: string | null }): Promise<ReportRow>;
  abstract listReports(f: { status?: ReportStatus }, skip: number, take: number): Promise<Paged<ReportRow>>;
  abstract getReport(id: string): Promise<ReportRow | null>;
  abstract updateReport(id: string, expected: ReportStatus, patch: { status?: ReportStatus; note?: string | null; handledByStaffId: string | null }): Promise<ReportRow | null>;

  // prohibited terms
  abstract listTerms(): Promise<TermRow[]>;
  abstract createTerm(d: { term: string; category: string; enabled: boolean; editedBy: string | null }): Promise<TermRow | null>;
  abstract updateTerm(id: string, patch: { term?: string; category?: string; enabled?: boolean; editedBy: string | null }): Promise<TermRow | null | 'DUPLICATE'>;
  abstract deleteTerm(id: string): Promise<TermRow | null>;

  // takedowns
  abstract createTakedown(d: { vendorId: string | null; listingId: string | null; reason: string; documentRef: string | null; decidedBy: string; now: Date }): Promise<CreateTakedownResult>;
  abstract reverseTakedown(id: string, d: { reversedBy: string; reverseReason: string; now: Date }): Promise<TakedownRow | null>;
  abstract getTakedown(id: string): Promise<TakedownRow | null>;
  abstract listTakedowns(f: { status?: 'ACTIVE' | 'REVERSED'; vendorId?: string }, skip: number, take: number): Promise<Paged<TakedownRow>>;
  /** the ACTIVE takedown of a vendor, if any (read fresh on every public request: a takedown must never wait for a timer) */
  abstract activeTakedownOfVendor(vendorId: string): Promise<TakedownRow | null>;
  /** the names a payee is compared with: the business name and the owner name of a vendor */
  abstract namesOfVendor(vendorId: string): Promise<string[]>;
}
