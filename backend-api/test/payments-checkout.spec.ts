import { DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { payNotice } from '../src/v3-payments/core/pay-core';
import { PaymentsService } from '../src/v3-payments/payments.service';
import { PayLinkPort } from '../src/requests-orders/requests-ports';
import { HOST_A, OWNER, requestsWorld, RW } from './support/requests-world';
import { entitlements } from './support/site-fixtures';
import { MemoryPaymentsStore } from './support/memory-payments-store';

/** Block 4b slice 8 (Amendment 09 Part W): the fixed pay-page notice on every response, checkout making its own pay request, late payments, the old invoice retired. */
let prevKey: string | undefined;
beforeAll(() => { prevKey = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = 'unit-test-platform-settings-key-0123456789'; });
afterAll(() => { if (prevKey === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = prevKey; });
let w: RW; let ps: MemoryPaymentsStore; let pay: PaymentsService; let n = 0;
const NOTICE = 'You are paying Shop va directly. Get4Domain does not receive or hold this payment.';
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const body = async (p: Promise<unknown>): Promise<Record<string, unknown>> => { try { await p; return {}; } catch (e) { return ((e as { response?: Record<string, unknown> }).response ?? {}); } };
beforeEach(async () => {
  w = await requestsWorld(); ps = new MemoryPaymentsStore(); ps.clock = () => new Date(w.now.t); n = 0;
  const b3svc = { get: async () => ({ ...DEFAULT_B3_SETTINGS, ...w.b3.over }) };
  const ents = { resolve: async (v: string) => w.ents.get(v) ?? entitlements('FREE', 'ecommerce') };
  pay = new PaymentsService(ps, w.store, w.vendor, w.lifecycle, b3svc as never, ents as never, w.messaging, 'https://app.example.test/pay', w.activity as never, { activeForVendor: async () => false } as never);
  pay.clock = () => new Date(w.now.t); pay.random = () => Uint8Array.from({ length: 24 }, (_, i) => (i * 7 + ++n * 13) & 255);
  w.b3.over = { payLinkExpiryHours: 48 };
  (w.pub as unknown as { payLinks?: PayLinkPort }).payLinks = pay;   // exactly what the global bridge module binds in the real app
});
const upiA = async () => { const id = await w.method('va', 'UPI'); await w.vendor.setDefaultMethod('va', id, OWNER); return id; };

describe('W1: one fixed notice on every pay-request response', () => {
  it('the text is exactly the owner\'s, with only the business name varying', () => {
    expect(payNotice('Shop va')).toBe(NOTICE); expect(payNotice('Priya Stores')).toBe('You are paying Priya Stores directly. Get4Domain does not receive or hold this payment.');
  });
  it('it is on the owner side: create, list, get, cancel, mark paid (and again), record offline', async () => {
    await upiA(); const a = await pay.create('va', { amountPaise: 50_000, customerName: 'Meena R' }, OWNER); const b = await pay.create('va', { amountPaise: 60_000, customerName: 'Ravi K' }, OWNER);
    expect(a.notice).toBe(NOTICE); expect((await pay.list('va', { skip: 0, take: 10 })).items.every((x) => x.notice === NOTICE)).toBe(true); expect((await pay.get('va', a.id)).notice).toBe(NOTICE);
    expect((await pay.cancel('va', b.id, OWNER)).notice).toBe(NOTICE);
    const m = await pay.markPaid('va', a.id, {}, OWNER); expect(m.notice).toBe(NOTICE); expect((await pay.markPaid('va', a.id, {}, OWNER)).notice).toBe(NOTICE);
    expect((await pay.recordOffline('va', { amountPaise: 70_000, customerName: 'Meena R', method: 'CASH', idempotencyKey: 'rec-notice-0001-abcd' }, OWNER)).notice).toBe(NOTICE);
  });
  it('it is on every public pay-page response: waiting, said paid, paid, and the expired and cancelled errors', async () => {
    await upiA(); const r = await pay.create('va', { amountPaise: 50_000, customerName: 'Meena R' }, OWNER);
    expect((await pay.publicView(r.code) as { notice: string }).notice).toBe(NOTICE);
    expect((await pay.iHavePaid(r.code, {}) as { notice: string }).notice).toBe(NOTICE); expect((await pay.iHavePaid(r.code, {}) as { notice: string }).notice).toBe(NOTICE);   // repeat tap too
    expect((await pay.publicView(r.code) as { notice: string }).notice).toBe(NOTICE);
    await pay.markPaid('va', r.id, {}, OWNER); expect(await pay.publicView(r.code)).toMatchObject({ state: 'PAID', notice: NOTICE }); expect(await pay.iHavePaid(r.code, {})).toMatchObject({ notice: NOTICE });
    const c = await pay.create('va', { amountPaise: 10_000, customerName: 'Ravi K' }, OWNER); await pay.cancel('va', c.id, OWNER);
    expect(await body(pay.publicView(c.code))).toMatchObject({ code: 'PAY_LINK_EXPIRED', notice: NOTICE });
    const e = await pay.create('va', { amountPaise: 20_000, customerName: 'Ravi K' }, OWNER); w.now.t = new Date(w.now.t.getTime() + 3 * 86_400_000);
    expect(await body(pay.publicView(e.code))).toMatchObject({ code: 'PAY_LINK_EXPIRED', notice: NOTICE }); expect(await body(pay.iHavePaid(e.code, {}))).toMatchObject({ notice: NOTICE });
  });
  it('a plain 404 (unknown code, Free vendor) reveals nothing, so it carries no notice', async () => {
    expect(await body(pay.publicView('nope'))).not.toHaveProperty('notice');
  });
});

describe('W3: checkout creates the pay request itself, one order and one pay link', () => {
  it('an online order answers with its own pay link (the step, the url, the expiry from the staff setting, the notice) and a pay request exists for the order', async () => {
    await upiA(); await w.vendor.setStock('va', 'sku-1', 5);
    const r = await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1') as unknown as { paymentStep: { step: string; payUrl: string; expiresAt: Date; notice: string }; readiness: string };
    expect(r.readiness).toBe('FULL_CHECKOUT'); expect(r.paymentStep).toMatchObject({ step: 'PAY_WITH_UPI_LINK', notice: NOTICE }); expect(r.paymentStep.payUrl).toMatch(/^https:\/\/app\.example\.test\/pay\/[A-Z0-9]{24}$/);
    expect(r.paymentStep.expiresAt.getTime() - w.now.t.getTime()).toBe(48 * 3_600_000);
    const o = [...w.store.orders.values()][0]; expect(ps.rows.size).toBe(1); expect([...ps.rows.values()][0]).toMatchObject({ orderId: o.id, source: 'ORDER', amountPaise: o.amountPaise, status: 'AWAITING' });
  });
  it('asking for the link again gives the same link and creates nothing more (one order, one pay link)', async () => {
    await upiA(); await w.vendor.setStock('va', 'sku-1', 5); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    const a = await pay.createForOrder('va', o.id); const b = await pay.createForOrder('va', o.id); expect(b).toEqual(a); expect(ps.rows.size).toBe(1);
    expect(await pay.createForOrder('vb', o.id)).toBeNull(); expect(ps.rows.size).toBe(1);   // another business cannot make a link for this order
  });
  it('if the link cannot be made (staff have not set the expiry) the order still stands and the answer says the link is pending', async () => {
    await upiA(); await w.vendor.setStock('va', 'sku-1', 5); w.b3.over = {};
    const r = await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1') as unknown as { accepted: boolean; paymentStep: { step: string } };
    expect(r.accepted).toBe(true); expect(r.paymentStep).toEqual({ step: 'PAY_LINK_PENDING' }); expect([...w.store.orders.values()]).toHaveLength(1); expect(ps.rows.size).toBe(0);
  });
  it('a shop that takes the order by cash or with no method makes no pay link at all', async () => {
    await w.method('va', 'PAY_ON_DELIVERY'); await w.vendor.setStock('va', 'sku-1', 5);
    const r = await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1') as unknown as { paymentStep: { step: string } }; expect(r.paymentStep.step).toBe('PAY_ON_DELIVERY'); expect(ps.rows.size).toBe(0);
  });
  it('paying that link settles the order once: mark as paid makes the order PAID and exactly one document', async () => {
    await upiA(); await w.vendor.setStock('va', 'sku-1', 5); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    const link = (await pay.createForOrder('va', o.id))!; const m = await pay.markPaid('va', link.requestId, { method: 'UPI' }, OWNER);
    expect(m).toMatchObject({ status: 'PAID', alreadyPaid: false }); expect([...w.store.orders.values()][0].status).toBe('PAID'); expect(ps.payments.size).toBe(1);
  });
});

describe('W2: a late payment is allowed and flagged', () => {
  it('an expired request can still be marked paid; the activity row says late', async () => {
    await upiA(); const r = await pay.create('va', { amountPaise: 50_000, customerName: 'Meena R' }, OWNER); w.now.t = new Date(w.now.t.getTime() + 3 * 86_400_000); await pay.expireDue();
    expect(ps.rows.get(r.id)?.status).toBe('EXPIRED'); const m = await pay.markPaid('va', r.id, {}, OWNER); expect(m.status).toBe('PAID');
    expect(w.activity.rows.find((x) => x.actionKey === 'payment.marked_paid')?.summary).toMatchObject({ late: true });
  });
  it('a payment on time is not flagged late', async () => {
    await upiA(); const r = await pay.create('va', { amountPaise: 50_000, customerName: 'Meena R' }, OWNER); await pay.markPaid('va', r.id, {}, OWNER);
    expect(w.activity.rows.find((x) => x.actionKey === 'payment.marked_paid')?.summary).not.toHaveProperty('late');
  });
});

describe('W5: the old 5.14 order invoice is retired; one order payment, one document', () => {
  it('marking an order paid takes no old invoice number any more', async () => {
    await w.method('va', 'PAY_ON_DELIVERY'); await w.vendor.setStock('va', 'sku-1', 5); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    await w.vendor.updateOrder('va', o.id, { status: 'PAID' }, OWNER); expect([...w.store.orders.values()][0].status).toBe('PAID'); expect(w.store.invoices.size).toBe(0);
  });
  it('the manual issue route answers that it is retired; an invoice issued before stays readable and is still returned for its order', async () => {
    await w.method('va', 'PAY_ON_DELIVERY'); await w.vendor.setStock('va', 'sku-1', 5); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    expect(await code(w.vendor.invoiceFor('va', o.id, OWNER))).toBe('ORDER_INVOICE_RETIRED'); expect(w.store.invoices.size).toBe(0);
    const old = await w.store.createInvoice({ vendorId: 'va', orderId: o.id, requestId: o.requestId, snapshot: { kept: true }, prefix: 'INV-', now: new Date(w.now.t) });   // a row from before the retirement
    expect((await w.vendor.invoiceFor('va', o.id, OWNER)).id).toBe(old.id); expect((await w.vendor.invoices('va', 0, 10)).items.map((i) => i.id)).toEqual([old.id]);
    expect((await w.vendor.voidInvoice('va', old.id, 'issued in error before', OWNER)).status).toBe('VOID');   // old rows can still be corrected
  });
  it('another business cannot reach the invoice of this business\'s order', async () => {
    await w.method('va', 'PAY_ON_DELIVERY'); await w.vendor.setStock('va', 'sku-1', 5); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    expect(await code(w.vendor.invoiceFor('vb', o.id, OWNER))).toBe('ORDER_INVALID');
  });
});
