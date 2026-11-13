import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { methodLabel, normaliseMethod, providerFor, referenceAllowed } from '../src/v3-payments/core/pay-core';
import { PaymentsService } from '../src/v3-payments/payments.service';
import { HOST_A, OWNER, requestsWorld, RW } from './support/requests-world';
import { entitlements } from './support/site-fixtures';
import { MemoryPaymentsStore } from './support/memory-payments-store';

/** Block 4b slice 5 (Amendment 09 C1): cash, UPI and bank transfer recorded by the business. It is the business's money; there is still one door to PAID. */
let prevKey: string | undefined;
beforeAll(() => { prevKey = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = 'unit-test-platform-settings-key-0123456789'; });
afterAll(() => { if (prevKey === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = prevKey; });
let w: RW; let ps: MemoryPaymentsStore; let pay: PaymentsService; let n = 0;
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
beforeEach(async () => {
  w = await requestsWorld(); ps = new MemoryPaymentsStore(); ps.clock = () => new Date(w.now.t);
  const b3svc = { get: async () => ({ ...DEFAULT_B3_SETTINGS, ...w.b3.over }) };
  const ents = { resolve: async (v: string) => w.ents.get(v) ?? entitlements('FREE', 'ecommerce') };
  pay = new PaymentsService(ps, w.store, w.vendor, w.lifecycle, b3svc as never, ents as never, w.messaging, 'https://app.example.test/pay', w.activity as never, { activeForVendor: async () => false } as never);
  pay.clock = () => new Date(w.now.t); pay.random = () => Uint8Array.from({ length: 24 }, (_, i) => (i * 7 + ++n * 13) & 255);
  w.b3.over = { payLinkExpiryHours: 24 };
});
const upiA = async () => { const id = await w.method('va', 'UPI'); await w.vendor.setDefaultMethod('va', id, OWNER); return id; };
const KEY = (s: string) => `rec-${s}-0001-abcd`;
const placeOrder = async () => { await upiA(); await w.vendor.setStock('va', 'sku-1', 5); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); return [...w.store.orders.values()][0]; };

describe('the method pure rules', () => {
  it('UPI is the default; only the three are accepted; cash carries no reference', () => {
    expect(normaliseMethod(undefined)).toBe('UPI'); expect(normaliseMethod('')).toBe('UPI'); expect(normaliseMethod('CASH')).toBe('CASH'); expect(normaliseMethod('BANK_TRANSFER')).toBe('BANK_TRANSFER');
    for (const bad of ['cash', 'CHEQUE', 'CARD', 5, {}]) expect(normaliseMethod(bad)).toBeNull();
    expect(referenceAllowed('CASH', 'AB12CD34EF56')).toBe(false); expect(referenceAllowed('CASH', null)).toBe(true); expect(referenceAllowed('UPI', 'AB12CD34EF56')).toBe(true); expect(referenceAllowed('BANK_TRANSFER', 'AB12CD34EF56')).toBe(true);
  });
  it('the provider label says the business confirmed it, never a gateway', () => { expect(['UPI', 'CASH', 'BANK_TRANSFER'].map((m) => providerFor(m as never))).toEqual(['UPI_MANUAL', 'CASH_MANUAL', 'BANK_MANUAL']); expect(methodLabel('CASH')).toBe('Cash'); expect(methodLabel('BANK_TRANSFER')).toBe('Bank transfer'); expect(methodLabel('UPI')).toBe('UPI'); });
});

