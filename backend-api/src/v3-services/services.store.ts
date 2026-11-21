import { Inject, Injectable, Optional } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { PackItem, PriceStatus, ServicePlanRule } from './core/services-core';
import { WalletTx } from '../v3-wallet/wallet.store';
import { TaxRateLite } from '../v3-wallet/core/tax-core';

export type CatalogStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';
export type DoneBy = 'VENDOR' | 'TEAM' | 'EITHER';
export type Delivery = 'INSTANT' | 'TEAM_REQUEST';

export interface ServiceRow {
  id: string; key: string; name: string; shortDescription: string; includesText: string; approvalText: string; kind: string; doneBy: DoneBy; deliveryKind: Delivery; planStateRule: ServicePlanRule;
  trackScope: string[]; publicVisible: boolean; sortOrder: number; status: CatalogStatus; createdAt: Date; updatedAt: Date;
}
export type NewService = Omit<ServiceRow, 'id' | 'createdAt' | 'updatedAt'>;
export type ServicePatch = Partial<Omit<ServiceRow, 'id' | 'key' | 'createdAt' | 'updatedAt'>>;

export interface PriceRow {
  id: string; ownerId: string; amountPaise: number; currency: string; taxCategory: string; taxInclusive: boolean; effectiveFrom: Date | null; status: PriceStatus; note: string | null;
  createdBy: string | null; approvedBy: string | null; approvedAt: Date | null; createdAt: Date; updatedAt: Date;
}
/** `ownerId` is the service id (service prices) or the pack id (pack prices): the two price tables have the same shape. */
export type NewPrice = Pick<PriceRow, 'ownerId' | 'amountPaise' | 'currency' | 'taxCategory' | 'taxInclusive' | 'effectiveFrom' | 'note' | 'createdBy'>;
export type PricePatch = Partial<Pick<PriceRow, 'amountPaise' | 'taxCategory' | 'taxInclusive' | 'effectiveFrom' | 'status' | 'note' | 'approvedBy' | 'approvedAt'>>;

export interface PackRow { id: string; key: string; name: string; description: string; items: PackItem[]; validityDays: number | null; status: CatalogStatus; createdAt: Date; updatedAt: Date }
export type NewPack = Omit<PackRow, 'id' | 'createdAt' | 'updatedAt'>;
export type PackPatch = Partial<Omit<PackRow, 'id' | 'key' | 'createdAt' | 'updatedAt'>>;

export interface PurchaseRow {
  id: string; vendorId: string; packId: string; idempotencyKey: string; remaining: Record<string, number>; priceSnapshotPaise: number; taxSnapshot: Record<string, unknown>;
  purchasedAt: Date; expiresAt: Date | null; ledgerEntryId: string;
}
export type NewPurchase = Omit<PurchaseRow, 'id'>;

/** Thrown when a unique rule refused a write (a key already taken, a date already used). The service turns it into a plain 409. */
export class DuplicateError extends Error { constructor(readonly what: 'SERVICE_KEY' | 'PACK_KEY' | 'PRICE_DATE' | 'PURCHASE') { super(`duplicate ${what}`); } }

export interface ServicesReads {
  services(): Promise<ServiceRow[]>;
  serviceByKey(key: string): Promise<ServiceRow | null>;
  servicePrices(serviceId: string): Promise<PriceRow[]>;
  allServicePrices(): Promise<PriceRow[]>;
  getServicePrice(id: string): Promise<PriceRow | null>;
  packs(): Promise<PackRow[]>;
  packByKey(key: string): Promise<PackRow | null>;
  packPrices(packId: string): Promise<PriceRow[]>;
  allPackPrices(): Promise<PriceRow[]>;
  getPackPrice(id: string): Promise<PriceRow | null>;
  purchasesFor(vendorId: string): Promise<PurchaseRow[]>;
  purchaseByKey(vendorId: string, key: string): Promise<PurchaseRow | null>;
  /** the tax-rate rows (g4d_tax_rates); every rate the services use comes from here */
  taxRates(): Promise<TaxRateLite[]>;
}

