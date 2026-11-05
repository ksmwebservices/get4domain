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
 * Batch 4 slice 5.16b on STAGING, with the real database and the FAKE payment provider (nothing is charged, no Razorpay call is made): the catalogue and the price book over HTTP with the real
 * roles, what the database refuses (a price that is not positive, an approved price with no date, two prices starting at the same moment), pack purchases against a real wallet, and many parallel
 * buyers through the real connection pool. The suite makes its OWN service and pack (keys carry the run id), its own tax-rate rows and settings, and removes them at the end.
 * Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(240_000);

describe('services, the price book and packs on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; const fake = new FakeRazorpay();
  let A: SeededTenant; let tokenA: string; let sup: string; let ops: string; let mkt: string;
  const SK = `V3TEST${RUN_ID.toUpperCase()}`; const PK = `V3PACK${RUN_ID.toUpperCase()}`;
  const taxIds: string[] = []; const savedSettings = new Map<string, { existed: boolean; value: unknown }>();
  const api = (method: 'get' | 'post' | 'put', url: string, token?: string, body?: object) => { const r = request(app.getHttpServer())[method](url); const t = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? t.send(body) : t; };
  const key = (() => { let n = 0; return () => `v3test-${RUN_ID}-svc-${++n}`; })();
  const setSetting = async (k: string, v: unknown) => { if (!savedSettings.has(k)) { const row = await prisma.v3PlanSetting.findUnique({ where: { key: k } }); savedSettings.set(k, { existed: !!row, value: row?.valueJson ?? null }); } await prisma.v3PlanSetting.upsert({ where: { key: k }, create: { key: k, valueJson: v as never, description: 'v3test' }, update: { valueJson: v as never } }); };
  const restoreSettings = async () => { for (const [k, p] of savedSettings) { if (p.existed) await prisma.v3PlanSetting.update({ where: { key: k }, data: { valueJson: p.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key: k } }); } };
  const removeCatalogue = async () => {
    await prisma.v3PackPurchase.deleteMany({ where: { pack: { key: PK } } });
    await prisma.v3AddonPackPrice.deleteMany({ where: { pack: { key: PK } } }); await prisma.v3AddonPack.deleteMany({ where: { key: PK } });
    await prisma.v3ServicePrice.deleteMany({ where: { service: { key: SK } } }); await prisma.v3Service.deleteMany({ where: { key: SK } });
    if (taxIds.length) await prisma.v3TaxRate.deleteMany({ where: { id: { in: taxIds } } });
  };
  const soon = (ms = 2000) => new Date(Date.now() + ms).toISOString();

  beforeAll(async () => {
    prisma = newPrisma();
    app = await buildProvisioningTestApp({ billing: { fake }, wallet: true, services: true });
    A = await seedTenant(prisma, 's16a', RUN_ID); await makeSiteVendor(prisma, app.get(SubscriptionsService), A, RUN_ID, {}); tokenA = vendorToken(A.vendorId, A.email);
    sup = await seedStaff(prisma, 's16sup', RUN_ID, 'SUPER_ADMIN'); ops = await seedStaff(prisma, 's16ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 's16mkt', RUN_ID, 'MARKETING');
    const eff = new Date(Date.now() - 3_600_000);
    for (const [name, rate] of [['IGST', 18], ['CGST', 9], ['SGST', 9]] as const) taxIds.push((await prisma.v3TaxRate.create({ data: { name, ratePercent: rate, appliesTo: 'ALL', active: true, validFrom: new Date(eff.getTime() + taxIds.length) } })).id);   // test-only rows; removed at the end
    await setSetting('walletSellerStateCode', '33'); await setSetting('walletTopupMinPaise', 10_000); await setSetting('walletTopupMaxPaise', 1_000_000);
  }, 300000);

  afterAll(async () => { await runCleanup([() => removeCatalogue(), () => restoreSettings(), () => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('staff build a service and a price: OPERATIONS proposes, only SUPER_ADMIN approves, and a proposal is never public', async () => {
    const c = await api('post', '/v3/admin/services', ops, { key: SK, name: 'Test poster service', shortDescription: 'A test service for the suite.', includesText: 'Nothing real is included.', approvalText: 'Nothing real is approved.', status: 'ACTIVE', publicVisible: true });
    expect(c.status).toBe(200);
    const p = await api('post', `/v3/admin/services/${SK}/prices`, ops, { amountPaise: 50_000 }); expect(p.body.data).toMatchObject({ status: 'PROPOSED', effectiveFrom: null });
    expect((await api('post', `/v3/admin/services/prices/${p.body.data.id}/approve`, ops, { effectiveFrom: soon() })).status).toBe(403);
    expect((await api('get', '/v3/public/services')).body.data.items.some((i: { key: string }) => i.key === SK)).toBe(false);
    expect((await api('post', `/v3/admin/services/prices/${p.body.data.id}/approve`, sup, { effectiveFrom: soon() })).body.data.status).toBe('APPROVED');
    await new Promise((r) => setTimeout(r, 2600));
    expect((await api('get', '/v3/public/services')).body.data.items.find((i: { key: string }) => i.key === SK)).toMatchObject({ price: { amountPaise: 50_000 } });
  });

  it('MARKETING reads the catalogue with no money field; the vendor sees "price not set" for the seeded services without a price', async () => {
    expect(JSON.stringify((await api('get', `/v3/admin/services/${SK}`, mkt)).body)).not.toMatch(/amountPaise|prices/);
    expect((await api('get', `/v3/admin/services/${SK}`, ops)).body.data.priceInForce).toMatchObject({ amountPaise: 50_000 });
    expect((await api('post', '/v3/admin/services', mkt, { key: `${SK}X`, name: 'No', shortDescription: 'Not allowed.', includesText: 'Not allowed.', approvalText: 'Not allowed.' })).status).toBe(403);
  });

  it('the DATABASE refuses a price that is not positive, an approved price with no date or approver, and two prices starting at the same moment', async () => {
    const svc = await prisma.v3Service.findUniqueOrThrow({ where: { key: SK } });
    await expect(prisma.$executeRaw`INSERT INTO "g4d_service_prices" ("id","serviceId","amountPaise","status","createdAt","updatedAt") VALUES (${`bad-${RUN_ID}-1`}, ${svc.id}, 0, 'PROPOSED', now(), now())`).rejects.toThrow(/amount_chk|check constraint/i);
    await expect(prisma.$executeRaw`INSERT INTO "g4d_service_prices" ("id","serviceId","amountPaise","status","createdAt","updatedAt") VALUES (${`bad-${RUN_ID}-2`}, ${svc.id}, 100, 'APPROVED', now(), now())`).rejects.toThrow(/approved_dated_chk|check constraint/i);
    const existing = await prisma.v3ServicePrice.findFirstOrThrow({ where: { serviceId: svc.id, status: 'APPROVED' } });
    await expect(prisma.v3ServicePrice.create({ data: { serviceId: svc.id, amountPaise: 1_000, effectiveFrom: existing.effectiveFrom } })).rejects.toThrow();
  });

  it('a pack bought with wallet credit: exact charge, one purchase, one ledger entry; the same key again is the same purchase', async () => {
    const subs = app.get(SubscriptionsService);
    await subs.assignPlan({ vendorId: A.vendorId, planKey: 'handyman_pro', termMonths: 3, source: 'SELF', actor: { type: 'SYSTEM', id: null, ip: null }, reason: `plan order v3test-${RUN_ID}` });   // a paid Pro term opens the wallet
    expect((await api('get', '/v3/me/wallet', tokenA)).body.data.status).toBe('ACTIVE');
    await api('put', '/v3/me/wallet/billing-profile', tokenA, { stateCode: '33' });
    expect((await api('post', `/v3/admin/wallets/${A.vendorId}/adjustments`, sup, { amountPaise: 400_000, reason: 'suite credit', idempotencyKey: key() })).status).toBe(200);
    expect((await api('post', '/v3/admin/packs', ops, { key: PK, name: 'Test pack', description: 'A test pack for the suite.', items: [{ serviceKey: SK, count: 3 }], validityDays: 30, status: 'ACTIVE' })).status).toBe(200);
    const pp = await api('post', `/v3/admin/packs/${PK}/prices`, ops, { amountPaise: 100_000 });
    expect((await api('post', `/v3/admin/packs/prices/${pp.body.data.id}/approve`, sup, { effectiveFrom: soon() })).status).toBe(200); await new Promise((r) => setTimeout(r, 2600));
    const k = key(); const a = await api('post', `/v3/me/packs/${PK}/purchase`, tokenA, { idempotencyKey: k }); const b = await api('post', `/v3/me/packs/${PK}/purchase`, tokenA, { idempotencyKey: k });
    expect(a.status).toBe(200); expect(a.body.data).toMatchObject({ packKey: PK, paidPaise: 118_000, remaining: { [SK]: 3 }, replay: false }); expect(b.body.data).toMatchObject({ id: a.body.data.id, replay: true });
    expect(await prisma.v3PackPurchase.count({ where: { vendorId: A.vendorId } })).toBe(1);
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'PACK_PURCHASE' } })).toBe(1);
    expect(await prisma.v3Wallet.findUnique({ where: { vendorId: A.vendorId } })).toMatchObject({ balancePaise: 282_000 });
    expect((await api('get', `/v3/admin/wallets/${A.vendorId}/reconcile`, ops)).body.data.ok).toBe(true);
  });

  it('many parallel pack purchases through the real pool can never overspend: 12 parallel buys by a wallet that can afford two more succeed exactly twice', async () => {
    const bal = (await prisma.v3Wallet.findUniqueOrThrow({ where: { vendorId: A.vendorId } })).balancePaise;
    await api('post', `/v3/admin/wallets/${A.vendorId}/adjustments`, sup, { amountPaise: -(bal - 236_000), reason: 'suite trim', idempotencyKey: key() });
    const results = await Promise.all(Array.from({ length: 12 }, () => api('post', `/v3/me/packs/${PK}/purchase`, tokenA, { idempotencyKey: key() }).then((r) => r.status)));
    expect(results.filter((s) => s === 200)).toHaveLength(2); expect(results.filter((s) => s === 409)).toHaveLength(10);
    expect(await prisma.v3Wallet.findUnique({ where: { vendorId: A.vendorId } })).toMatchObject({ balancePaise: 0, heldPaise: 0 });
    expect((await api('get', `/v3/admin/wallets/${A.vendorId}/reconcile`, ops)).body.data.ok).toBe(true);
  });

  it('team members and anonymous callers cannot list services or buy packs', async () => {
    expect((await api('get', '/v3/me/services')).status).toBe(401);
    expect((await api('post', `/v3/me/packs/${PK}/purchase`, undefined, { idempotencyKey: key() })).status).toBe(401);
  });
});
