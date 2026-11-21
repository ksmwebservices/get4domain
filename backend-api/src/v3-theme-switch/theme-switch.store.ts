import { Actor } from '../plans/admin/audit.service';
import { ServicesTx } from '../v3-services/services.store';
import { WalletTx } from '../v3-wallet/wallet.store';
import { PriorSwitch, SwitchKind, SwitchStatus } from './core/theme-switch-core';

export interface SwitchRow {
  id: string; vendorId: string; siteId: string | null; fromThemeKey: string | null; toThemeKey: string; kind: SwitchKind; performedByType: 'VENDOR' | 'STAFF' | 'SYSTEM'; performedById: string | null;
  serviceRequestId: string | null; ledgerEntryId: string | null; packPurchaseId: string | null; priceSnapshotPaise: number | null; taxSnapshot: Record<string, unknown>; publicationId: string | null;
  status: SwitchStatus; idempotencyKey: string; reason: string | null; failureReason: string | null; hiddenFields: string[]; createdAt: Date; updatedAt: Date;
}
export type NewSwitch = Omit<SwitchRow, 'createdAt' | 'updatedAt' | 'publicationId' | 'failureReason'>;
export type SwitchPatch = Partial<Pick<SwitchRow, 'status' | 'publicationId' | 'failureReason'>>;
export class DuplicateSwitchError extends Error { constructor() { super('duplicate theme switch'); } }

/** The theme switch side of ONE unit of work for one vendor. It shares the transaction with the services and wallet rows: a charge and the row that records it commit together or not at all. */
export interface SwitchTx {
  insert(d: NewSwitch): Promise<SwitchRow>;
  findByKey(key: string): Promise<SwitchRow | null>;
  get(id: string): Promise<SwitchRow | null>;
  /** compare-and-set on the status */
  updateCas(id: string, expected: SwitchStatus[], patch: SwitchPatch): Promise<boolean>;
  /** every earlier switch of this vendor (kind and status only): what the fee decision looks at */
  priors(): Promise<PriorSwitch[]>;
  /** the vendor's service request that carries the fee, when the vendor asked our team: must be theirs, a THEME_SWITCH request, still open */
  requestCarriesFee(requestId: string, toThemeKey: string): Promise<boolean>;
  audit(actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}

export abstract class ThemeSwitchStore {
  abstract unit<T>(vendorId: string, fn: (t: SwitchTx, s: ServicesTx, w: WalletTx) => Promise<T>): Promise<T>;
  abstract findByKey(vendorId: string, key: string): Promise<SwitchRow | null>;
  abstract priors(vendorId: string): Promise<PriorSwitch[]>;
  abstract listForVendor(vendorId: string, skip: number, take: number): Promise<{ items: SwitchRow[]; total: number }>;
  /** switches stuck in PENDING since before `before` (a crash between the charge and the publish) */
  abstract stalePending(before: Date, limit: number): Promise<SwitchRow[]>;
}
