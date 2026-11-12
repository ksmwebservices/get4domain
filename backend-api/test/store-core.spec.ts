import { checkMovement, checkoutMode, checkProduct, checkReturn, checkVariant, compareImport, planStockImport } from '../src/v3-store/core/store-core';

describe('checkout decision table (UPI only; no UPI means an order request)', () => {
  const m = (kind: string, status: string) => ({ kind, status }) as { kind: 'UPI' | 'OWN_GATEWAY' | 'PAY_ON_DELIVERY' | 'PAY_AT_VISIT' | 'BANK_TRANSFER'; status: 'ACTIVE' | 'UNVERIFIED' | 'DISABLED' };
  it.each([
    [[], 'ORDER_REQUEST'], [[m('UPI', 'ACTIVE')], 'ONLINE_UPI'], [[m('UPI', 'UNVERIFIED')], 'ORDER_REQUEST'], [[m('UPI', 'DISABLED')], 'ORDER_REQUEST'],
    [[m('PAY_ON_DELIVERY', 'ACTIVE')], 'ORDER_REQUEST'], [[m('BANK_TRANSFER', 'ACTIVE'), m('PAY_AT_VISIT', 'ACTIVE')], 'ORDER_REQUEST'],
    [[m('OWN_GATEWAY', 'ACTIVE')], 'ORDER_REQUEST'], [[m('OWN_GATEWAY', 'ACTIVE'), m('UPI', 'ACTIVE')], 'ONLINE_UPI'], [[m('PAY_ON_DELIVERY', 'ACTIVE'), m('UPI', 'ACTIVE')], 'ONLINE_UPI'],
  ] as const)('%j gives %s', (methods, want) => { expect(checkoutMode(methods as never)).toBe(want); });
});

describe('product input (tax rate only from the table)', () => {
  const base = { name: 'Copper pipe', sku: 'CP-1', hsnSac: '7411', pricePaise: 25000, taxRatePercent: 18 };
  it('accepts a good one, with the rate from the table', () => { expect(checkProduct(base, [18])).toMatchObject({ ok: true, value: { name: 'Copper pipe', sku: 'CP-1', hsnSac: '7411', pricePaise: 25000, taxRatePercent: 18, trackStock: true } }); });
  it('refuses a rate not in the table, and every rate when the table is empty; no rate is simply not set', () => {
    expect(checkProduct(base, [5]).ok).toBe(false); expect(checkProduct(base, []).ok).toBe(false); expect(checkProduct({ ...base, taxRatePercent: undefined }, [])).toMatchObject({ ok: true, value: { taxRatePercent: null } });
  });
  it.each([[{ ...base, name: '' }], [{ ...base, pricePaise: 0 }], [{ ...base, pricePaise: 1.5 }], [{ ...base, hsnSac: 'ab' }], [{ ...base, sku: 'has space' }], [{ ...base, sku: 'x'.repeat(41) }]])('refuses %j', (bad) => { expect(checkProduct(bad, [18]).ok).toBe(false); });
  it('variants need a label; a missing price means the product price', () => {
    expect(checkVariant({ label: 'Large', sku: 'CP-1-L' })).toMatchObject({ ok: true, value: { label: 'Large', sku: 'CP-1-L', pricePaise: null } });
    expect(checkVariant({ label: '' }).ok).toBe(false); expect(checkVariant({ label: 'x', pricePaise: -1 }).ok).toBe(false);
  });
});

describe('stock movements', () => {
  it('a change is a whole number other than zero with a known reason', () => {
    expect(checkMovement({ delta: 5, reason: 'RECEIPT' })).toMatchObject({ ok: true });
    for (const bad of [{ delta: 0, reason: 'RECEIPT' }, { delta: 1.5, reason: 'RECEIPT' }, { delta: 5, reason: 'SALE' }, { delta: 5, reason: 'x' }, { delta: 2_000_000, reason: 'RECEIPT' }]) expect(checkMovement(bad).ok).toBe(false);
  });
});

describe('returns are recorded facts', () => {
  it('need a reason; the amount is whole paise and may be zero', () => {
    expect(checkReturn({ reason: 'damaged', amountPaise: 500 })).toMatchObject({ ok: true, value: { amountPaise: 500 } }); expect(checkReturn({ reason: 'damaged' })).toMatchObject({ ok: true, value: { amountPaise: 0 } });
    expect(checkReturn({ reason: '' }).ok).toBe(false); expect(checkReturn({ reason: 'x', amountPaise: -1 }).ok).toBe(false);
  });
});

describe('stock import plan (Step N Rock readiness)', () => {
  const rows = [
    { sourceId: 'o1', sku: 'A', kind: 'OPENING', qty: 10 }, { sourceId: 'm1', sku: 'A', kind: 'MOVEMENT', qty: -3, note: 'sale' }, { sourceId: 'o2', sku: 'B', kind: 'OPENING', qty: 0 },
  ];
  it('keys every row by its source id, so a second run changes nothing, and totals what it read', () => {
    const p = planStockImport(rows); expect(p.rejected).toEqual([]); expect(p.accepted.map((r) => r.key)).toEqual(['import:o1', 'import:m1', 'import:o2']);
    expect(p.sourceTotals).toEqual({ rows: 3, quantity: 7, skus: 2 });
  });
  it('rejects a bad row with its reason and still plans the rest', () => {
    const p = planStockImport([...rows, { sourceId: 'o1', sku: 'C', kind: 'OPENING', qty: 1 }, { sourceId: '', sku: 'C', kind: 'OPENING', qty: 1 }, { sourceId: 'x', sku: '', kind: 'OPENING', qty: 1 }, { sourceId: 'y', sku: 'C', kind: 'OPENING', qty: -1 }, { sourceId: 'z', sku: 'C', kind: 'WHAT', qty: 1 }, { sourceId: 'w', sku: 'C', kind: 'MOVEMENT', qty: 1.5 }]);
    expect(p.accepted).toHaveLength(3); expect(p.rejected.map((r) => r.reason)).toEqual(['DUPLICATE_SOURCE_ID', 'NO_SOURCE_ID', 'NO_SKU', 'OPENING_NEGATIVE', 'UNKNOWN_KIND', 'QTY_NOT_WHOLE']);
  });
  it('compares counts and totals against the database after the run, naming what differs', () => {
    expect(compareImport({ rows: 3, quantity: 7, skus: 2 }, { rows: 3, quantity: 7, skus: 2 })).toEqual({ rowsMatch: true, quantityMatch: true, skusMatch: true, ok: true });
    expect(compareImport({ rows: 3, quantity: 7, skus: 2 }, { rows: 3, quantity: 6, skus: 2 })).toMatchObject({ quantityMatch: false, ok: false });
  });
});
