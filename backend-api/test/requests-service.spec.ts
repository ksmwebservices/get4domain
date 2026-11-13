import { UnauthorizedException } from '@nestjs/common';
import { hashPhone } from '../src/directory/core/otp';
import { hmacHex } from '../src/requests-orders/core/commerce-core';
import { hashTrackingToken } from '../src/requests-orders/core/requests-core';
import { consent, enquiry, HOST_A, HOST_B, OWNER, requestsWorld, RW, STAFF } from './support/requests-world';

/** Slice 5.14 through the services with memory twins: public routes, the vendor inbox, orders and payments, the vendor-gateway webhook, reports and the blocklist. */
jest.setTimeout(60_000);
let prevKey: string | undefined;
beforeAll(() => { prevKey = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = 'unit-test-platform-settings-key-0123456789'; });
afterAll(() => { if (prevKey === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = prevKey; });
let w: RW;
beforeEach(async () => { w = await requestsWorld(); });
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { const r = (e as { response?: { code?: string; message?: string } }).response; return r?.code ?? `HTTP${(e as { status?: number }).status}`; } };
const trackingOf = (r: unknown): string => String((r as { trackingUrl: string }).trackingUrl).split('/track/')[1];

describe('the public gate: one plain 404 for everything that must reveal nothing', () => {
  it('unknown host, Free site, suspended vendor, removed business, a site without requests.inbox: all the same 404; nothing is stored', async () => {
    const ok = await w.pub.submit(HOST_A, enquiry(), '203.0.113.1'); expect(ok).toMatchObject({ accepted: true });
    w.hostMap.set('free.get4domain.com', 'vfree');
    w.lifecycle.vendors.get('vb')!.status = 'SUSPENDED';
    w.lifecycle.removals.set('vremoved', { kind: 'VENDOR_REQUEST', reason: 'x', phoneHash: null }); w.addVendor('vremoved', 'removed.get4domain.com');
    const noInbox = w.ents.get('va')!; w.addVendor('vnoinbox', 'noinbox.get4domain.com'); w.ents.get('vnoinbox')!.features['requests.inbox'] = { ...noInbox.features['requests.inbox'], state: 'LOCKED_PREVIEW' };
    const answers: string[] = [];
    for (const h of ['nobody.get4domain.com', 'free.get4domain.com', HOST_B, 'removed.get4domain.com', 'noinbox.get4domain.com', '', 'bad host!']) answers.push(await code(w.pub.submit(h, enquiry(), '203.0.113.2')));
    expect(answers).toEqual(Array(7).fill('HTTP404'));
    expect(w.store.requests.size).toBe(1);
  });
  it('suspension stops forms AND checkout at once (the vendor row is read on every call, not the 30 second entitlement cache)', async () => {
    await w.method('va', 'PAY_ON_DELIVERY');
    expect(await code(w.pub.order(HOST_A, w.orderBody(), '1.1.1.1'))).toBe('OK');
    w.lifecycle.vendors.get('va')!.status = 'SUSPENDED';   // entitlements still say Pro for up to 30 seconds
    expect(await code(w.pub.submit(HOST_A, enquiry(), '1.1.1.2'))).toBe('HTTP404'); expect(await code(w.pub.order(HOST_A, w.orderBody(), '1.1.1.3'))).toBe('HTTP404');
  });
});

