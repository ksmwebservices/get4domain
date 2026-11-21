import { MergeCustomer } from './core/admin-actions-core';

export interface VendorLite { id: string; businessName: string; email: string }
export interface NameHistoryRow { id: string; vendorId: string; oldName: string; newName: string; reason: string; actorId: string | null; createdAt: Date }
export interface PlanChangeRow { id: string; vendorId: string; planKey: string; termMonths: number | null; effectiveAt: Date; reason: string; requestedBy: string | null; status: string; appliedAt: Date | null; error: string | null; createdAt: Date }
export interface NewPlanChange { vendorId: string; planKey: string; termMonths: number | null; effectiveAt: Date; reason: string; requestedBy: string | null; status: 'PENDING' | 'APPLIED'; appliedAt: Date | null }
export interface MergeRow { id: string; keepVendorId: string; mergedVendorId: string; reason: string; actorId: string | null; status: string; moved: { customerIds: string[] }; conflicts: Array<{ id: string; because: string }>; reversibleUntil: Date; reversedAt: Date | null; reversedBy: string | null; reverseReason: string | null; createdAt: Date }
export interface VisitRow { host: string; day: string; count: number }

/** Everything the staff actions store, behind one port. The staff routes name the business they act on; nothing here is reachable from a business's own routes. */
export abstract class AdminActionsStore {
  abstract vendor(id: string): Promise<VendorLite | null>;
  abstract planExists(key: string): Promise<boolean>;
  /** The new name and the history row, together. */
  abstract rename(vendorId: string, oldName: string, newName: string, reason: string, actorId: string | null, at: Date): Promise<void>;
  abstract nameHistory(vendorId: string, skip: number, take: number): Promise<{ items: NameHistoryRow[]; total: number }>;
  /** The payee names on the business's UPI methods, for the name check. */
  abstract payeeNames(vendorId: string): Promise<string[]>;

  abstract createPlanChange(d: NewPlanChange): Promise<PlanChangeRow>;
  abstract listPlanChanges(vendorId: string, skip: number, take: number): Promise<{ items: PlanChangeRow[]; total: number }>;
  abstract getPlanChange(id: string): Promise<PlanChangeRow | null>;
  abstract duePlanChanges(now: Date, limit: number): Promise<PlanChangeRow[]>;
  /** PENDING to APPLYING, once: the one that gets true applies it. */
  abstract claimPlanChange(id: string): Promise<boolean>;
  abstract finishPlanChange(id: string, status: 'APPLIED' | 'FAILED', at: Date, error: string | null): Promise<void>;
  /** PENDING to CANCELLED. False when it is not pending any more. */
  abstract cancelPlanChange(id: string): Promise<boolean>;

  abstract customersOf(vendorId: string): Promise<MergeCustomer[]>;
  /** The moved customers (and their sources) go to the kept business and the merge record is written, in ONE transaction. A unique-key clash rolls everything back. */
  abstract applyMerge(d: { keepVendorId: string; mergedVendorId: string; reason: string; actorId: string | null; customerIds: string[]; conflicts: Array<{ id: string; because: string }>; reversibleUntil: Date }): Promise<MergeRow>;
  abstract getMerge(id: string): Promise<MergeRow | null>;
  abstract listMerges(vendorId: string | null, skip: number, take: number): Promise<{ items: MergeRow[]; total: number }>;
  /** Moves back the customers that are still on the kept business and marks the merge REVERSED, in ONE transaction. Returns how many went back and how many were no longer there. */
  abstract reverseMerge(id: string, actorId: string | null, reason: string, at: Date): Promise<{ restored: number; left: number } | null>;

  abstract addVisits(vendorId: string, rows: ReadonlyArray<VisitRow>): Promise<void>;
  abstract visitsOf(vendorId: string, fromDay: string, toDay: string): Promise<VisitRow[]>;
}
