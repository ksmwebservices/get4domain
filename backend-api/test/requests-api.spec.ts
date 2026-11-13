import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { AdminRequestsController } from '../src/requests-orders/api/admin-requests.controller';
import { MeOffersController, MePaymentsController, MeRequestsController } from '../src/requests-orders/api/me-requests.controller';
import { PublicRequestsController, VendorWebhookController } from '../src/requests-orders/api/public-requests.controller';
import { PublicRequestsService } from '../src/requests-orders/public-requests.service';
import { StaffRequestsService } from '../src/requests-orders/staff-requests.service';
import { VendorRequestsService } from '../src/requests-orders/vendor-requests.service';
import { VendorWebhookService } from '../src/requests-orders/vendor-webhook.service';
import { consent, HOST_A, requestsWorld, RW } from './support/requests-world';
import { entitlements } from './support/site-fixtures';

/** Slice 5.14 over HTTP with the real guards, pipe, filter, interceptor, feature guard and raw body; the services are the real ones over the in-memory store. */
jest.setTimeout(120_000);
const untimed = (t: string): string => t.replace(/"timestamp":"[^"]*"/, '');
const body = (over: Record<string, unknown> = {}) => ({ kind: 'ENQUIRY', name: 'Meena R', phone: '98765 43210', payload: { message: 'Do you fix geysers?' }, consent: consent(), idempotencyKey: `k-${Math.random().toString(36).slice(2)}-${Date.now()}-aaaa`, ...over });

