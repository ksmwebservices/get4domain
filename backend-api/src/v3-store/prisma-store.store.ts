import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { KeyedQueue } from '../common/keyed-queue';
import { PrismaService } from '../prisma/prisma.service';
import { ImportTotals, ProductFields, VariantFields } from './core/store-core';
import { ApplyStock, LevelRow, MoveRow, Paging, ProductRow, RefInfo, ReturnRow, SkuTaken, StockInsufficient, StoreStore, VariantRow } from './store.store';

type DbVariant = Prisma.V3StoreVariantGetPayload<Record<string, never>>;
type DbProduct = Prisma.V3StoreProductGetPayload<{ include: { variants: true } }>;
const variant = (r: DbVariant): VariantRow => ({ id: r.id, vendorId: r.vendorId, productId: r.productId, label: r.label, sku: r.sku, pricePaise: r.pricePaise, archivedAt: r.archivedAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const product = (r: DbProduct): ProductRow => ({ id: r.id, vendorId: r.vendorId, name: r.name, description: r.description, sku: r.sku, hsnSac: r.hsnSac, pricePaise: r.pricePaise, taxRatePercent: r.taxRatePercent === null ? null : Number(r.taxRatePercent), trackStock: r.trackStock, archivedAt: r.archivedAt, createdAt: r.createdAt, updatedAt: r.updatedAt, variants: r.variants.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map(variant) });
const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Stock changes for one product wait here in memory BEFORE a transaction opens (stop-line 7), so a burst never holds pooled connections while waiting. Different products run in parallel. */
const stockQueue = new KeyedQueue();

@Injectable()
export class PrismaStoreStore extends StoreStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  /** A SKU is unique among the products AND the variants of a business; the two unique indexes cover each table, this covers the pair. */
  private async skuUsed(vendorId: string, sku: string | null, exceptId?: string): Promise<boolean> {
    if (!sku) return false;
    const [p, v] = await Promise.all([this.prisma.v3StoreProduct.findFirst({ where: { vendorId, sku, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } }), this.prisma.v3StoreVariant.findFirst({ where: { vendorId, sku, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })]);
    return p !== null || v !== null;
  }

  async addProduct(vendorId: string, p: ProductFields): Promise<ProductRow> {
    if (await this.skuUsed(vendorId, p.sku)) throw new SkuTaken();
    try { return product(await this.prisma.v3StoreProduct.create({ data: { vendorId, ...p }, include: { variants: true } })); } catch (e) { if (isUnique(e)) throw new SkuTaken(); throw e; }
  }
  async listProducts(vendorId: string, q: { q?: string; includeArchived: boolean }, p: Paging): Promise<{ items: ProductRow[]; total: number }> {
    const rest: Prisma.V3StoreProductWhereInput = { ...(q.includeArchived ? {} : { archivedAt: null }), ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3StoreProduct.findMany({ where: { vendorId, ...rest }, include: { variants: true }, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }), this.prisma.v3StoreProduct.count({ where: { vendorId, ...rest } })]);
    return { items: items.map(product), total };
  }
  async getProduct(vendorId: string, id: string): Promise<ProductRow | null> { const r = await this.prisma.v3StoreProduct.findFirst({ where: { id, vendorId }, include: { variants: true } }); return r ? product(r) : null; }
  async updateProduct(vendorId: string, id: string, patch: Partial<ProductFields> & { archivedAt?: Date | null }): Promise<ProductRow | null> {
    if (patch.sku !== undefined && (await this.skuUsed(vendorId, patch.sku, id))) throw new SkuTaken();
    try { const n = await this.prisma.v3StoreProduct.updateMany({ where: { id, vendorId }, data: defined(patch) }); return n.count === 0 ? null : this.getProduct(vendorId, id); } catch (e) { if (isUnique(e)) throw new SkuTaken(); throw e; }
  }
  async addVariant(vendorId: string, productId: string, v: VariantFields): Promise<VariantRow | null> {
    const p = await this.prisma.v3StoreProduct.findFirst({ where: { id: productId, vendorId }, select: { id: true } }); if (!p) return null;
    if (await this.skuUsed(vendorId, v.sku)) throw new SkuTaken();
    try { return variant(await this.prisma.v3StoreVariant.create({ data: { vendorId, productId, ...v } })); } catch (e) { if (isUnique(e)) throw new SkuTaken(); throw e; }
  }
  async updateVariant(vendorId: string, id: string, patch: Partial<VariantFields> & { archivedAt?: Date | null }): Promise<VariantRow | null> {
    if (patch.sku !== undefined && (await this.skuUsed(vendorId, patch.sku, id))) throw new SkuTaken();
    try {
      const n = await this.prisma.v3StoreVariant.updateMany({ where: { id, vendorId }, data: defined(patch) });
      if (n.count === 0) return null;
      const r = await this.prisma.v3StoreVariant.findFirst({ where: { id, vendorId } }); return r ? variant(r) : null;
    } catch (e) { if (isUnique(e)) throw new SkuTaken(); throw e; }
  }

  async resolveRef(vendorId: string, ref: string): Promise<RefInfo | null> {
    const p = await this.prisma.v3StoreProduct.findFirst({ where: { id: ref, vendorId }, select: { id: true, name: true, trackStock: true, archivedAt: true, _count: { select: { variants: true } } } });
    if (p) return { productId: p.id, variantId: null, name: p.name, trackStock: p.trackStock, archived: p.archivedAt !== null, hasVariants: p._count.variants > 0 };
    const v = await this.prisma.v3StoreVariant.findFirst({ where: { id: ref, vendorId }, select: { id: true, label: true, archivedAt: true, product: { select: { id: true, name: true, trackStock: true, archivedAt: true } } } });
    return v ? { productId: v.product.id, variantId: v.id, name: `${v.product.name} ${v.label}`, trackStock: v.product.trackStock, archived: v.product.archivedAt !== null || v.archivedAt !== null, hasVariants: true } : null;
  }
  async resolveSku(vendorId: string, sku: string): Promise<string | null> {
    const v = await this.prisma.v3StoreVariant.findFirst({ where: { vendorId, sku }, select: { id: true } }); if (v) return v.id;
    const p = await this.prisma.v3StoreProduct.findFirst({ where: { vendorId, sku }, select: { id: true, _count: { select: { variants: true } } } });
    return p && p._count.variants === 0 ? p.id : null;
  }

  /**
   * One transaction: make sure the level row exists, move it with ONE conditional statement (a decrease only where on hand is at least the decrease), then write the ledger row with the balance. A repeated
   * key hits the unique index, the whole transaction rolls back, and the answer is `applied: false`. Calls for one product are queued in memory first (stockQueue), so nothing waits inside the transaction.
   */
  applyStock(vendorId: string, a: ApplyStock): Promise<{ applied: boolean; onHand: number; reserved: number }> {
    return stockQueue.run(`${vendorId}:${a.productRef}`, () => this.applyStockNow(vendorId, a));
  }
  private async applyStockNow(vendorId: string, a: ApplyStock): Promise<{ applied: boolean; onHand: number; reserved: number }> {
    const current = async (): Promise<{ onHand: number; reserved: number }> => { const l = await this.prisma.v3StockLevel.findFirst({ where: { vendorId, productRef: a.productRef }, select: { onHand: true, reserved: true } }); return l ?? { onHand: 0, reserved: 0 }; };
    if (a.key && (await this.prisma.v3StoreStockMove.findFirst({ where: { vendorId, key: a.key }, select: { id: true } }))) return { applied: false, ...(await current()) };
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.v3StockLevel.createMany({ data: [{ vendorId, productRef: a.productRef, onHand: 0 }], skipDuplicates: true });
        const n = await tx.v3StockLevel.updateMany({ where: { vendorId, productRef: a.productRef, ...(a.delta < 0 ? { onHand: { gte: -a.delta } } : {}) }, data: { onHand: { increment: a.delta } } });
        if (n.count === 0) throw new StockInsufficient(a.productRef);
        const l = await tx.v3StockLevel.findFirstOrThrow({ where: { vendorId, productRef: a.productRef }, select: { onHand: true, reserved: true } });
        await tx.v3StoreStockMove.create({ data: { vendorId, productRef: a.productRef, delta: a.delta, reason: a.reason, key: a.key, balanceAfter: l.onHand, note: a.note, at: a.at } });
        return { applied: true, onHand: l.onHand, reserved: l.reserved };
      });
    } catch (e) { if (isUnique(e)) return { applied: false, ...(await current()) }; throw e; }
  }
  async levels(vendorId: string, refs: readonly string[]): Promise<LevelRow[]> {
    if (refs.length === 0) return [];
    const rows = await this.prisma.v3StockLevel.findMany({ where: { vendorId, productRef: { in: [...refs] } }, select: { productRef: true, onHand: true, reserved: true } }); return rows;
  }
  async moves(vendorId: string, productRef: string, p: Paging): Promise<{ items: MoveRow[]; total: number }> {
    const [items, total] = await Promise.all([this.prisma.v3StoreStockMove.findMany({ where: { vendorId, productRef }, orderBy: { at: 'desc' }, skip: p.skip, take: p.take }), this.prisma.v3StoreStockMove.count({ where: { vendorId, productRef } })]);
    return { items: items.map((m) => ({ id: m.id, productRef: m.productRef, delta: m.delta, reason: m.reason, key: m.key, balanceAfter: m.balanceAfter, note: m.note, at: m.at })), total };
  }
  async appliedKeys(vendorId: string, keys: readonly string[]): Promise<Set<string>> {
    const out = new Set<string>();
    for (let i = 0; i < keys.length; i += 500) { const rows = await this.prisma.v3StoreStockMove.findMany({ where: { vendorId, key: { in: keys.slice(i, i + 500) as string[] } }, select: { key: true } }); for (const r of rows) if (r.key) out.add(r.key); }
    return out;
  }
  async importTotals(vendorId: string): Promise<ImportTotals> {
    const where = { vendorId, key: { startsWith: 'import:' } };
    const [agg, refs] = await Promise.all([this.prisma.v3StoreStockMove.aggregate({ where, _count: { _all: true }, _sum: { delta: true } }), this.prisma.v3StoreStockMove.groupBy({ by: ['productRef'], where })]);
    return { rows: agg._count._all, quantity: agg._sum.delta ?? 0, skus: refs.length };
  }

  async orderExists(vendorId: string, orderId: string): Promise<boolean> { return (await this.prisma.v3Order.findFirst({ where: { id: orderId, vendorId }, select: { id: true } })) !== null; }
  async addReturn(vendorId: string, orderId: string, r: { reason: string; amountPaise: number; note: string | null }): Promise<ReturnRow> { const x = await this.prisma.v3OrderReturn.create({ data: { vendorId, orderId, ...r } }); return { id: x.id, vendorId: x.vendorId, orderId: x.orderId, reason: x.reason, amountPaise: x.amountPaise, note: x.note, createdAt: x.createdAt }; }
  async listReturns(vendorId: string, orderId: string | undefined, p: Paging): Promise<{ items: ReturnRow[]; total: number }> {
    const rest: Prisma.V3OrderReturnWhereInput = orderId ? { orderId } : {};
    const [items, total] = await Promise.all([this.prisma.v3OrderReturn.findMany({ where: { vendorId, ...rest }, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }), this.prisma.v3OrderReturn.count({ where: { vendorId, ...rest } })]);
    return { items: items.map((x) => ({ id: x.id, vendorId: x.vendorId, orderId: x.orderId, reason: x.reason, amountPaise: x.amountPaise, note: x.note, createdAt: x.createdAt })), total };
  }
}
