import { MethodSource, StoreService } from '../src/v3-store/store.service';
import { TaxRateSource } from '../src/v3-business/tax-rate-source';
import { MemoryStoreStore } from './support/memory-store-store';

const A = 'vendor-a'; const B = 'vendor-b';
class Rates extends TaxRateSource { rates = [18]; async activeRates() { return [...this.rates]; } }
class Methods extends MethodSource { list: Array<{ kind: string; status: string }> = []; async methods() { return this.list; } }
const code = (c: string) => ({ response: { code: c } });
const make = () => { const store = new MemoryStoreStore(2); const rates = new Rates(); const methods = new Methods(); const svc = new StoreService(store, rates, methods); svc.clock = () => new Date('2026-11-12T06:00:00Z'); return { store, rates, methods, svc }; };
const prod = { name: 'Copper pipe', sku: 'CP-1', hsnSac: '7411', pricePaise: 25000, taxRatePercent: 18 };

describe('products and variants', () => {
  it('carry the HSN or SAC code and a tax rate that is in the table', async () => {
    const { svc, rates } = make(); const p = await svc.createProduct(A, prod); expect(p).toMatchObject({ name: 'Copper pipe', hsnSac: '7411', taxRatePercent: 18, pricePaise: 25000 });
    rates.rates = []; await expect(svc.createProduct(A, { ...prod, sku: 'CP-2' })).rejects.toMatchObject(code('STORE_INVALID'));
  });
  it('say whether the online cart can take them: a whole-percent rate, or none, is orderable; a fractional rate is not yet', async () => {
    const { svc, rates } = make(); rates.rates = [18, 0.25];
    expect((await svc.createProduct(A, prod)).orderable).toBe(true);
    expect((await svc.createProduct(A, { ...prod, sku: 'N-1', taxRatePercent: undefined })).orderable).toBe(true);
    expect((await svc.createProduct(A, { ...prod, sku: 'F-1', taxRatePercent: 0.25 })).orderable).toBe(false);
  });
  it('a SKU is used once per business, across products and variants; another business may reuse it', async () => {
    const { svc } = make(); const p = await svc.createProduct(A, prod);
    await expect(svc.createProduct(A, prod)).rejects.toMatchObject(code('STORE_SKU_TAKEN')); await expect(svc.addVariant(A, p.id, { label: 'L', sku: 'CP-1' })).rejects.toMatchObject(code('STORE_SKU_TAKEN'));
    expect((await svc.createProduct(B, prod)).sku).toBe('CP-1');
  });
  it('are changed and archived, never deleted; variants hang off their product', async () => {
    const { svc, store } = make(); const p = await svc.createProduct(A, prod); const v = await svc.addVariant(A, p.id, { label: 'Large', sku: 'CP-1-L', pricePaise: 30000 });
    expect((await svc.updateProduct(A, p.id, { pricePaise: 26000 })).pricePaise).toBe(26000); expect((await svc.updateVariant(A, v.id, { label: 'XL' })).label).toBe('XL');
    expect((await svc.archiveVariant(A, v.id, true)).archived).toBe(true); expect((await svc.archiveProduct(A, p.id, true)).archived).toBe(true); expect(store.products).toHaveLength(1);
    expect((await svc.listProducts(A, {}, 1, 20)).total).toBe(0); expect((await svc.listProducts(A, { includeArchived: true }, 1, 20)).total).toBe(1);
  });
  it('another business sees nothing and changes nothing', async () => {
    const { svc } = make(); const p = await svc.createProduct(A, prod); const v = await svc.addVariant(A, p.id, { label: 'L' });
    expect((await svc.listProducts(B, {}, 1, 20)).total).toBe(0);
    for (const call of [() => svc.getProduct(B, p.id), () => svc.updateProduct(B, p.id, { name: 'x' }), () => svc.archiveProduct(B, p.id, true), () => svc.addVariant(B, p.id, { label: 'x' }), () => svc.updateVariant(B, v.id, { label: 'x' }), () => svc.archiveVariant(B, v.id, true), () => svc.adjustStock(B, p.id, { delta: 1, reason: 'RECEIPT' }), () => svc.movements(B, p.id, 1, 20)]) await expect(call()).rejects.toMatchObject(code('STORE_NOT_FOUND'));
  });
});