describe('Mark as paid names the method', () => {
  it('defaults to UPI, is flagged vendor-recorded, and the receipt says UPI', async () => {
    await upiA(); const r = await pay.create('va', { amountPaise: 50_000, customerName: 'Meena R' }, OWNER);
    const a = await pay.markPaid('va', r.id, {}, OWNER); expect(a.payment).toMatchObject({ method: 'UPI', vendorRecorded: true }); expect(ps.payments.get(r.id)).toMatchObject({ provider: 'UPI_MANUAL', method: 'UPI' });
    expect(w.activity.rows.find((x) => x.actionKey === 'payment.marked_paid')?.summary).toMatchObject({ method: 'UPI', vendorRecorded: true });
  });
  it('cash and bank transfer are accepted; cash with a reference is refused; an unknown method is refused and changes nothing', async () => {
    await upiA(); const a = await pay.create('va', { amountPaise: 50_000, customerName: 'Meena R' }, OWNER); const b = await pay.create('va', { amountPaise: 60_000, customerName: 'Ravi K' }, OWNER);
    expect(await code(pay.markPaid('va', a.id, { method: 'CASH', utr: 'AB12CD34EF56' }, OWNER))).toBe('PAY_REFERENCE_INVALID');
    expect(await code(pay.markPaid('va', a.id, { method: 'CHEQUE' }, OWNER))).toBe('PAY_REQUEST_INVALID'); expect(ps.payments.size).toBe(0);
    expect((await pay.markPaid('va', a.id, { method: 'CASH' }, OWNER)).payment).toMatchObject({ method: 'CASH' }); expect(ps.payments.get(a.id)?.provider).toBe('CASH_MANUAL');
    expect((await pay.markPaid('va', b.id, { method: 'BANK_TRANSFER', utr: 'ab12cd34ef56' }, OWNER)).payment).toMatchObject({ method: 'BANK_TRANSFER', utr: 'AB12CD34EF56' }); expect(ps.payments.get(b.id)?.provider).toBe('BANK_MANUAL');
  });
  it('a late payment (the request had expired) is allowed and the activity row says late', async () => {
    await upiA(); const r = await pay.create('va', { amountPaise: 50_000, customerName: 'Meena R' }, OWNER); w.now.t = new Date(w.now.t.getTime() + 3 * 86_400_000); await pay.expireDue();
    expect(ps.rows.get(r.id)?.status).toBe('EXPIRED'); await pay.markPaid('va', r.id, { method: 'CASH' }, OWNER);
    expect(w.activity.rows.find((x) => x.actionKey === 'payment.marked_paid')?.summary).toMatchObject({ late: true, method: 'CASH' });
  });
});

