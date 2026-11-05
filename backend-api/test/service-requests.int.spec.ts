// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { FakeRazorpay } from './support/fake-razorpay';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Batch 4 slice 5.16c on STAGING, with the real database and the FAKE payment provider (nothing is charged, no Razorpay call is made): a request holds the price (no tax), approving charges the hold
 * once and issues NO invoice (owner, 5 November 2026: the refill has the tax invoice), cancel and reject release it, the database refuses an edited history or invoice and an unfunded wallet request, tenants cannot reach each
 * other, and many parallel requests and approvals go through the real connection pool. The suite makes its OWN service (its key carries the run id), tax rows and settings, and removes them at the end.
 * Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(300_000);

describe('service requests on staging (fake provider)', () => {
  let app: INestApplication; let prisma: PrismaClient; const fake = new FakeRazorpay();
  let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let sup: string; let ops: string; let mkt: string;
  const SK = `V3REQ${RUN_ID.toUpperCase()}`; const TOTAL = 50_000;
  const taxIds: string[] = []; const saved = new Map<string, { existed: boolean; value: unknown }>();
  const api = (method: 'get' | 'post' | 'put', url: string, token?: string, body?: object) => { const r = request(app.getHttpServer())[method](url); const t = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? t.send(body) : t; };
  const key = (() => { let n = 0; return () => `v3test-${RUN_ID}-req-${++n}`; })();
  const setSetting = async (k: string, v: unknown) => { if (!saved.has(k)) { const row = await prisma.v3PlanSetting.findUnique({ where: { key: k } }); saved.set(k, { existed: !!row, value: row?.valueJson ?? null }); } await prisma.v3PlanSetting.upsert({ where: { key: k }, create: { key: k, valueJson: v as never, description: 'v3test' }, update: { valueJson: v as never } }); };
  const brief = () => ({ details: 'A poster for our festival offer with the shop name and phone number.' });
  const create = (token = tokenA) => api('post', '/v3/me/service-requests', token, { serviceKey: SK, brief: brief(), idempotencyKey: key() });
  const work = async (id: string) => {
    const q = `/v3/admin/service-requests/${id}`;
    await api('post', `${q}/status`, ops, { to: 'ACCEPTED' }); await api('post', `${q}/status`, ops, { to: 'IN_PRODUCTION' });
    await api('post', `${q}/deliverables`, ops, { kind: 'TEXT', text: 'Finished work for the suite.' }); return api('post', `${q}/status`, ops, { to: 'READY_FOR_REVIEW' });
  };
  const credit = (vendorId: string, amount: number) => api('post', `/v3/admin/wallets/${vendorId}/adjustments`, sup, { amountPaise: amount, reason: 'suite credit', idempotencyKey: key() });
  const wallet = (vendorId: string) => prisma.v3Wallet.findUniqueOrThrow({ where: { vendorId } });
  const soon = () => new Date(Date.now() + 2000).toISOString();

  beforeAll(async () => {
    prisma = newPrisma();
    app = await buildProvisioningTestApp({ billing: { fake }, wallet: true, services: true, requests: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'r16a', RUN_ID); await makeSiteVendor(prisma, subs, A, RUN_ID, {}); tokenA = vendorToken(A.vendorId, A.email);
    B = await seedTenant(prisma, 'r16b', RUN_ID); await makeSiteVendor(prisma, subs, B, RUN_ID, {}); tokenB = vendorToken(B.vendorId, B.email);
    sup = await seedStaff(prisma, 'r16sup', RUN_ID, 'SUPER_ADMIN'); ops = await seedStaff(prisma, 'r16ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'r16mkt', RUN_ID, 'MARKETING');
    const eff = new Date(Date.now() - 3_600_000);
    for (const [name, rate] of [['IGST', 18], ['CGST', 9], ['SGST', 9]] as const) taxIds.push((await prisma.v3TaxRate.create({ data: { name, ratePercent: rate, appliesTo: 'ALL', active: true, validFrom: new Date(eff.getTime() + taxIds.length) } })).id);
    await setSetting('walletSellerStateCode', '33'); await setSetting('walletTopupMinPaise', 10_000); await setSetting('walletTopupMaxPaise', 1_000_000); await setSetting('serviceMaxRevisions', 2);
    for (const v of [A, B]) { await subs.assignPlan({ vendorId: v.vendorId, planKey: 'handyman_pro', termMonths: 3, source: 'SELF', actor: { type: 'SYSTEM', id: null, ip: null }, reason: `plan order v3test-${RUN_ID}` }); }
    await api('get', '/v3/me/wallet', tokenA); await api('get', '/v3/me/wallet', tokenB);
    await api('put', '/v3/me/wallet/billing-profile', tokenA, { stateCode: '33' }); await api('put', '/v3/me/wallet/billing-profile', tokenB, { stateCode: '33' });
    expect((await api('post', '/v3/admin/services', ops, { key: SK, name: 'Test request service', shortDescription: 'A test service for the suite.', includesText: 'Nothing real is included.', approvalText: 'Nothing real is approved.', status: 'ACTIVE', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST' })).status).toBe(200);
    const p = await api('post', `/v3/admin/services/${SK}/prices`, ops, { amountPaise: 50_000 }); await api('post', `/v3/admin/services/prices/${p.body.data.id}/approve`, sup, { effectiveFrom: soon() });
    await new Promise((r) => setTimeout(r, 2600)); await credit(A.vendorId, 1_000_000); await credit(B.vendorId, 200_000);
  }, 300000);

  afterAll(async () => {
    await runCleanup([
      () => cleanupTenants(prisma, RUN_ID), () => prisma.v3ServicePrice.deleteMany({ where: { service: { key: SK } } }).then(() => prisma.v3Service.deleteMany({ where: { key: SK } })),
      () => prisma.v3TaxRate.deleteMany({ where: { id: { in: taxIds } } }),
      async () => { for (const [k, p] of saved) { if (p.existed) await prisma.v3PlanSetting.update({ where: { key: k }, data: { valueJson: p.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key: k } }); } },
      () => app?.close(), () => prisma?.$disconnect(),
    ]);
  }, 240000);

  it('a request holds the exact price (no tax): the balance is untouched and nothing is charged', async () => {
    const before = await wallet(A.vendorId); const r = await create(); expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'REQUESTED', funding: { kind: 'WALLET', amountPaise: TOTAL, heldPaise: TOTAL, basePaise: 50_000 } });
    const after = await wallet(A.vendorId); expect([after.balancePaise, after.heldPaise]).toEqual([before.balancePaise, before.heldPaise + TOTAL]);
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'HOLD', refId: r.body.data.id } })).toBe(1); expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'CHARGE', refId: r.body.data.id } })).toBe(0);
    await api('post', `/v3/me/service-requests/${r.body.data.id}/cancel`, tokenA);
  });

  it('the whole life: accepted, produced, delivered, approved: ONE charge, NO invoice, the hold gone, the books balance', async () => {
    const before = await wallet(A.vendorId); const r = await create(); const id = r.body.data.id as string;
    expect((await work(id)).body.data.status).toBe('READY_FOR_REVIEW');
    const results = await Promise.all(Array.from({ length: 5 }, () => api('post', `/v3/me/service-requests/${id}/approve`, tokenA).then((x) => x.status)));
    expect(results.every((s) => s === 200)).toBe(true);
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'CHARGE', refId: id } })).toBe(1);
    expect(await prisma.v3ServiceInvoice.count({ where: { requestId: id } })).toBe(0);   // a deduction is a ledger line and a usage statement line, never an invoice
    const after = await wallet(A.vendorId); expect([after.balancePaise, after.heldPaise]).toEqual([before.balancePaise - TOTAL, before.heldPaise]);
    expect((await api('get', `/v3/admin/wallets/${A.vendorId}/reconcile`, ops)).body.data.ok).toBe(true);
  });

  it('the DATABASE refuses an edited history, an edited or deleted invoice, and a wallet request with no hold', async () => {
    const req = await prisma.v3ServiceRequest.findFirstOrThrow({ where: { vendorId: A.vendorId, status: 'APPROVED' } });
    const ev = await prisma.v3ServiceRequestEvent.findFirstOrThrow({ where: { requestId: req.id } });
    // nothing writes a request invoice any more, but a row from before 5 November 2026 must stay unchangeable: make one by hand to prove the trigger still holds
    const inv = await prisma.v3ServiceInvoice.create({ data: { vendorId: A.vendorId, requestId: req.id, invoiceNumber: `LEGACY/${RUN_ID}`, financialYear: '2026-27', issuedAt: new Date(), ledgerEntryId: `legacy-${RUN_ID}`, snapshotJson: {}, taxBreakdownJson: {} } });
    await expect(prisma.$executeRaw`UPDATE "g4d_service_request_events" SET "note" = 'changed' WHERE "id" = ${ev.id}`).rejects.toThrow(/cannot be changed/);
    await expect(prisma.$executeRaw`DELETE FROM "g4d_service_request_events" WHERE "id" = ${ev.id}`).rejects.toThrow(/cannot be deleted/);
    await expect(prisma.$executeRaw`UPDATE "g4d_service_invoices" SET "invoiceNumber" = 'X' WHERE "id" = ${inv.id}`).rejects.toThrow(/cannot be changed/);
    await expect(prisma.$executeRaw`DELETE FROM "g4d_service_invoices" WHERE "id" = ${inv.id}`).rejects.toThrow(/cannot be deleted/);
    const svc = await prisma.v3Service.findUniqueOrThrow({ where: { key: SK } });
    await expect(prisma.$executeRaw`INSERT INTO "g4d_service_requests" ("id","vendorId","serviceId","briefJson","fundingKind","idempotencyKey","createdAt","updatedAt") VALUES (${`bad-${RUN_ID}`}, ${A.vendorId}, ${svc.id}, '{}', 'WALLET', ${`bad-${RUN_ID}`}, now(), now())`).rejects.toThrow(/funding_chk|check constraint/i);
  });

  it('cancel before production and a rejection by the team both release the hold and charge nothing', async () => {
    const before = await wallet(A.vendorId);
    const a = await create(); expect((await api('post', `/v3/me/service-requests/${a.body.data.id}/cancel`, tokenA)).body.data.status).toBe('CANCELLED');
    const b = await create(); expect((await api('post', `/v3/admin/service-requests/${b.body.data.id}/reject`, ops, { reason: 'We cannot deliver this.' })).body.data.status).toBe('REJECTED_BY_TEAM');
    const after = await wallet(A.vendorId); expect([after.balancePaise, after.heldPaise]).toEqual([before.balancePaise, before.heldPaise]);
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'RELEASE', refId: { in: [a.body.data.id, b.body.data.id] } } })).toBe(2);
  });

  it('twelve parallel requests by a wallet that can fund three succeed exactly three times; then three parallel approvals make three charges and no invoice', async () => {
    const bal = await wallet(B.vendorId); await api('post', `/v3/admin/wallets/${B.vendorId}/adjustments`, sup, { amountPaise: -(bal.balancePaise - bal.heldPaise - TOTAL * 3 - 1_000), reason: 'suite trim', idempotencyKey: key() });
    const rs = await Promise.all(Array.from({ length: 12 }, () => create(tokenB))); const ok = rs.filter((r) => r.status === 200);
    expect(ok).toHaveLength(3); expect(rs.filter((r) => r.status === 409 && r.body.code === 'INSUFFICIENT_WALLET')).toHaveLength(9);
    const ids = ok.map((r) => r.body.data.id as string); for (const id of ids) await work(id);
    await Promise.all(ids.map((id) => api('post', `/v3/me/service-requests/${id}/approve`, tokenB)));
    expect(await prisma.v3ServiceInvoice.count({ where: { requestId: { in: ids } } })).toBe(0); expect(await prisma.v3WalletLedger.count({ where: { vendorId: B.vendorId, kind: 'CHARGE', refId: { in: ids } } })).toBe(3);
    expect((await api('get', `/v3/admin/wallets/${B.vendorId}/reconcile`, ops)).body.data.ok).toBe(true);
  });

  it('vendor B cannot see, cancel or approve vendor A\'s request: the same answer as for one that does not exist', async () => {
    const mine = await prisma.v3ServiceRequest.findFirstOrThrow({ where: { vendorId: A.vendorId } });
    const missing = await api('get', '/v3/me/service-requests/does-not-exist', tokenB);
    for (const r of [await api('get', `/v3/me/service-requests/${mine.id}`, tokenB), await api('post', `/v3/me/service-requests/${mine.id}/cancel`, tokenB), await api('post', `/v3/me/service-requests/${mine.id}/approve`, tokenB)]) expect([r.status, r.body.code]).toEqual([missing.status, missing.body.code]);
  });

  it('MARKETING is refused on the staff queue, OPERATIONS may work it; a vendor token is refused there', async () => {
    expect((await api('get', '/v3/admin/service-requests', mkt)).status).toBe(403); expect((await api('get', '/v3/admin/service-requests', ops)).status).toBe(200); expect((await api('get', '/v3/admin/service-requests', tokenA)).status).toBe(403);
    expect((await api('post', '/v3/admin/service-requests/sla-sweep', ops)).body.data).toHaveProperty('marked');
  });
});
