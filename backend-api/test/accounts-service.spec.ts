import { AccountsService, DocumentSource } from '../src/v3-accounts/accounts.service';
import { DocumentInput, TaxProfileInput } from '../src/v3-accounts/core/accounts-core';
import { MemoryAccountsStore } from './support/memory-accounts-store';

const A = 'vendor-a'; const B = 'vendor-b';
const taxTax = { taxablePaise: 10000, taxPaise: 1800, cgstPaise: 900, sgstPaise: 900, igstPaise: 0, supply: 'INTRA' as const };
const mkDoc = (id: string, at: string, o: Partial<DocumentInput> = {}): DocumentInput => ({ id, kind: 'TAX_INVOICE', number: `INV2627-${id}`, totalPaise: 11800, createdAt: new Date(at), customerName: 'Meena', tax: taxTax, ...o });

class FakeSource extends DocumentSource {
  docs = new Map<string, DocumentInput[]>(); profile: TaxProfileInput = { gstRegistered: true, compositionScheme: false, gstin: '27AAAAA0000A1Z5', stateCode: '27' };
  async listIssued(vendorId: string, skip: number, take: number) { const all = this.docs.get(vendorId) ?? []; return { items: all.slice(skip, skip + take), total: all.length }; }
  async taxProfile(): Promise<TaxProfileInput> { return this.profile; }
}
const make = () => { const store = new MemoryAccountsStore(); const src = new FakeSource(); const svc = new AccountsService(store, src); return { store, src, svc }; };

describe('auto-posting vendor documents as sale records', () => {
  it('posts every document once and says what it did', async () => {
    const { svc, src, store } = make(); src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z'), mkDoc('2', '2026-11-11T05:00:00Z')]);
    expect(await svc.syncDocuments(A)).toEqual({ posted: 2, alreadyPosted: 0, skipped: 0 }); expect(store.sales).toHaveLength(2);
  });
  it('running it again, or twenty times in parallel, never doubles a record', async () => {
    const { svc, src, store } = make(); src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z')]);
    await Promise.all(Array.from({ length: 20 }, () => svc.syncDocuments(A))); await svc.syncDocuments(A);
    expect(store.sales).toHaveLength(1);
  });
  it('a document that arrives later is picked up, the old ones are left alone', async () => {
    const { svc, src, store } = make(); src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z')]); await svc.syncDocuments(A);
    src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z'), mkDoc('2', '2026-11-11T05:00:00Z')]);
    expect(await svc.syncDocuments(A)).toEqual({ posted: 1, alreadyPosted: 1, skipped: 0 }); expect(store.sales).toHaveLength(2);
  });
  it('a document whose parts do not add up is skipped and counted, never posted', async () => {
    const { svc, src, store } = make(); src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z', { totalPaise: 5 }), mkDoc('2', '2026-11-11T05:00:00Z')]);
    expect(await svc.syncDocuments(A)).toEqual({ posted: 1, alreadyPosted: 0, skipped: 1 }); expect(store.sales.map((s) => s.sourceId)).toEqual(['2']);
  });
  it('reading the sales posts first, so the books are never behind the documents', async () => {
    const { svc, src } = make(); src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z')]);
    expect((await svc.listSales(A, {}, 1, 20)).total).toBe(1);
  });
  it('pages through more documents than one page holds', async () => {
    const { svc, src, store } = make(); src.docs.set(A, Array.from({ length: 230 }, (_, i) => mkDoc(String(i), '2026-11-10T05:00:00Z')));
    expect((await svc.syncDocuments(A)).posted).toBe(230); expect(store.sales).toHaveLength(230);
  });
});

describe('two businesses never see each other', () => {
  it('sales, expenses and items are separate; another business id answers like a missing one', async () => {
    const { svc, src } = make(); src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z')]);
    await svc.syncDocuments(A); const e = await svc.createExpense(A, { date: '2026-11-05', category: 'RENT', description: 'Rent', amountPaise: 1000 });
    const it = await svc.createItem(A, { kind: 'SERVICE', name: 'Visit' });
    expect((await svc.listSales(B, {}, 1, 20)).total).toBe(0);
    expect((await svc.listExpenses(B, 1, 20, false)).total).toBe(0);
    expect((await svc.listItems(B, {}, 1, 20)).total).toBe(0);
    await expect(svc.updateExpense(B, e.id, { description: 'x' })).rejects.toMatchObject({ response: { code: 'ACCOUNTS_NOT_FOUND' } });
    await expect(svc.archiveExpense(B, e.id, true)).rejects.toMatchObject({ response: { code: 'ACCOUNTS_NOT_FOUND' } });
    await expect(svc.updateItem(B, it.id, { name: 'x' })).rejects.toMatchObject({ response: { code: 'ACCOUNTS_NOT_FOUND' } });
    await expect(svc.archiveItem(B, it.id, true)).rejects.toMatchObject({ response: { code: 'ACCOUNTS_NOT_FOUND' } });
  });
  it('the same document id in two businesses is two records', async () => {
    const { svc, src, store } = make(); src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z')]); src.docs.set(B, [mkDoc('1', '2026-11-10T05:00:00Z')]);
    await svc.syncDocuments(A); await svc.syncDocuments(B); expect(store.sales).toHaveLength(2);
  });
});

