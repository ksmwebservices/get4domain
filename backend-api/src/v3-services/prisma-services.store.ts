import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { advisoryXactLock } from '../common/db-lock';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { PackItem, ServicePlanRule } from './core/services-core';
import { TaxRateLite } from '../v3-wallet/core/tax-core';
import { WalletStore, WalletTx, walletQueue } from '../v3-wallet/wallet.store';
import {
  DuplicateError, NewPack, NewPrice, NewPurchase, NewService, PackPatch, PackRow, PricePatch, PriceRow, PurchaseRow, ServicePatch, ServiceRow, ServicesStore, ServicesTx,
} from './services.store';

const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const counts = (v: unknown): Record<string, number> => Object.fromEntries(Object.entries(obj(v)).filter(([, n]) => typeof n === 'number')) as Record<string, number>;

const toService = (s: Prisma.V3ServiceGetPayload<Record<string, never>>): ServiceRow => ({
  id: s.id, key: s.key, name: s.name, shortDescription: s.shortDescription, includesText: s.includesText, approvalText: s.approvalText, kind: s.kind, doneBy: s.doneBy, deliveryKind: s.deliveryKind,
  planStateRule: s.planStateRule as ServicePlanRule, trackScope: s.trackScope, publicVisible: s.publicVisible, sortOrder: s.sortOrder, status: s.status, createdAt: s.createdAt, updatedAt: s.updatedAt,
});
type PriceDb = { id: string; amountPaise: number; currency: string; taxCategory: string; taxInclusive: boolean; effectiveFrom: Date | null; status: PriceRow['status']; note: string | null; createdBy: string | null; approvedBy: string | null; approvedAt: Date | null; createdAt: Date; updatedAt: Date };
const toPrice = (p: PriceDb & { serviceId?: string; packId?: string }): PriceRow => ({
  id: p.id, ownerId: (p.serviceId ?? p.packId) as string, amountPaise: p.amountPaise, currency: p.currency, taxCategory: p.taxCategory, taxInclusive: p.taxInclusive, effectiveFrom: p.effectiveFrom, status: p.status, note: p.note,
  createdBy: p.createdBy, approvedBy: p.approvedBy, approvedAt: p.approvedAt, createdAt: p.createdAt, updatedAt: p.updatedAt,
});
const toPack = (p: Prisma.V3AddonPackGetPayload<Record<string, never>>): PackRow => ({ id: p.id, key: p.key, name: p.name, description: p.description, items: (Array.isArray(p.itemsJson) ? p.itemsJson : []) as unknown as PackItem[], validityDays: p.validityDays, status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt });
const toPurchase = (p: Prisma.V3PackPurchaseGetPayload<Record<string, never>>): PurchaseRow => ({
  id: p.id, vendorId: p.vendorId, packId: p.packId, idempotencyKey: p.idempotencyKey, remaining: counts(p.remainingJson), priceSnapshotPaise: p.priceSnapshotPaise, taxSnapshot: obj(p.taxSnapshotJson), purchasedAt: p.purchasedAt, expiresAt: p.expiresAt, ledgerEntryId: p.ledgerEntryId,
});

type Db = Prisma.TransactionClient | PrismaService;
function reads(db: Db) {
  return {
    services: async () => (await db.v3Service.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] })).map(toService),
    serviceByKey: async (key: string) => { const s = await db.v3Service.findUnique({ where: { key } }); return s ? toService(s) : null; },
    servicePrices: async (serviceId: string) => (await db.v3ServicePrice.findMany({ where: { serviceId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })).map(toPrice),
    allServicePrices: async () => (await db.v3ServicePrice.findMany({ where: { status: { in: ['APPROVED', 'PROPOSED'] } } })).map(toPrice),
    getServicePrice: async (id: string) => { const p = await db.v3ServicePrice.findUnique({ where: { id } }); return p ? toPrice(p) : null; },
    packs: async () => (await db.v3AddonPack.findMany({ orderBy: [{ key: 'asc' }] })).map(toPack),
    packByKey: async (key: string) => { const p = await db.v3AddonPack.findUnique({ where: { key } }); return p ? toPack(p) : null; },
    packPrices: async (packId: string) => (await db.v3AddonPackPrice.findMany({ where: { packId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })).map(toPrice),
    allPackPrices: async () => (await db.v3AddonPackPrice.findMany({ where: { status: { in: ['APPROVED', 'PROPOSED'] } } })).map(toPrice),
    getPackPrice: async (id: string) => { const p = await db.v3AddonPackPrice.findUnique({ where: { id } }); return p ? toPrice(p) : null; },
    purchasesFor: async (vendorId: string) => (await db.v3PackPurchase.findMany({ where: { vendorId }, orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }] })).map(toPurchase),
    purchaseByKey: async (vendorId: string, key: string) => { const p = await db.v3PackPurchase.findUnique({ where: { vendorId_idempotencyKey: { vendorId, idempotencyKey: key } } }); return p ? toPurchase(p) : null; },
    taxRates: async (): Promise<TaxRateLite[]> => (await db.v3TaxRate.findMany()).map((t) => ({ name: t.name, ratePercent: Number(t.ratePercent), appliesTo: t.appliesTo, active: t.active, validFrom: t.validFrom })),
  };
}
const priceData = (d: NewPrice) => ({ amountPaise: d.amountPaise, currency: d.currency, taxCategory: d.taxCategory, taxInclusive: d.taxInclusive, effectiveFrom: d.effectiveFrom, note: d.note, createdBy: d.createdBy });

