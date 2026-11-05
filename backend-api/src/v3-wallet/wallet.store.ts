import { KeyedQueue } from '../common/keyed-queue';
import { Actor } from '../plans/admin/audit.service';
import { LedgerKind, LotStatus, LotUse } from './core/wallet-core';

export type WalletStatus = 'INACTIVE' | 'ACTIVE' | 'FROZEN';
export type TopupStatus = 'CREATED' | 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
export type LotSource = 'TOPUP' | 'ADJUSTMENT';

export interface WalletRow {
  id: string; vendorId: string; status: WalletStatus; balancePaise: number; heldPaise: number; entryCount: number; version: number;
  activatedAt: Date | null; activatedByEventId: string | null; frozenReason: string | null; billingStateCode: string | null; billingGstin: string | null; createdAt: Date; updatedAt: Date;
}
export interface LotRow { id: string; walletId: string; vendorId: string; topupId: string | null; source: LotSource; amountPaise: number; remainingPaise: number; expiresAt: Date; status: LotStatus; createdAt: Date }
export interface LedgerRow {
  id: string; walletId: string; vendorId: string; entryNo: number; kind: LedgerKind; amountPaise: number; balanceDeltaPaise: number; heldDeltaPaise: number; balanceAfterPaise: number; heldAfterPaise: number;
  refType: string | null; refId: string | null; idempotencyKey: string; holdId: string | null; reversesId: string | null; reason: string | null; actorType: string; actorId: string | null; lotUses: LotUse[]; at: Date;
}
export type NewLedger = Omit<LedgerRow, 'id' | 'walletId' | 'vendorId' | 'entryNo' | 'at'>;
export interface TopupRow {
  id: string; vendorId: string; amountPaise: number; currency: string; status: TopupStatus; providerOrderId: string | null; idempotencyKey: string; paymentId: string | null; paidAmountPaise: number | null;
  paidAt: Date | null; ledgerId: string | null; receiptId: string | null; createdByType: string; createdById: string | null; expiresAt: Date; createdAt: Date; updatedAt: Date;
}
export type NewTopup = Pick<TopupRow, 'vendorId' | 'amountPaise' | 'currency' | 'idempotencyKey' | 'expiresAt' | 'createdByType' | 'createdById'>;
export type TopupPatch = Partial<Pick<TopupRow, 'status' | 'providerOrderId' | 'paymentId' | 'paidAmountPaise' | 'paidAt' | 'ledgerId' | 'receiptId'>>;
export interface ReceiptRow { id: string; vendorId: string; topupId: string; receiptNumber: string; financialYear: string; documentType: 'RECEIPT'; issuedAt: Date; snapshot: Record<string, unknown> }

/** Thrown when (vendorId, idempotencyKey) of a top-up already exists: the caller then returns the existing top-up. */
export class DuplicateTopupError extends Error { constructor() { super('duplicate topup'); } }
/** Thrown when another writer changed the wallet between our read and our write (the version no longer matches). Cannot happen under the lock; it is the last guard. */
export class WalletVersionError extends Error { constructor() { super('the wallet changed while it was being updated'); } }

export interface LotChange { id: string; remainingPaise: number; status: LotStatus }
export interface NewLot { id: string; topupId: string | null; source: LotSource; amountPaise: number; remainingPaise: number; expiresAt: Date; createdAt: Date }
export interface Commit { expectedVersion: number; balancePaise: number; heldPaise: number; lotUpdates: LotChange[]; newLot: NewLot | null; entry: NewLedger; at: Date }

