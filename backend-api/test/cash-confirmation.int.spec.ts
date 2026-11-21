// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { BillingFixture, setUpBilling, tearDownBilling } from './support/billing-staging';
import { runCleanup } from './support/cleanup-guard';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { makeSiteVendor } from './support/site-staging';
import { bootWave3, Wave3Env } from './support/wave3-staging';

/**
 * Wave 3 Part E on STAGING (in-memory gateways, real database): an admin makes a cash order and confirms the cash with every detail; ADMIN and SUPER_ADMIN only; the vendor can never settle by hand; one transaction
 * (paid, activated, invoiced, audited); a wrong amount or method is refused; a repeat changes nothing. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(240_000);

describe('cash confirmed by an admin on staging', () => {
  let env: Wave3Env; let prisma: PrismaClient; let fx: BillingFixture; let A: SeededTenant; let tokenA: string; const t: Record<string, string> = {};
  const cash = (amountPaise: number, over: object = {}) => ({ method: 'CASH', reference: `RCPT-${RUN_ID}`, receivedOn: new Date().toISOString().slice(0, 10), amountPaise, specialCase: true, reason: 'paid cash at the office, no card or bank', ...over });
  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma); env = await bootWave3(prisma);
    A = await seedTenant(prisma, 'w3ca', RUN_ID); await makeSiteVendor(prisma, env.app.get(SubscriptionsService), A, RUN_ID, {}); tokenA = vendorToken(A.vendorId, A.email);
    for (const [k, role] of [['sup', 'SUPER_ADMIN'], ['admin', 'ADMIN'], ['ops', 'OPERATIONS'], ['mkt', 'MARKETING'], ['fe', 'FIELD_EXECUTIVE'], ['tc', 'TELECALLER'], ['sp', 'SUPPORT']] as const) t[k] = await seedStaff(prisma, `w3c${k}`, RUN_ID, role);
  }, 300000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => env?.app.close(), () => prisma?.$disconnect()]); }, 180000);

  const makeOrder = (token: string, term = 3) => env.api('post', `/v3/admin/billing/vendors/${A.vendorId}/cash-orders`, token, { planKey: 'handyman_pro', termMonths: term, idempotencyKey: env.key('cash') });

  it('only ADMIN and SUPER_ADMIN make a cash order or confirm cash; OPERATIONS, SALES, both labels, SUPPORT and the vendor are refused', async () => {
    for (const who of ['ops', 'mkt', 'fe', 'tc', 'sp']) expect([who, (await makeOrder(t[who])).status]).toEqual([who, 403]);
    expect((await env.api('post', `/v3/admin/billing/vendors/${A.vendorId}/cash-orders`, tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: env.key('cash') })).status).toBe(403);
    const made = await makeOrder(t.admin); expect(made.status).toBe(200); expect(made.body.data).toMatchObject({ gateway: 'cash', status: 'PENDING_PAYMENT', amountPaise: 354_000 });
    for (const who of ['ops', 'mkt', 'fe', 'tc', 'sp']) expect([who, (await env.api('post', `/v3/admin/billing/orders/${made.body.data.id}/mark-paid`, t[who], cash(354_000))).status]).toEqual([who, 403]);
    expect((await env.api('post', `/v3/admin/billing/orders/${made.body.data.id}/mark-paid`, tokenA, cash(354_000))).status).toBe(403);
  });

  it('refuses anything that is not exact cash: another method, a missing detail, a wrong amount, a gateway order; nothing is activated', async () => {
    const made = await makeOrder(t.sup, 6); const id = made.body.data.id as string; const total = made.body.data.amountPaise as number;
    const bank = await env.api('post', `/v3/admin/billing/orders/${id}/mark-paid`, t.sup, cash(total, { method: 'BANK_TRANSFER' })); expect([bank.status, bank.body.code]).toEqual([400, 'CASH_ONLY']);
    expect((await env.api('post', `/v3/admin/billing/orders/${id}/mark-paid`, t.sup, { method: 'CASH' })).body.code).toBe('CASH_DETAILS_INVALID');
    expect((await env.api('post', `/v3/admin/billing/orders/${id}/mark-paid`, t.sup, cash(total - 1))).body.code).toBe('OFFLINE_AMOUNT_MISMATCH');
    await env.setGateway('razorpay');
    const online = await env.api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: env.key('online') });
    expect(online.status).toBe(200);
    expect((await env.api('post', `/v3/admin/billing/orders/${online.body.data.id}/mark-paid`, t.sup, cash(354_000))).body.code).toBe('CASH_ORDER_INVALID');
    expect((await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING_PAYMENT'); expect(await prisma.v3PlanInvoice.count({ where: { orderId: id } })).toBe(0);
  });

  it('confirming marks it paid, activates the plan, makes the invoice with the cash reference and audits, in one go; a repeat changes nothing', async () => {
    const made = await makeOrder(t.admin, 12); const id = made.body.data.id as string; const total = made.body.data.amountPaise as number;
    const done = await env.api('post', `/v3/admin/billing/orders/${id}/mark-paid`, t.admin, cash(total)); expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ status: 'PAID', outcome: 'PAID', invoice: { reference: `RCPT-${RUN_ID}` } });
    expect(await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'PAID', source: 'STAFF', gateway: 'cash', settledReference: `RCPT-${RUN_ID}`, paidAmountPaise: total });
    const inv = await prisma.v3PlanInvoice.findFirstOrThrow({ where: { orderId: id } }); expect((inv.snapshotJson as { payment?: { method: string } }).payment?.method).toBe('CASH');
    expect((await prisma.v3PlanSubscription.findFirstOrThrow({ where: { vendorId: A.vendorId, currentVendorId: A.vendorId }, include: { plan: true } })).plan.key).toBe('handyman_pro');
    const again = await env.api('post', `/v3/admin/billing/orders/${id}/mark-paid`, t.sup, cash(total)); expect(again.body.data).toMatchObject({ outcome: 'ALREADY_PAID' });
    expect(await prisma.v3PlanInvoice.count({ where: { orderId: id } })).toBe(1);
  });
});