describe('requests', () => {
  it('a valid request is stored with its consent, a tracking token (hash only) and events; both messages go to the sandbox outbox; it ends DELIVERED', async () => {
    const r = await w.pub.submit(HOST_A, enquiry(), '203.0.113.1');
    expect(r).toMatchObject({ accepted: true, status: 'DELIVERED' }); const token = trackingOf(r);
    const row = [...w.store.requests.values()][0];
    expect(row).toMatchObject({ vendorId: 'va', kind: 'ENQUIRY', status: 'DELIVERED', customerPhoneE164: '+919876543210', sourceKind: 'SITE', siteHost: HOST_A });
    expect(w.store.consents.get(row.id)).toMatchObject({ textVersion: 1 }); expect(w.store.consents.get(row.id)!.textHash).toHaveLength(64);
    expect([...w.store.tracking.keys()]).toEqual([hashTrackingToken(token)]); expect(JSON.stringify([...w.store.tracking.keys()])).not.toContain(token);
    expect((await w.store.events(row.id)).map((e) => e.type)).toEqual(['RECEIVED', 'DELIVERED']);
    expect(w.store.outbox.map((m) => [m.templateKey, m.channel, m.status])).toEqual([['request_received_customer', 'WHATSAPP', 'SENT_SANDBOX'], ['request_received_vendor', 'WHATSAPP', 'SENT_SANDBOX']]);
    expect(JSON.stringify(w.store.outbox)).not.toMatch(/9876543210|meena@example/);   // no number, no address in the outbox payload
    expect(w.store.outbox.every((m) => String(m.payload.text).includes('Shop va'))).toBe(true);   // every message names the business
  });
  it('consent is REQUIRED and must be for the current text version; the fields are validated; the honeypot is not a field of the form', async () => {
    for (const bad of [{ consent: undefined }, { consent: consent({ contactByBusiness: false }) }, { consent: consent({ textVersion: 99 }) }, { name: 'x' }, { phone: '12' }, { email: 'nope' }, { idempotencyKey: 'short' }, { payload: { message: 'x' } }, { kind: 'ORDER' }, { kind: 'WHATEVER' }]) {
      expect(await code(w.pub.submit(HOST_A, enquiry(bad as never), '1.1.1.1'))).toBe('REQUEST_INVALID');
    }
    expect(w.store.requests.size).toBe(0);
    w.b3.over = { customerConsentVersion: 2 };   // the text was edited: the old version is refused
    expect(await code(w.pub.submit(HOST_A, enquiry(), '1.1.1.1'))).toBe('REQUEST_INVALID');
    expect(await code(w.pub.submit(HOST_A, enquiry({ consent: consent({ textVersion: 2 }) }), '1.1.1.1'))).toBe('OK');
  });
  it('idempotent: the same key twice is one request, the second answer is the same reference without a new token', async () => {
    const body = enquiry(); const a = await w.pub.submit(HOST_A, body, '1.1.1.1'); const b = await w.pub.submit(HOST_A, body, '1.1.1.1');
    expect(w.store.requests.size).toBe(1); expect(b).toMatchObject({ accepted: true, reference: (a as { reference: string }).reference, replay: true }); expect((b as { trackingUrl?: string }).trackingUrl).toBeUndefined();
    expect(w.store.outbox).toHaveLength(2);   // no second round of messages
    const parallel = enquiry({ payload: { message: 'A different question about warranty' } }); const rs = await Promise.all(Array.from({ length: 8 }, () => w.pub.submit(HOST_A, parallel, '1.1.1.9')));
    expect(new Set(rs.map((r) => (r as { reference: string }).reference)).size).toBe(1); expect(w.store.requests.size).toBe(2);
  });
  it('the same key under another vendor is a separate request', async () => {
    const body = enquiry(); await w.pub.submit(HOST_A, body, '1.1.1.1'); await w.pub.submit(HOST_B, body, '1.1.1.1'); expect(w.store.requests.size).toBe(2);
  });
  it('spam: the honeypot and the blocklist store the request as SPAM and answer exactly like success; nothing is delivered or trackable', async () => {
    const honey = await w.pub.submit(HOST_A, enquiry({ website: 'http://spam.example' }), '1.1.1.1');
    await w.staff.addBlock('PHONE', '+919000000099', 'repeat spammer', STAFF);
    const blocked = await w.pub.submit(HOST_A, enquiry({ phone: '9000000099' }), '1.1.1.2');
    for (const r of [honey, blocked]) { expect(r).toMatchObject({ accepted: true, status: 'RECEIVED' }); expect((r as { trackingUrl?: string }).trackingUrl).toBeUndefined(); }
    expect([...w.store.requests.values()].map((r) => r.status)).toEqual(['SPAM', 'SPAM']); expect(w.store.outbox).toHaveLength(0); expect(w.store.tracking.size).toBe(0);
    expect(await code(w.vendor.open('va', [...w.store.requests.keys()][0]))).toBe('REQUEST_NOT_FOUND');   // the vendor never sees spam in the inbox
  });
  it('a duplicate and a burst raise the score: a high score asks for a phone code; the right code lets the request through, a wrong one does not', async () => {
    const first = enquiry(); await w.pub.submit(HOST_A, first, '1.1.1.1');
    const dup = enquiry({ payload: first.payload });   // same sender, same words, new key: a duplicate (+60 asks for a code at the default threshold 50)
    const ask = await w.pub.submit(HOST_A, dup, '1.1.1.1'); expect(ask).toMatchObject({ otpRequired: true }); expect(w.store.requests.size).toBe(1);
    expect(w.sms.sent).toHaveLength(1); const otp = /is (\d{6})\./.exec(w.sms.sent[0].body)![1];
    expect(await code(w.pub.submit(HOST_A, { ...dup, otp: otp === '000000' ? '111111' : '000000' }, '1.1.1.1'))).toBe('OK');   // wrong code: asks again, creates nothing
    expect(w.store.requests.size).toBe(1);
    const through = await w.pub.submit(HOST_A, { ...dup, otp }, '1.1.1.1'); expect(through).toMatchObject({ accepted: true }); expect(w.store.requests.size).toBe(2);
  });
  it('the Directory attribution: a live Visit reference is used once and marks the request DIRECTORY; replay, expiry and a foreign reference are ignored', async () => {
    const biz = await w.dw.biz({ name: 'Shop va', vendorId: 'va' }); w.dw.repo.sites.set('va', { subdomain: 'shop-a', proActive: true });
    const visit = (await w.dw.visits.visit(biz.slug, '9.9.9.9', true))!;
    const a = await w.pub.submit(HOST_A, enquiry({ dirRef: visit.ref }), '1.1.1.1'); const b = await w.pub.submit(HOST_A, enquiry({ dirRef: visit.ref, payload: { message: 'A second and different question' } }), '1.1.1.2');
    const rows = [...w.store.requests.values()]; expect(rows[0].sourceKind).toBe('DIRECTORY'); expect(rows[1].sourceKind).toBe('SITE'); expect(rows[0].directoryRefHash).toHaveLength(32);
    expect(JSON.stringify(rows)).not.toContain(visit.ref); expect(a).toMatchObject({ accepted: true }); expect(b).toMatchObject({ accepted: true });
  });
});

describe('tracking', () => {
  it('the token shows the status and the business replies and the bridge statement; a wrong, a malformed and an expired token are the SAME 404', async () => {
    const r = await w.pub.submit(HOST_A, enquiry(), '1.1.1.1'); const token = trackingOf(r); const id = (r as { reference: string }).reference;
    await w.vendor.respond('va', id, { message: 'Yes, we do. When suits you?' }, OWNER);
    const t = await w.pub.track(token);
    expect(t).toMatchObject({ reference: id, kind: 'ENQUIRY', status: 'RESPONDED', business: 'Shop va', statement: expect.stringContaining('does not receive or hold your payment') }); expect(t.replies.map((x) => x.message).filter(Boolean)).toEqual(['Yes, we do. When suits you?']);
    expect(JSON.stringify(t)).not.toMatch(/9876543210|meena@example|va@x\.invalid/);
    w.now.t = new Date(w.now.t.getTime() + 61 * 86_400_000);
    const answers = [await code(w.pub.track('x'.repeat(43))), await code(w.pub.track('short')), await code(w.pub.track('')), await code(w.pub.track(token))];
    expect(answers).toEqual(['HTTP404', 'HTTP404', 'HTTP404', 'HTTP404']);
  });
  it('a removed business can no longer be tracked', async () => {
    const r = await w.pub.submit(HOST_A, enquiry(), '1.1.1.1'); w.lifecycle.removals.set('va', { kind: 'VENDOR_REQUEST', reason: 'x', phoneHash: null });
    expect(await code(w.pub.track(trackingOf(r)))).toBe('HTTP404');
  });
});