/** Everything a wallet change touches, inside ONE unit of work (a database transaction in production). A throw rolls all of it back. */
export interface WalletTx {
  readonly vendorId: string;
  wallet(): Promise<WalletRow | null>;
  /** creates the wallet INACTIVE when there is none; a race with another creator returns the winner's row */
  ensureWallet(): Promise<WalletRow>;
  lots(): Promise<LotRow[]>;
  ledgerByKey(key: string): Promise<LedgerRow | null>;
  ledgerById(id: string): Promise<LedgerRow | null>;
  /** the RELEASE or CHARGE entry that settled this HOLD, if any */
  consumerOfHold(holdId: string): Promise<LedgerRow | null>;
  reversalOf(chargeId: string): Promise<LedgerRow | null>;
  commit(c: Commit): Promise<LedgerRow>;
  /** INACTIVE to ACTIVE, once. Returns true only for the call that changed it. */
  activate(eventId: string, now: Date): Promise<boolean>;
  setFrozen(frozen: boolean, reason: string | null): Promise<WalletRow>;
  setBillingProfile(p: { stateCode: string | null; gstin: string | null }): Promise<void>;

  insertTopup(d: NewTopup): Promise<TopupRow>;
  getTopup(id: string): Promise<TopupRow | null>;
  updateTopupCas(id: string, expected: TopupStatus[], patch: TopupPatch): Promise<boolean>;
  /** next gap-free number of a numbered series for a financial year (the counter row is locked by the unit of work) */
  nextNumber(series: string, financialYear: string): Promise<number>;
  insertReceipt(d: Omit<ReceiptRow, 'id'>): Promise<ReceiptRow>;
  audit(actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}

export interface PaidProEvidence { kind: 'PLAN_ORDER' | 'SUBSCRIPTION'; id: string }
export interface AdminWalletRow extends WalletRow { businessName: string }

/** The one in-process queue every wallet-touching unit of work waits in BEFORE a transaction opens (Batch 2 lesson: never wait for a lock inside a transaction). Shared by the wallet store and plan renewal from the wallet. */
export const walletQueue = new KeyedQueue();
export const walletKey = (vendorId: string): string => `wallet:${vendorId}`;

/** The port. Prisma implementation in production, an in-memory twin in the unit tests. */
export abstract class WalletStore {
  /** one vendor, one unit of work: queued in memory first, then a transaction under the per-vendor lock */
  abstract unit<T>(vendorId: string, fn: (tx: WalletTx) => Promise<T>): Promise<T>;
  abstract wallet(vendorId: string): Promise<WalletRow | null>;
  abstract lots(vendorId: string): Promise<LotRow[]>;
  abstract ledgerPage(vendorId: string, skip: number, take: number): Promise<{ items: LedgerRow[]; total: number }>;
  abstract allLedger(vendorId: string): Promise<LedgerRow[]>;
  abstract topupsPage(vendorId: string, skip: number, take: number): Promise<{ items: TopupRow[]; total: number }>;
  abstract getTopupForVendor(vendorId: string, id: string): Promise<TopupRow | null>;
  abstract findTopupByIdempotency(vendorId: string, key: string): Promise<TopupRow | null>;
  abstract findTopupByProviderOrder(providerOrderId: string): Promise<TopupRow | null>;
  abstract receiptForTopup(vendorId: string, topupId: string): Promise<ReceiptRow | null>;
  abstract adminWallets(q: { status?: WalletStatus; skip: number; take: number }): Promise<{ items: AdminWalletRow[]; total: number }>;
  /** vendors that have a lot past its date with money left (the expiry job's work list) */
  abstract vendorsWithExpiredLots(now: Date, limit: number): Promise<string[]>;
  /** the evidence that this vendor's first Pro term was paid, read from the plan billing tables; null for a vendor that never paid */
  abstract paidProEvidence(vendorId: string): Promise<PaidProEvidence | null>;
  /** marks CREATED / PENDING top-ups past their expiry EXPIRED (a late payment is still credited: see WalletService.settleTopup) */
  abstract expireStaleTopups(now: Date): Promise<number>;
}

/**
 * Hands out the wallet's side of a unit of work that ANOTHER module already opened (plan renewal from the wallet runs inside the plan billing transaction, so the charge, the paid order
 * and the term start commit together). `db` is the open transaction client; the provider takes the wallet lock on it. Optional everywhere: without the wallet module there is no such door.
 */
export abstract class WalletTxProvider {
  abstract forDb(db: unknown, vendorId: string): Promise<WalletTx>;
}
