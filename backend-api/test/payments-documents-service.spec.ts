import { DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { gstinCheckChar } from '../src/v3-payments/core/doc-core';
import { DocumentsService } from '../src/v3-payments/documents.service';
import { FakeMessageSender, FakePdf } from '../src/v3-payments/documents.ports';
import { PaymentsService } from '../src/v3-payments/payments.service';
import { HOST_A, OWNER, requestsWorld, RW } from './support/requests-world';
import { entitlements } from './support/site-fixtures';
import { MemoryDocumentsStore } from './support/memory-documents-store';
import { MemoryPaymentsStore } from './support/memory-payments-store';

/** Slice 5.17d: receipts and invoices through the service with memory twins. */
let prevKey: string | undefined;
beforeAll(() => { prevKey = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = 'unit-test-platform-settings-key-0123456789'; });
afterAll(() => { if (prevKey === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = prevKey; });
let w: RW; let ps: MemoryPaymentsStore; let ds: MemoryDocumentsStore; let docs: DocumentsService; let pay: PaymentsService; let sender: FakeMessageSender;
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const GSTIN_TN = '33ABCDE1234F1Z' + gstinCheckChar('33ABCDE1234F1Z');
beforeEach(async () => {
  w = await requestsWorld(); ps = new MemoryPaymentsStore(); ps.clock = () => new Date(w.now.t); ds = new MemoryDocumentsStore(); sender = new FakeMessageSender(); sender.env = {};
  const ents = { resolve: async (v: string) => w.ents.get(v) ?? entitlements('FREE', 'ecommerce') };
  docs = new DocumentsService(ds, ps, w.store, w.lifecycle, ents as never, sender, new FakePdf(), w.dw.pepper, 'https://app.example.test/doc', w.activity as never, { activeForVendor: async () => false } as never);
  docs.clock = () => new Date(w.now.t);
  const b3svc = { get: async () => ({ ...DEFAULT_B3_SETTINGS, payLinkExpiryHours: 24 }) };
  pay = new PaymentsService(ps, w.store, w.vendor, w.lifecycle, b3svc as never, ents as never, w.messaging, 'https://app.example.test/pay', w.activity as never, { activeForVendor: async () => false } as never, docs);
  pay.clock = () => new Date(w.now.t);
});
const upiA = async () => { const id = await w.method('va', 'UPI'); await w.vendor.setDefaultMethod('va', id, OWNER); return id; };
const paid = async (over: Record<string, unknown> = {}) => { const r = await pay.create('va', { amountPaise: 118_000, customerName: 'Meena R', customerPhone: '98765 43210', note: 'Brass lamp', ...over }, OWNER); return { r, m: await pay.markPaid('va', r.id, {}, OWNER) }; };

describe('the tax profile', () => {
  it('a GSTIN is checked, its state is read from it, registered needs name and address, unregistered clears the number, the prefix is checked, and the activity names fields only', async () => {
    expect(await code(docs.saveProfile('va', { gstRegistered: true, gstin: 'nope', legalName: 'Priya Stores', address: '12 Main Road' }, 'u1'))).toBe('PAY_REQUEST_INVALID');
    expect(await code(docs.saveProfile('va', { gstRegistered: true, gstin: GSTIN_TN }, 'u1'))).toBe('PAY_REQUEST_INVALID');
    expect(await code(docs.saveProfile('va', { invoicePrefix: 'TOOLONGPREFIX' }, 'u1'))).toBe('PAY_REQUEST_INVALID');
    const p = await docs.saveProfile('va', { gstRegistered: true, gstin: GSTIN_TN.toLowerCase(), legalName: 'Priya Stores', address: '12 Main Road, Chennai', invoicePrefix: 'ps' }, 'u1');
    expect(p).toMatchObject({ gstRegistered: true, gstin: GSTIN_TN, stateCode: '33', invoicePrefix: 'PS', compositionScheme: false });
    expect(JSON.stringify(w.activity.rows)).not.toContain(GSTIN_TN); expect(w.activity.rows.at(-1)!.summary).toMatchObject({ changed: expect.arrayContaining(['gstin', 'gstRegistered']) });
    expect(await docs.saveProfile('va', { gstRegistered: false }, 'u1')).toMatchObject({ gstRegistered: false, gstin: null, compositionScheme: false });
  });
});

describe('a document is made once per payment, after the vendor marks it paid', () => {
  it('not registered gives a bill, a Professional vendor gets a fee receipt; the total is what was paid; no tax lines', async () => {
    await upiA(); const a = await paid(); expect(a.m.document).toMatchObject({ kind: 'BILL', number: expect.stringMatching(/^INV\d{4}-00001$/) });
    const d = [...ds.docs.values()][0]; expect(d).toMatchObject({ totalPaise: 118_000, tax: { taxPaise: 0 } });
    w.ents.set('va', entitlements('PRO', 'professional')); const b = await paid(); expect(b.m.document).toMatchObject({ kind: 'FEE_RECEIPT', number: expect.stringMatching(/-00002$/) });
  });
  it('composition gives a bill of supply; registered gives a tax invoice only when the lines carry their tax (an order), never a guess for a payment without one', async () => {
    await upiA(); await docs.saveProfile('va', { gstRegistered: true, gstin: GSTIN_TN, legalName: 'Priya Stores', address: '12 Main Road, Chennai', compositionScheme: true }, 'u1');
    expect((await paid()).m.document).toMatchObject({ kind: 'BILL_OF_SUPPLY' });
    await docs.saveProfile('va', { compositionScheme: false }, 'u1'); const x = await paid({ amountPaise: 5000 });
    expect(x.m.document).toBeNull(); expect(w.activity.rows.some((r) => r.actionKey === 'document.needs_tax_rate')).toBe(true); expect(ps.payments.size).toBe(2);   // the payment stands
  });
  it('an order payment on a registered vendor is a tax invoice: same state CGST plus SGST exactly, other state IGST, unknown state assumed intra and flagged', async () => {
    await upiA(); await docs.saveProfile('va', { gstRegistered: true, gstin: GSTIN_TN, legalName: 'Priya Stores', address: '12 Main Road, Chennai' }, 'u1');
    await w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }, { productRef: 'sku-2', qty: 1 }]), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    w.catalogue.items.set('va|sku-1', { productRef: 'sku-1', name: 'Brass lamp', unitPaise: 150_000, taxPercent: 18 });
    const r = await pay.create('va', { customerName: 'Meena R', orderId: o.id }, OWNER); const m = await pay.markPaid('va', r.id, {}, OWNER);
    const d = [...ds.docs.values()][0]; expect(m.document).toMatchObject({ kind: expect.stringMatching(/TAX_INVOICE|BILL/) });
    if (d.kind === 'TAX_INVOICE') { expect(d.tax.cgstPaise + d.tax.sgstPaise + d.tax.igstPaise).toBe(d.tax.taxPaise); expect(d.tax.taxablePaise + d.tax.taxPaise).toBe(d.totalPaise); expect(d.flags.assumedIntraState).toBe(true); expect(d.tax.supply).toBe('INTRA'); }
    expect(d.totalPaise).toBe(o.amountPaise);
  });
  it('double confirmation and a repeat call make ONE document; the numbers of many payments at once have no gap and no repeat', async () => {
    await upiA(); const a = await paid(); await pay.markPaid('va', a.r.id, {}, OWNER); await docs.createForPayment('va', a.r.id); expect(ds.docs.size).toBe(1);
    const reqs = await Promise.all(Array.from({ length: 12 }, () => pay.create('va', { amountPaise: 10_000, customerName: 'Meena R' }, OWNER)));
    await Promise.all(reqs.map((r) => pay.markPaid('va', r.id, {}, OWNER)));
    expect([...ds.docs.values()].map((d) => d.seq).sort((x, y) => x - y)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1)); expect(new Set([...ds.docs.values()].map((d) => d.number)).size).toBe(13);
  });
  it('a failed write gives the number back: the next document takes it (no gap)', async () => {
    await upiA(); ds.failNext = true; const a = await paid(); expect(a.m.document).toBeNull(); expect(ps.payments.size).toBe(1);   // the payment stands
    const again = await docs.createForPayment('va', a.r.id); expect(again.doc!.seq).toBe(1);
  });
  it('another vendor can never get a document for this payment', async () => {
    await upiA(); const a = await paid(); expect((await docs.createForPayment('vb', a.r.id)).reason).toBe('NO_PAYMENT'); expect(await code(docs.get('vb', [...ds.docs.values()][0].id))).toBe('PAY_REQUEST_NOT_FOUND');
  });
});

