import { DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { PAY_CODE_ALPHABET } from '../src/v3-payments/core/pay-core';
import { PaymentsService } from '../src/v3-payments/payments.service';
import { HOST_A, OWNER, requestsWorld, RW } from './support/requests-world';
import { entitlements } from './support/site-fixtures';
import { MemoryPaymentsStore } from './support/memory-payments-store';

/** Slice 5.17b (amendment 06, UPI only): pay requests, the public pay page, I have paid, Mark as paid, expiry, through the service with memory twins. */
let prevKey: string | undefined;
beforeAll(() => { prevKey = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = 'unit-test-platform-settings-key-0123456789'; });
afterAll(() => { if (prevKey === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = prevKey; });
let w: RW; let ps: MemoryPaymentsStore; let pay: PaymentsService; let n = 0; let takedown = false;
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
beforeEach(async () => {
  w = await requestsWorld(); ps = new MemoryPaymentsStore(); ps.clock = () => new Date(w.now.t); takedown = false;
  const b3svc = { get: async () => ({ ...DEFAULT_B3_SETTINGS, ...w.b3.over }) };
  const ents = { resolve: async (v: string) => w.ents.get(v) ?? entitlements('FREE', 'ecommerce') };
  pay = new PaymentsService(ps, w.store, w.vendor, w.lifecycle, b3svc as never, ents as never, w.messaging, 'https://app.example.test/pay', w.activity as never, { activeForVendor: async () => takedown } as never);
  pay.clock = () => new Date(w.now.t); pay.random = () => Uint8Array.from({ length: 24 }, (_, i) => (i * 7 + ++n * 13) & 255);
});
const setExpiry = (hours = 24) => { w.b3.over = { payLinkExpiryHours: hours }; };
const upiA = async () => { const id = await w.method('va', 'UPI'); await w.vendor.setDefaultMethod('va', id, OWNER); return id; };
const mk = async (over: Record<string, unknown> = {}) => pay.create('va', { amountPaise: 150_050, customerName: 'Meena R', customerPhone: '98765 43210', note: 'Brass lamp', ...over }, OWNER);

describe('creating a pay request', () => {
  it('is refused until staff set how long a link stays valid (no invented default)', async () => {
    await upiA(); expect(await code(mk())).toBe('PAY_LINK_EXPIRY_NOT_SET'); expect(ps.rows.size).toBe(0);
  });
  it('makes an unguessable code and a link; the expiry is the staff setting; the default method is used', async () => {
    setExpiry(6); const m = await upiA(); const r = await mk();
    expect(r.code).toHaveLength(24); expect([...r.code].every((c) => PAY_CODE_ALPHABET.includes(c))).toBe(true); expect(r.payUrl).toBe(`https://app.example.test/pay/${r.code}`);
    expect(r).toMatchObject({ amountPaise: 150_050, amountText: '1500.50', status: 'AWAITING', methodId: m, source: 'MANUAL', customerPhone: '+919876543210' });
    expect(r.expiresAt.getTime() - w.now.t.getTime()).toBe(6 * 3_600_000);
    expect(new Set([r.code, (await mk()).code, (await mk()).code]).size).toBe(3);
  });
  it('validates the amount, name, phone and method', async () => {
    setExpiry(); await upiA();
    for (const bad of [{ amountPaise: 0 }, { amountPaise: -5 }, { amountPaise: 10.5 }, { amountPaise: '100' }, { amountPaise: undefined }, { customerName: 'x' }, { customerPhone: '12' }, { note: 'n'.repeat(201) }]) expect(await code(mk(bad))).toBe('PAY_REQUEST_INVALID');
    expect(ps.rows.size).toBe(0);
  });
  it('needs an ACTIVE UPI method of the same vendor: none, a cash method, or another vendor\'s UPI method are all refused', async () => {
    setExpiry(); expect(await code(mk())).toBe('PAYMENT_METHOD_INVALID');
    const cod = await w.method('va', 'PAY_ON_DELIVERY'); expect(await code(mk({ methodId: cod }))).toBe('PAYMENT_METHOD_INVALID');
    const b = await w.method('vb', 'UPI'); expect(await code(mk({ methodId: b }))).toBe('PAYMENT_METHOD_INVALID');
    expect(ps.rows.size).toBe(0);
  });
  it('an order request takes its amount from the order; another vendor\'s order answers like one that does not exist', async () => {
    setExpiry(); await upiA(); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    const r = await pay.create('va', { customerName: 'Meena R', orderId: o.id }, OWNER); expect(r).toMatchObject({ source: 'ORDER', orderId: o.id, amountPaise: 150_000 });
    expect(await code(pay.create('va', { customerName: 'Meena R', orderId: o.id, amountPaise: 1 }, OWNER))).toBe('PAY_REQUEST_INVALID');
    expect(await code(pay.create('vb', { customerName: 'Meena R', orderId: o.id }, OWNER))).toBe('PAY_REQUEST_NOT_FOUND');
  });
});

describe('the public pay page', () => {
  it('shows exactly what the customer needs: business, payee, amount, note, the UPI string; no phone and no customer name', async () => {
    setExpiry(); await upiA(); const r = await mk(); const v = await pay.publicView(r.code);
    expect(v).toMatchObject({ state: 'AWAITING', businessName: 'Shop va', payeeName: 'Shop va', amountPaise: 150_050, amountText: '1500.50', note: 'Brass lamp' });
    expect((v as { upiIntent: string }).upiIntent).toBe('upi://pay?pa=va.shop%40okbank&pn=Shop%20va&am=1500.50&tn=Brass%20lamp&cu=INR');
    expect((v as { qrPayload: string }).qrPayload).toBe((v as { upiIntent: string }).upiIntent);
    expect(JSON.stringify(v)).not.toMatch(/9876543210|Meena/);
  });
  it('every thing that must reveal nothing is the same plain 404: unknown or malformed code, Free vendor, suspended, removed, takedown', async () => {
    setExpiry(); await upiA(); const r = await mk();
    const answers = [await code(pay.publicView('nope')), await code(pay.publicView('A'.repeat(24)))];
    w.ents.set('va', entitlements('FREE', 'ecommerce')); answers.push(await code(pay.publicView(r.code))); w.ents.set('va', entitlements('PRO', 'ecommerce'));
    w.lifecycle.vendors.get('va')!.status = 'SUSPENDED'; answers.push(await code(pay.publicView(r.code))); w.lifecycle.vendors.get('va')!.status = 'ACTIVE';
    takedown = true; answers.push(await code(pay.publicView(r.code))); takedown = false;
    expect(answers).toEqual(Array(5).fill('HTTP404')); expect(await code(pay.publicView(r.code))).toBe('OK');
  });
});

describe('I have paid never confirms; Mark as paid is the only route to PAID', () => {
  it('the customer tap gives CUSTOMER_SAYS_PAID, stores the optional reference, tells the vendor, and pays nothing', async () => {
    setExpiry(); await upiA(); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    const r = await pay.create('va', { customerName: 'Meena R', orderId: o.id }, OWNER);
    expect(await pay.iHavePaid(r.code, { utr: ' ab12cd34ef56 ' })).toEqual({ state: 'CUSTOMER_SAYS_PAID', notice: 'You are paying Shop va directly. Get4Domain does not receive or hold this payment.' });
    expect(ps.rows.get(r.id)).toMatchObject({ status: 'CUSTOMER_SAYS_PAID', customerUtr: 'AB12CD34EF56' });
    expect(ps.payments.size).toBe(0); expect([...w.store.orders.values()][0].status).toBe('AWAITING_PAYMENT'); expect(w.store.invoices.size).toBe(0);
    expect(w.store.outbox.filter((m) => m.templateKey === 'payment_said_paid_vendor')).toHaveLength(1);
    expect(JSON.stringify(w.store.outbox)).not.toMatch(/9876543210/);
  });
  it('repeating the tap changes and sends nothing more; a bad reference is a 400 and changes nothing', async () => {
    setExpiry(); await upiA(); const r = await mk();
    expect(await code(pay.iHavePaid(r.code, { utr: '12' }))).toBe('PAY_REFERENCE_INVALID'); expect(ps.rows.get(r.id)!.status).toBe('AWAITING');
    await pay.iHavePaid(r.code, {}); await pay.iHavePaid(r.code, { utr: 'ZZ99ZZ99ZZ99' });
    expect(ps.rows.get(r.id)!.customerUtr).toBeNull(); expect(w.store.outbox.filter((m) => m.templateKey === 'payment_said_paid_vendor')).toHaveLength(1);
  });
  it('mark-paid makes ONE payment and the order PAID once, with NO old 5.14 invoice (retired; the receipt comes from the payments slice); the second call is alreadyPaid and changes nothing', async () => {
    setExpiry(); await upiA(); await w.vendor.setStock('va', 'sku-1', 5); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    const r = await pay.create('va', { customerName: 'Meena R', orderId: o.id }, OWNER);
    const a = await pay.markPaid('va', r.id, { utr: 'bank1234ref9', idempotencyKey: 'mark-0001-abcd' }, OWNER);
    expect(a).toMatchObject({ status: 'PAID', alreadyPaid: false, payment: { amountPaise: 150_000, utr: 'BANK1234REF9', confirmedBy: 'VENDOR' } });
    const b = await pay.markPaid('va', r.id, { idempotencyKey: 'mark-0001-abcd' }, OWNER); expect(b).toMatchObject({ status: 'PAID', alreadyPaid: true });
    expect(ps.payments.size).toBe(1); expect([...w.store.orders.values()][0].status).toBe('PAID'); expect(w.store.invoices.size).toBe(0);
    expect(w.activity.rows.filter((x) => x.actionKey === 'payment.marked_paid')).toHaveLength(1);
  });
  it('two confirmations at once still make one payment', async () => {
    setExpiry(); await upiA(); const r = await mk();
    const both = await Promise.all([pay.markPaid('va', r.id, {}, OWNER), pay.markPaid('va', r.id, {}, OWNER)]);
    expect(both.filter((x) => !x.alreadyPaid)).toHaveLength(1); expect(ps.payments.size).toBe(1);
  });
  it('the legacy gateway webhook is OFF by default: a signed event gets the plain 401 and the order stays unpaid', async () => {
    setExpiry(); await upiA(); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'); const o = [...w.store.orders.values()][0];
    const g = await w.legacyGateway('va', 'ACTIVE', 'whsec-va-secret-0001'); w.webhook.env = {};
    const { raw, sig } = w.signed('whsec-va-secret-0001', { id: 'evt_9', type: 'payment.captured', orderRef: o.id, amountPaise: o.amountPaise, currency: 'INR' });
    await expect(w.webhook.handle('va', g.id, raw, sig)).rejects.toMatchObject({ status: 401 }); expect([...w.store.orders.values()][0].status).toBe('AWAITING_PAYMENT');
  });
});

describe('expiry and cancel', () => {
  it('after the expiry time the page and the tap refuse with a 410, the job marks it EXPIRED once, and the vendor can still record a late payment', async () => {
    setExpiry(1); await upiA(); const r = await mk(); w.now.t = new Date(w.now.t.getTime() + 3_600_001);
    expect(await code(pay.publicView(r.code))).toBe('PAY_LINK_EXPIRED'); expect(await code(pay.iHavePaid(r.code, {}))).toBe('PAY_LINK_EXPIRED'); expect(ps.rows.get(r.id)!.status).toBe('EXPIRED');
    expect(await pay.expireDue()).toBe(0);
    const r2 = await mk(); w.now.t = new Date(w.now.t.getTime() + 3_600_001); expect(await pay.expireDue()).toBe(1); expect(await pay.expireDue()).toBe(0);
    expect(await pay.markPaid('va', r2.id, {}, OWNER)).toMatchObject({ status: 'PAID' });
  });
  it('a request the customer already said they paid does not expire on its own', async () => {
    setExpiry(1); await upiA(); const r = await mk(); await pay.iHavePaid(r.code, {}); w.now.t = new Date(w.now.t.getTime() + 7_200_000);
    expect(await pay.expireDue()).toBe(0); expect(ps.rows.get(r.id)!.status).toBe('CUSTOMER_SAYS_PAID');
  });
  it('cancel stops the link; a cancelled request cannot be marked paid or cancelled again; a paid one cannot be cancelled', async () => {
    setExpiry(); await upiA(); const r = await mk(); await pay.cancel('va', r.id, OWNER);
    expect(await code(pay.publicView(r.code))).toBe('PAY_LINK_EXPIRED'); expect(await code(pay.markPaid('va', r.id, {}, OWNER))).toBe('PAY_STATE_INVALID'); expect(await code(pay.cancel('va', r.id, OWNER))).toBe('PAY_STATE_INVALID');
    const r2 = await mk(); await pay.markPaid('va', r2.id, {}, OWNER); expect(await code(pay.cancel('va', r2.id, OWNER))).toBe('PAY_STATE_INVALID');
  });
});

describe('cross-tenant', () => {
  it('vendor B cannot read, cancel or mark paid vendor A\'s request; the answer is the same as for one that does not exist', async () => {
    setExpiry(); await upiA(); const r = await mk();
    for (const p of [pay.get('vb', r.id), pay.cancel('vb', r.id, OWNER), pay.markPaid('vb', r.id, {}, OWNER)]) expect(await code(p)).toBe('PAY_REQUEST_NOT_FOUND');
    expect(await code(pay.get('va', 'does-not-exist'))).toBe('PAY_REQUEST_NOT_FOUND');
    expect((await pay.list('vb', { skip: 0, take: 10 })).total).toBe(0); expect(ps.rows.get(r.id)!.status).toBe('AWAITING');
  });
});