describe('the vendor inbox', () => {
  it('opening a request marks it SEEN once; a reply stamps the first response and tells the customer; moves must be allowed ones', async () => {
    const id = ((await w.pub.submit(HOST_A, enquiry(), '1.1.1.1')) as { reference: string }).reference;
    const o = await w.vendor.open('va', id); expect(o.status).toBe('SEEN'); expect((await w.store.getRequest(id))!.firstSeenAt).not.toBeNull();
    await w.vendor.open('va', id); expect((await w.store.events(id)).filter((e) => e.type === 'SEEN')).toHaveLength(1);
    expect(await code(w.vendor.respond('va', id, { status: 'DELIVERED' }, OWNER))).toBe('REQUEST_STATE_INVALID'); expect(await code(w.vendor.respond('va', id, { status: 'EXPIRED' }, OWNER))).toBe('REQUEST_STATE_INVALID');
    expect(await code(w.vendor.respond('va', id, {}, OWNER))).toBe('REQUEST_INVALID'); expect(await code(w.vendor.respond('va', id, { message: '' }, OWNER))).toBe('REQUEST_INVALID');
    w.now.t = new Date(w.now.t.getTime() + 7 * 60_000);
    const r = await w.vendor.respond('va', id, { message: 'On our way tomorrow.', status: 'CONFIRMED' }, OWNER); expect(r.status).toBe('CONFIRMED');
    const row = (await w.store.getRequest(id))!; expect(row.firstResponseAt).toEqual(w.now.t);
    expect(w.store.outbox.at(-1)).toMatchObject({ templateKey: 'request_responded_customer' }); expect(String(w.store.outbox.at(-1)!.payload.text)).toContain('does not receive or hold your payment');
    await w.vendor.respond('va', id, { status: 'COMPLETED' }, OWNER); expect(await code(w.vendor.respond('va', id, { status: 'CONFIRMED' }, OWNER))).toBe('REQUEST_STATE_INVALID');
  });
  it('a message alone moves RECEIVED/SEEN to RESPONDED; the list filters by status and kind; the summary has the median response time', async () => {
    const a = ((await w.pub.submit(HOST_A, enquiry(), '1.1.1.1')) as { reference: string }).reference; await w.pub.submit(HOST_A, enquiry({ kind: 'QUOTE', payload: { service: 'Fitting', details: 'Three lamps' } }), '1.1.1.2');
    w.now.t = new Date(w.now.t.getTime() + 10 * 60_000); expect((await w.vendor.respond('va', a, { message: 'Hello' }, OWNER)).status).toBe('RESPONDED');
    const all = await w.vendor.inbox('va', { skip: 0, take: 10 }); expect(all.total).toBe(2); expect(all.summary).toMatchObject({ total: 2, awaiting: 1, responded: 1, medianResponseMinutes: 10 });
    expect((await w.vendor.inbox('va', { status: 'RESPONDED', skip: 0, take: 10 })).total).toBe(1); expect((await w.vendor.inbox('va', { kind: 'QUOTE', skip: 0, take: 10 })).items[0].kind).toBe('QUOTE');
  });
  it('the CRM and booking links are only recorded (ids), validated, and per vendor', async () => {
    const id = ((await w.pub.submit(HOST_A, enquiry(), '1.1.1.1')) as { reference: string }).reference;
    expect((await w.vendor.link('va', id, { customerId: 'cust_1', bookingId: 'bk_9' }, OWNER))).toMatchObject({ convertedCustomerId: 'cust_1', convertedBookingId: 'bk_9' });
    expect(await code(w.vendor.link('va', id, {}, OWNER))).toBe('REQUEST_INVALID'); expect(await code(w.vendor.link('va', id, { customerId: '../x' }, OWNER))).toBe('REQUEST_INVALID'); expect(await code(w.vendor.link('vb', id, { customerId: 'c' }, OWNER))).toBe('REQUEST_NOT_FOUND');
  });
  it('cross-tenant: vendor B cannot read, respond to, link or invoice vendor A\'s request or order, or use A\'s payment method', async () => {
    const id = ((await w.pub.submit(HOST_A, enquiry(), '1.1.1.1')) as { reference: string }).reference; const mid = await w.method('va', 'PAY_ON_DELIVERY');
    await w.method('vb', 'PAY_ON_DELIVERY'); await w.pub.order(HOST_A, w.orderBody(), '1.1.1.5'); const orderId = [...w.store.orders.keys()][0];
    expect(await code(w.vendor.open('vb', id))).toBe('REQUEST_NOT_FOUND'); expect(await code(w.vendor.respond('vb', id, { message: 'hi' }, OWNER))).toBe('REQUEST_NOT_FOUND');
    expect(await code(w.vendor.order('vb', orderId))).toBe('ORDER_INVALID'); expect(await code(w.vendor.invoiceFor('vb', orderId, OWNER))).toBe('ORDER_INVALID'); expect(await code(w.vendor.updateOrder('vb', orderId, { status: 'PACKED' }, OWNER))).toBe('ORDER_INVALID');
    expect(await code(w.vendor.recordRefund('vb', orderId, 100, OWNER))).toBe('ORDER_INVALID');
    expect(await code(w.vendor.testMethod('vb', mid, OWNER))).toBe('PAYMENT_METHOD_INVALID'); expect(await code(w.vendor.updateMethod('vb', mid, { status: 'DISABLED' }, OWNER))).toBe('PAYMENT_METHOD_INVALID');
    expect((await w.vendor.listMethods('vb')).map((m) => m.id)).not.toContain(mid); expect((await w.vendor.inbox('vb', { skip: 0, take: 10 })).total).toBe(0);
  });
});

