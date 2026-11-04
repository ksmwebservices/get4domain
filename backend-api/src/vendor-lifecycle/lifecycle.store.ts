import { Actor } from '../plans/admin/audit.service';
import { ListingFacts } from './core/lifecycle-core';

export interface LifecycleVendor { id: string; status: string; businessName: string; phone: string | null; email: string }
export interface LifecycleSubscription { id: string; planKey: string; level: 'FREE' | 'PRO'; track: string; status: string; termMonths: number | null; endsAt: Date | null; graceEndsAt: Date | null }
export type RemovalKind = 'VENDOR_REQUEST' | 'STAFF_EMPTY_LISTING' | 'SEEDED_REMOVAL';
export type DeletionStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED';
export interface DeletionRequestRow { id: string; vendorId: string; status: DeletionStatus; requestedById: string | null; verifiedAt: Date; executedAt: Date | null; executedById: string | null; note: string | null; createdAt: Date }
export interface AuditEntry { actor: Actor; action: string; entityType: string; entityId: string | null; before?: unknown; after?: unknown }

export interface RemovalArgs {
  vendorId: string;
  kind: RemovalKind;
  reason: string;
  /** keyed hash of the phone on file; null when the vendor has none */
  phoneHash: string | null;
  requestedBy: string | null;
  deletionRequestId?: string;
  executedBy: string | null;
  audit: AuditEntry;
}

/**
 * Everything slice 5.1d stores or reads, behind one port: a Prisma implementation and an in-memory twin for the unit tests. The mutating methods write their audit row in the
 * same transaction as the change. Nothing is hard-deleted: a removal adds a row and marks the directory business REMOVED.
 */
export abstract class LifecycleStore {
  abstract vendor(vendorId: string): Promise<LifecycleVendor | null>;
  abstract setVendorStatus(vendorId: string, status: 'ACTIVE' | 'SUSPENDED', audit: AuditEntry): Promise<void>;
  abstract currentSubscription(vendorId: string): Promise<LifecycleSubscription | null>;
  /** the most recent PRO subscription (any state): what "restore Pro" defaults to */
  abstract latestProSubscription(vendorId: string): Promise<LifecycleSubscription | null>;
  abstract setGraceEnd(subscriptionId: string, graceEndsAt: Date, audit: AuditEntry): Promise<void>;
  abstract listingFacts(vendorId: string): Promise<ListingFacts>;
  abstract isRemoved(vendorId: string): Promise<boolean>;
  /** the clear audit row for an action whose change was made by another service (plan assignment) */
  abstract recordAudit(audit: AuditEntry): Promise<void>;

  abstract pendingDeletion(vendorId: string): Promise<DeletionRequestRow | null>;
  abstract createDeletion(d: { vendorId: string; requestedById: string | null; verifiedAt: Date; audit: AuditEntry }): Promise<DeletionRequestRow>;
  abstract getDeletion(id: string): Promise<DeletionRequestRow | null>;
  abstract listDeletions(f: { status?: DeletionStatus; skip: number; take: number }): Promise<{ items: DeletionRequestRow[]; total: number }>;

  /** Idempotent: removing an already removed business changes nothing and returns alreadyRemoved. One transaction: removal row, register row, directory business REMOVED, request EXECUTED, audit. */
  abstract executeRemoval(a: RemovalArgs): Promise<{ alreadyRemoved: boolean }>;
}