describe('Record a payment (no UPI method needed)', () => {
  const rec = (over: Record<string, unknown> = {}) => pay.recordOffline('va', { amountPaise: 75_000, customerName: 'Meena R', method: 'CASH', idempotencyKey: KEY('a'), ...over }, OWNER);
  it('a cash-only business with no UPI method writes down a cash payment on its own: one request, one payment, vendor-recorded, never a wallet entry', async () => {
    const r = await rec();
    expect(r).toMatchObject({ status: 'PAID', source: 'MANUAL', methodId: null, alreadyPaid: false, payment: { amountPaise: 75_000, method: 'CASH', vendorRecorded: true, utr: null, confirmedBy: 'VENDOR' } });
    expect(ps.rows.size).toBe(1); expect(ps.payments.size).toBe(1); expect([...ps.payments.values()][0].provider).toBe('CASH_MANUAL');
    expect(w.activity.rows.filter((x) => x.actionKey === 'payment.recorded_offline')).toHaveLength(1);
  });
  it('the same key twice is a no-op: no second request, no second payment, no second activity row', async () => {
    const a = await rec(); const b = await rec(); expect(b).toMatchObject({ alreadyPaid: true, id: a.id }); expect(ps.rows.size).toBe(1); expect(ps.payments.size).toBe(1);
    expect(w.activity.rows.filter((x) => x.actionKey === 'payment.recorded_offline')).toHaveLength(1);
    const both = await Promise.all([rec({ idempotencyKey: KEY('b') }), rec({ idempotencyKey: KEY('b') })]); expect(both.filter((x) => !x.alreadyPaid)).toHaveLength(1); expect(ps.payments.size).toBe(2);
  });
  it('validates: a key is required, a method from the list, cash has no reference, an amount in whole paise, a name of two characters', async () => {
    expect(await code(rec({ idempotencyKey: undefined }))).toBe('PAY_REQUEST_INVALID'); expect(await code(rec({ idempotencyKey: 'short' }))).toBe('PAY_REQUEST_INVALID');
    expect(await code(rec({ method: 'CARD' }))).toBe('PAY_REQUEST_INVALID'); expect(await code(rec({ reference: 'AB12CD34EF56' }))).toBe('PAY_REFERENCE_INVALID');
    for (const bad of [{ amountPaise: 0 }, { amountPaise: 10.5 }, { amountPaise: undefined }, { customerName: 'x' }, { customerName: undefined }, { customerPhone: '12' }, { note: 'n'.repeat(201) }]) expect(await code(rec({ ...bad, idempotencyKey: KEY('v') }))).toBe('PAY_REQUEST_INVALID');
    expect(ps.rows.size).toBe(0);
  });
  it('against an order: the amount is the order total, the order becomes PAID once with one receipt that names the method', async () => {
    const o = await placeOrder();
    expect(await code(rec({ orderId: o.id, amountPaise: 1, idempotencyKey: KEY('o1') }))).toBe('PAY_REQUEST_INVALID');
    const r = await rec({ orderId: o.id, amountPaise: undefined, customerName: undefined, method: 'BANK_TRANSFER', reference: 'bank1234ref9', idempotencyKey: KEY('o2') });
    expect(r).toMatchObject({ status: 'PAID', source: 'ORDER', orderId: o.id, amountPaise: 150_000, payment: { method: 'BANK_TRANSFER', utr: 'BANK1234REF9' } });
    expect([...w.store.orders.values()][0].status).toBe('PAID'); expect(ps.rows.size).toBe(1);
    expect(await code(rec({ orderId: o.id, amountPaise: undefined, idempotencyKey: KEY('o3') }))).toBe('PAY_STATE_INVALID');   // already paid: no second payment for the order
  });
  it('an order that already has a pay link is settled on that link, not on a second request', async () => {
    const o = await placeOrder(); const link = await pay.create('va', { customerName: 'Meena R', orderId: o.id }, OWNER);
    const r = await rec({ orderId: o.id, amountPaise: undefined, idempotencyKey: KEY('o4') }); expect(r.id).toBe(link.id); expect(ps.rows.size).toBe(1); expect(ps.payments.get(link.id)).toMatchObject({ method: 'CASH' });
  });
  it('an order request from a shop with NO payment method is settled by recording the cash: the whole path needs no UPI method at any step', async () => {
    await w.vendor.setStock('va', 'sku-1', 5); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    expect(o).toMatchObject({ status: 'PLACED', paymentMode: 'MANUAL', methodId: null }); expect(ps.rows.size).toBe(0);
    const r = await rec({ orderId: o.id, amountPaise: undefined, customerName: undefined, idempotencyKey: KEY('req') });
    expect(r).toMatchObject({ status: 'PAID', source: 'ORDER', orderId: o.id, amountPaise: 150_000, payment: { method: 'CASH', vendorRecorded: true } }); expect([...w.store.orders.values()][0].status).toBe('PAID');
  });
  it('another business cannot record against this business\'s order', async () => {
    const o = await placeOrder(); expect(await code(pay.recordOffline('vb', { orderId: o.id, customerName: 'Meena R', method: 'CASH', idempotencyKey: KEY('x') }, OWNER))).toBe('PAY_REQUEST_NOT_FOUND'); expect(ps.rows.size).toBe(0);
    expect(w.activity.rows.filter((x) => x.actionKey === 'payment.recorded_offline')).toHaveLength(0);
  });
  it('a recorded payment shows on the pay page only as PAID with the business name and amount, like any paid request', async () => {
    await upiA(); const r = await rec(); expect(await pay.publicView(r.code)).toEqual({ state: 'PAID', businessName: 'Shop va', amountText: '750.00' });
  });
});

describe('never Get4Domain money', () => {
  it('the payments service and the pay core import no wallet, plan billing or Get4Domain ledger', () => {
    for (const f of ['v3-payments/payments.service.ts', 'v3-payments/core/pay-core.ts', 'v3-payments/payments.store.ts', 'v3-payments/prisma-payments.store.ts']) {
      const t = fs.readFileSync(path.resolve(__dirname, '../src', f), 'utf8');
      expect([f, /from '[^']*(v3-wallet|\/wallet|plan-billing|ledger)[^']*'/i.test(t)]).toEqual([f, false]);
    }
  });
  it('every payment row this path writes is flagged vendor-recorded', async () => {
    await pay.recordOffline('va', { amountPaise: 75_000, customerName: 'Meena R', method: 'CASH', idempotencyKey: KEY('f') }, OWNER); expect([...ps.payments.values()].every((p) => p.vendorRecorded)).toBe(true);
  });
});