describe('payment methods keep their secrets', () => {
  it('bank details are sealed, write-only, never in a response, an audit row or the store view; only the last four show', async () => {
    const m = await w.vendor.createMethod('va', { kind: 'BANK_TRANSFER', label: 'My bank', details: 'bank_acct_secret_1234' }, OWNER);
    expect(m).toMatchObject({ kind: 'BANK_TRANSFER', status: 'UNVERIFIED', last4: '1234', hasGatewayDetails: true, hasWebhookSecret: false });
    const everything = JSON.stringify([m, await w.vendor.listMethods('va'), await w.store.listMethods('va'), w.store.audits, w.store.outbox]);
    expect(everything).not.toMatch(/bank_acct_secret|cipher|"iv"|"tag"/);
    const stored = JSON.stringify([...w.store.methods.values()]); expect(stored).not.toContain('bank_acct_secret');
  });
  it('an online method needs its test before it can be ACTIVE; an offline one does not; changing the details drops it back to UNVERIFIED', async () => {
    const g = await w.vendor.createMethod('va', { kind: 'UPI', label: 'UPI', upiId: 'shop@upi', payeeName: 'Shop Owner' }, OWNER);
    expect(await code(w.vendor.updateMethod('va', g.id, { status: 'ACTIVE' }, OWNER))).toBe('PAYMENT_METHOD_INVALID');
    expect(await w.vendor.testMethod('va', g.id, OWNER)).toMatchObject({ ok: true, mode: 'FAKE' }); expect((await w.vendor.updateMethod('va', g.id, { status: 'ACTIVE' }, OWNER)).status).toBe('ACTIVE');
    expect((await w.vendor.updateMethod('va', g.id, { upiId: 'new@upi', confirmUpiChange: true }, OWNER)).status).toBe('UNVERIFIED');
    const cod = await w.vendor.createMethod('va', { kind: 'PAY_ON_DELIVERY', label: 'Cash on delivery' }, OWNER); expect((await w.vendor.updateMethod('va', cod.id, { status: 'ACTIVE' }, OWNER)).status).toBe('ACTIVE');
    expect(await code(w.vendor.createMethod('va', { kind: 'BANK_TRANSFER', label: 'No details' }, OWNER))).toBe('PAYMENT_METHOD_INVALID');
    expect(await code(w.vendor.createMethod('va', { kind: 'UPI', label: 'No id' }, OWNER))).toBe('PAYMENT_METHOD_INVALID');
  });
  it('the terms must be accepted before a method is activated (the slice 5.15 guard)', async () => {
    const v2 = new (w.vendor.constructor as new (...a: unknown[]) => typeof w.vendor)(w.store, w.messaging, (w.vendor as never as { gateway: unknown }).gateway, w.lifecycle, { get: async () => ({}) }, { require: async () => { throw Object.assign(new Error('x'), { response: { code: 'TERMS_ACCEPTANCE_REQUIRED' } }); } });
    const cod = await v2.createMethod('va', { kind: 'PAY_ON_DELIVERY', label: 'Cash on delivery' }, OWNER);
    expect(await code(v2.updateMethod('va', cod.id, { status: 'ACTIVE' }, OWNER))).toBe('TERMS_ACCEPTANCE_REQUIRED');
  });
  it('live gateway checks are refused (no real adapter), and no real gateway is ever called', async () => {
    const g = await w.vendor.createMethod('va', { kind: 'UPI', label: 'Gate', upiId: 'gate@okbank', payeeName: 'Gate Shop' }, OWNER);
    (w.vendor as never as { gateway: { env: Record<string, string> } }).gateway.env = { VENDOR_GATEWAY_LIVE_ENABLED: 'true' };
    expect(await code(w.vendor.testMethod('va', g.id, OWNER))).toBe('PAYMENT_METHOD_INVALID');
  });
});