describe('sending and the public page', () => {
  it('the link goes by WhatsApp when there is a phone; the text has the business, kind, number and amount and no phone number; resend sends again once; a repeat of the same attempt sends nothing new', async () => {
    await upiA(); const a = await paid(); const d = [...ds.docs.values()][0];
    expect(d).toMatchObject({ whatsappStatus: 'SENT_SANDBOX', emailStatus: 'SKIPPED', pdfRef: expect.stringContaining('fake-pdf/va/') });
    expect(sender.sent).toHaveLength(1); expect(sender.sent[0].text).toBe(`Shop va has issued bill ${d.number} for Rs 1180.00. View it here: https://app.example.test/doc/${d.publicCode}`);
    expect(JSON.stringify([...ds.outbox.values()])).not.toMatch(/9876543210|\+91987/);
    await docs.resend('va', d.id, 'u1'); expect(sender.sent).toHaveLength(2); expect(ds.outbox.size).toBe(2);
    await docs.createForPayment('va', a.r.id); expect(sender.sent).toHaveLength(2);
  });
  it('a live attempt is FAILED plainly and the document stands', async () => {
    await upiA(); sender.env = { MESSAGING_LIVE_ENABLED: 'true' }; await paid(); expect([...ds.docs.values()][0]).toMatchObject({ whatsappStatus: 'FAILED' }); expect(sender.sent).toHaveLength(0);
  });
  it('the public page shows business, lines, tax and total; no phone; an unknown or malformed code is one plain 404; a takedown or removal hides it', async () => {
    await upiA(); await paid(); const d = [...ds.docs.values()][0]; const v = await docs.publicView(d.publicCode);
    expect(v).toMatchObject({ kind: 'BILL', number: d.number, totalPaise: 118_000, amountText: '1180.00', business: { name: 'Shop va', gstin: null }, customerName: 'Meena R' }); expect(JSON.stringify(v)).not.toMatch(/9876543210/);
    expect(await code(docs.publicView('nope'))).toBe('HTTP404'); expect(await code(docs.publicView('A'.repeat(24)))).toBe('HTTP404');
    w.lifecycle.removals.set('va', { kind: 'VENDOR_REQUEST', reason: 'x', phoneHash: null }); expect(await code(docs.publicView(d.publicCode))).toBe('HTTP404');
  });
  it('the public code is unguessable: 24 characters from a 32 letter alphabet, different for every document', async () => {
    await upiA(); await paid(); await paid(); const codes = [...ds.docs.values()].map((d) => d.publicCode); expect(new Set(codes).size).toBe(2); for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{24}$/);
  });
  it('download returns the PDF reference of the vendor\'s own document only', async () => {
    await upiA(); await paid(); const d = [...ds.docs.values()][0]; expect(await docs.download('va', d.id)).toMatchObject({ mode: 'FAKE', pdfRef: `fake-pdf/va/${d.number}.pdf` }); expect(await code(docs.download('vb', d.id))).toBe('PAY_REQUEST_NOT_FOUND');
  });
});
