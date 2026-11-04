// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { RenewalReminderService } from '../src/plan-billing/renewal-reminder.service';
import { BillingSettingsService } from '../src/plan-billing/settings/billing-settings.service';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { BillingFixture, evId, setUpBilling, tearDownBilling } from './support/billing-staging';
import { runCleanup } from './support/cleanup-guard';
import { FakeRazorpay } from './support/fake-razorpay';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * B2 slice 5.1b on STAGING, with the real database and the FAKE payment provider (nothing is charged, no Razorpay call is made): create an order, confirm it (wrong signature, then right),
 * the signed webhook (bad signature, duplicate, redaction), staff mark-paid and refund, invoices, the entitlement result after PAID, and the renewal reminder tick.
 * Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(180_000);

describe('plan purchase on staging (fake provider)', () => {
  let app: INestApplication; let prisma: PrismaClient; let fx: BillingFixture; const fake = new FakeRazorpay();
  let A: SeededTenant; let tokenA: string; let sup: string; let ops: string; let mkt: string;
  const api = (method: 'get' | 'post' | 'put', url: string, token?: string, body?: object) => { const r = request(app.getHttpServer())[method](url); const t = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? t.send(body) : t; };
  const key = (() => { let n = 0; return () => `v3test-${RUN_ID}-flow-${++n}`; })();
  const order = (over: object = {}) => api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: key(), ...over });

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma);
    app = await buildProvisioningTestApp({ billing: { fake } });
    A = await seedTenant(prisma, 'p51ba', RUN_ID); await makeSiteVendor(prisma, app.get(SubscriptionsService), A, RUN_ID, {}); tokenA = vendorToken(A.vendorId, A.email);
    sup = await seedStaff(prisma, 'p51bsup', RUN_ID, 'SUPER_ADMIN'); ops = await seedStaff(prisma, 'p51bops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p51bmkt', RUN_ID, 'MARKETING');
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  const planOf = async (): Promise<string> => (await prisma.v3PlanSubscription.findFirstOrThrow({ where: { vendorId: A.vendorId, currentVendorId: A.vendorId }, include: { plan: true } })).plan.key;

  it('create: a quote from the plan tables and a provider order; the plan and the entitlements do not change yet', async () => {
    const c = await order(); expect(c.status).toBe(200);
    expect(c.body.data).toMatchObject({ status: 'PENDING_PAYMENT', planKey: 'handyman_pro', termMonths: 3, amountPaise: 354_000, currency: 'INR' }); expect(c.body.data.providerOrderId).toBeTruthy();
    expect(await planOf()).toBe('handyman_free'); expect((await api('get', '/v3/me/entitlements', tokenA)).body.data.plan).toBe('handyman_free');
    const same = await api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'v3test-' + RUN_ID + '-same' }); const again = await api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'v3test-' + RUN_ID + '-same' });
    expect(again.body.data.id).toBe(same.body.data.id); expect(await prisma.v3PlanOrder.count({ where: { vendorId: A.vendorId, idempotencyKey: 'v3test-' + RUN_ID + '-same' } })).toBe(1);
  });

  let paidOrderId = '';
  it('confirm: a wrong signature is 400 and activates nothing; the right one (and a CAPTURED payment of the exact amount) activates Pro, writes the invoice and changes the entitlements', async () => {
    const c = await order({ termMonths: 6 }); const id = c.body.data.id as string; const p = fake.pay(c.body.data.providerOrderId);
    expect((await api('post', `/v3/me/billing/orders/${id}/confirm`, tokenA, { paymentId: p.paymentId, signature: 'f'.repeat(64) })).status).toBe(400); expect(await planOf()).toBe('handyman_free');
    const ok = await api('post', `/v3/me/billing/orders/${id}/confirm`, tokenA, { paymentId: p.paymentId, signature: p.signature }); expect(ok.status).toBe(200); expect(ok.body.data.status).toBe('PAID'); paidOrderId = id;
    expect(await planOf()).toBe('handyman_pro');
    const sub = await prisma.v3PlanSubscription.findFirstOrThrow({ where: { vendorId: A.vendorId, currentVendorId: A.vendorId } }); expect(sub).toMatchObject({ source: 'SELF', termMonths: 6 });
    const inv = await prisma.v3PlanInvoice.findUniqueOrThrow({ where: { orderId: id } }); expect(inv.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/\d{6}$/);
    expect((await api('get', '/v3/me/entitlements', tokenA)).body.data.plan).toBe('handyman_pro');   // the 30 second entitlement cache was invalidated by the payment
    expect((await api('get', '/v3/me/billing/invoices', tokenA)).body.data.items[0].invoiceNumber).toBe(inv.invoiceNumber);
    const again = await api('post', `/v3/me/billing/orders/${id}/confirm`, tokenA, { paymentId: p.paymentId, signature: p.signature }); expect(again.status).toBe(200); expect(await prisma.v3PlanInvoice.count({ where: { orderId: id } })).toBe(1);
  });

  it('webhook: a bad signature is 401; a good captured event for a new order is PAID; the same event again is a 200 duplicate; the stored payload is redacted', async () => {
    const c = await order({ termMonths: 12 }); const p = fake.pay(c.body.data.providerOrderId); const h = fake.webhook('payment.captured', p.paymentId, { eventId: evId('wh1') });
    const send = (raw: string, sig: string, id: string) => request(app.getHttpServer()).post('/v3/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', sig).set('x-razorpay-event-id', id).send(raw);
    expect((await send(h.raw, 'a'.repeat(64), h.eventId)).status).toBe(401); expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: c.body.data.id } })).status).toBe('PENDING_PAYMENT');
    expect((await send(h.raw, h.signature, h.eventId)).body.data).toEqual({ received: true }); expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: c.body.data.id } })).status).toBe('PAID');
    expect((await send(h.raw, h.signature, h.eventId)).body.data).toEqual({ received: true, duplicate: true });
    const ev = await prisma.v3PaymentEvent.findUniqueOrThrow({ where: { providerEventId: h.eventId } }); expect(ev).toMatchObject({ signatureValid: true, result: 'PAID', orderId: c.body.data.id }); expect(JSON.stringify(ev.payloadRedactedJson)).not.toMatch(/buyer@example|9876543210|x@upi|1111|Visa/);
    expect(await prisma.v3PlanInvoice.count({ where: { orderId: c.body.data.id } })).toBe(1);
    await prisma.v3PaymentEvent.deleteMany({ where: { providerEventId: { startsWith: 'bad-' }, createdAt: { gte: new Date(Date.now() - 600_000) } } });
  });

  it('amount mismatch goes to REVIEW and activates nothing new; SUPER_ADMIN (only) can then mark it paid; OPERATIONS and MARKETING cannot; a refund is recorded, never sent', async () => {
    const c = await order({ termMonths: 3 }); const id = c.body.data.id as string; const p = fake.pay(c.body.data.providerOrderId, { amount: 1 });
    expect((await api('post', `/v3/me/billing/orders/${id}/confirm`, tokenA, { paymentId: p.paymentId, signature: p.signature })).body.data.status).toBe('REVIEW');
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id } })).status).toBe('REVIEW');
    expect((await api('post', `/v3/admin/billing/orders/${id}/mark-paid`, ops, { reason: 'checked the bank statement' })).status).toBe(403); expect((await api('post', `/v3/admin/billing/orders/${id}/mark-paid`, mkt, { reason: 'checked the bank statement' })).status).toBe(403);
    const done = await api('post', `/v3/admin/billing/orders/${id}/mark-paid`, sup, { reason: 'checked the bank statement' }); expect(done.status).toBe(200); expect(done.body.data.status).toBe('PAID');
    expect(await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ source: 'STAFF', status: 'PAID' });
    const calls = { ...fake.calls }; const r = await api('post', `/v3/admin/billing/orders/${id}/refund`, sup, { amountPaise: 1000, note: 'goodwill refund made by bank' }); expect(r.status).toBe(200); expect(fake.calls).toEqual(calls);
    expect((await api('get', '/v3/admin/billing/orders?vendorId=' + A.vendorId, ops)).body.data.total).toBeGreaterThanOrEqual(3); expect((await api('get', '/v3/admin/billing/orders', mkt)).status).toBe(403);
  });

  it('the renewal reminder tick (switched on for this test): one email to the sandbox, logged once, never twice', async () => {
    await prisma.v3PlanSetting.upsert({ where: { key: 'renewalRemindersEnabled' }, create: { key: 'renewalRemindersEnabled', valueJson: true, description: 'v3test' }, update: { valueJson: true } });
    const sub = await prisma.v3PlanSubscription.findFirstOrThrow({ where: { vendorId: A.vendorId, currentVendorId: A.vendorId } });
    await prisma.v3PlanSubscription.update({ where: { id: sub.id }, data: { endsAt: new Date(Date.now() + 5 * 86_400_000) } });
    app.get(BillingSettingsService).invalidate();   // the flag was written straight to the database; the service keeps its settings for 15 s and the purchase above had already read them (see test/billing-reminders.spec.ts)
    const reminders = app.get(RenewalReminderService);
    const first = await reminders.tick(); expect(first.sent).toBeGreaterThanOrEqual(1); const second = await reminders.tick(); expect(second.sent).toBe(0);
    expect(await prisma.v3ReminderLog.count({ where: { subscriptionId: sub.id, kind: 'SENT' } })).toBe(1);
    expect(paidOrderId).not.toBe('');
  });
});