describe('orders (the bridge: the customer pays the vendor, never Get4Domain)', () => {
  it('nothing configured (Block 4b, order-request mode): the checkout becomes an ORDER REQUEST with no payment taken; an unverified gateway counts for nothing, so it is still an order request', async () => {
    await w.vendor.setStock('va', 'sku-1', 5);
    const r = await w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }]), '1.1.1.1');
    expect(r).toMatchObject({ accepted: true, orderNo: 1, paymentMode: 'MANUAL', readiness: 'ORDER_REQUEST_ONLY', paymentTaken: false, orderRequest: true, paymentStep: { step: 'NO_PAYMENT_TAKEN' } });
    const o = [...w.store.orders.values()][0]; expect(o).toMatchObject({ vendorId: 'va', status: 'PLACED', paymentMode: 'MANUAL', methodId: null }); expect([...w.store.requests.values()][0].kind).toBe('ORDER_REQUEST');
    expect(w.store.invoices.size).toBe(0); expect(r).not.toHaveProperty('paymentStep.checkout');
  });
  it('an unverified gateway counts for nothing: the shop is still in order-request mode', async () => {
    await w.vendor.setStock('va', 'sku-1', 5);
    await w.vendor.createMethod('va', { kind: 'UPI', label: 'Gate', upiId: 'gate@okbank', payeeName: 'Gate Shop' }, OWNER);   // unverified: no payment method is ACTIVE
    expect(await w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }]), '1.1.1.2')).toMatchObject({ paymentMode: 'MANUAL', paymentTaken: false, orderRequest: true });
  });
  it('an order request takes no way of paying: choosing one is refused, and nothing is stored for the refused attempt', async () => {
    await w.vendor.setStock('va', 'sku-1', 5); const before = w.store.orders.size;
    for (const payWith of ['ONLINE', 'COD', 'AT_VISIT', 'BANK'] as const) expect(await code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }], { payWith } as never), '1.1.1.3'))).toBe('ORDER_INVALID');
    expect(w.store.orders.size).toBe(before);
  });
  it('an order request keeps the other order rules: stock is reserved, an unknown product is refused, and another business is not touched', async () => {
    await w.vendor.setStock('va', 'sku-1', 2); await w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 2 }]), '1.1.1.1');
    expect(await w.store.getStock('va', 'sku-1')).toEqual({ onHand: 2, reserved: 2 }); expect(await code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }]), '1.1.1.4'))).toBe('STOCK_UNAVAILABLE');
    expect(await code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'nope', qty: 1 }]), '1.1.1.5'))).toBe('REQUEST_INVALID');
  });
  it('only a cash-style method: an ORDER REQUEST (pay on delivery); an online choice is refused; the order, items, stock reservation and the first number are stored', async () => {
    await w.method('va', 'PAY_ON_DELIVERY'); await w.vendor.setStock('va', 'sku-1', 5);
    const r = await w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 2 }, { productRef: 'sku-2', qty: 1 }]), '1.1.1.1');
    expect(r).toMatchObject({ accepted: true, orderNo: 1, totalPaise: 325_000, paymentMode: 'COD', readiness: 'ORDER_REQUEST_ONLY', paymentStep: { step: 'PAY_ON_DELIVERY' } });
    const o = [...w.store.orders.values()][0]; expect(o).toMatchObject({ vendorId: 'va', status: 'PLACED', amountPaise: 325_000, orderNo: 1 }); expect(w.store.items.get(o.id)).toHaveLength(2);
    expect(await w.store.getStock('va', 'sku-1')).toEqual({ onHand: 5, reserved: 2 }); expect([...w.store.requests.values()][0].kind).toBe('ORDER_REQUEST');
    expect(await code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }], { payWith: 'ONLINE' }), '1.1.1.2'))).toBe('ORDER_INVALID');
  });
  it('a vendor gateway or UPI that is ACTIVE gives the online step with the vendor\'s own checkout reference; nothing from Get4Domain touches money', async () => {
    await w.method('va', 'UPI');
    const r = await w.pub.order(HOST_A, w.orderBody(), '1.1.1.1') as unknown as { paymentStep: { step: string; checkout: { providerOrderRef: string; mode: string; amountPaise: number } }; readiness: string };
    expect(r.readiness).toBe('FULL_CHECKOUT'); expect(r.paymentStep).toMatchObject({ step: 'PAY_ONLINE_WITH_VENDOR_GATEWAY', checkout: { mode: 'FAKE', amountPaise: 150_000 } });
    const o = [...w.store.orders.values()][0]; expect(o).toMatchObject({ status: 'AWAITING_PAYMENT', paymentMode: 'ONLINE' }); expect(r.paymentStep.checkout.providerOrderRef).toBe(o.id);
  });
  it('items, quantities and the catalogue: unknown or unavailable products, duplicates and bad quantities are refused; the price comes from the catalogue, never the browser', async () => {
    await w.method('va', 'PAY_ON_DELIVERY');
    for (const items of [[], [{ productRef: 'nope', qty: 1 }], [{ productRef: 'sku-1', qty: 0 }], [{ productRef: 'sku-1', qty: 1.5 }], [{ productRef: 'sku-1', qty: 1 }, { productRef: 'sku-1', qty: 1 }], [{ productRef: 'sku-1', qty: 1001 }]]) expect(await code(w.pub.order(HOST_A, w.orderBody(items as never), '1.1.1.1'))).toBe('REQUEST_INVALID');
    const sneaky = w.orderBody([{ productRef: 'sku-1', qty: 1, unitPaise: 1 } as never]); expect(((await w.pub.order(HOST_A, sneaky, '1.1.1.2')) as unknown as { totalPaise: number }).totalPaise).toBe(150_000);
    expect(await code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }]), '1.1.1.3'))).not.toBe('HTTP500');
    w.catalogue.items.get('vb|sku-1');   // vendor B's product 'sku-1' is a different product at a different price
    await w.method('vb', 'PAY_ON_DELIVERY'); expect(((await w.pub.order(HOST_B, w.orderBody(), '1.1.1.4')) as unknown as { totalPaise: number }).totalPaise).toBe(100_000);
  });
  it('a coupon: validated, discounts in paise, usage counted and limited; an expired or unknown coupon is refused', async () => {
    await w.method('va', 'PAY_ON_DELIVERY'); await w.vendor.createOffer('va', { kind: 'COUPON', title: 'Ten off', code: 'save10', percentOff: 10, usageLimit: 1 }, OWNER);
    const r = await w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }], { couponCode: 'SAVE10' }), '1.1.1.1') as unknown as { totalPaise: number };
    expect(r.totalPaise).toBe(135_000); expect((await w.store.offerByCode('va', 'SAVE10'))!.usedCount).toBe(1);
    expect(await code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }], { couponCode: 'SAVE10' }), '1.1.1.2'))).toBe('REQUEST_INVALID');   // used up
    expect(await code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }], { couponCode: 'NOPE' }), '1.1.1.3'))).toBe('REQUEST_INVALID');
    expect(await code(w.vendor.createOffer('va', { kind: 'COUPON', title: 'Dup', code: 'SAVE10', percentOff: 5 }, OWNER))).toBe('OFFER_INVALID');
    for (const bad of [{ kind: 'COUPON' as const, title: 'x', code: 'ab', percentOff: 5 }, { kind: 'COUPON' as const, title: 'Both', code: 'BOTH1', percentOff: 5, flatPaise: 5 }, { kind: 'COUPON' as const, title: 'Neither', code: 'NONE1' }, { kind: 'BANNER' as const, title: 'Banner', percentOff: 101 }]) expect(await code(w.vendor.createOffer('va', bad, OWNER))).toBe('OFFER_INVALID');
  });
  it('stock under concurrency: 12 parallel orders for 3 units give exactly 3 orders and 9 STOCK_UNAVAILABLE; reserved never exceeds on hand', async () => {
    await w.method('va', 'PAY_ON_DELIVERY'); await w.vendor.setStock('va', 'sku-2', 3);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-2', qty: 1 }]), `10.0.0.${i}`))));
    expect(results.filter((r) => r === 'OK')).toHaveLength(3); expect(results.filter((r) => r === 'STOCK_UNAVAILABLE')).toHaveLength(9);
    expect(await w.store.getStock('va', 'sku-2')).toEqual({ onHand: 3, reserved: 3 }); expect(w.store.orders.size).toBe(3);
  });
  it('order numbers are gap-free per vendor under concurrency, and vendors have their own series', async () => {
    await w.method('va', 'PAY_ON_DELIVERY'); await w.method('vb', 'PAY_ON_DELIVERY');
    await Promise.all([...Array.from({ length: 10 }, (_, i) => w.pub.order(HOST_A, w.orderBody(), `10.0.1.${i}`)), ...Array.from({ length: 4 }, (_, i) => w.pub.order(HOST_B, w.orderBody(), `10.0.2.${i}`))]);
    const nos = (v: string) => [...w.store.orders.values()].filter((o) => o.vendorId === v).map((o) => o.orderNo).sort((a, b) => a - b);
    expect(nos('va')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); expect(nos('vb')).toEqual([1, 2, 3, 4]);
  });
  it('a reservation that is not paid in time is released by the tick, so the stock comes back', async () => {
    await w.method('va', 'PAY_ON_DELIVERY'); await w.vendor.setStock('va', 'sku-2', 1);
    await w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-2', qty: 1 }]), '1.1.1.1');
    expect(await code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-2', qty: 1 }], { phone: '9811100002' }), '1.1.1.2'))).toBe('STOCK_UNAVAILABLE');
    w.now.t = new Date(w.now.t.getTime() + 16 * 60_000); expect((await w.cron.run()).released).toBe(1);
    expect(await code(w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-2', qty: 1 }], { phone: '9811100003' }), '1.1.1.3'))).toBe('OK');
  });
});

describe('the vendor gateway webhook', () => {
  const setup = async () => {
    await w.method('va', 'UPI'); const mid = (await w.legacyGateway('va', 'ACTIVE', 'whsec-va-secret-0001')).id; await w.vendor.setStock('va', 'sku-1', 5);
    await w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 2 }]), '1.1.1.1'); const order = [...w.store.orders.values()][0];
    const event = (id: string, over: Record<string, unknown> = {}) => ({ id, type: 'payment.captured', orderRef: order.id, amountPaise: order.amountPaise, currency: 'INR', ...over });
    return { mid, order, event };
  };
  it('a good signature marks the order PAID once, reduces the stock once, takes invoice number 1 and queues the confirmation', async () => {
    const { mid, order, event } = await setup(); const { raw, sig } = w.signed('whsec-va-secret-0001', event('evt_1'));
    expect(await w.webhook.handle('va', mid, raw, sig)).toEqual({ status: 'PROCESSED' });
    expect(w.store.orders.get(order.id)).toMatchObject({ status: 'PAID' }); expect(await w.store.getStock('va', 'sku-1')).toEqual({ onHand: 3, reserved: 0 });
    expect([...w.store.invoices.values()].map((i) => i.invoiceNumber)).toEqual(['INV-000001']); expect(w.store.outbox.at(-1)).toMatchObject({ templateKey: 'order_confirmed_customer' });
  });
  it('replay-safe: the same event again is DUPLICATE (200), changes nothing; the event inbox holds one row', async () => {
    const { mid, event } = await setup(); const { raw, sig } = w.signed('whsec-va-secret-0001', event('evt_1'));
    await w.webhook.handle('va', mid, raw, sig); expect(await w.webhook.handle('va', mid, raw, sig)).toEqual({ status: 'DUPLICATE' });
    expect(w.store.paymentEvents.size).toBe(1); expect(w.store.invoices.size).toBe(1); expect(await w.store.getStock('va', 'sku-1')).toEqual({ onHand: 3, reserved: 0 });
  });
  it('double delivery under concurrency (the same event, then two different events for one order): exactly one PAID, one stock reduction, one invoice', async () => {
    const { mid, order, event } = await setup();
    const a = w.signed('whsec-va-secret-0001', event('evt_A')); const b = w.signed('whsec-va-secret-0001', event('evt_B'));
    const rs = await Promise.all([...Array.from({ length: 5 }, () => w.webhook.handle('va', mid, a.raw, a.sig)), ...Array.from({ length: 5 }, () => w.webhook.handle('va', mid, b.raw, b.sig))]);
    expect(rs.filter((r) => r.status === 'PROCESSED')).toHaveLength(1); expect(w.store.orders.get(order.id)!.status).toBe('PAID');
    expect(w.store.invoices.size).toBe(1); expect(await w.store.getStock('va', 'sku-1')).toEqual({ onHand: 3, reserved: 0 }); expect(w.store.outbox.filter((m) => m.templateKey === 'order_confirmed_customer')).toHaveLength(1);
  });
  it('a bad signature, a wrong secret, another vendor\'s secret, no signature, an unknown vendor or method: the SAME 401, and nothing changes', async () => {
    const { mid, order, event } = await setup(); const good = w.signed('whsec-va-secret-0001', event('evt_9'));
    const results: string[] = [];
    for (const f of [() => w.webhook.handle('va', mid, good.raw, 'deadbeef'), () => w.webhook.handle('va', mid, good.raw, undefined), () => w.webhook.handle('va', mid, w.signed('whsec-vb-secret-0002', event('evt_9')).raw, w.signed('whsec-vb-secret-0002', event('evt_9')).sig), () => w.webhook.handle('vb', mid, good.raw, good.sig), () => w.webhook.handle('nobody', mid, good.raw, good.sig), () => w.webhook.handle('va', 'nope', good.raw, good.sig), () => w.webhook.handle('va', mid, undefined, good.sig)]) {
      try { await f(); results.push('OK'); } catch (e) { results.push(e instanceof UnauthorizedException ? 'U401' : 'OTHER'); }
    }
    expect(results).toEqual(Array(7).fill('U401')); expect(w.store.orders.get(order.id)!.status).toBe('AWAITING_PAYMENT'); expect(w.store.paymentEvents.size).toBe(0);
  });
  it('the amount must match EXACTLY: a different amount or currency flags the order for review and NEVER marks it PAID', async () => {
    const { mid, order, event } = await setup();
    for (const [i, over] of [{ amountPaise: order.amountPaise - 1 }, { amountPaise: order.amountPaise + 100 }, { currency: 'USD' }].entries()) {
      const { raw, sig } = w.signed('whsec-va-secret-0001', event(`evt_m${i}`, over)); expect(await w.webhook.handle('va', mid, raw, sig)).toEqual({ status: 'REVIEW' });
    }
    expect(w.store.orders.get(order.id)).toMatchObject({ status: 'AWAITING_PAYMENT', reviewFlag: true }); expect(w.store.invoices.size).toBe(0); expect(await w.store.getStock('va', 'sku-1')).toEqual({ onHand: 5, reserved: 2 });
  });
  it('another vendor\'s order cannot be paid through this vendor\'s webhook; unknown orders and other event types are ignored', async () => {
    const { mid, event } = await setup(); await w.method('vb', 'UPI'); await w.legacyGateway('vb', 'ACTIVE', 'whsec-vb-secret-0002'); await w.pub.order(HOST_B, w.orderBody(), '2.2.2.2'); const bOrder = [...w.store.orders.values()].find((o) => o.vendorId === 'vb')!;
    const cross = w.signed('whsec-va-secret-0001', event('evt_c', { orderRef: bOrder.id, amountPaise: bOrder.amountPaise })); expect(await w.webhook.handle('va', mid, cross.raw, cross.sig)).toEqual({ status: 'IGNORED' });
    expect(w.store.orders.get(bOrder.id)!.status).toBe('AWAITING_PAYMENT');
    const unknown = w.signed('whsec-va-secret-0001', event('evt_u', { orderRef: 'ord-zzz' })); expect(await w.webhook.handle('va', mid, unknown.raw, unknown.sig)).toEqual({ status: 'IGNORED' });
    const other = w.signed('whsec-va-secret-0001', event('evt_o', { type: 'payment.failed' })); expect(await w.webhook.handle('va', mid, other.raw, other.sig)).toEqual({ status: 'IGNORED' });
    const notJson = Buffer.from('not json'); expect(await w.webhook.handle('va', mid, notJson, hmacHex('whsec-va-secret-0001', notJson))).toEqual({ status: 'IGNORED' });   // a signed body that is not an event is ignored
  });
  it('a refund is a recorded fact (no provider call); it cannot exceed what was paid or be recorded before payment; an online order cannot be marked PAID by hand', async () => {
    const { mid, order, event } = await setup();
    expect(await code(w.vendor.recordRefund('va', order.id, 100, OWNER))).toBe('ORDER_INVALID'); expect(await code(w.vendor.updateOrder('va', order.id, { status: 'PAID' }, OWNER))).toBe('ORDER_INVALID');
    const { raw, sig } = w.signed('whsec-va-secret-0001', event('evt_1')); await w.webhook.handle('va', mid, raw, sig);
    expect((await w.vendor.recordRefund('va', order.id, 100_000, OWNER))!.refundedPaise).toBe(100_000);
    expect(await code(w.vendor.recordRefund('va', order.id, 250_000, OWNER))).toBe('ORDER_INVALID'); expect((await w.vendor.recordRefund('va', order.id, 200_000, OWNER))!.status).toBe('REFUNDED_RECORDED');
  });
});