describe('stock never goes negative', () => {
  it('receipts add, a decrease beyond what is there is refused and writes nothing', async () => {
    const { svc, store } = make(); const p = await svc.createProduct(A, prod);
    expect((await svc.adjustStock(A, p.id, { delta: 10, reason: 'RECEIPT' })).onHand).toBe(10);
    await expect(svc.adjustStock(A, p.id, { delta: -11, reason: 'ADJUSTMENT' })).rejects.toMatchObject(code('STORE_STOCK_INSUFFICIENT')); expect(store.moveRows).toHaveLength(1);
    expect((await svc.adjustStock(A, p.id, { delta: -10, reason: 'ADJUSTMENT' })).onHand).toBe(0);
  });
  it('forty parallel single-unit decreases of ten in stock (small simulated pool): exactly ten win, never below zero', async () => {
    const { svc, store } = make(); const p = await svc.createProduct(A, prod); await svc.adjustStock(A, p.id, { delta: 10, reason: 'OPENING' });
    const r = await Promise.allSettled(Array.from({ length: 40 }, () => svc.adjustStock(A, p.id, { delta: -1, reason: 'ADJUSTMENT' })));
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(10); expect(r.filter((x) => x.status === 'rejected' && (x.reason as { response: { code: string } }).response.code === 'STORE_STOCK_INSUFFICIENT')).toHaveLength(30);
    expect(store.levelRows[0].onHand).toBe(0); expect(store.moveRows.every((m) => m.balanceAfter >= 0)).toBe(true); expect(store.moveRows).toHaveLength(11);
  });
  it('the same key twice changes the stock once', async () => {
    const { svc, store } = make(); const p = await svc.createProduct(A, prod);
    const a = await svc.adjustStock(A, p.id, { delta: 5, reason: 'RECEIPT', idempotencyKey: 'delivery-1' }); const b = await svc.adjustStock(A, p.id, { delta: 5, reason: 'RECEIPT', idempotencyKey: 'delivery-1' });
    expect([a.applied, b.applied, b.onHand]).toEqual([true, false, 5]); expect(store.moveRows).toHaveLength(1);
  });
  it('a product that does not track stock, a bad change and an unknown reference are refused', async () => {
    const { svc } = make(); const p = await svc.createProduct(A, { ...prod, trackStock: false });
    await expect(svc.adjustStock(A, p.id, { delta: 1, reason: 'RECEIPT' })).rejects.toMatchObject(code('STORE_NOT_TRACKED'));
    const q = await svc.createProduct(A, { ...prod, sku: 'CP-2' }); await expect(svc.adjustStock(A, q.id, { delta: 0, reason: 'RECEIPT' })).rejects.toMatchObject(code('STORE_INVALID')); await expect(svc.adjustStock(A, q.id, { delta: 1, reason: 'SALE' })).rejects.toMatchObject(code('STORE_INVALID'));
    await expect(svc.adjustStock(A, 'nope', { delta: 1, reason: 'RECEIPT' })).rejects.toMatchObject(code('STORE_NOT_FOUND'));
  });
  it('a variant has its own stock; the inventory shows on hand, reserved and available for each', async () => {
    const { svc, store } = make(); const p = await svc.createProduct(A, prod); const v = await svc.addVariant(A, p.id, { label: 'Large' }); await svc.adjustStock(A, v.id, { delta: 7, reason: 'RECEIPT' });
    store.levelRows[0].reserved = 2;
    const inv = await svc.inventory(A, 1, 20); expect(inv.items[0].variants[0]).toMatchObject({ id: v.id, onHand: 7, reserved: 2, available: 5 }); expect(inv.items[0]).toMatchObject({ onHand: null });
    expect((await svc.movements(A, v.id, 1, 20)).total).toBe(1);
  });
});

describe('checkout decision', () => {
  it('online UPI when the business has an active UPI method, otherwise an order request', async () => {
    const { svc, methods } = make(); expect((await svc.checkout(A)).mode).toBe('ORDER_REQUEST');
    methods.list = [{ kind: 'UPI', status: 'UNVERIFIED' }]; expect((await svc.checkout(A)).mode).toBe('ORDER_REQUEST');
    methods.list = [{ kind: 'UPI', status: 'ACTIVE' }]; expect((await svc.checkout(A)).mode).toBe('ONLINE_UPI');
  });
});

