import { ImportTotals } from '../../src/v3-store/core/store-core';
import { ApplyStock, LevelRow, MoveRow, Paging, ProductRow, RefInfo, ReturnRow, SkuTaken, StockInsufficient, StoreStore, VariantRow } from '../../src/v3-store/store.store';
import { ProductFields, VariantFields } from '../../src/v3-store/core/store-core';

const clean = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/**
 * In-memory twin of the store port: same vendor scoping, same SKU uniqueness, same ledger idempotency, and a stock change that checks and writes with no await in between (like one conditional
 * statement). `poolSize` simulates a small connection pool (stop-line 7): at most that many changes are in flight, the rest wait, so the concurrency tests also exercise queueing.
 */
export class MemoryStoreStore extends StoreStore {
  products: ProductRow[] = []; moveRows: Array<MoveRow & { vendorId: string }> = []; levelRows: Array<LevelRow & { vendorId: string }> = []; returns: ReturnRow[] = []; orders = new Set<string>(); private n = 0;
  constructor(private readonly poolSize = 2) { super(); }
  private inFlight = 0; private waiting: Array<() => void> = [];
  private async slot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inFlight >= this.poolSize) await new Promise<void>((r) => this.waiting.push(r));
    this.inFlight++; try { await new Promise((r) => setImmediate(r)); return await fn(); } finally { this.inFlight--; this.waiting.shift()?.(); }
  }
  private skuUsed(vendorId: string, sku: string | null, exceptId?: string): boolean {
    if (!sku) return false;
    return this.products.some((p) => p.vendorId === vendorId && p.id !== exceptId && (p.sku === sku || p.variants.some((v) => v.id !== exceptId && v.sku === sku)));
  }
  private clone(p: ProductRow): ProductRow { return { ...p, variants: p.variants.map((v) => ({ ...v })) }; }
  async addProduct(vendorId: string, f: ProductFields) { if (this.skuUsed(vendorId, f.sku)) throw new SkuTaken(); const p: ProductRow = { ...f, id: `p${++this.n}`, vendorId, archivedAt: null, createdAt: new Date(2026, 10, 12, 0, 0, this.n), updatedAt: new Date(), variants: [] }; this.products.push(p); return this.clone(p); }
  async listProducts(vendorId: string, q: { q?: string; includeArchived: boolean }, p: Paging) {
    const all = this.products.filter((x) => x.vendorId === vendorId && (q.includeArchived || !x.archivedAt) && (!q.q || x.name.toLowerCase().includes(q.q.toLowerCase()))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: all.slice(p.skip, p.skip + p.take).map((r) => this.clone(r)), total: all.length };
  }
  async getProduct(vendorId: string, id: string) { const r = this.products.find((x) => x.id === id && x.vendorId === vendorId); return r ? this.clone(r) : null; }
  async updateProduct(vendorId: string, id: string, patch: Partial<ProductFields> & { archivedAt?: Date | null }) {
    const r = this.products.find((x) => x.id === id && x.vendorId === vendorId); if (!r) return null;
    if (patch.sku !== undefined && this.skuUsed(vendorId, patch.sku, id)) throw new SkuTaken();
    Object.assign(r, clean(patch), { updatedAt: new Date() }); return this.clone(r);
  }
  async addVariant(vendorId: string, productId: string, f: VariantFields) {
    const p = this.products.find((x) => x.id === productId && x.vendorId === vendorId); if (!p) return null; if (this.skuUsed(vendorId, f.sku)) throw new SkuTaken();
    const v: VariantRow = { ...f, id: `v${++this.n}`, vendorId, productId, archivedAt: null, createdAt: new Date(), updatedAt: new Date() }; p.variants.push(v); return { ...v };
  }
  async updateVariant(vendorId: string, id: string, patch: Partial<VariantFields> & { archivedAt?: Date | null }) {
    for (const p of this.products) { if (p.vendorId !== vendorId) continue; const v = p.variants.find((x) => x.id === id); if (v) { if (patch.sku !== undefined && this.skuUsed(vendorId, patch.sku, id)) throw new SkuTaken(); Object.assign(v, clean(patch), { updatedAt: new Date() }); return { ...v }; } }
    return null;
  }
  async resolveRef(vendorId: string, ref: string): Promise<RefInfo | null> {
    for (const p of this.products) {
      if (p.vendorId !== vendorId) continue;
      if (p.id === ref) return { productId: p.id, variantId: null, name: p.name, trackStock: p.trackStock, archived: p.archivedAt !== null, hasVariants: p.variants.length > 0 };
      const v = p.variants.find((x) => x.id === ref); if (v) return { productId: p.id, variantId: v.id, name: `${p.name} ${v.label}`, trackStock: p.trackStock, archived: p.archivedAt !== null || v.archivedAt !== null, hasVariants: true };
    }
    return null;
  }
  async resolveSku(vendorId: string, sku: string) {
    for (const p of this.products) { if (p.vendorId !== vendorId) continue; const v = p.variants.find((x) => x.sku === sku); if (v) return v.id; if (p.sku === sku) return p.variants.length === 0 ? p.id : null; }
    return null;
  }
  async applyStock(vendorId: string, a: ApplyStock) {
    return this.slot(async () => {
      if (a.key && this.moveRows.some((m) => m.vendorId === vendorId && m.key === a.key)) { const l = this.levelRows.find((x) => x.vendorId === vendorId && x.productRef === a.productRef); return { applied: false, onHand: l?.onHand ?? 0, reserved: l?.reserved ?? 0 }; }
      let l = this.levelRows.find((x) => x.vendorId === vendorId && x.productRef === a.productRef);
      if ((l?.onHand ?? 0) + a.delta < 0) throw new StockInsufficient(a.productRef);
      if (!l) { l = { vendorId, productRef: a.productRef, onHand: 0, reserved: 0 }; this.levelRows.push(l); }
      l.onHand += a.delta; this.moveRows.push({ id: `m${++this.n}`, vendorId, productRef: a.productRef, delta: a.delta, reason: a.reason, key: a.key, balanceAfter: l.onHand, note: a.note, at: a.at });
      return { applied: true, onHand: l.onHand, reserved: l.reserved };
    });
  }
  async levels(vendorId: string, refs: readonly string[]) { return this.levelRows.filter((x) => x.vendorId === vendorId && refs.includes(x.productRef)).map(({ productRef, onHand, reserved }) => ({ productRef, onHand, reserved })); }
  async moves(vendorId: string, productRef: string, p: Paging) { const all = this.moveRows.filter((m) => m.vendorId === vendorId && m.productRef === productRef).sort((a, b) => b.at.getTime() - a.at.getTime()); return { items: all.slice(p.skip, p.skip + p.take), total: all.length }; }
  async appliedKeys(vendorId: string, keys: readonly string[]) { return new Set(this.moveRows.filter((m) => m.vendorId === vendorId && m.key && keys.includes(m.key)).map((m) => m.key as string)); }
  async importTotals(vendorId: string): Promise<ImportTotals> { const rows = this.moveRows.filter((m) => m.vendorId === vendorId && m.key?.startsWith('import:')); return { rows: rows.length, quantity: rows.reduce((a, r) => a + r.delta, 0), skus: new Set(rows.map((r) => r.productRef)).size }; }
  async orderExists(vendorId: string, orderId: string) { return this.orders.has(`${vendorId}:${orderId}`); }
  async addReturn(vendorId: string, orderId: string, r: { reason: string; amountPaise: number; note: string | null }) { const row: ReturnRow = { ...r, id: `r${++this.n}`, vendorId, orderId, createdAt: new Date() }; this.returns.push(row); return { ...row }; }
  async listReturns(vendorId: string, orderId: string | undefined, p: Paging) { const all = this.returns.filter((x) => x.vendorId === vendorId && (!orderId || x.orderId === orderId)); return { items: all.slice(p.skip, p.skip + p.take), total: all.length }; }
}