export interface ServicesTx extends ServicesReads {
  insertService(d: NewService): Promise<ServiceRow>;
  updateService(id: string, patch: ServicePatch): Promise<ServiceRow>;
  insertServicePrice(d: NewPrice): Promise<PriceRow>;
  /** compare-and-set on the status: false when the row is no longer in one of the expected states */
  updateServicePrice(id: string, expected: PriceStatus[], patch: PricePatch): Promise<boolean>;
  insertPack(d: NewPack): Promise<PackRow>;
  updatePack(id: string, patch: PackPatch): Promise<PackRow>;
  insertPackPrice(d: NewPrice): Promise<PriceRow>;
  updatePackPrice(id: string, expected: PriceStatus[], patch: PricePatch): Promise<boolean>;
  insertPurchase(d: NewPurchase): Promise<PurchaseRow>;
  /** the counts of a pack purchase, compare-and-set on the previous counts (service requests use one unit of a pack) */
  updatePurchaseRemaining(id: string, expected: Record<string, number>, next: Record<string, number>): Promise<boolean>;
  audit(actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}

/** The port. Prisma implementation in production, an in-memory twin in the unit tests. */
export abstract class ServicesStore implements ServicesReads {
  /** staff changes to the catalogue and the price book: one at a time (in-process queue first, then the transaction), audited in the same transaction */
  abstract unit<T>(fn: (tx: ServicesTx) => Promise<T>): Promise<T>;
  /** the services side and the wallet side of ONE unit of work for one vendor: a ledger entry and the rows it pays for commit together or not at all */
  abstract withWallet<T>(vendorId: string, fn: (tx: ServicesTx, wallet: WalletTx) => Promise<T>): Promise<T>;
  abstract services(): Promise<ServiceRow[]>;
  abstract serviceByKey(key: string): Promise<ServiceRow | null>;
  abstract servicePrices(serviceId: string): Promise<PriceRow[]>;
  abstract allServicePrices(): Promise<PriceRow[]>;
  abstract getServicePrice(id: string): Promise<PriceRow | null>;
  abstract packs(): Promise<PackRow[]>;
  abstract packByKey(key: string): Promise<PackRow | null>;
  abstract packPrices(packId: string): Promise<PriceRow[]>;
  abstract allPackPrices(): Promise<PriceRow[]>;
  abstract getPackPrice(id: string): Promise<PriceRow | null>;
  abstract purchasesFor(vendorId: string): Promise<PurchaseRow[]>;
  abstract purchaseByKey(vendorId: string, key: string): Promise<PurchaseRow | null>;
  abstract taxRates(): Promise<TaxRateLite[]>;
}

/**
 * How many of a service the vendor has already had from their plan allowance in the current plan term (the implementation finds the term's start itself). The service requests slice (5.16c)
 * provides the real count; until then (and in every test that does not install it) nothing has been used.
 */
export abstract class ServiceUsagePort {
  abstract allowanceUsed(vendorId: string, serviceKey: string): Promise<number>;
}
export class NoServiceUsage extends ServiceUsagePort { async allowanceUsed(): Promise<number> { return 0; } }

/** The token the service requests module (slice 5.16c) provides its real count under. The catalogue asks for it OPTIONALLY, so the two modules never import each other. */
export const SERVICE_REQUESTS_USAGE = 'SERVICE_REQUESTS_USAGE';
@Injectable()
export class DelegatingServiceUsage extends ServiceUsagePort {
  constructor(@Optional() @Inject(SERVICE_REQUESTS_USAGE) private readonly real?: ServiceUsagePort) { super(); }
  allowanceUsed(vendorId: string, serviceKey: string): Promise<number> { return this.real ? this.real.allowanceUsed(vendorId, serviceKey) : Promise.resolve(0); }
}