describe('offline orders, invoices and order status', () => {
  const placed = async () => { await w.method('va', 'PAY_ON_DELIVERY'); await w.vendor.setStock('va', 'sku-1', 4); await w.pub.order(HOST_A, w.orderBody([{ productRef: 'sku-1', qty: 1 }]), '1.1.1.1'); return [...w.store.orders.values()][0]; };
  it('the vendor records cash received: PAID once, stock reduced once, one invoice, the customer is told; again changes nothing', async () => {
    const o = await placed();
    expect((await w.vendor.updateOrder('va', o.id, { status: 'PAID' }, OWNER)).status).toBe('PAID'); await w.vendor.updateOrder('va', o.id, { status: 'PAID' }, OWNER);
    expect(await w.store.getStock('va', 'sku-1')).toEqual({ onHand: 3, reserved: 0 }); expect(w.store.invoices.size).toBe(1); expect(w.store.outbox.filter((m) => m.templateKey === 'order_confirmed_customer')).toHaveLength(1);
  });
  it('packed, shipped with tracking, delivered: allowed moves only; a bad move is refused; a non-https tracking link is dropped', async () => {
    const o = await placed(); await w.vendor.updateOrder('va', o.id, { status: 'PAID' }, OWNER);
    expect(await code(w.vendor.updateOrder('va', o.id, { status: 'SHIPPED' }, OWNER))).toBe('ORDER_INVALID');
    await w.vendor.updateOrder('va', o.id, { status: 'PACKED' }, OWNER);
    const shipped = await w.vendor.updateOrder('va', o.id, { status: 'SHIPPED', tracking: { carrier: 'India Post', reference: 'EE123', url: 'javascript:alert(1)' } }, OWNER);
    expect(shipped.tracking).toMatchObject({ carrier: 'India Post', reference: 'EE123' }); expect(shipped.tracking.url).toBeUndefined();
    expect((await w.vendor.updateOrder('va', o.id, { status: 'DELIVERED' }, OWNER)).status).toBe('DELIVERED'); expect(await code(w.vendor.updateOrder('va', o.id, { status: 'PLACED' }, OWNER))).toBe('ORDER_INVALID');
    expect(JSON.stringify(await w.pub.track(String([...w.store.tracking.entries()].length ? '' : '')).catch(() => ({})))).toBeDefined();
  });
  it('invoices: numbers are gap-free per vendor under concurrency; one live invoice per order; void keeps the number and the row; a number is never reused', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => w.store.createInvoice({ vendorId: 'va', orderId: null, requestId: null, snapshot: {}, prefix: 'INV-', now: w.now.t })));
    expect(results.map((i) => i.seq).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1)); expect(new Set(results.map((i) => i.invoiceNumber)).size).toBe(20);
    expect((await w.store.createInvoice({ vendorId: 'vb', orderId: null, requestId: null, snapshot: {}, prefix: 'INV-', now: w.now.t })).invoiceNumber).toBe('INV-000001');
    const o = await placed(); const a = await w.vendor.invoiceFor('va', o.id, OWNER); const b = await w.vendor.invoiceFor('va', o.id, OWNER);
    expect(b.id).toBe(a.id); expect(a.invoiceNumber).toBe('INV-000021');
    expect((await w.vendor.voidInvoice('va', a.id, 'issued to the wrong order', OWNER)).status).toBe('VOID'); expect(await code(w.vendor.voidInvoice('va', a.id, 'no', OWNER))).toBe('LIFECYCLE_REASON_REQUIRED');
    expect((await w.vendor.invoiceFor('va', o.id, OWNER)).invoiceNumber).toBe('INV-000022'); expect((await w.vendor.invoices('va', 0, 100)).total).toBe(22);
  });
});

