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
import { FakeCrypto, FakeRegistrar, RecordingOtpSender } from './support/registrar-world';

/**
 * Batch 11 slice 5.6d on STAGING, with the real database and the real wallet, a FAKE registrar (never live), a recording OTP sender and a test crypto. It proves the parts only a database can: the
 * one-live-purchase-per-name rule, the unique key, the hold and charge written together with the order, the release on failure, the invoice, the cascade that lets the cleanup remove everything, and the
 * routes' roles. The suite adds its OWN tax rows, settings and approved margins and removes them at the end. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(300_000);

describe('domain sales on staging (fake registrar, real database and wallet)', () => {
  let app: INestApplication; let prisma: PrismaClient; const fake = new FakeRazorpay(); const port = new FakeRegistrar(); const sender = new RecordingOtpSender(); const crypto = new FakeCrypto();
  let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let sup: string; let ops: string; let mkt: string;
  const taxIds: string[] = []; const marginIds: string[] = []; const saved = new Map<string, { existed: boolean; value: unknown }>();
  const api = (method: 'get' | 'post' | 'put', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`).timeout({ response: 60_000, deadline: 90_000 }); return body ? r.send(body) : r; };
  const key = (() => { let n = 0; return () => `v3test-${RUN_ID}-dom-${++n}`; })();
  const setSetting = async (k: string, v: unknown) => { if (!saved.has(k)) { const row = await prisma.v3PlanSetting.findUnique({ where: { key: k } }); saved.set(k, { existed: !!row, value: row?.valueJson ?? null }); } await prisma.v3PlanSetting.upsert({ where: { key: k }, update: { valueJson: v as never }, create: { key: k, valueJson: v as never } }); };
  const must = async (step: string, call: PromiseLike<{ status: number; body: unknown }>) => { const r = await call; if (r.status < 200 || r.status >= 300) throw new Error(`setup step "${step}" answered ${r.status}: ${JSON.stringify(r.body)}`); return r; };
  const balance = async (v: SeededTenant) => (await prisma.v3Wallet.findUniqueOrThrow({ where: { vendorId: v.vendorId } }));
  const domain = (n: string): string => `v3test-${RUN_ID.toLowerCase().replace(/[^a-z0-9]/g, '')}-${n}.com`;
  const buy = (token: string, d: string, k = key(), total = 99_120) => api('post', '/v3/me/domain-sales/purchase', token, { domain: d, years: 1, privacy: false, idempotencyKey: k, expectedTotalPaise: total, consent: true });
  const identity = async (token: string, v: SeededTenant, staff: string) => {
    await must('details', api('put', '/v3/me/identity/details', token, { legalName: 'Meena Ravi', company: 'V3TEST Traders', email: `${v.email}`, phoneCc: '91', phone: '9876543210', addressLine1: '12 Main Road', city: 'Madurai', state: 'Tamil Nadu', zipcode: '625001' }));
    for (const ch of ['EMAIL', 'PHONE'] as const) { await must(`otp ${ch}`, api('post', '/v3/me/identity/otp', token, { channel: ch })); const code = [...sender.sent].reverse().find((s) => s.channel === ch && s.vendorId === v.vendorId)!.code; await must(`verify ${ch}`, api('post', '/v3/me/identity/otp/verify', token, { channel: ch, code })); }
    await must('document', api('put', '/v3/me/identity/document', token, { kind: 'PAN', mime: 'application/pdf', dataBase64: Buffer.from('v3test pan').toString('base64') }));
    await must('submit', api('post', '/v3/me/identity/submit', token, { consent: true }));
    await must('approve', api('post', `/v3/admin/vendors/${v.vendorId}/identity/approve`, staff, {}));
  };

  beforeAll(async () => {
    let step = 'start';
    try {
      step = 'build the app'; prisma = newPrisma();
      app = await buildProvisioningTestApp({ billing: { fake }, wallet: true, includeSiteApi: true, registrar: { port, sender, crypto } });
      step = 'seed vendors and staff'; const subs = app.get(SubscriptionsService);
      A = await seedTenant(prisma, 'd56a', RUN_ID); B = await seedTenant(prisma, 'd56b', RUN_ID);
      for (const v of [A, B]) { await makeSiteVendor(prisma, subs, v, RUN_ID, { complete: true }); await subs.assignPlan({ vendorId: v.vendorId, planKey: 'handyman_pro', termMonths: 3, source: 'SELF', actor: { type: 'SYSTEM', id: null, ip: null }, reason: `plan order v3test-${RUN_ID}` }); }
      tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
      sup = await seedStaff(prisma, 'd56sup', RUN_ID, 'SUPER_ADMIN'); ops = await seedStaff(prisma, 'd56ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'd56mkt', RUN_ID, 'MARKETING');
      step = 'tax rows and settings'; const eff = new Date(Date.now() - 3_600_000);
      for (const [name, rate] of [['IGST', 18], ['CGST', 9], ['SGST', 9]] as const) taxIds.push((await prisma.v3TaxRate.create({ data: { name, ratePercent: rate, appliesTo: 'ALL', active: true, validFrom: new Date(eff.getTime() + taxIds.length) } })).id);
      await setSetting('walletSellerStateCode', '33'); await setSetting('walletTopupMinPaise', 10_000); await setSetting('walletTopupMaxPaise', 1_000_000);
      await setSetting('registrarNameServers', ['ns1.example.com', 'ns2.example.com']); await setSetting('registrarMinBalancePaise', 100_000);
      await setSetting('identityOtpTtlSeconds', 600); await setSetting('identityOtpMaxAttempts', 3); await setSetting('identityDocMaxBytes', 1_000_000);
      step = 'open and credit the wallets'; for (const [t, v] of [[tokenA, A], [tokenB, B]] as const) { await must(step, api('get', '/v3/me/wallet', t)); await must('billing profile', api('put', '/v3/me/wallet/billing-profile', t, { stateCode: '33' })); await must(step, api('post', `/v3/admin/wallets/${v.vendorId}/adjustments`, sup, { amountPaise: 500_000, reason: 'suite credit', idempotencyKey: key() })); }
      step = 'price book'; for (const [tld, kind, value] of [['com', 'PERCENT_BP', 2000]] as const) {
        const p = await must(step, api('post', '/v3/admin/domain-margins', ops, { tld, kind, value })); marginIds.push((p.body as { data: { id: string } }).data.id);
        await must(step, api('post', `/v3/admin/domain-margins/${marginIds[0]}/approve`, sup, { effectiveFrom: new Date(Date.now() - 60_000).toISOString() }));
      }
      step = 'identity checks'; await identity(tokenA, A, ops); await identity(tokenB, B, ops);
    } catch (e) { throw new Error(`domain sales suite setup failed at step "${step}": ${e instanceof Error ? e.message : String(e)}`); }
  }, 300000);

  afterAll(async () => {
    await runCleanup([
      () => prisma.v3DomainMargin.deleteMany({ where: { id: { in: marginIds } } }), () => prisma.v3TaxRate.deleteMany({ where: { id: { in: taxIds } } }),
      async () => { for (const [k, s] of saved) { if (s.existed) await prisma.v3PlanSetting.update({ where: { key: k }, data: { valueJson: s.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key: k } }); } },
      () => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect(),
    ]);
  }, 240000);

  it('a purchase writes the order, the hold and the charge, the registered domain, the invoice and the vendor\'s own domain row', async () => {
    const before = await balance(A); const d = domain('one');
    const r = await buy(tokenA, d); expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ status: 'COMPLETED', amountPaise: 99_120 });
    const after = await balance(A); expect(after.balancePaise).toBe(before.balancePaise - 99_120); expect(after.heldPaise).toBe(0);
    const order = await prisma.v3DomainOrder.findFirstOrThrow({ where: { vendorId: A.vendorId, domain: d } });
    expect(order).toMatchObject({ status: 'COMPLETED', openKey: d, amountPaise: 99_120 });
    expect((await prisma.v3WalletLedger.findMany({ where: { vendorId: A.vendorId, refId: order.id }, orderBy: { entryNo: 'asc' } })).map((e) => [e.kind, Math.abs(e.amountPaise)])).toEqual([['HOLD', 99_120], ['CHARGE', 99_120]]);
    expect(await prisma.v3DomainInvoice.count({ where: { orderId: order.id, vendorId: A.vendorId, totalPaise: 99_120 } })).toBe(1);
    expect(await prisma.v3RegisteredDomain.count({ where: { vendorId: A.vendorId, domain: d } })).toBe(1);
    expect(await prisma.v3Domain.count({ where: { vendorId: A.vendorId, hostname: d, kind: 'CUSTOM', status: 'ACTIVE' } })).toBe(1);
  });

  it('three parallel submissions of one key buy once; a second key for the same name is refused; the database rule refuses a second live order for a name', async () => {
    const d = domain('two'); const k = key();
    const rs = await Promise.all([buy(tokenA, d, k), buy(tokenA, d, k), buy(tokenA, d, k)]);
    expect(rs.every((r) => r.status === 200)).toBe(true); expect(new Set(rs.map((r) => r.body.data.id)).size).toBe(1);
    expect(port.calls.filter((c) => c === `register:${d}`)).toHaveLength(1); expect(await prisma.v3DomainOrder.count({ where: { vendorId: A.vendorId, domain: d } })).toBe(1);
    expect((await buy(tokenA, d)).body.code).toBe('DOMAIN_NOT_AVAILABLE');
    await expect(prisma.v3DomainOrder.create({ data: { vendorId: B.vendorId, kind: 'REGISTER', domain: d, tld: 'com', years: 1, amountPaise: 1, costPaise: 1, marginPaise: 0, idempotencyKey: key(), openKey: d } })).rejects.toThrow();
    await expect(prisma.v3DomainOrder.create({ data: { vendorId: A.vendorId, kind: 'REGISTER', domain: d, tld: 'com', years: 1, amountPaise: 1, costPaise: 1, marginPaise: 0, idempotencyKey: k } })).rejects.toThrow();
  });

  it('a registrar refusal releases the hold and frees the name; an unsure answer keeps the hold until recovery settles it', async () => {
    const before = await balance(A); const d = domain('fail');
    port.registerMode = 'refuse'; const f = await buy(tokenA, d); expect(f.body.data).toMatchObject({ status: 'FAILED' });
    port.registerMode = 'ok'; const mid = await balance(A); expect(mid).toMatchObject({ balancePaise: before.balancePaise, heldPaise: 0 });
    const o = await prisma.v3DomainOrder.findFirstOrThrow({ where: { vendorId: A.vendorId, domain: d } }); expect(o.openKey).toBeNull();
    expect((await prisma.v3WalletLedger.findMany({ where: { vendorId: A.vendorId, refId: o.id } })).map((e) => e.kind).sort()).toEqual(['HOLD', 'RELEASE']);
    const u = domain('unsure'); port.registerMode = 'timeout-but-done'; const r = await buy(tokenA, u); port.registerMode = 'ok';
    expect(r.body.data).toMatchObject({ status: 'UNKNOWN', pendingConfirmation: true }); expect((await balance(A)).heldPaise).toBe(99_120);
    const rec = await api('post', '/v3/admin/registrar/recover', ops, { olderThanMinutes: 0 }); expect(rec.status).toBe(200); expect(rec.body.data.settled).toBeGreaterThanOrEqual(1);
    expect((await balance(A)).heldPaise).toBe(0); expect(await prisma.v3DomainOrder.count({ where: { vendorId: A.vendorId, domain: u, status: 'COMPLETED' } })).toBe(1);
  });

  it('renewal works before expiry and is refused after it', async () => {
    const reg = await prisma.v3RegisteredDomain.findFirstOrThrow({ where: { vendorId: A.vendorId, domain: domain('one') } });
    const q = await api('post', `/v3/me/domain-sales/registered/${reg.id}/renew-quote`, tokenA, { years: 1 }); expect(q.status).toBe(200);
    const r = await api('post', `/v3/me/domain-sales/registered/${reg.id}/renew`, tokenA, { years: 1, idempotencyKey: key(), expectedTotalPaise: q.body.data.totalPaise }); expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ kind: 'RENEW', status: 'COMPLETED' });
    await prisma.v3RegisteredDomain.update({ where: { id: reg.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const late = await api('post', `/v3/me/domain-sales/registered/${reg.id}/renew`, tokenA, { years: 1, idempotencyKey: key(), expectedTotalPaise: q.body.data.totalPaise }); expect(late.status).toBe(409); expect(late.body.code).toBe('DOMAIN_EXPIRED');
  });

  it('vendors are separate: another vendor cannot see or renew these, and sees their own list only', async () => {
    const mine = await prisma.v3DomainOrder.findFirstOrThrow({ where: { vendorId: A.vendorId } }); const reg = await prisma.v3RegisteredDomain.findFirstOrThrow({ where: { vendorId: A.vendorId } });
    expect((await api('get', `/v3/me/domain-sales/orders/${mine.id}`, tokenB)).status).toBe(404);
    expect((await api('post', `/v3/me/domain-sales/registered/${reg.id}/renew`, tokenB, { years: 1, idempotencyKey: key(), expectedTotalPaise: 1 })).status).toBe(404);
    expect((await api('get', '/v3/me/domain-sales/registered', tokenB)).body.data).toEqual([]);
  });

  it('a Free vendor sees a locked preview; the staff routes follow the role matrix', async () => {
    await prisma.v3PlanSubscription.updateMany({ where: { vendorId: B.vendorId }, data: { status: 'EXPIRED', currentVendorId: null } });
    const o = await api('get', '/v3/me/domain-sales/overview', tokenB); expect(o.status).toBe(200); expect(o.body.data.state).toBe('LOCKED_PREVIEW');
    expect((await buy(tokenB, domain('free'))).status).toBe(403);
    for (const [m, u] of [['get', '/v3/admin/domain-orders'], ['get', '/v3/admin/domain-margins'], ['get', '/v3/admin/identity-checks'], ['get', `/v3/admin/vendors/${A.vendorId}/identity`], ['get', '/v3/admin/registrar/runs']] as const) expect([u, (await api(m, u, mkt)).status]).toEqual([u, 403]);
    expect((await api('post', `/v3/admin/domain-margins/${marginIds[0]}/approve`, ops, { effectiveFrom: new Date().toISOString() })).status).toBe(403);   // SUPER_ADMIN only
    const list = await api('get', `/v3/admin/domain-orders?vendorId=${A.vendorId}`, ops); expect(list.status).toBe(200); expect(list.body.data.total).toBeGreaterThanOrEqual(3);
  });

  it('opening an identity document is logged first and never returned to the vendor; staff on behalf spend the vendor\'s own wallet', async () => {
    const view = await api('get', '/v3/me/identity', tokenA); expect(JSON.stringify(view.body)).not.toMatch(/cipher|dataBase64/);
    const doc = await api('post', `/v3/admin/vendors/${A.vendorId}/identity/document`, ops, { reason: 'suite check of the document' }); expect(doc.status).toBe(200);
    expect(await prisma.v3IdentityAccess.count({ where: { vendorId: A.vendorId, action: 'DOCUMENT_VIEWED' } })).toBe(1);
    const before = await balance(A); const d = domain('behalf');
    const r = await api('post', `/v3/admin/vendors/${A.vendorId}/domains/register`, ops, { domain: d, years: 1, idempotencyKey: key(), expectedTotalPaise: 99_120, reason: 'vendor asked by phone' });
    expect(r.status).toBe(200); expect((await balance(A)).balancePaise).toBe(before.balancePaise - 99_120);
    expect(await prisma.v3DomainOrder.count({ where: { vendorId: A.vendorId, domain: d, requestedByType: 'STAFF', requestedById: expect.any(String) as never } })).toBe(1);
  });
});
