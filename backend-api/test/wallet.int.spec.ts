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
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { BillingFixture, evId, setUpBilling, tearDownBilling } from './support/billing-staging';
import { runCleanup } from './support/cleanup-guard';
import { FakeRazorpay } from './support/fake-razorpay';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Batch 4 slices 5.16a and 5.16a-2 on STAGING, with the real database and the FAKE payment provider (nothing is charged, no Razorpay call is made): the wallet opens when the first Pro
 * term is paid, top-ups credit exactly once (browser confirm, signed webhook, replays), the database refuses what the application must never do (a negative balance, held above balance, an
 * edited or deleted ledger row), tenants cannot reach each other's wallet, staff roles, expiry, and many parallel spenders through the real connection pool.
 * Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(240_000);

describe('wallet on staging (fake provider)', () => {
  let app: INestApplication; let prisma: PrismaClient; let fx: BillingFixture; const fake = new FakeRazorpay();
  let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let sup: string; let ops: string; let mkt: string;
  const savedSettings = new Map<string, { existed: boolean; value: unknown }>(); const taxIds: string[] = [];
  const api = (method: 'get' | 'post' | 'put', url: string, token?: string, body?: object) => { const r = request(app.getHttpServer())[method](url); const t = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? t.send(body) : t; };
  const key = (() => { let n = 0; return () => `v3test-${RUN_ID}-wal-${++n}`; })();
  const setSetting = async (k: string, v: unknown) => { if (!savedSettings.has(k)) { const row = await prisma.v3PlanSetting.findUnique({ where: { key: k } }); savedSettings.set(k, { existed: !!row, value: row?.valueJson ?? null }); } await prisma.v3PlanSetting.upsert({ where: { key: k }, create: { key: k, valueJson: v as never, description: 'v3test' }, update: { valueJson: v as never } }); };
  const dropSetting = async (k: string) => { if (!savedSettings.has(k)) { const row = await prisma.v3PlanSetting.findUnique({ where: { key: k } }); savedSettings.set(k, { existed: !!row, value: row?.valueJson ?? null }); } await prisma.v3PlanSetting.deleteMany({ where: { key: k } }); };
  const restoreSettings = async () => { for (const [k, p] of savedSettings) { if (p.existed) await prisma.v3PlanSetting.update({ where: { key: k }, data: { valueJson: p.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key: k } }); } };
  const walletOf = (vendorId: string) => prisma.v3Wallet.findUnique({ where: { vendorId } });
  const topUp = async (token: string, amount: number) => {
    const c = await api('post', '/v3/me/wallet/topups', token, { amountPaise: amount, idempotencyKey: key() }); const p = fake.pay(c.body.data.providerOrderId);
    const ok = await api('post', `/v3/me/wallet/topups/${c.body.data.id}/confirm`, token, { paymentId: p.paymentId, signature: p.signature }); return { c, p, ok };
  };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma);
    app = await buildProvisioningTestApp({ billing: { fake }, wallet: true });
    A = await seedTenant(prisma, 'w16a', RUN_ID); await makeSiteVendor(prisma, app.get(SubscriptionsService), A, RUN_ID, {}); tokenA = vendorToken(A.vendorId, A.email);
    B = await seedTenant(prisma, 'w16b', RUN_ID); await makeSiteVendor(prisma, app.get(SubscriptionsService), B, RUN_ID, {}); tokenB = vendorToken(B.vendorId, B.email);
    sup = await seedStaff(prisma, 'w16sup', RUN_ID, 'SUPER_ADMIN'); ops = await seedStaff(prisma, 'w16ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'w16mkt', RUN_ID, 'MARKETING');
    await dropSetting('walletTopupMinPaise'); await dropSetting('walletTopupMaxPaise'); await setSetting('walletCreditValidityDays', 365);
    // GST on top of a refill needs Get4Domain's state and the GST rows (test-only rows, started a day ago so the plan billing fixture's newer row still wins its own lookup; removed at the end)
    const eff = new Date(Date.now() - 86_400_000);
    for (const [name, rate] of [['IGST', 18], ['CGST', 9], ['SGST', 9]] as const) taxIds.push((await prisma.v3TaxRate.create({ data: { name, ratePercent: rate, appliesTo: 'ALL', active: true, validFrom: new Date(eff.getTime() + taxIds.length) } })).id);
    await setSetting('walletSellerStateCode', '33');
  }, 300000);

  afterAll(async () => { await runCleanup([() => (taxIds.length ? prisma.v3TaxRate.deleteMany({ where: { id: { in: taxIds } } }) : Promise.resolve()), () => restoreSettings(), () => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('a Free vendor has no wallet: a locked preview, no top-up, no row', async () => {
    const v = await api('get', '/v3/me/wallet', tokenA);
    expect(v.status).toBe(200); expect(v.body.data).toMatchObject({ status: 'INACTIVE', locked: true, lockedReason: 'NO_PAID_PRO_TERM', balancePaise: 0 });
    const t = await api('post', '/v3/me/wallet/topups', tokenA, { amountPaise: 20_000, idempotencyKey: key() });
    expect([t.status, t.body.code]).toEqual([403, 'WALLET_NOT_ACTIVE']);
    expect(await walletOf(A.vendorId)).toBeNull();
  });

  it('paying the first Pro term opens the wallet exactly once', async () => {
    const c = await api('post', '/v3/me/billing/orders', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: key() }); const p = fake.pay(c.body.data.providerOrderId);
    expect((await api('post', `/v3/me/billing/orders/${c.body.data.id}/confirm`, tokenA, { paymentId: p.paymentId, signature: p.signature })).body.data.status).toBe('PAID');
    await api('get', '/v3/me/wallet', tokenA);
    expect(await walletOf(A.vendorId)).toMatchObject({ status: 'ACTIVE', balancePaise: 0, heldPaise: 0 });
    expect(await prisma.v3AuditLog.count({ where: { action: 'wallet.activated', entityId: A.vendorId } })).toBe(1);
    expect((await api('get', '/v3/me/wallet', tokenA)).body.data).toMatchObject({ status: 'ACTIVE', locked: false });
    expect(await walletOf(B.vendorId)).toBeNull();   // vendor B only has the Free plan
    expect((await api('put', '/v3/me/wallet/billing-profile', tokenA, { stateCode: '33' })).status).toBe(200);   // the buyer's state: the GST on a refill needs it
  });

  it('top-ups are refused until staff set both limits, then judged against them', async () => {
    const none = await api('post', '/v3/me/wallet/topups', tokenA, { amountPaise: 20_000, idempotencyKey: key() });
    expect([none.status, none.body.code]).toEqual([409, 'WALLET_TOPUP_NOT_CONFIGURED']);
    await setSetting('walletTopupMinPaise', 10_000); await setSetting('walletTopupMaxPaise', 1_000_000); await new Promise((r) => setTimeout(r, 16_000));   // the settings cache lasts 15 seconds
    expect((await api('post', '/v3/me/wallet/topups', tokenA, { amountPaise: 9_999, idempotencyKey: key() })).body.code).toBe('WALLET_TOPUP_AMOUNT_INVALID');
    expect((await api('post', '/v3/me/wallet/topups', tokenA, { amountPaise: 1_000_001, idempotencyKey: key() })).body.code).toBe('WALLET_TOPUP_AMOUNT_INVALID');
  });

  it('a refill credits the amount before GST exactly once: confirm, a second confirm, and a signed webhook replay; one lot, one TAX INVOICE, one ledger row', async () => {
    const { c, p, ok } = await topUp(tokenA, 50_000);
    expect(c.body.data).toMatchObject({ creditPaise: 50_000, taxPaise: 9_000, payablePaise: 59_000 });   // GST on top: the vendor pays 59,000, the credit is 50,000
    expect(ok.body.data.status).toBe('PAID');
    const again = await api('post', `/v3/me/wallet/topups/${c.body.data.id}/confirm`, tokenA, { paymentId: p.paymentId, signature: p.signature }); expect(again.status).toBe(200);
    const h = fake.webhook('payment.captured', p.paymentId, { eventId: evId('walwh1') });
    const send = () => request(app.getHttpServer()).post('/v3/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', h.signature).set('x-razorpay-event-id', h.eventId).send(h.raw);
    expect((await send()).status).toBe(200); expect((await send()).status).toBe(200);
    expect(await walletOf(A.vendorId)).toMatchObject({ balancePaise: 50_000 });
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'TOPUP' } })).toBe(1);
    expect(await prisma.v3WalletLot.count({ where: { vendorId: A.vendorId } })).toBe(1);
    const rc = await prisma.v3WalletReceipt.findFirstOrThrow({ where: { vendorId: A.vendorId } }); expect(rc).toMatchObject({ documentType: 'TAX_INVOICE' }); expect(rc.receiptNumber).toMatch(/^[A-Z0-9]+\/\d{4}-\d{2}\/\d{6}$/);
    expect((await api('get', `/v3/me/wallet/topups/${c.body.data.id}/invoice`, tokenA)).body.data).toMatchObject({ invoiceNumber: rc.receiptNumber, documentType: 'TAX_INVOICE' });
    expect((await api('get', '/v3/me/wallet/ledger', tokenA)).body.data.items[0]).toMatchObject({ kind: 'TOPUP', amountPaise: 50_000 });
  });

  it('the DATABASE refuses what the application must never do', async () => {
    const w = await walletOf(A.vendorId); const row = await prisma.v3WalletLedger.findFirstOrThrow({ where: { vendorId: A.vendorId } });
    await expect(prisma.$executeRaw`UPDATE "g4d_wallet_ledger" SET "amountPaise" = 1 WHERE "id" = ${row.id}`).rejects.toThrow(/cannot be changed/);
    await expect(prisma.$executeRaw`DELETE FROM "g4d_wallet_ledger" WHERE "id" = ${row.id}`).rejects.toThrow(/cannot be deleted/);
    await expect(prisma.$executeRaw`UPDATE "g4d_v3_wallets" SET "balancePaise" = -1 WHERE "id" = ${w!.id}`).rejects.toThrow(/amounts_chk|check constraint/i);
    await expect(prisma.$executeRaw`UPDATE "g4d_v3_wallets" SET "heldPaise" = "balancePaise" + 1 WHERE "id" = ${w!.id}`).rejects.toThrow(/amounts_chk|check constraint/i);
    expect(await walletOf(A.vendorId)).toMatchObject({ balancePaise: 50_000 });
  });

  it('tenants cannot reach each other: vendor B sees nothing of vendor A and gets the same answer as for a top-up that does not exist', async () => {
    const t = await prisma.v3WalletTopup.findFirstOrThrow({ where: { vendorId: A.vendorId } });
    const cross = await api('post', `/v3/me/wallet/topups/${t.id}/confirm`, tokenB, { paymentId: 'pay_x', signature: 'a'.repeat(64) });
    const missing = await api('post', '/v3/me/wallet/topups/does-not-exist/confirm', tokenB, { paymentId: 'pay_x', signature: 'a'.repeat(64) });
    expect([cross.status, cross.body.code]).toEqual([missing.status, missing.body.code]);
    expect((await api('get', '/v3/me/wallet/ledger', tokenB)).body.data.total).toBe(0);
    expect((await api('get', '/v3/me/wallet/topups', tokenB)).body.data.total).toBe(0);
  });

  it('staff: MARKETING is refused everywhere, OPERATIONS reads but cannot adjust, SUPER_ADMIN adjusts with a reason; the reconciliation agrees', async () => {
    const [t_sup, t_ops, t_mkt] = [sup, ops, mkt];   // seedStaff returns the signed token
    expect((await api('get', '/v3/admin/wallets', t_mkt)).status).toBe(403);
    expect((await api('get', `/v3/admin/wallets/${A.vendorId}`, t_ops)).status).toBe(200);
    expect((await api('post', `/v3/admin/wallets/${A.vendorId}/adjustments`, t_ops, { amountPaise: -1_000, reason: 'goodwill credit', idempotencyKey: key() })).status).toBe(403);
    expect((await api('post', `/v3/admin/wallets/${A.vendorId}/adjustments`, t_sup, { amountPaise: -1_000, reason: 'no', idempotencyKey: key() })).status).toBe(400);
    expect((await api('post', `/v3/admin/wallets/${A.vendorId}/adjustments`, t_sup, { amountPaise: -1_000, reason: 'correction entry', idempotencyKey: key() })).status).toBe(200);
    expect((await api('get', `/v3/admin/wallets/${A.vendorId}/reconcile`, t_ops)).body.data).toMatchObject({ ok: true, balancePaise: 49_000 });
    expect((await api('get', '/v3/admin/wallets/reconciliation', t_ops)).body.data.mismatches).toBe(0);
  });

  it('many parallel staff adjustments through the real pool can never overspend: 20 parallel takes of 4,900 from 49,000 succeed exactly 10 times', async () => {
    const t_sup = sup;
    const results = await Promise.all(Array.from({ length: 20 }, () => api('post', `/v3/admin/wallets/${A.vendorId}/adjustments`, t_sup, { amountPaise: -4_900, reason: 'parallel take test', idempotencyKey: key() }).then((r) => r.status)));
    expect(results.filter((s) => s === 200)).toHaveLength(10); expect(results.filter((s) => s === 409)).toHaveLength(10);
    expect(await walletOf(A.vendorId)).toMatchObject({ balancePaise: 0, heldPaise: 0 });
    expect((await api('get', `/v3/admin/wallets/${A.vendorId}/reconcile`, t_sup)).body.data.ok).toBe(true);
  });

  it('renewing the plan from the wallet charges, pays the order, extends the term and writes NO invoice and no GST in one transaction; a short wallet leaves nothing behind', async () => {
    const before = await prisma.v3PlanOrder.count({ where: { vendorId: A.vendorId } });
    const short = await api('post', '/v3/me/plan/renew-with-wallet', tokenA, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: key() });
    expect([short.status, short.body.code]).toEqual([409, 'INSUFFICIENT_WALLET']); expect(short.body.shortfallPaise).toBeGreaterThan(0);
    expect(await prisma.v3PlanOrder.count({ where: { vendorId: A.vendorId } })).toBe(before);   // no order was left behind
    await topUp(tokenA, 400_000);
    const k = key(); const body = { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: k };
    const ok = await api('post', '/v3/me/plan/renew-with-wallet', tokenA, body);
    expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ status: 'PAID', paidWith: 'WALLET', amountPaise: 300_000, replay: false, invoiceNumber: null });
    const order = await prisma.v3PlanOrder.findFirstOrThrow({ where: { vendorId: A.vendorId, idempotencyKey: k } }); expect(order).toMatchObject({ status: 'PAID', source: 'WALLET' });
    expect(await prisma.v3PlanInvoice.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'PLAN_RENEWAL', refId: order.id } })).toBe(1);
    expect(await walletOf(A.vendorId)).toMatchObject({ balancePaise: 100_000, heldPaise: 0 });
    const again = await api('post', '/v3/me/plan/renew-with-wallet', tokenA, body); expect(again.body.data).toMatchObject({ replay: true, orderId: order.id });
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'PLAN_RENEWAL' } })).toBe(1);
    expect((await api('get', `/v3/admin/wallets/${A.vendorId}/reconcile`, ops)).body.data.ok).toBe(true);
  });

  it('credit past its date is written off exactly once by the expiry run, and the reconciliation still agrees', async () => {
    const t_ops = ops;
    await topUp(tokenA, 20_000);
    await prisma.v3WalletLot.updateMany({ where: { vendorId: A.vendorId, remainingPaise: { gt: 0 } }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    const run = await api('post', '/v3/admin/wallets/expiry-run', t_ops); expect(run.status).toBe(200);
    expect(await walletOf(A.vendorId)).toMatchObject({ balancePaise: 0 });
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'EXPIRY' } })).toBe(1);
    await api('post', '/v3/admin/wallets/expiry-run', t_ops);
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'EXPIRY' } })).toBe(1);
    expect((await api('get', `/v3/admin/wallets/${A.vendorId}/reconcile`, t_ops)).body.data.ok).toBe(true);
  });
});