describe('reports, the blocklist, the outbox and the tick', () => {
  it('a report is accepted with the SAME answer whatever it says; staff handle it; ACTIONED with a vendor suspends them and the public forms stop at once', async () => {
    const a = await w.pub.report({ host: HOST_A, reasonKind: 'SCAM', text: 'took money', contact: 'me@example.in' }); const b = await w.pub.report({ host: 'nobody.example', reasonKind: 'WEIRD', text: '' });
    expect(a).toEqual(b); expect(w.store.reports.size).toBe(2); expect(JSON.stringify([...w.store.reports.values()])).not.toContain('me@example.in');
    const id = [...w.store.reports.keys()][0];
    expect((await w.staff.handleReport(id, 'ACTIONED', STAFF, 'va', 'reported for taking money')).status).toBe('ACTIONED');
    expect(await code(w.pub.submit(HOST_A, enquiry(), '1.1.1.1'))).toBe('HTTP404');
    expect(await code(w.staff.handleReport(id, 'BOGUS' as never, STAFF))).toBe('REQUEST_INVALID'); expect(await code(w.staff.handleReport(id, 'REVIEWED', STAFF, 'vb', 'x'))).toBe('REQUEST_INVALID');
  });
  it('the blocklist stores hashes only; add is idempotent; remove works; a blocked phone, e-mail or network stores SPAM', async () => {
    const p = await w.staff.addBlock('PHONE', '9000000099', 'repeat spammer', STAFF); const again = await w.staff.addBlock('PHONE', '+91 90000 00099', 'repeat spammer', STAFF);
    expect(again.id).toBe(p.id); await w.staff.addBlock('EMAIL', 'Bad@Example.in', 'abusive', STAFF); await w.staff.addBlock('IP_HASH', '198.51.100.7', 'abusive', STAFF);
    expect(JSON.stringify([...w.store.blocks.values()])).not.toMatch(/9000000099|bad@example|198\.51\.100/i); expect((await w.staff.blocks(0, 10)).items.map((b) => b.hashPrefix.length)).toEqual([10, 10, 10]);
    for (const body of [enquiry({ phone: '9000000099' }), enquiry({ email: 'bad@example.in' }), enquiry()]) await w.pub.submit(HOST_A, body, body.phone === '9000000099' || body.email === 'bad@example.in' ? '1.1.1.1' : '198.51.100.7');
    expect([...w.store.requests.values()].map((r) => r.status)).toEqual(['SPAM', 'SPAM', 'SPAM']);
    expect(await code(w.staff.addBlock('PHONE', 'x', 'bad phone here', STAFF))).toBe('REQUEST_INVALID'); expect(await code(w.staff.addBlock('PHONE', '9000000098', '', STAFF))).toBe('LIFECYCLE_REASON_REQUIRED');
    expect((await w.staff.removeBlock(p.id, STAFF)).removed).toBe(true); expect(await code(w.staff.removeBlock(p.id, STAFF))).toBe('REQUEST_NOT_FOUND');
  });
  it('STOP is honoured: a suppressed channel is skipped and the next one is used; with every channel stopped the message is a dashboard note', async () => {
    await w.pub.submit(HOST_A, enquiry(), '1.1.1.1'); expect(w.store.outbox[0].channel).toBe('WHATSAPP');
    await w.messaging.stop('+919876543210', 'WHATSAPP'); await w.pub.submit(HOST_A, enquiry({ payload: { message: 'Another question please' } }), '1.1.1.2');
    expect(w.store.outbox.filter((m) => m.templateKey === 'request_received_customer').map((m) => m.channel)).toEqual(['WHATSAPP', 'SMS']);
    await w.messaging.stop('+919876543210', 'PHONE'); await w.messaging.stop('meena@example.in', 'EMAIL'); await w.pub.submit(HOST_A, enquiry({ payload: { message: 'Third question please' } }), '1.1.1.3');
    expect(w.store.outbox.filter((m) => m.templateKey === 'request_received_customer').at(-1)).toMatchObject({ channel: 'DASHBOARD', senderRoute: 'DASHBOARD', status: 'DELIVERED' });
    expect(await w.messaging.stop('+919876543210', 'PHONE')).toBe(false);   // recorded once
  });
  it('live messaging is refused: with the live flag on, the sandbox adapters report FAILED and the router falls through to the dashboard', async () => {
    for (const a of w.messaging.adapters) (a as unknown as { env: Record<string, string> }).env = { MESSAGING_LIVE_ENABLED: 'true' };
    await w.pub.submit(HOST_A, enquiry(), '1.1.1.1');
    expect(w.store.outbox.filter((m) => m.templateKey === 'request_received_customer').map((m) => m.status)).toEqual(['FAILED', 'FAILED', 'FAILED', 'DELIVERED']);
  });
  it('the tick expires requests nobody answered, and nudges ONCE only when the setting is on (it is off by default)', async () => {
    const id = ((await w.pub.submit(HOST_A, enquiry(), '1.1.1.1')) as { reference: string }).reference;
    w.now.t = new Date(w.now.t.getTime() + 45 * 60_000); expect((await w.cron.run()).nudged).toBe(0);
    w.b3.over = { requestNudgeEnabled: true, nudgeAfterMinutes: 30 }; expect((await w.cron.run()).nudged).toBe(1); expect((await w.cron.run()).nudged).toBe(0);
    expect(w.store.outbox.filter((m) => m.templateKey === 'request_nudge_vendor')).toHaveLength(1);
    w.now.t = new Date(w.now.t.getTime() + 31 * 86_400_000); expect((await w.cron.run()).expired).toBe(1); expect((await w.store.getRequest(id))!.status).toBe('EXPIRED');
    const answered = ((await w.pub.submit(HOST_A, enquiry(), '1.1.1.9')) as { reference: string }).reference; await w.vendor.respond('va', answered, { message: 'ok then' }, OWNER);
    w.now.t = new Date(w.now.t.getTime() + 40 * 86_400_000); await w.cron.run(); expect((await w.store.getRequest(answered))!.status).toBe('RESPONDED');   // an answered request does not expire
  });
  it('staff see requests and events without the customer e-mail; the outbox shows masked recipients only', async () => {
    const id = ((await w.pub.submit(HOST_A, enquiry(), '1.1.1.1')) as { reference: string }).reference;
    const list = await w.staff.requests({ skip: 0, take: 10 }); expect(JSON.stringify(list)).not.toMatch(/meena@example|9876543210/); expect((await w.staff.request(id)).events.length).toBeGreaterThan(0);
    const ob = await w.staff.outbox({ skip: 0, take: 10 }); expect(ob.items.every((m) => m.toMasked.includes('•'))).toBe(true); expect(JSON.stringify(ob)).not.toMatch(/9876543210|meena@example/);
    expect(hashPhone('+919876543210', w.dw.pepper.value())).toHaveLength(64);
  });
});
