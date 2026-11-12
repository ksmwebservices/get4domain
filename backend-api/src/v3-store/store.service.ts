import { Injectable } from '@nestjs/common';
import { TaxRateSource } from '../v3-business/tax-rate-source';
import { checkMovement, checkProduct, checkReturn, checkVariant, checkoutMode, compareImport, ImportTotals, planStockImport } from './core/store-core';
import { storeError } from './store.errors';
import { ProductRow, SkuTaken, StockInsufficient, StoreStore, VariantRow } from './store.store';

/** The payment methods of a business (Stage 9), read only: kind and status are all the checkout decision needs. */
export abstract class MethodSource { abstract methods(vendorId: string): Promise<Array<{ kind: string; status: string }>> }

export interface ProductInput { name?: unknown; description?: unknown; sku?: unknown; hsnSac?: unknown; pricePaise?: unknown; taxRatePercent?: unknown; trackStock?: unknown }
export interface VariantInput { label?: unknown; sku?: unknown; pricePaise?: unknown }
export interface StockInput { delta?: unknown; reason?: unknown; note?: unknown; idempotencyKey?: unknown }

export interface ImportReport {
  mode: 'DRY_RUN' | 'APPLIED'; read: number; rejected: Array<{ index: number; reason: string }>; alreadyApplied: number; toApply: number; applied: number;
  sourceTotals: ImportTotals; databaseTotals: ImportTotals | null; comparison: ReturnType<typeof compareImport> | null;
}

const notFound = (what: string) => storeError(404, 'STORE_NOT_FOUND', `That ${what} was not found.`);
const variantView = (v: VariantRow) => ({ id: v.id, label: v.label, sku: v.sku, pricePaise: v.pricePaise, archived: v.archivedAt !== null });
const productView = (p: ProductRow) => ({ id: p.id, name: p.name, description: p.description, sku: p.sku, hsnSac: p.hsnSac, pricePaise: p.pricePaise, taxRatePercent: p.taxRatePercent, trackStock: p.trackStock, orderable: p.taxRatePercent === null || Number.isInteger(p.taxRatePercent), archived: p.archivedAt !== null, variants: p.variants.map(variantView), createdAt: p.createdAt });

/**
 * The store of an Ecommerce business (slice 5.24c): products and variants with HSN or SAC code and a tax rate from the table, stock that can never go below zero, the checkout decision,
 * returns recorded as facts, and the stock import loader. The plan gate is the route's `@RequiresFeature('store.manage')`. Orders, coupons, shipping and refund records are the Stage 9 routes.
 */
