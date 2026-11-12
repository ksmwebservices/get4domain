import { ImportTotals, MovementReason, ProductFields, VariantFields } from './core/store-core';

export interface VariantRow extends VariantFields { id: string; vendorId: string; productId: string; archivedAt: Date | null; createdAt: Date; updatedAt: Date }
export interface ProductRow extends ProductFields { id: string; vendorId: string; archivedAt: Date | null; createdAt: Date; updatedAt: Date; variants: VariantRow[] }
export interface RefInfo { productId: string; variantId: string | null; name: string; trackStock: boolean; archived: boolean; hasVariants: boolean }
export interface LevelRow { productRef: string; onHand: number; reserved: number }
export interface MoveRow { id: string; productRef: string; delta: number; reason: string; key: string | null; balanceAfter: number; note: string | null; at: Date }
export interface ReturnRow { id: string; vendorId: string; orderId: string; reason: string; amountPaise: number; note: string | null; createdAt: Date }
export interface ApplyStock { productRef: string; delta: number; reason: MovementReason; key: string | null; note: string | null; at: Date }
export interface Paging { skip: number; take: number }

/** Thrown by `applyStock` when a decrease would take the stock below zero. Nothing is written. */
export class StockInsufficient extends Error { constructor(readonly productRef: string) { super('STOCK_INSUFFICIENT'); } }
/** Thrown when a SKU is already used by another product or variant of the business. */
export class SkuTaken extends Error { constructor() { super('SKU_TAKEN'); } }

/**
 * Everything the store stores, behind one port (Prisma implementation and an in-memory twin). Every read and write carries the vendor id in its WHERE. `applyStock` is the only way stock changes:
 * in one transaction it writes the ledger row (a repeated key writes nothing and says `applied: false`) and moves the level with one conditional statement, so the stock can never go below zero
 * however many changes arrive together. The level rows are the Stage 9 ones, so reservations and the ledger always agree.
 */
export abstract class StoreStore {
  abstract addProduct(vendorId: string, p: ProductFields): Promise<ProductRow>;
  abstract listProducts(vendorId: string, q: { q?: string; includeArchived: boolean }, p: Paging): Promise<{ items: ProductRow[]; total: number }>;
  abstract getProduct(vendorId: string, id: string): Promise<ProductRow | null>;
  abstract updateProduct(vendorId: string, id: string, patch: Partial<ProductFields> & { archivedAt?: Date | null }): Promise<ProductRow | null>;
  abstract addVariant(vendorId: string, productId: string, v: VariantFields): Promise<VariantRow | null>;
  abstract updateVariant(vendorId: string, id: string, patch: Partial<VariantFields> & { archivedAt?: Date | null }): Promise<VariantRow | null>;
  /** What a stock reference (a product id, or a variant id) points to in this business. */
  abstract resolveRef(vendorId: string, ref: string): Promise<RefInfo | null>;
  /** The stock reference a SKU stands for: a variant id, or the product id when the product has no variants. Null when unknown or ambiguous. */
  abstract resolveSku(vendorId: string, sku: string): Promise<string | null>;
  abstract applyStock(vendorId: string, a: ApplyStock): Promise<{ applied: boolean; onHand: number; reserved: number }>;
  abstract levels(vendorId: string, refs: readonly string[]): Promise<LevelRow[]>;
  abstract moves(vendorId: string, productRef: string, p: Paging): Promise<{ items: MoveRow[]; total: number }>;
  abstract appliedKeys(vendorId: string, keys: readonly string[]): Promise<Set<string>>;
  /** What the import rows (key starting `import:`) add up to in the ledger: how many, the sum of their changes, and how many different stock references they touch. */
  abstract importTotals(vendorId: string): Promise<ImportTotals>;
  abstract orderExists(vendorId: string, orderId: string): Promise<boolean>;
  abstract addReturn(vendorId: string, orderId: string, r: { reason: string; amountPaise: number; note: string | null }): Promise<ReturnRow>;
  abstract listReturns(vendorId: string, orderId: string | undefined, p: Paging): Promise<{ items: ReturnRow[]; total: number }>;
}
