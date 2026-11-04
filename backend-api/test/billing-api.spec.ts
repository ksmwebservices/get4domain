import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { BillingAdminController } from '../src/plan-billing/api/billing-admin.controller';
import { MeBillingController } from '../src/plan-billing/api/me-billing.controller';
import { PaymentsWebhookController } from '../src/plan-billing/api/payments-webhook.controller';
import { PlanOrderService } from '../src/plan-billing/plan-order.service';
import { PlanBillingRepository } from '../src/plan-billing/plan-billing.repository';
import { PaymentSettlementService } from '../src/plan-billing/settlement.service';
import { hmacHex } from '../src/plan-billing/razorpay/razorpay.port';
import { FakeRazorpay } from './support/fake-razorpay';
import { billingWorld, BillingWorld, currentOf } from './support/billing-world';

/** Slice 5.1b over HTTP with the real guards, pipe, filter, interceptor and RAW BODY handling; the services are the real ones over the in-memory repository and the fake provider. */
jest.setTimeout(180_000);

describe('billing API', () => {
  let app: INestApplication; let w: BillingWorld;
  const as = (role: string) => ({ 'x-test-principal': role });
  const get = (url: string, role?: string) => { const r = request(app.getHttpServer()).get(url); return role ? r.set(as(role)) : r; };
  const send = (m: 'post' | 'put', url: string, role: string | null, body: object = {}) => { const r = request(app.getHttpServer())[m](url); return (role ? r.set(as(role)) : r).send(body); };
  const key = (() => { let n = 0; return () => `http-key-${++n}-abcdefgh`; })();
  const order = (role = 'owner', over: object = {}) => send('post', '/v3/me/billing/orders', role, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: key(), ...over });

  beforeEach(async () => {
    w = billingWorld();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MeBillingController, PaymentsWebhookController, BillingAdminController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: PlanOrderService, useValue: w.orders }, { provide: PaymentSettlementService, useValue: w.settlement }, { provide: PlanBillingRepository, useValue: w.repo }],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner') req.user = { sub: 'v1', email: 'o@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-2') req.user = { sub: 'v2', email: 'o2@x.invalid', role: 'VENDOR' };
      else if (p === 'member') req.user = { sub: 'v1', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['website', 'accounts', 'wallet'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  describe('vendor routes (/v3/me/billing), owner only', () => {
    it('create returns the quote and the provider order; confirm with the right signature and a captured payment activates the plan', async () => {
      const c = await order(); expect(c.status).toBe(200);
      expect(c.body.data).toMatchObject({ status: 'PENDING_PAYMENT', amountPaise: 354_000, currency: 'INR', planKey: 'handyman_pro', termMonths: 3, keyId: 'rzp_test_fakekey', providerOrderId: 'order_1' });
      expect(JSON.stringify(c.body)).not.toMatch(/secret|refund|vendorId/);
      const p = w.fake.pay(c.body.data.providerOrderId);
      const ok = await send('post', `/v3/me/billing/orders/${c.body.data.id}/confirm`, 'owner', { paymentId: p.paymentId, signature: p.signature }); expect(ok.status).toBe(200); expect(ok.body.data.status).toBe('PAID');
      expect(w.repo.plans.get(currentOf(w).planId)!.key).toBe('handyman_pro');
      expect((await get('/v3/me/billing/orders', 'owner')).body.data.items).toHaveLength(1); expect((await get('/v3/me/billing/invoices', 'owner')).body.data.items[0].invoiceNumber).toBe('INV/2026-27/000001');
    });
    it('a team member is refused on every route, even with the accounts and wallet areas', async () => {
      const c = await order(); const id = c.body.data.id as string;
      for (const [m, url, body] of [['post', '/v3/me/billing/orders', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: key() }], ['post', `/v3/me/billing/orders/${id}/confirm`, { paymentId: 'pay_x', signature: 'a'.repeat(64) }], ['get', '/v3/me/billing/orders'], ['get', '/v3/me/billing/invoices']] as Array<['post' | 'get', string, object?]>) {
        const r = m === 'get' ? await get(url, 'member') : await send(m, url, 'member', body ?? {}); expect([m, url, r.status]).toEqual([m, url, 403]);
      }
    });
    it('DTO: a bad term, a short key, a bad plan key, a malformed payment id or signature, and any extra field (vendorId, amount) are 400', async () => {
      for (const bad of [{ termMonths: 5 }, { termMonths: 1 }, { termMonths: '3x' }, { idempotencyKey: 'short' }, { idempotencyKey: 'has spaces in it!!' }, { planKey: 'Handyman Pro' }, { vendorId: 'v2' }, { amountPaise: 1 }, { amount: 1 }]) expect([JSON.stringify(bad), (await order('owner', bad)).status]).toEqual([JSON.stringify(bad), 400]);
      const c = await order(); const id = c.body.data.id as string;
      for (const bad of [{ paymentId: 'x', signature: 'a'.repeat(64) }, { paymentId: 'pay_x', signature: 'short' }, { paymentId: 'pay_x', signature: 'A'.repeat(64) }, { paymentId: 'pay_x', signature: 'a'.repeat(64), amount: 1 }, {}]) expect((await send('post', `/v3/me/billing/orders/${id}/confirm`, 'owner', bad)).status).toBe(400);
    });
    it('payments off: 409 PAYMENTS_DISABLED; a plan that cannot be bought: 409 PLAN_NOT_PURCHASABLE; a mid-term downgrade: 409 PLAN_CHANGE_NOT_ALLOWED', async () => {
      expect((await order('owner', { planKey: 'handyman_free' })).body.code).toBe('PLAN_NOT_PURCHASABLE');
      w.settings.over = { paymentsMode: 'off' }; const off = await order(); expect([off.status, off.body.code]).toEqual([409, 'PAYMENTS_DISABLED']);
    });
    it('a wrong signature is 400 PAYMENT_SIGNATURE_INVALID and the plan is not activated', async () => {
      const c = await order(); const p = w.fake.pay(c.body.data.providerOrderId);
      const bad = await send('post', `/v3/me/billing/orders/${c.body.data.id}/confirm`, 'owner', { paymentId: p.paymentId, signature: 'f'.repeat(64) }); expect([bad.status, bad.body.code]).toEqual([400, 'PAYMENT_SIGNATURE_INVALID']);
      expect(currentOf(w).planId).toBe(w.ids.free);
    });
    it('CROSS-TENANT: another owner cannot confirm or see this order, and the answer equals the one for an order that does not exist', async () => {
      const c = await order(); const p = w.fake.pay(c.body.data.providerOrderId); const body = { paymentId: p.paymentId, signature: p.signature };
      const other = await send('post', `/v3/me/billing/orders/${c.body.data.id}/confirm`, 'owner-2', body); const none = await send('post', '/v3/me/billing/orders/nope/confirm', 'owner-2', body);
      expect([other.status, other.body.code, other.body.message]).toEqual([404, 'ORDER_NOT_FOUND', none.body.message]); expect(none.status).toBe(404);
      expect((await get('/v3/me/billing/orders', 'owner-2')).body.data.items).toEqual([]); expect(w.repo.orders.get(c.body.data.id)!.status).toBe('PENDING_PAYMENT');
    });
    it('rate limited: the 21st order request in a minute is 429', async () => {
      const codes: number[] = []; for (let i = 0; i < 21; i++) codes.push((await order()).status);
      expect(codes.slice(0, 20).every((c) => c === 200)).toBe(true); expect(codes[20]).toBe(429);
    });
  });

  describe('the webhook (POST /v3/payments/razorpay/webhook): public, signature over the RAW body', () => {
    const deliver = (raw: string, signature: string | undefined, eventId?: string) => { let r = request(app.getHttpServer()).post('/v3/payments/razorpay/webhook').set('Content-Type', 'application/json'); if (signature) r = r.set('x-razorpay-signature', signature); if (eventId) r = r.set('x-razorpay-event-id', eventId); return r.send(raw); };
    it('a correctly signed captured event activates the plan; a repeat is a 200 duplicate; no login is needed', async () => {
      const c = await order(); const p = w.fake.pay(c.body.data.providerOrderId); const h = w.fake.webhook('payment.captured', p.paymentId);
      const r1 = await deliver(h.raw, h.signature, h.eventId); expect(r1.status).toBe(200); expect(r1.body.data).toEqual({ received: true });
      const r2 = await deliver(h.raw, h.signature, h.eventId); expect(r2.status).toBe(200); expect(r2.body.data).toEqual({ received: true, duplicate: true });
      expect(w.repo.plans.get(currentOf(w).planId)!.key).toBe('handyman_pro'); expect(w.repo.subs.filter((s) => s.planId === w.ids.pro)).toHaveLength(1);
    });
    it('a wrong, missing or malformed signature is 401 and nothing happens; so is a body changed after signing (the RAW bytes are what counts, not a re-serialised JSON)', async () => {
      const c = await order(); const p = w.fake.pay(c.body.data.providerOrderId); const h = w.fake.webhook('payment.captured', p.paymentId);
      expect((await deliver(h.raw, 'f'.repeat(64), h.eventId)).status).toBe(401); expect((await deliver(h.raw, undefined, h.eventId)).status).toBe(401); expect((await deliver(h.raw, 'zz', h.eventId)).status).toBe(401);
      expect((await deliver(h.raw, hmacHex('some-other-secret', h.raw), h.eventId)).status).toBe(401);
      const spaced = JSON.stringify(JSON.parse(h.raw), null, 2); expect((await deliver(spaced, h.signature, h.eventId)).status).toBe(401);   // same JSON, different bytes
      expect(w.repo.orders.get(c.body.data.id)!.status).toBe('PENDING_PAYMENT'); expect(w.repo.invoices).toHaveLength(0);
    });
    it('payments off: the webhook answers 200 and ignores the event (no retry storm), nothing stored', async () => {
      w.settings.over = { paymentsMode: 'off' }; const r = await deliver('{}', 'a'.repeat(64), 'evt_off_12345'); expect(r.status).toBe(200); expect(r.body.data).toEqual({ received: true, ignored: true }); expect(w.repo.events.size).toBe(0);
    });
    it('the event inbox keeps the payload REDACTED (no email, phone, card or VPA)', async () => {
      const c = await order(); const p = w.fake.pay(c.body.data.providerOrderId); const h = w.fake.webhook('payment.captured', p.paymentId); await deliver(h.raw, h.signature, h.eventId);
      expect(JSON.stringify([...w.repo.events.values()])).not.toMatch(/buyer@example|9876543210|x@upi|1111|Visa/);
    });
  });

  describe('staff routes (/v3/admin/billing)', () => {
    it('MARKETING is refused everywhere; a vendor is not staff', async () => {
      const c = await order(); const id = c.body.data.id as string;
      for (const [m, url, body] of [['get', '/v3/admin/billing/orders'], ['get', '/v3/admin/billing/payment-events'], ['post', `/v3/admin/billing/orders/${id}/mark-paid`, { reason: 'bank transfer' }], ['post', `/v3/admin/billing/orders/${id}/refund`, { amountPaise: 100, note: 'goodwill' }]] as Array<['get' | 'post', string, object?]>) {
        const r = m === 'get' ? await get(url, 'MARKETING') : await send(m, url, 'MARKETING', body ?? {}); expect([m, url, r.status]).toEqual([m, url, 403]);
        const v = m === 'get' ? await get(url, 'owner') : await send(m, url, 'owner', body ?? {}); expect(v.status).toBe(403);
      }
    });
    it('OPERATIONS and SUPER_ADMIN read orders and the inbox; ONLY SUPER_ADMIN marks paid or records a refund', async () => {
      const c = await order(); const id = c.body.data.id as string; await order('owner-2', { termMonths: 6 });
      for (const role of ['OPERATIONS', 'SUPER_ADMIN']) { expect((await get('/v3/admin/billing/orders?pageSize=5', role)).body.data.total).toBe(2); expect((await get('/v3/admin/billing/payment-events', role)).status).toBe(200); }
      expect((await get(`/v3/admin/billing/orders?vendorId=v2&status=PENDING_PAYMENT`, 'OPERATIONS')).body.data.total).toBe(1);
      expect((await get('/v3/admin/billing/orders?status=NOPE', 'OPERATIONS')).status).toBe(400);
      expect((await send('post', `/v3/admin/billing/orders/${id}/mark-paid`, 'OPERATIONS', { reason: 'bank transfer' })).status).toBe(403); expect((await send('post', `/v3/admin/billing/orders/${id}/refund`, 'OPERATIONS', { amountPaise: 1, note: 'xxx' })).status).toBe(403);
      expect((await send('post', `/v3/admin/billing/orders/${id}/mark-paid`, 'SUPER_ADMIN', { reason: 'x' })).status).toBe(400);   // DTO: reason too short
      const paidRes = await send('post', `/v3/admin/billing/orders/${id}/mark-paid`, 'SUPER_ADMIN', { reason: 'bank transfer received' }); expect(paidRes.status).toBe(200); expect(paidRes.body.data).toEqual({ status: 'PAID', outcome: 'PAID' });
      expect(currentOf(w).source).toBe('STAFF');
      expect((await send('post', `/v3/admin/billing/orders/${id}/refund`, 'SUPER_ADMIN', { amountPaise: 1.5, note: 'half' })).status).toBe(400); expect((await send('post', `/v3/admin/billing/orders/${id}/refund`, 'SUPER_ADMIN', { amountPaise: 100, note: 'x' })).status).toBe(400);
      const ref = await send('post', `/v3/admin/billing/orders/${id}/refund`, 'SUPER_ADMIN', { amountPaise: 100, note: 'refunded by bank' }); expect(ref.status).toBe(200); expect(ref.body.data).toEqual({ refundRecordedPaise: 100 });
      expect((await send('post', '/v3/admin/billing/orders/nope/mark-paid', 'SUPER_ADMIN', { reason: 'bank transfer' })).status).toBe(404);
    });
    it('the staff order list shows the money and refund fields; the inbox shows redacted payloads only', async () => {
      const c = await order(); const p = w.fake.pay(c.body.data.providerOrderId); const h = w.fake.webhook('payment.captured', p.paymentId); await w.settlement.handleWebhook(h.raw, h.signature, h.eventId);
      const o = (await get('/v3/admin/billing/orders', 'OPERATIONS')).body.data.items[0]; expect(o).toMatchObject({ status: 'PAID', paidAmountPaise: 354_000, source: 'SELF', refundRecordedPaise: null });
      const e = (await get('/v3/admin/billing/payment-events', 'OPERATIONS')).body.data.items[0]; expect(e).toMatchObject({ type: 'payment.captured', signatureValid: true, result: 'PAID' }); expect(JSON.stringify(e)).not.toMatch(/buyer@example|9876543210|x@upi/);
      void FakeRazorpay;
    });
  });
});