/** The services side of a unit of work on an OPEN transaction client. */
export function prismaServicesTx(db: Prisma.TransactionClient, audits: AuditService): ServicesTx {
  const guard = async <T>(what: DuplicateError['what'], fn: () => Promise<T>): Promise<T> => { try { return await fn(); } catch (e) { if (isUnique(e)) throw new DuplicateError(what); throw e; } };
  return {
    ...reads(db),
    insertService: (d: NewService) => guard('SERVICE_KEY', async () => toService(await db.v3Service.create({ data: { ...d } }))),
    updateService: async (id: string, patch: ServicePatch) => toService(await db.v3Service.update({ where: { id }, data: { ...patch } })),
    insertServicePrice: (d: NewPrice) => guard('PRICE_DATE', async () => toPrice(await db.v3ServicePrice.create({ data: { serviceId: d.ownerId, ...priceData(d) } }))),
    updateServicePrice: (id: string, expected, patch: PricePatch) => guard('PRICE_DATE', async () => (await db.v3ServicePrice.updateMany({ where: { id, status: { in: expected } }, data: { ...patch } })).count === 1),
    insertPack: (d: NewPack) => guard('PACK_KEY', async () => toPack(await db.v3AddonPack.create({ data: { key: d.key, name: d.name, description: d.description, itemsJson: d.items as unknown as Prisma.InputJsonValue, validityDays: d.validityDays, status: d.status } }))),
    updatePack: async (id: string, patch: PackPatch) => { const { items, ...rest } = patch; return toPack(await db.v3AddonPack.update({ where: { id }, data: { ...rest, ...(items ? { itemsJson: items as unknown as Prisma.InputJsonValue } : {}) } })); },
    insertPackPrice: (d: NewPrice) => guard('PRICE_DATE', async () => toPrice(await db.v3AddonPackPrice.create({ data: { packId: d.ownerId, ...priceData(d) } }))),
    updatePackPrice: (id: string, expected, patch: PricePatch) => guard('PRICE_DATE', async () => (await db.v3AddonPackPrice.updateMany({ where: { id, status: { in: expected } }, data: { ...patch } })).count === 1),
    insertPurchase: (d: NewPurchase) => guard('PURCHASE', async () => toPurchase(await db.v3PackPurchase.create({
      data: { vendorId: d.vendorId, packId: d.packId, idempotencyKey: d.idempotencyKey, remainingJson: d.remaining as Prisma.InputJsonValue, priceSnapshotPaise: d.priceSnapshotPaise, taxSnapshotJson: d.taxSnapshot as Prisma.InputJsonValue, purchasedAt: d.purchasedAt, expiresAt: d.expiresAt, ledgerEntryId: d.ledgerEntryId },
    }))),
    updatePurchaseRemaining: async (id: string, expected, next) => {
      const cur = await db.v3PackPurchase.findUnique({ where: { id } });
      if (!cur || JSON.stringify(counts(cur.remainingJson)) !== JSON.stringify(expected)) return false;
      return (await db.v3PackPurchase.updateMany({ where: { id, remainingJson: { equals: cur.remainingJson as Prisma.InputJsonValue } }, data: { remainingJson: next as Prisma.InputJsonValue } })).count === 1;
    },
    audit: (actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown) => audits.record(db, actor, action, 'service', entityId, before, after),
  };
}

const CATALOG_KEY = 'services-catalog';

@Injectable()
export class PrismaServicesStore extends ServicesStore {
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService, private readonly wallets: WalletStore) { super(); }

  /** One staff change to the catalogue at a time: the in-process queue first (memory only), then the transaction under the cross-process lock. */
  unit<T>(fn: (tx: ServicesTx) => Promise<T>): Promise<T> {
    return walletQueue.run(CATALOG_KEY, () => this.prisma.$transaction(async (db) => { await advisoryXactLock(db, CATALOG_KEY); return fn(prismaServicesTx(db, this.audits)); }, { timeout: 30_000, maxWait: 15_000 }));
  }
  /** The wallet's unit of work (queue first, then transaction and lock) with the services side opened on the SAME transaction client. */
  withWallet<T>(vendorId: string, fn: (tx: ServicesTx, wallet: WalletTx) => Promise<T>): Promise<T> {
    return this.wallets.unit(vendorId, (wtx) => fn(prismaServicesTx(wtx.db as Prisma.TransactionClient, this.audits), wtx));
  }
  private r() { return reads(this.prisma); }
  services() { return this.r().services(); }
  serviceByKey(key: string) { return this.r().serviceByKey(key); }
  servicePrices(serviceId: string) { return this.r().servicePrices(serviceId); }
  allServicePrices() { return this.r().allServicePrices(); }
  getServicePrice(id: string) { return this.r().getServicePrice(id); }
  packs() { return this.r().packs(); }
  packByKey(key: string) { return this.r().packByKey(key); }
  packPrices(packId: string) { return this.r().packPrices(packId); }
  allPackPrices() { return this.r().allPackPrices(); }
  getPackPrice(id: string) { return this.r().getPackPrice(id); }
  purchasesFor(vendorId: string) { return this.r().purchasesFor(vendorId); }
  purchaseByKey(vendorId: string, key: string) { return this.r().purchaseByKey(vendorId, key); }
  taxRates() { return this.r().taxRates(); }
}