@Injectable()
export class StoreService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: StoreStore, private readonly rates: TaxRateSource, private readonly methods: MethodSource) {}

  // ── products and variants ──
  async createProduct(vendorId: string, i: ProductInput) {
    const c = checkProduct(i, await this.rates.activeRates(this.clock())); if (!c.ok) throw storeError(400, 'STORE_INVALID', c.problems.join('; '));
    try { return productView(await this.store.addProduct(vendorId, c.value)); } catch (e) { throw this.mapSku(e); }
  }
  async listProducts(vendorId: string, q: { q?: string; includeArchived?: boolean }, page: number, pageSize: number) {
    const r = await this.store.listProducts(vendorId, { q: q.q?.slice(0, 80), includeArchived: q.includeArchived === true }, { skip: (page - 1) * pageSize, take: pageSize }); return { items: r.items.map(productView), total: r.total };
  }
  async getProduct(vendorId: string, id: string) { const p = await this.store.getProduct(vendorId, id); if (!p) throw notFound('product'); return productView(p); }
  async updateProduct(vendorId: string, id: string, p: ProductInput) {
    const cur = await this.store.getProduct(vendorId, id); if (!cur) throw notFound('product');
    const c = checkProduct({ name: p.name ?? cur.name, description: p.description === undefined ? cur.description : p.description, sku: p.sku === undefined ? cur.sku : p.sku, hsnSac: p.hsnSac === undefined ? cur.hsnSac : p.hsnSac, pricePaise: p.pricePaise ?? cur.pricePaise, taxRatePercent: p.taxRatePercent === undefined ? cur.taxRatePercent : p.taxRatePercent, trackStock: p.trackStock ?? cur.trackStock }, await this.rates.activeRates(this.clock()));
    if (!c.ok) throw storeError(400, 'STORE_INVALID', c.problems.join('; '));
    try { const row = await this.store.updateProduct(vendorId, id, c.value); if (!row) throw notFound('product'); return productView(row); } catch (e) { throw this.mapSku(e); }
  }
  async archiveProduct(vendorId: string, id: string, archived: boolean) { const row = await this.store.updateProduct(vendorId, id, { archivedAt: archived ? this.clock() : null }); if (!row) throw notFound('product'); return productView(row); }
  async addVariant(vendorId: string, productId: string, i: VariantInput) {
    const c = checkVariant(i); if (!c.ok) throw storeError(400, 'STORE_INVALID', c.problems.join('; '));
    try { const v = await this.store.addVariant(vendorId, productId, c.value); if (!v) throw notFound('product'); return variantView(v); } catch (e) { throw this.mapSku(e); }
  }
  async updateVariant(vendorId: string, id: string, i: VariantInput) {
    const cur = await this.variantOf(vendorId, id);
    const c = checkVariant({ label: i.label ?? cur.label, sku: i.sku === undefined ? cur.sku : i.sku, pricePaise: i.pricePaise === undefined ? cur.pricePaise : i.pricePaise }); if (!c.ok) throw storeError(400, 'STORE_INVALID', c.problems.join('; '));
    try { const v = await this.store.updateVariant(vendorId, id, c.value); if (!v) throw notFound('variant'); return variantView(v); } catch (e) { throw this.mapSku(e); }
  }
  async archiveVariant(vendorId: string, id: string, archived: boolean) { const v = await this.store.updateVariant(vendorId, id, { archivedAt: archived ? this.clock() : null }); if (!v) throw notFound('variant'); return variantView(v); }
  private async variantOf(vendorId: string, id: string): Promise<VariantRow> {
    const ref = await this.store.resolveRef(vendorId, id); const p = ref?.variantId ? await this.store.getProduct(vendorId, ref.productId) : null; const v = p?.variants.find((x) => x.id === id); if (!v) throw notFound('variant'); return v;
  }
  private mapSku(e: unknown): unknown { return e instanceof SkuTaken ? storeError(409, 'STORE_SKU_TAKEN', 'That SKU is already used in your store.') : e; }

  // ── stock ──
  /** The only way stock changes by hand. A decrease below zero is refused and writes nothing, however many arrive together. */
  async adjustStock(vendorId: string, productRef: string, i: StockInput) {
    const c = checkMovement(i); if (!c.ok) throw storeError(400, 'STORE_INVALID', c.problems.join('; '));
    const ref = await this.store.resolveRef(vendorId, productRef); if (!ref) throw notFound('product');
    if (!ref.trackStock) throw storeError(409, 'STORE_NOT_TRACKED', 'This product does not track stock.');
    if (ref.hasVariants && !ref.variantId) throw storeError(400, 'STORE_INVALID', 'Stock of a product with variants is kept per variant.');
    const key = typeof i.idempotencyKey === 'string' && i.idempotencyKey.trim() ? `manual:${i.idempotencyKey.trim().slice(0, 70)}` : null;
    try {
      const r = await this.store.applyStock(vendorId, { productRef, delta: c.value.delta, reason: c.value.reason, key, note: c.value.note, at: this.clock() });
      return { applied: r.applied, onHand: r.onHand, reserved: r.reserved, available: r.onHand - r.reserved };
    } catch (e) { if (e instanceof StockInsufficient) throw storeError(409, 'STORE_STOCK_INSUFFICIENT', 'There is not enough stock for that change.'); throw e; }
  }
  async movements(vendorId: string, productRef: string, page: number, pageSize: number) {
    if (!(await this.store.resolveRef(vendorId, productRef))) throw notFound('product');
    const r = await this.store.moves(vendorId, productRef, { skip: (page - 1) * pageSize, take: pageSize }); return { items: r.items.map((m) => ({ id: m.id, delta: m.delta, reason: m.reason, balanceAfter: m.balanceAfter, note: m.note, at: m.at })), total: r.total };
  }
  /** Each product and variant with what is on hand, what is held for orders, and what is left to sell. A product with variants shows its stock on the variants. */
  async inventory(vendorId: string, page: number, pageSize: number) {
    const r = await this.store.listProducts(vendorId, { includeArchived: false }, { skip: (page - 1) * pageSize, take: pageSize });
    const refs = r.items.flatMap((p) => [p.id, ...p.variants.map((v) => v.id)]); const lv = new Map((await this.store.levels(vendorId, refs)).map((l) => [l.productRef, l]));
    const level = (ref: string) => { const l = lv.get(ref); return l ? { tracked: true, onHand: l.onHand, reserved: l.reserved, available: l.onHand - l.reserved } : { tracked: false, onHand: null, reserved: null, available: null }; };
    return { items: r.items.map((p) => ({ id: p.id, name: p.name, sku: p.sku, trackStock: p.trackStock, ...(p.variants.length ? { tracked: false, onHand: null, reserved: null, available: null } : level(p.id)), variants: p.variants.filter((v) => !v.archivedAt).map((v) => ({ id: v.id, label: v.label, sku: v.sku, ...level(v.id) })) })), total: r.total };
  }

  // ── checkout decision ──
  /** What the business's own shop does at checkout today: online UPI when it has an active UPI method, otherwise an order request it settles itself. */
  async checkout(vendorId: string) { const m = await this.methods.methods(vendorId); return { mode: checkoutMode(m), activeUpi: m.some((x) => x.kind === 'UPI' && x.status === 'ACTIVE') }; }

  // ── returns (recorded facts only) ──
  async recordReturn(vendorId: string, orderId: string, i: { reason?: unknown; amountPaise?: unknown; note?: unknown }) {
    const c = checkReturn(i); if (!c.ok) throw storeError(400, 'STORE_INVALID', c.problems.join('; '));
    if (!(await this.store.orderExists(vendorId, orderId))) throw notFound('order');
    const r = await this.store.addReturn(vendorId, orderId, c.value); return { id: r.id, orderId: r.orderId, reason: r.reason, amountPaise: r.amountPaise, note: r.note, createdAt: r.createdAt };
  }
  async listReturns(vendorId: string, orderId: string | undefined, page: number, pageSize: number) {
    const r = await this.store.listReturns(vendorId, orderId, { skip: (page - 1) * pageSize, take: pageSize }); return { items: r.items.map((x) => ({ id: x.id, orderId: x.orderId, reason: x.reason, amountPaise: x.amountPaise, note: x.note, createdAt: x.createdAt })), total: r.total };
  }

  // ── stock import (Step N Rock readiness; the loader script and the owner route both call this) ──
  /**
   * Legacy stock rows (opening balances and movements) into the ledger. Dry run by default: it reads, resolves the SKUs and reports what it would do. Each row is keyed by its source id, so a second
   * run changes nothing; a row for an unknown SKU, or a movement that would take the stock below zero, is rejected with its reason and the rest go in. After an apply, the counts and totals of the
   * file are compared with what the ledger holds for imported rows.
   */
  async importStock(vendorId: string, raw: unknown, apply: boolean): Promise<ImportReport> {
    const plan = planStockImport(raw); const rejected = [...plan.rejected];
    const resolved: Array<{ row: (typeof plan.accepted)[number]; ref: string }> = [];
    for (const row of plan.accepted) { const ref = await this.store.resolveSku(vendorId, row.sku); if (ref) resolved.push({ row, ref }); else rejected.push({ index: row.index, reason: 'UNKNOWN_SKU' }); }
    const done = await this.store.appliedKeys(vendorId, resolved.map((x) => x.row.key));
    const todo = resolved.filter((x) => !done.has(x.row.key)); let alreadyApplied = resolved.length - todo.length; let applied = 0;
    if (apply) {
      for (const { row, ref } of todo) {
        try { const r = await this.store.applyStock(vendorId, { productRef: ref, delta: row.qty, reason: row.kind === 'OPENING' ? 'OPENING' : 'IMPORT', key: row.key, note: row.note, at: this.clock() }); if (r.applied) applied++; else alreadyApplied++; }
        catch (e) { if (e instanceof StockInsufficient) rejected.push({ index: row.index, reason: 'WOULD_GO_NEGATIVE' }); else throw e; }
      }
    }
    const databaseTotals = apply ? await this.store.importTotals(vendorId) : null;
    return { mode: apply ? 'APPLIED' : 'DRY_RUN', read: Array.isArray(raw) ? raw.length : 0, rejected: rejected.sort((a, b) => a.index - b.index), alreadyApplied, toApply: todo.length, applied, sourceTotals: plan.sourceTotals, databaseTotals, comparison: databaseTotals ? compareImport(plan.sourceTotals, databaseTotals) : null };
  }
}