describe('expenses', () => {
  it('are added, changed and archived, never deleted', async () => {
    const { svc, store } = make(); const e = await svc.createExpense(A, { date: '2026-11-05', category: 'RENT', description: 'Rent', amountPaise: 1000, gstPaise: 100 });
    expect((await svc.updateExpense(A, e.id, { amountPaise: 2000 })).amountPaise).toBe(2000);
    expect((await svc.archiveExpense(A, e.id, true)).archived).toBe(true); expect(store.expenses).toHaveLength(1);
    expect((await svc.listExpenses(A, 1, 20, false)).total).toBe(0); expect((await svc.listExpenses(A, 1, 20, true)).total).toBe(1);
  });
  it('refuses a bad one with the stable code', async () => { await expect(svc0().createExpense(A, { date: 'x', category: 'RENT', description: 'r', amountPaise: 5 })).rejects.toMatchObject({ response: { code: 'ACCOUNTS_INVALID' } }); });
  it('a change that would break the rules (gst above the amount) is refused', async () => {
    const { svc } = make(); const e = await svc.createExpense(A, { date: '2026-11-05', category: 'RENT', description: 'Rent', amountPaise: 1000, gstPaise: 100 });
    await expect(svc.updateExpense(A, e.id, { gstPaise: 5000 })).rejects.toMatchObject({ response: { code: 'ACCOUNTS_INVALID' } });
  });
});
function svc0(): AccountsService { return make().svc; }

describe('items and services', () => {
  it('a tax rate is accepted only when staff have put it in the rate table', async () => {
    const { svc, store } = make();
    await expect(svc.createItem(A, { kind: 'ITEM', name: 'Pipe', taxRatePercent: 18 })).rejects.toMatchObject({ response: { code: 'ACCOUNTS_INVALID' } });
    store.rates = [18]; expect((await svc.createItem(A, { kind: 'ITEM', name: 'Pipe', taxRatePercent: 18, hsnSac: '7306' })).taxRatePercent).toBe(18);
  });
  it('an item can be listed by kind and found by name', async () => {
    const { svc } = make(); await svc.createItem(A, { kind: 'ITEM', name: 'Copper pipe' }); await svc.createItem(A, { kind: 'SERVICE', name: 'AC service' });
    expect((await svc.listItems(A, { kind: 'SERVICE' }, 1, 20)).total).toBe(1); expect((await svc.listItems(A, { q: 'pipe' }, 1, 20)).total).toBe(1);
  });
});

describe('the GST summary', () => {
  it('syncs, uses only the range, and takes the profile from the vendor', async () => {
    const { svc, src } = make(); src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z'), mkDoc('2', '2026-10-10T05:00:00Z')]);
    await svc.createExpense(A, { date: '2026-11-05', category: 'RENT', description: 'Rent', amountPaise: 1180, gstPaise: 180 });
    await svc.createExpense(A, { date: '2026-09-05', category: 'RENT', description: 'Old rent', amountPaise: 9999, gstPaise: 999 });
    const r = await svc.gstSummary(A, '2026-11-01', '2026-11-30');
    expect(r).toMatchObject({ invoiceCount: 1, outputTaxPaise: 1800, inputTaxPaise: 180, netTaxPaise: 1620, expenseTotalPaise: 1180, profitPaise: 11800 - 1180, truncated: false, registered: true });
  });
  it('refuses a range that is not a range', async () => { await expect(svc0().gstSummary(A, '2026-11-30', '2026-11-01')).rejects.toMatchObject({ response: { code: 'ACCOUNTS_INVALID' } }); });
  it('a vendor who is not GST registered gets no tax figures', async () => {
    const { svc, src } = make(); src.profile = { ...src.profile, gstRegistered: false }; src.docs.set(A, [mkDoc('1', '2026-11-10T05:00:00Z')]);
    expect(await svc.gstSummary(A, '2026-11-01', '2026-11-30')).toMatchObject({ registered: false, outputTaxPaise: 0, note: 'NOT_REGISTERED' });
  });
});