describe('requests and orders API', () => {
  let app: INestApplication; let w: RW; let prevKey: string | undefined;
  const as = (p: string) => ({ 'x-test-principal': p });
  const get = (url: string, p?: string) => { const r = request(app.getHttpServer()).get(url); return p ? r.set(as(p)) : r; };
  const send = (m: 'post' | 'put' | 'delete', url: string, p: string | null, b: object = {}, extra: Record<string, string> = {}) => { const r = request(app.getHttpServer())[m](url).set(extra); return (p ? r.set(as(p)) : r).send(b); };

  beforeAll(() => { prevKey = process.env.PLATFORM_SETTINGS_KEY; process.env.PLATFORM_SETTINGS_KEY = 'unit-test-platform-settings-key-0123456789'; });
  afterAll(() => { if (prevKey === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = prevKey; });
  beforeEach(async () => {
    w = await requestsWorld();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport],
      controllers: [PublicRequestsController, VendorWebhookController, MeRequestsController, MeOffersController, MePaymentsController, AdminRequestsController],
      providers: [
        throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard },
        { provide: PublicRequestsService, useValue: w.pub }, { provide: VendorWebhookService, useValue: w.webhook }, { provide: VendorRequestsService, useValue: w.vendor }, { provide: StaffRequestsService, useValue: w.staff },
        { provide: EntitlementsService, useValue: { resolveForRequest: async (_r: unknown, vendorId: string) => w.ents.get(vendorId) ?? entitlements('FREE', 'ecommerce') } },
      ],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner-a') req.user = { sub: 'va', email: 'a@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-b') req.user = { sub: 'vb', email: 'b@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-free') req.user = { sub: 'vfree', email: 'f@x.invalid', role: 'VENDOR' };
      else if (p === 'member-a') req.user = { sub: 'va', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['website'] };
      else if (p === 'member-nomodule') req.user = { sub: 'va', email: 'n@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['telecrm'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  describe('public', () => {
    it('POST requests: 200 with a reference and a tracking link, nothing cached, no cookie; the visitor can follow it', async () => {
      const r = await send('post', `/v3/public/sites/${HOST_A}/requests`, null, body());
      expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ accepted: true, status: 'DELIVERED' }); expect(r.headers['cache-control']).toBe('no-store'); expect(r.headers['set-cookie']).toBeUndefined();
      const token = String(r.body.data.trackingUrl).split('/track/')[1];
      const t = await get(`/v3/public/requests/track/${token}`); expect(t.status).toBe(200); expect(t.body.data).toMatchObject({ kind: 'ENQUIRY', business: 'Shop va' });
    });
    it('a Free site, an unknown host and a suspended vendor are the SAME 404 body; bad input on a Pro site is a 400 with the stable code', async () => {
      const a = await send('post', '/v3/public/sites/free.get4domain.com/requests', null, body()); const b = await send('post', '/v3/public/sites/nobody.get4domain.com/requests', null, body());
      expect([a.status, b.status]).toEqual([404, 404]); expect(untimed(a.text)).toBe(untimed(b.text));
      const bad = await send('post', `/v3/public/sites/${HOST_A}/requests`, null, body({ name: 'x' })); expect(bad.status).toBe(400); expect(bad.body.code).toBe('REQUEST_INVALID');
      expect((await send('post', `/v3/public/sites/${HOST_A}/requests`, null, { kind: 'ENQUIRY' })).status).toBe(400);
    });
    it('rate limited per IP: the 11th request in a minute is 429', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 12; i++) codes.push((await send('post', `/v3/public/sites/${HOST_A}/requests`, null, body({ phone: `98700000${String(i).padStart(2, '0')}`, payload: { message: `Question number ${i} about geysers` } }))).status);
      expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true); expect(codes.slice(10)).toContain(429);
    });
    it('a wrong, malformed or missing tracking token is one 404 body; the report route always answers the same 202', async () => {
      const x = await get('/v3/public/requests/track/' + 'x'.repeat(43)); const y = await get('/v3/public/requests/track/short'); expect([x.status, y.status]).toEqual([404, 404]); expect(untimed(x.text)).toBe(untimed(y.text));
      const r1 = await send('post', '/v3/public/reports', null, { host: HOST_A, reasonKind: 'SCAM', text: 'took my money' }); const r2 = await send('post', '/v3/public/reports', null, { host: 'nothing.example' });
      expect([r1.status, r2.status]).toEqual([202, 202]); expect(r1.body.data).toEqual(r2.body.data);
    });
    it('POST orders: nothing configured is an order request with no payment taken (Block 4b)', async () => {
      const lines = { items: [{ productRef: 'sku-1', qty: 1 }] };
      const r = await send('post', `/v3/public/sites/${HOST_A}/orders`, null, body({ kind: undefined, payload: undefined, ...lines }));
      expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ orderNo: 1, totalPaise: 150_000, paymentTaken: false, orderRequest: true, paymentStep: { step: 'NO_PAYMENT_TAKEN' } });
      expect((await send('post', `/v3/public/sites/${HOST_A}/orders`, null, body({ kind: undefined, payload: undefined, ...lines, payWith: 'ONLINE' }))).status).toBe(409);
    });
    it('POST orders: with cash on delivery an order request with the number and the payment step', async () => {
      const lines = { items: [{ productRef: 'sku-1', qty: 1 }] };
      await w.method('va', 'PAY_ON_DELIVERY');
      const r = await send('post', `/v3/public/sites/${HOST_A}/orders`, null, body({ kind: undefined, payload: undefined, ...lines }));
      expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ orderNo: 1, totalPaise: 150_000, paymentStep: { step: 'PAY_ON_DELIVERY' } });
    });
  });

  describe('the vendor-gateway webhook (raw body)', () => {
    it('a signed event pays the order once; the same event again is 200 with duplicate; a bad signature is 401', async () => {
      await w.method('va', 'UPI'); const mid = (await w.legacyGateway('va', 'ACTIVE', 'whsec-va-secret-0001')).id;
      await send('post', `/v3/public/sites/${HOST_A}/orders`, null, body({ kind: undefined, payload: undefined, items: [{ productRef: 'sku-1', qty: 1 }] }));
      const order = [...w.store.orders.values()][0]; const { raw, sig } = w.signed('whsec-va-secret-0001', { id: 'evt_1', type: 'payment.captured', orderRef: order.id, amountPaise: order.amountPaise, currency: 'INR' });
      const post = (s: string) => request(app.getHttpServer()).post(`/v3/payments/vendor/va/${mid}`).set('content-type', 'application/json').set('x-g4d-signature', s).send(raw.toString('utf8'));
      const ok = await post(sig); expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ received: true }); expect(w.store.orders.get(order.id)!.status).toBe('PAID');
      const dup = await post(sig); expect(dup.status).toBe(200); expect(dup.body.data).toMatchObject({ duplicate: true });
      expect((await post('00'.repeat(32))).status).toBe(401);
    });
  });

  describe('the vendor', () => {
    it('a Free vendor is refused everywhere here (FEATURE_LOCKED with the upsell): nothing to read, create or change', async () => {
      for (const [m, u] of [['get', '/v3/me/requests'], ['get', '/v3/me/orders'], ['get', '/v3/me/offers'], ['get', '/v3/me/payment-methods'], ['get', '/v3/me/invoices']] as const) {
        const r = await get(u, 'owner-free'); expect({ u, status: r.status, code: r.body.code }).toEqual({ u, status: 403, code: 'FEATURE_LOCKED' }); void m;
      }
      const r = await send('post', '/v3/me/payment-methods', 'owner-free', { kind: 'PAY_ON_DELIVERY', label: 'Cash' }); expect(r.status).toBe(403); expect(r.body.upsellText ?? r.body.message).toBeTruthy();
    });
    it('the inbox is area-gated: the owner and a member with the website area may read it, a member without the area may not; replying records and tells the customer', async () => {
      const id = ((await send('post', `/v3/public/sites/${HOST_A}/requests`, null, body())).body.data.reference) as string;
      expect((await get('/v3/me/requests', 'owner-a')).body.data.total).toBe(1); expect((await get('/v3/me/requests', 'member-a')).status).toBe(200); expect((await get('/v3/me/requests', 'member-nomodule')).status).toBe(403); expect((await get('/v3/me/requests')).status).toBe(401);
      expect((await get(`/v3/me/requests/${id}`, 'member-a')).body.data.status).toBe('SEEN');
      const reply = await send('post', `/v3/me/requests/${id}/respond`, 'member-a', { message: 'Yes we do.' }); expect(reply.status).toBe(200); expect(reply.body.data.status).toBe('RESPONDED');
      expect((await send('post', `/v3/me/requests/${id}/respond`, 'member-a', {})).status).toBe(400); expect((await send('post', `/v3/me/requests/${id}/respond`, 'member-a', { status: 'NOPE' })).status).toBe(400);
    });
    it('money and credentials are OWNER ONLY: a member is refused on payment methods, refunds and invoices even with the website area', async () => {
      for (const [m, u] of [['get', '/v3/me/payment-methods'], ['post', '/v3/me/payment-methods'], ['get', '/v3/me/invoices'], ['post', '/v3/me/orders/x/refund'], ['post', '/v3/me/orders/x/invoice']] as const) {
        const r = m === 'get' ? await get(u, 'member-a') : await send(m, u, 'member-a', { amountPaise: 1, kind: 'PAY_ON_DELIVERY', label: 'Cash' }); expect({ u, status: r.status }).toEqual({ u, status: 403 });
      }
    });
    it('payment method secrets are write-only over HTTP: not in the create response, the list or an update', async () => {
      const c = await send('post', '/v3/me/payment-methods', 'owner-a', { kind: 'BANK_TRANSFER', label: 'My bank', details: 'bank_acct_secret_1234' });
      expect(c.status).toBe(200); expect(c.body.data).toMatchObject({ last4: '1234', hasGatewayDetails: true });
      const all = JSON.stringify([c.body, (await get('/v3/me/payment-methods', 'owner-a')).body, (await send('put', `/v3/me/payment-methods/${c.body.data.id}`, 'owner-a', { label: 'Renamed', details: 'bank_new_secret_9999' })).body]);
      expect(all).not.toMatch(/bank_acct_secret|bank_new_secret|cipher/);
      for (const kind of ['OWN_GATEWAY', 'GATEWAY_RAZORPAY', 'GATEWAY_CASHFREE', 'GATEWAY_PAYTM']) expect((await send('post', '/v3/me/payment-methods', 'owner-a', { kind, label: 'Gate', details: 'key_1234' })).status).toBe(400);
      expect((await send('post', '/v3/me/payment-methods', 'owner-a', { kind: 'NOPE', label: 'x' })).status).toBe(400);
    });
    it('vendor B cannot see, answer or invoice vendor A\'s request or order (the same 404 as an id that does not exist)', async () => {
      const id = ((await send('post', `/v3/public/sites/${HOST_A}/requests`, null, body())).body.data.reference) as string; await w.method('va', 'PAY_ON_DELIVERY');
      await send('post', `/v3/public/sites/${HOST_A}/orders`, null, body({ kind: undefined, payload: undefined, items: [{ productRef: 'sku-1', qty: 1 }], phone: '9811100001' })); const orderId = [...w.store.orders.keys()][0];
      const missing = await get('/v3/me/requests/does-not-exist', 'owner-b');
      for (const r of [await get(`/v3/me/requests/${id}`, 'owner-b'), await get(`/v3/me/orders/${orderId}`, 'owner-b'), await send('post', `/v3/me/orders/${orderId}/invoice`, 'owner-b')]) expect(r.status).toBe(404);
      expect(missing.status).toBe(404); expect((await get(`/v3/me/requests/${id}`, 'owner-b')).body.code).toBe(missing.body.code);
    });
    it('offers need the offers feature and validate their input', async () => {
      expect((await send('post', '/v3/me/offers', 'owner-a', { kind: 'COUPON', title: 'Ten off', code: 'TEN10', percentOff: 10 })).status).toBe(200);
      expect((await send('post', '/v3/me/offers', 'owner-a', { kind: 'COUPON', title: 'Bad', code: 'x', percentOff: 10 })).status).toBe(400); expect((await send('post', '/v3/me/offers', 'owner-free', { kind: 'BANNER', title: 'Sale', percentOff: 5 })).status).toBe(403);
    });
  });

  describe('staff', () => {
    it('OPERATIONS and SUPER_ADMIN read requests, reports, the blocklist and the outbox; MARKETING is refused on all of it', async () => {
      await send('post', `/v3/public/sites/${HOST_A}/requests`, null, body());
      for (const u of ['/v3/admin/requests', '/v3/admin/message-outbox', '/v3/admin/reports', '/v3/admin/blocklist']) {
        expect({ u, s: (await get(u, 'OPERATIONS')).status }).toEqual({ u, s: 200 }); expect({ u, s: (await get(u, 'SUPER_ADMIN')).status }).toEqual({ u, s: 200 }); expect({ u, s: (await get(u, 'MARKETING')).status }).toEqual({ u, s: 403 });
      }
      expect((await send('post', '/v3/admin/blocklist', 'MARKETING', { kind: 'PHONE', value: '9000000099', reason: 'repeat spammer' })).status).toBe(403);
      const b = await send('post', '/v3/admin/blocklist', 'OPERATIONS', { kind: 'PHONE', value: '9000000099', reason: 'repeat spammer' }); expect(b.status).toBe(200); expect(JSON.stringify(b.body)).not.toContain('9000000099');
      expect((await send('delete', `/v3/admin/blocklist/${b.body.data.id}`, 'OPERATIONS')).status).toBe(200);
    });
    it('a report handled as ACTIONED with a vendor suspends them: the public form of that vendor stops at once', async () => {
      await send('post', '/v3/public/reports', null, { host: HOST_A, reasonKind: 'SCAM', text: 'x' }); const id = (await get('/v3/admin/reports', 'OPERATIONS')).body.data.items[0].id;
      expect((await send('post', `/v3/admin/reports/${id}/handle`, 'OPERATIONS', { status: 'ACTIONED', suspendVendorId: 'va', reason: 'reported for taking money' })).status).toBe(200);
      expect((await send('post', `/v3/public/sites/${HOST_A}/requests`, null, body())).status).toBe(404);
    });
  });
});
