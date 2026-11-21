// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SeededTenant, cleanupTenants, newPrisma, seedMember, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice 5.17a on STAGING (owner amendment 06, UPI only): the real routes over the real database. A UPI method needs its id and payee name; a gateway kind is a plain 400; changing the UPI id
 * needs the confirm; one default per business (the partial unique index); vendor B cannot touch vendor A's method; a Free vendor gets 403; a team member gets 403; staff see a masked id and
 * MARKETING is refused. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('payment methods (UPI only) on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let mkt: string; let ops: string;
  let A: SeededTenant; let B: SeededTenant; let F: SeededTenant; let tokenA: string; let tokenB: string; let tokenF: string; let memberA: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string | null, body?: object) => { const r = request(app.getHttpServer())[method](url); const a = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? a.send(body) : a; };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    mkt = await seedStaff(prisma, 'p517mkt', RUN_ID, 'MARKETING'); ops = await seedStaff(prisma, 'p517ops', RUN_ID, 'OPERATIONS');
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, payments: true, activity: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p517a', RUN_ID); B = await seedTenant(prisma, 'p517b', RUN_ID); F = await seedTenant(prisma, 'p517f', RUN_ID);
    await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); tokenF = vendorToken(F.vendorId, F.email);
    memberA = await seedMember(prisma, A.vendorId, 'p517m', RUN_ID, ['website']);
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('UPI needs id and payee name; a gateway kind is a plain 400 and stores nothing; the id and name come back to the owner only', async () => {
    expect((await api('post', '/v3/me/payment-methods', tokenA, { kind: 'UPI', label: 'V3TEST upi', upiId: 'nobank', payeeName: 'V3TEST Shop' })).status).toBe(400);
    for (const kind of ['OWN_GATEWAY', 'GATEWAY_RAZORPAY', 'GATEWAY_CASHFREE', 'GATEWAY_PAYTM']) expect((await api('post', '/v3/me/payment-methods', tokenA, { kind, label: 'V3TEST gate', details: 'key_1234' })).status).toBe(400);
    expect(await prisma.v3VendorPaymentMethod.count({ where: { vendorId: A.vendorId } })).toBe(0);
    const c = await api('post', '/v3/me/payment-methods', tokenA, { kind: 'UPI', label: 'V3TEST upi', upiId: 'V3Test.Shop@OKSBI', payeeName: 'V3TEST Shop' });
    expect(c.status).toBe(200); expect(c.body.data).toMatchObject({ kind: 'UPI', upiId: 'v3test.shop@oksbi', payeeName: 'V3TEST Shop', isDefault: false });
  });

  it('changing the UPI id needs the confirm; with it the method drops to UNVERIFIED', async () => {
    const m = await prisma.v3VendorPaymentMethod.findFirstOrThrow({ where: { vendorId: A.vendorId, kind: 'UPI' } });
    const no = await api('put', `/v3/me/payment-methods/${m.id}`, tokenA, { upiId: 'other.shop@okaxis' }); expect(no.status).toBe(409); expect(no.body.code).toBe('PAYMENT_METHOD_CONFIRM_REQUIRED');
    expect((await prisma.v3VendorPaymentMethod.findFirstOrThrow({ where: { id: m.id } })).upiId).toBe('v3test.shop@oksbi');
    const yes = await api('put', `/v3/me/payment-methods/${m.id}`, tokenA, { upiId: 'other.shop@okaxis', confirmUpiChange: true }); expect(yes.status).toBe(200); expect(yes.body.data).toMatchObject({ upiId: 'other.shop@okaxis', status: 'UNVERIFIED' });
    expect(await prisma.v3ActivityLog.count({ where: { vendorId: A.vendorId, actionKey: 'payment_method.upi_changed' } })).toBeGreaterThanOrEqual(1);
  });

  it('one default per business, enforced by the database; the default must be active', async () => {
    const m = await prisma.v3VendorPaymentMethod.findFirstOrThrow({ where: { vendorId: A.vendorId, kind: 'UPI' } });
    expect((await api('post', `/v3/me/payment-methods/${m.id}/default`, tokenA)).status).toBe(409);   // still UNVERIFIED
    await prisma.v3VendorPaymentMethod.update({ where: { id: m.id }, data: { status: 'ACTIVE', isDefault: true } });
    const second = await prisma.v3VendorPaymentMethod.create({ data: { vendorId: A.vendorId, kind: 'UPI', label: 'V3TEST second', upiId: 'second@okhdfc', payeeName: 'V3TEST Shop', status: 'ACTIVE' } });
    await expect(prisma.v3VendorPaymentMethod.update({ where: { id: second.id }, data: { isDefault: true } })).rejects.toBeDefined();   // partial unique index
    expect((await api('post', `/v3/me/payment-methods/${second.id}/default`, tokenA)).status).toBe(200);
    expect(await prisma.v3VendorPaymentMethod.count({ where: { vendorId: A.vendorId, isDefault: true } })).toBe(1);
  });

  it('cross-tenant: vendor B gets the same answer as for a method that does not exist; Free is locked; a team member is refused', async () => {
    const m = await prisma.v3VendorPaymentMethod.findFirstOrThrow({ where: { vendorId: A.vendorId } });
    const foreign = await api('put', `/v3/me/payment-methods/${m.id}`, tokenB, { label: 'Mine now' }); const missing = await api('put', '/v3/me/payment-methods/does-not-exist', tokenB, { label: 'Mine now' });
    expect([foreign.status, missing.status]).toEqual([404, 404]); expect(foreign.body.code).toBe(missing.body.code);
    expect((await api('post', `/v3/me/payment-methods/${m.id}/default`, tokenB)).status).toBe(404);
    expect(((await api('get', '/v3/me/payment-methods', tokenB)).body.data as Array<{ id: string }>).map((x) => x.id)).not.toContain(m.id);
    expect((await api('get', '/v3/me/payment-methods', tokenF)).status).toBe(403);
    expect((await api('get', '/v3/me/payment-methods', memberA)).status).toBe(403);
  });

  it('staff read only, masked: OPERATIONS sees pr•••@bank, never the full id; MARKETING is refused', async () => {
    const r = await api('get', `/v3/admin/vendors/${A.vendorId}/payment-methods`, ops); expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/second@okhdfc|other\.shop@okaxis/);
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/payment-methods`, mkt)).status).toBe(403);
  });
});
