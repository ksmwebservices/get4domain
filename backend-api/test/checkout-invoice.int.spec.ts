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
 * Wave 3 Parts D and F on STAGING (in-memory gateways, real database): the invoice made once on payment with the gateway payment id, numbered in sequence, shown to its owner only and to staff, the invoice mail
 * recorded as pending while the mail switch is off, and no discount of any kind. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(240_000);

describe('checkout and invoice on staging', () => {
  let env: Wave3Env; let prisma: PrismaClient; let fx: BillingFixture; let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let sup: string; let mkt: string;
  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma); env = await bootWave3(prisma); await env.setGateway('cashfree');
    A = await seedTenant(prisma, 'w3ia', RUN_ID); B = await seedTenant(prisma, 'w3ib', RUN_ID);
    for (const t of [A, B]) await makeSiteVendor(prisma, env.app.get(SubscriptionsService), t, RUN_ID, {});
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
    sup = await seedStaff(prisma, 'w3isup', RUN_ID, 'SUPER_ADMIN'); mkt = await seedStaff(prisma, 'w3imkt', RUN_ID, 'MARKETING');
  }, 300000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => env?.app.close(), () => prisma?.$disconnect()]); }, 180000);

  const payNow = async (token: string, payId: string, term = 3) => {
    const c = await env.api('post', '/v3/me/billing/orders', token, { planKey: 'handyman_pro', termMonths: term, idempotencyKey: env.key('inv') });
    env.gws.cashfree.addPayment({ paymentId: payId, providerOrderId: c.body.data.providerOrderId, amountMinor: c.body.data.amountPaise, currency: 'INR', status: 'SUCCESS' });
    await env.api('post', `/v3/me/billing/orders/${c.body.data.id}/confirm`, token, {});
    return c.body.data.id as string;
  };

  it('makes exactly one invoice per paid order, with the gateway payment id and the lines, numbered in sequence', async () => {
    const a = await payNow(tokenA, '7200001'); await env.api('post', `/v3/me/billing/orders/${a}/confirm`, tokenA, {});
    const b = await payNow(tokenB, '7200002');
    const ia = await prisma.v3PlanInvoice.findMany({ where: { orderId: a } }); const ib = await prisma.v3PlanInvoice.findMany({ where: { orderId: b } });
    expect([ia.length, ib.length]).toEqual([1, 1]);
    const snap = ia[0].snapshotJson as { payment?: { method: string; gateway: string; reference: string }; lines?: Array<{ key: string; amountMinor: number }> };
    expect(snap.payment).toEqual({ method: 'GATEWAY', gateway: 'cashfree', reference: '7200001' }); expect(snap.lines?.map((l) => l.key)).toEqual(['PLAN', 'TAX', 'TOTAL']); expect(snap.lines?.[2].amountMinor).toBe(354_000);
    const n = (x: string) => Number(x.split('/').pop()); expect(n(ib[0].invoiceNumber)).toBe(n(ia[0].invoiceNumber) + 1);
  });

  it('shows an invoice to its owner and to staff only, as a page that says how it was paid, with its heading unchanged', async () => {
    const mine = await env.api('get', '/v3/me/billing/invoices', tokenA); expect(mine.body.data.total).toBe(1);
    expect((await env.api('get', '/v3/me/billing/invoices', tokenB)).body.data.items.some((i: { id: string }) => i.id === mine.body.data.items[0].id)).toBe(false);
    const page = await env.api('get', `/v3/me/billing/invoices/${mine.body.data.items[0].id}/download`, tokenA); expect(page.status).toBe(200);
    expect(page.text).toMatch(/<h1>Invoice [A-Z0-9]+\/\d{4}-\d{2}\/\d{6}<\/h1>/); expect(page.text).toContain('Paid through Cashfree. Payment reference 7200001');
    expect((await env.api('get', `/v3/me/billing/invoices/${mine.body.data.items[0].id}/download`, tokenB)).status).toBe(404);
    expect((await env.api('get', '/v3/admin/invoices', sup)).status).toBe(200); expect((await env.api('get', '/v3/admin/invoices', mkt)).status).toBe(403);
  });

  it('records the invoice mail as pending while the mail switch is off (nothing is sent)', async () => {
    const inv = await prisma.v3PlanInvoice.findFirstOrThrow({ where: { vendorId: A.vendorId } });
    await new Promise((r) => setTimeout(r, 500));
    const row = await prisma.v3MessageOutbox.findFirst({ where: { templateKey: 'plan_invoice', relatedRequestId: inv.id } });
    expect(row?.status).toBe('QUEUED'); expect(JSON.stringify(row)).not.toContain(A.email);
    await prisma.v3MessageOutbox.deleteMany({ where: { vendorId: { in: [A.vendorId, B.vendorId] }, templateKey: 'plan_invoice' } });
  });

  it('has no discount: a rule in the tables and a promo field change nothing, and the total is the price book plus GST', async () => {
    const rule = await prisma.v3DiscountRule.create({ data: { type: 'PROMO', name: `V3TEST ${RUN_ID}`, percentOff: 100, conditions: {}, stackable: true, active: true, status: 'APPROVED', validFrom: new Date(Date.now() - 60_000) } as never });
    try {
      const c = await env.api('post', '/v3/me/billing/orders', tokenB, { planKey: 'handyman_pro', termMonths: 6, idempotencyKey: env.key('nodisc') });
      expect(c.body.data.amountPaise).toBe(637_200); expect(c.body.data.quote.discounts).toEqual([]);
      expect((await env.api('post', '/v3/me/billing/orders', tokenB, { planKey: 'handyman_pro', termMonths: 6, idempotencyKey: env.key('nodisc'), promoCode: 'FREE' })).status).toBe(400);
    } finally { await prisma.v3DiscountRule.deleteMany({ where: { id: rule.id } }); }
  });
});