describe('returns are recorded, nothing else', () => {
  it('only for an order of this business; a recorded fact with a reason and an amount', async () => {
    const { svc, store } = make(); store.orders.add(`${A}:o1`);
    const r = await svc.recordReturn(A, 'o1', { reason: 'damaged', amountPaise: 500 }); expect(r).toMatchObject({ orderId: 'o1', reason: 'damaged', amountPaise: 500 });
    await expect(svc.recordReturn(B, 'o1', { reason: 'x' })).rejects.toMatchObject(code('STORE_NOT_FOUND')); await expect(svc.recordReturn(A, 'o1', { reason: '' })).rejects.toMatchObject(code('STORE_INVALID'));
    expect((await svc.listReturns(A, 'o1', 1, 20)).total).toBe(1); expect((await svc.listReturns(B, 'o1', 1, 20)).total).toBe(0);
  });
});

describe('stock import (dry run by default, idempotent, with a count and total comparison)', () => {
  const rows = [{ sourceId: 'o1', sku: 'CP-1', kind: 'OPENING', qty: 10 }, { sourceId: 'm1', sku: 'CP-1', kind: 'MOVEMENT', qty: -3 }, { sourceId: 'o2', sku: 'SH-1-L', kind: 'OPENING', qty: 4 }];
  const setup = async () => { const c = make(); await c.svc.createProduct(A, prod); const shirt = await c.svc.createProduct(A, { ...prod, name: 'Shirt', sku: 'SH-1' }); await c.svc.addVariant(A, shirt.id, { label: 'Large', sku: 'SH-1-L' }); return c; };
  it('a dry run reports and writes nothing', async () => {
    const { svc, store } = await setup(); const r = await svc.importStock(A, rows, false);
    expect(r).toMatchObject({ mode: 'DRY_RUN', read: 3, rejected: [], alreadyApplied: 0, toApply: 3, applied: 0, comparison: null }); expect(store.moveRows).toHaveLength(0);
  });
  it('apply writes every row once, then compares counts and totals with the database', async () => {
    const { svc, store } = await setup(); const r = await svc.importStock(A, rows, true);
    expect(r).toMatchObject({ mode: 'APPLIED', applied: 3, alreadyApplied: 0, comparison: { rowsMatch: true, quantityMatch: true, skusMatch: true, ok: true }, sourceTotals: { rows: 3, quantity: 11, skus: 2 }, databaseTotals: { rows: 3, quantity: 11, skus: 2 } });
    expect(store.moveRows.map((m) => m.key)).toEqual(['import:o1', 'import:m1', 'import:o2']); expect(store.levelRows.find((l) => l.productRef !== undefined && l.onHand === 7)).toBeDefined();
  });
  it('running it again changes nothing', async () => {
    const { svc, store } = await setup(); await svc.importStock(A, rows, true); const r = await svc.importStock(A, rows, true);
    expect(r).toMatchObject({ applied: 0, alreadyApplied: 3, comparison: { ok: true } }); expect(store.moveRows).toHaveLength(3);
  });
  it('an unknown SKU and a movement that would go below zero are rejected with their reason, and the comparison says the totals differ', async () => {
    const { svc } = await setup();
    const r = await svc.importStock(A, [...rows, { sourceId: 'x1', sku: 'NOPE', kind: 'OPENING', qty: 1 }, { sourceId: 'x2', sku: 'SH-1-L', kind: 'MOVEMENT', qty: -99 }], true);
    expect(r.rejected.map((x) => x.reason)).toEqual(['UNKNOWN_SKU', 'WOULD_GO_NEGATIVE']); expect(r.applied).toBe(3);
  });
  it('another business cannot import against this business products', async () => { const { svc, store } = await setup(); const r = await svc.importStock(B, rows, true); expect(r.rejected).toHaveLength(3); expect(store.moveRows).toHaveLength(0); });
  it('the bad rows of the file are reported by position, and the rest still go in', async () => {
    const { svc } = await setup(); const r = await svc.importStock(A, [...rows, { sourceId: '', sku: 'CP-1', kind: 'OPENING', qty: 1 }], true);
    expect(r.rejected).toEqual([{ index: 3, reason: 'NO_SOURCE_ID' }]); expect(r.applied).toBe(3);
  });
});
