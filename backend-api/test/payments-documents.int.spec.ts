// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { B3SettingsService } from '../src/b3-settings/b3-settings.service';
import { gstinCheckChar } from '../src/v3-payments/core/doc-core';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SeededTenant, cleanupTenants, newPrisma, seedMember, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice 5.17d on STAGING: the real routes over the real database. Mark as paid makes ONE document with the next gap-free number even when 8 payments are confirmed at once; a repeat makes no
 * second document; the type follows the tax profile; the public page carries no phone number; vendor B cannot read, resend or download vendor A's document; a Free vendor gets 403; a team
 * member gets 403. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('receipts and invoices on staging', () => {
  let app: INestApplication; let prisma: PrismaClient;
  let A: SeededTenant; let B: SeededTenant; let F: SeededTenant; let tokenA: string; let tokenB: string; let tokenF: string; let memberA: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string | null, body?: object) => { const r = request(app.getHttpServer())[method](url); const a = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? a.send(body) : a; };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p517da', RUN_ID); B = await seedTenant(prisma, 'p517db', RUN_ID); F = await seedTenant(prisma, 'p517df', RUN_ID);
    await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); tokenF = vendorToken(F.vendorId, F.email);
    memberA = await seedMember(prisma, A.vendorId, 'p517dm', RUN_ID, ['website']);
    await prisma.v3VendorPaymentMethod.create({ data: { vendorId: A.vendorId, kind: 'UPI', label: 'V3TEST upi', upiId: 'v3test.a@okbank', payeeName: 'V3TEST Shop A', status: 'ACTIVE', isDefault: true, verifiedAt: new Date() } });
    await prisma.v3PlanSetting.upsert({ where: { key: 'payLinkExpiryHours' }, create: { key: 'payLinkExpiryHours', valueJson: 24 }, update: { valueJson: 24 } }); app.get(B3SettingsService).invalidate();
  }, 240000);

  afterAll(async () => { await prisma.v3PlanSetting.deleteMany({ where: { key: 'payLinkExpiryHours' } }).catch(() => undefined); await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  const makePaid = async (amountPaise: number) => { const c = await api('post', '/v3/me/payment-requests', tokenA, { amountPaise, customerName: 'V3TEST Meena', customerPhone: '9876543210' }); return api('post', `/v3/me/payment-requests/${c.body.data.id}/mark-paid`, tokenA, {}); };

  it('the tax profile checks the GSTIN; a payment makes one document of the type the profile says, repeated confirmation makes no second one', async () => {
    expect((await api('put', '/v3/me/tax-profile', tokenA, { gstRegistered: true, gstin: 'nope', legalName: 'V3TEST Stores', address: '1 Test Road, Chennai' })).status).toBe(400);
    const first = await makePaid(10000); expect(first.status).toBe(200); expect(first.body.data.document).toMatchObject({ kind: 'BILL', number: expect.stringMatching(/^INV\d{4}-00001$/) });
    const again = await api('post', `/v3/me/payment-requests/${first.body.data.id}/mark-paid`, tokenA, {}); expect(again.body.data.alreadyPaid).toBe(true);
    expect(await prisma.v3VendorDocument.count({ where: { vendorId: A.vendorId } })).toBe(1);
    const g = '33ABCDE1234F1Z' + gstinCheckChar('33ABCDE1234F1Z'); expect((await api('put', '/v3/me/tax-profile', tokenA, { gstRegistered: true, gstin: g, legalName: 'V3TEST Stores', address: '1 Test Road, Chennai', compositionScheme: true })).status).toBe(200);
    expect((await makePaid(20000)).body.data.document).toMatchObject({ kind: 'BILL_OF_SUPPLY', number: expect.stringMatching(/-00002$/) });
  });

  it('eight payments confirmed at once get numbers without a gap or a repeat', async () => {
    const before = await prisma.v3VendorDocument.count({ where: { vendorId: A.vendorId } });
    await Promise.all(Array.from({ length: 8 }, (_, i) => makePaid(1000 + i)));
    const seqs = (await prisma.v3VendorDocument.findMany({ where: { vendorId: A.vendorId }, orderBy: { seq: 'asc' }, select: { seq: true } })).map((d) => d.seq);
    expect(seqs).toEqual(Array.from({ length: before + 8 }, (_, i) => i + 1));
  });

  it('the public page has no phone number; cross-tenant: vendor B gets the same 404 as for a document that does not exist; Free and a team member are refused', async () => {
    const d = await prisma.v3VendorDocument.findFirstOrThrow({ where: { vendorId: A.vendorId } });
    const pub = await api('get', `/v3/public/doc/${d.publicCode}`, null); expect(pub.status).toBe(200); expect(JSON.stringify(pub.body)).not.toMatch(/9876543210/);
    expect((await api('get', '/v3/public/doc/AAAAAAAAAAAAAAAAAAAAAAAA', null)).status).toBe(404);
    const foreign = await api('get', `/v3/me/documents/${d.id}`, tokenB); const missing = await api('get', '/v3/me/documents/does-not-exist', tokenB);
    expect([foreign.status, missing.status]).toEqual([404, 404]); expect(foreign.body.code).toBe(missing.body.code);
    expect((await api('post', `/v3/me/documents/${d.id}/resend`, tokenB)).status).toBe(404); expect((await api('get', `/v3/me/documents/${d.id}/download`, tokenB)).status).toBe(404);
    expect((await api('get', '/v3/me/documents', tokenF)).status).toBe(403); expect((await api('get', '/v3/me/tax-profile', memberA)).status).toBe(403);
    expect((await api('post', `/v3/me/documents/${d.id}/resend`, tokenA)).status).toBe(200);
  });
});
