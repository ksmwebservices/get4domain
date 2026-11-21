// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { B3SettingsService } from '../src/b3-settings/b3-settings.service';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SeededTenant, cleanupTenants, newPrisma, seedMember, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice 5.17b on STAGING (amendment 06, UPI only): the real routes over the real database. A link cannot be made until the expiry setting exists; the public page shows only what it must; the
 * customer's tap never marks anything paid; Mark as paid is idempotent and makes one payment row; an expired link is a 410; vendor B cannot touch vendor A's request or use A's method; a Free
 * vendor gets 403; a team member gets 403. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('pay requests (UPI only) on staging', () => {
  let app: INestApplication; let prisma: PrismaClient;
  let A: SeededTenant; let B: SeededTenant; let F: SeededTenant; let tokenA: string; let tokenB: string; let tokenF: string; let memberA: string; let methodA: string; let methodB: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string | null, body?: object) => { const r = request(app.getHttpServer())[method](url); const a = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? a.send(body) : a; };
  const setting = async (value: number) => { await prisma.v3PlanSetting.upsert({ where: { key: 'payLinkExpiryHours' }, create: { key: 'payLinkExpiryHours', valueJson: value }, update: { valueJson: value } }); app.get(B3SettingsService).invalidate(); };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, payments: true, activity: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p517ba', RUN_ID); B = await seedTenant(prisma, 'p517bb', RUN_ID); F = await seedTenant(prisma, 'p517bf', RUN_ID);
    await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); tokenF = vendorToken(F.vendorId, F.email);
    memberA = await seedMember(prisma, A.vendorId, 'p517bm', RUN_ID, ['website']);
    methodA = (await prisma.v3VendorPaymentMethod.create({ data: { vendorId: A.vendorId, kind: 'UPI', label: 'V3TEST upi', upiId: 'v3test.a@okbank', payeeName: 'V3TEST Shop A', status: 'ACTIVE', isDefault: true, verifiedAt: new Date() } })).id;
    methodB = (await prisma.v3VendorPaymentMethod.create({ data: { vendorId: B.vendorId, kind: 'UPI', label: 'V3TEST upi', upiId: 'v3test.b@okbank', payeeName: 'V3TEST Shop B', status: 'ACTIVE', isDefault: true, verifiedAt: new Date() } })).id;
  }, 240000);

  afterAll(async () => { await prisma.v3PlanSetting.deleteMany({ where: { key: 'payLinkExpiryHours' } }).catch(() => undefined); await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('no link until the expiry setting exists; then the link works and the page shows only what it must', async () => {
    await prisma.v3PlanSetting.deleteMany({ where: { key: 'payLinkExpiryHours' } }); app.get(B3SettingsService).invalidate();
    const no = await api('post', '/v3/me/payment-requests', tokenA, { amountPaise: 150050, customerName: 'V3TEST Meena' }); expect(no.status).toBe(409); expect(no.body.code).toBe('PAY_LINK_EXPIRY_NOT_SET');
    await setting(24);
    const c = await api('post', '/v3/me/payment-requests', tokenA, { amountPaise: 150050, customerName: 'V3TEST Meena', customerPhone: '9876543210', note: 'V3TEST lamp' }); expect(c.status).toBe(200);
    const page = await api('get', `/v3/public/pay/${c.body.data.code}`, null); expect(page.status).toBe(200); expect(page.headers['cache-control']).toBe('no-store');
    expect(page.body.data).toMatchObject({ state: 'AWAITING', payeeName: 'V3TEST Shop A', amountText: '1500.50', upiIntent: expect.stringContaining('pa=v3test.a%40okbank') });
    expect(JSON.stringify(page.body)).not.toMatch(/9876543210|V3TEST Meena/);
    expect((await api('get', '/v3/public/pay/AAAAAAAAAAAAAAAAAAAAAAAA', null)).status).toBe(404);
  });

  it('the customer tap never marks paid; Mark as paid is idempotent and makes one payment', async () => {
    const c = await api('post', '/v3/me/payment-requests', tokenA, { amountPaise: 10000, customerName: 'V3TEST Meena' });
    const tap = await api('post', `/v3/public/pay/${c.body.data.code}/i-have-paid`, null, { utr: 'V3TEST123456' }); expect(tap.status).toBe(200); expect(tap.body.data.state).toBe('CUSTOMER_SAYS_PAID');
    expect(await prisma.v3Payment.count({ where: { paymentRequestId: c.body.data.id } })).toBe(0);
    expect((await api('post', `/v3/public/pay/${c.body.data.code}/i-have-paid`, null, { utr: '12' })).status).toBe(400);
    const a = await api('post', `/v3/me/payment-requests/${c.body.data.id}/mark-paid`, tokenA, {}); const b = await api('post', `/v3/me/payment-requests/${c.body.data.id}/mark-paid`, tokenA, {});
    expect([a.body.data.alreadyPaid, b.body.data.alreadyPaid]).toEqual([false, true]); expect(await prisma.v3Payment.count({ where: { paymentRequestId: c.body.data.id } })).toBe(1);
  });

  it('an expired link is a 410 and cancel stops a link', async () => {
    const c = await api('post', '/v3/me/payment-requests', tokenA, { amountPaise: 5000, customerName: 'V3TEST Meena' });
    await prisma.v3PaymentRequest.update({ where: { id: c.body.data.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await api('get', `/v3/public/pay/${c.body.data.code}`, null)).status).toBe(410);
    const d = await api('post', '/v3/me/payment-requests', tokenA, { amountPaise: 5000, customerName: 'V3TEST Meena' });
    expect((await api('post', `/v3/me/payment-requests/${d.body.data.id}/cancel`, tokenA)).status).toBe(200); expect((await api('get', `/v3/public/pay/${d.body.data.code}`, null)).status).toBe(410);
  });

  it('cross-tenant: vendor B cannot read, cancel or mark paid A\'s request or use A\'s method; Free is locked; a team member is refused', async () => {
    const c = await api('post', '/v3/me/payment-requests', tokenA, { amountPaise: 7000, customerName: 'V3TEST Meena' });
    const foreign = await api('get', `/v3/me/payment-requests/${c.body.data.id}`, tokenB); const missing = await api('get', '/v3/me/payment-requests/does-not-exist', tokenB);
    expect([foreign.status, missing.status]).toEqual([404, 404]); expect(foreign.body.code).toBe(missing.body.code);
    expect((await api('post', `/v3/me/payment-requests/${c.body.data.id}/mark-paid`, tokenB, {})).status).toBe(404); expect((await api('post', `/v3/me/payment-requests/${c.body.data.id}/cancel`, tokenB)).status).toBe(404);
    expect((await api('post', '/v3/me/payment-requests', tokenA, { amountPaise: 100, customerName: 'V3TEST Meena', methodId: methodB })).status).toBe(409);
    expect((await api('post', '/v3/me/payment-requests', tokenB, { amountPaise: 100, customerName: 'V3TEST Meena', methodId: methodA })).status).toBe(409);
    expect((await api('get', '/v3/me/payment-requests', tokenF)).status).toBe(403); expect((await api('get', '/v3/me/payment-requests', memberA)).status).toBe(403);
  });
});
