import { checkExpense, checkItem, gstSummary, parseRange, saleFromDocument } from '../src/v3-accounts/core/accounts-core';

const doc = (o: Partial<Parameters<typeof saleFromDocument>[0]> = {}): Parameters<typeof saleFromDocument>[0] => ({
  id: 'd1', kind: 'TAX_INVOICE', number: 'INV2627-00001', totalPaise: 11800, createdAt: new Date('2026-11-10T10:00:00Z'), customerName: 'Meena',
  tax: { taxablePaise: 10000, taxPaise: 1800, cgstPaise: 900, sgstPaise: 900, igstPaise: 0, supply: 'INTRA' }, ...o,
});

describe('a vendor document becomes one sale record', () => {
  it('copies the money exactly and names the source', () => {
    expect(saleFromDocument(doc())).toMatchObject({ sourceType: 'VENDOR_DOCUMENT', sourceId: 'd1', number: 'INV2627-00001', kind: 'TAX_INVOICE', taxablePaise: 10000, taxPaise: 1800, cgstPaise: 900, sgstPaise: 900, igstPaise: 0, totalPaise: 11800, customerName: 'Meena' });
  });
  it('a bill of supply or plain bill carries no tax at all', () => {
    const s = saleFromDocument(doc({ kind: 'BILL', totalPaise: 5000, tax: { taxablePaise: 5000, taxPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, supply: 'INTRA' } }));
    expect([s.taxPaise, s.taxablePaise, s.totalPaise]).toEqual([0, 5000, 5000]);
  });
  it('refuses a document whose parts do not add up to the total', () => { expect(() => saleFromDocument(doc({ totalPaise: 999 }))).toThrow(); });
});

describe('expenses', () => {
  const ok = { date: '2026-11-05', category: 'RENT', description: 'Shop rent', amountPaise: 1180000, gstPaise: 180000 };
  it('accepts a good one', () => { expect(checkExpense(ok)).toMatchObject({ ok: true }); });
  it.each([
    [{ ...ok, category: 'BRIBES' }], [{ ...ok, amountPaise: 0 }], [{ ...ok, amountPaise: 10.5 }], [{ ...ok, gstPaise: -1 }], [{ ...ok, gstPaise: 1180001 }], [{ ...ok, date: '05-11-2026' }], [{ ...ok, description: '' }],
  ])('refuses %j', (bad) => { expect(checkExpense(bad)).toMatchObject({ ok: false }); });
  it('gst is optional and defaults to none', () => { const r = checkExpense({ ...ok, gstPaise: undefined }); expect(r.ok && r.value.gstPaise).toBe(0); });
});

describe('items and services take their tax rate from the table, never from code', () => {
  const base = { kind: 'SERVICE', name: 'AC service', hsnSac: '998719', unit: 'job', pricePaise: 50000, taxRatePercent: 18 };
  it('accepts a rate that is in the table', () => { expect(checkItem(base, [5, 18])).toMatchObject({ ok: true }); });
  it('refuses a rate that is not in the table (and every rate when the table is empty)', () => { expect(checkItem(base, [5])).toMatchObject({ ok: false }); expect(checkItem(base, [])).toMatchObject({ ok: false }); });
  it('a missing rate is allowed: it is simply not set yet', () => { expect(checkItem({ ...base, taxRatePercent: undefined }, [])).toMatchObject({ ok: true }); });
  it.each([[{ ...base, kind: 'GADGET' }], [{ ...base, name: ' ' }], [{ ...base, hsnSac: '12' }], [{ ...base, pricePaise: -5 }]])('refuses %j', (bad) => { expect(checkItem(bad, [18])).toMatchObject({ ok: false }); });
});

describe('date range', () => {
  it('uses whole India days, end exclusive', () => {
    const r = parseRange('2026-04-01', '2026-04-30'); expect(r.ok && new Date(r.fromMs).toISOString()).toBe('2026-03-31T18:30:00.000Z'); expect(r.ok && new Date(r.toMs).toISOString()).toBe('2026-04-30T18:30:00.000Z');
  });
  it.each([['2026-04-30', '2026-04-01'], ['x', '2026-04-01'], ['2026-02-30', '2026-03-01'], ['2026-01-01', '2027-06-01']])('refuses %s to %s', (a, b) => { expect(parseRange(a, b).ok).toBe(false); });
});

describe('GST summary from the vendor tax profile', () => {
  const sales = [saleFromDocument(doc()), saleFromDocument(doc({ id: 'd2', number: 'INV2627-00002', tax: { taxablePaise: 10000, taxPaise: 1800, cgstPaise: 0, sgstPaise: 0, igstPaise: 1800, supply: 'INTER' } })), saleFromDocument(doc({ id: 'd3', kind: 'BILL_OF_SUPPLY', totalPaise: 3000, tax: { taxablePaise: 3000, taxPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, supply: 'INTRA' } }))];
  const profile = { gstRegistered: true, compositionScheme: false, gstin: '27AAAAA0000A1Z5', stateCode: '27' };
  it('adds the outward tax split and the input tax from expenses', () => {
    const r = gstSummary(sales, [{ amountPaise: 1180, gstPaise: 180 }], profile);
    expect(r).toMatchObject({ registered: true, invoiceCount: 3, taxablePaise: 23000, cgstPaise: 900, sgstPaise: 900, igstPaise: 1800, outputTaxPaise: 3600, inputTaxPaise: 180, netTaxPaise: 3420, notTaxablePaise: 3000, salesTotalPaise: 26600, expenseTotalPaise: 1180 });
  });
  it('a vendor who is not registered reports no tax, and says why', () => {
    const r = gstSummary(sales, [], { ...profile, gstRegistered: false });
    expect(r).toMatchObject({ registered: false, outputTaxPaise: 0, netTaxPaise: 0 }); expect(r.note).toBe('NOT_REGISTERED');
  });
  it('composition vendors report no input tax credit', () => { expect(gstSummary(sales, [{ amountPaise: 1180, gstPaise: 180 }], { ...profile, compositionScheme: true }).inputTaxPaise).toBe(0); });
  it('an empty period is all zeros', () => { expect(gstSummary([], [], profile)).toMatchObject({ invoiceCount: 0, outputTaxPaise: 0, netTaxPaise: 0 }); });
});
