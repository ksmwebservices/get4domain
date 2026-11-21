// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { monthOf } from '../src/v3-referrals/core/referral-core';
import { BillingFixture, setUpBilling, tearDownBilling } from './support/billing-staging';
import { runCleanup } from './support/cleanup-guard';
import { SeededTenant, cleanupTenants, newPrisma, seedPartnerLogin, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { makeSiteVendor } from './support/site-staging';
import { bootWave3, Wave3Env } from './support/wave3-staging';

/**
 * Wave 3 Part I on STAGING (in-memory gateways, real database): a partner's code, first-touch attribution, self-referral refused, the ledger line on the first paid plan payment (once), slab tiers, an idempotent month
 * close, a payout with a reference, the CSV, and who may do what. The slab rows are made by the synthetic super admin, so test:cleanup-staging removes them. Synthetic data only. NOT RUN in the build session that wrote it.
 */
jest.setTimeout(300_000);

describe('referrals and commission on staging', () => {
  let env: Wave3Env; let prisma: PrismaClient; let fx: BillingFixture; let A: SeededTenant; let B: SeededTenant; let tokenA: string;
  let sup: string; let admin: string; let ops: string; let mkt: string; let partner: { partnerId: string; token: string; email: string };
  const wait = async (fn: () => Promise<boolean>) => { for (let i = 0; i < 30; i++) { if (await fn()) return; await new Promise((r) => setTimeout(r, 200)); } };
  const pay = async (token: string, payId: string) => {
    const c = await env.api('post', '/v3/me/billing/orders', token, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: env.key('ref') });
    env.gws.cashfree.addPayment({ paymentId: payId, providerOrderId: c.body.data.providerOrderId, amountMinor: c.body.data.amountPaise, currency: 'INR', status: 'SUCCESS' });
    await env.api('post', `/v3/me/billing/orders/${c.body.data.id}/confirm`, token, {});
    return c.body.data.id as string;
  };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma); env = await bootWave3(prisma); await env.setGateway('cashfree');
    A = await seedTenant(prisma, 'w3ra', RUN_ID); B = await seedTenant(prisma, 'w3rb', RUN_ID);
    for (const t of [A, B]) await makeSiteVendor(prisma, env.app.get(SubscriptionsService), t, RUN_ID, {});
    tokenA = vendorToken(A.vendorId, A.email);
    sup = await seedStaff(prisma, 'w3rsup', RUN_ID, 'SUPER_ADMIN'); admin = await seedStaff(prisma, 'w3radm', RUN_ID, 'ADMIN'); ops = await seedStaff(prisma, 'w3rops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'w3rmkt', RUN_ID, 'MARKETING');
    partner = await seedPartnerLogin(prisma, 'w3rp', RUN_ID, { phone: '+919000011111' });
  }, 300000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => env?.app.close(), () => prisma?.$disconnect()]); }, 180000);

  let code = '';
  it('an admin issues a code, it resolves publicly to the source name only, and SALES, OPERATIONS and a partner cannot issue one', async () => {
    for (const t of [ops, mkt, partner.token]) expect((await env.api('post', `/v3/admin/partners/${partner.partnerId}/links`, t, {})).status).toBe(403);
    const issued = await env.api('post', `/v3/admin/partners/${partner.partnerId}/links`, admin, {}); expect(issued.status).toBe(200);
    code = issued.body.data.code; expect(code).toMatch(/^[A-Z2-9]{8}$/);
    const pub = await env.api('get', `/v3/public/referral/${code}`); expect(pub.body.data).toEqual({ valid: true, source: `V3TEST partner w3rp` });
    expect((await env.api('get', '/v3/public/referral/ZZZZZZZZ')).body.data).toEqual({ valid: false });
  });

  it('first touch wins, only SUPER_ADMIN changes a referrer, and a partner cannot be set on his own business', async () => {
    const set = await env.api('put', `/v3/admin/vendors/${A.vendorId}/referral`, admin, { partnerId: partner.partnerId }); expect(set.status).toBe(200);
    expect((await env.api('put', `/v3/admin/vendors/${A.vendorId}/referral`, admin, { partnerId: partner.partnerId })).body.code).toBe('REFERRAL_ATTRIBUTION_EXISTS');
    expect((await env.api('post', `/v3/admin/vendors/${A.vendorId}/referral/change`, admin, { partnerId: partner.partnerId, reason: 'moving' })).status).toBe(403);
    await prisma.vendor.update({ where: { id: B.vendorId }, data: { phone: '09000011111' } });
    expect((await env.api('put', `/v3/admin/vendors/${B.vendorId}/referral`, admin, { partnerId: partner.partnerId })).body.code).toBe('REFERRAL_SELF_REFERRAL');
    const src = await env.api('get', `/v3/admin/vendors/${A.vendorId}/referral`, ops); expect(src.body.data.referral).toMatchObject({ source: 'ON_BEHALF', partner: { id: partner.partnerId } });
    expect((await env.api('get', `/v3/admin/vendors/${A.vendorId}/referral`, mkt)).status).toBe(403);
  });

  it('the first paid plan payment makes ONE ledger line; a second payment makes none; no slab rows means nothing accrues', async () => {
    await pay(tokenA, '7300001'); await pay(tokenA, '7300002');
    await wait(async () => (await prisma.commissionLedger.count({ where: { vendorId: A.vendorId } })) > 0);
    const lines = await prisma.commissionLedger.findMany({ where: { vendorId: A.vendorId } });
    expect(lines).toHaveLength(1); expect(lines[0]).toMatchObject({ partnerId: partner.partnerId, status: 'ACCRUED', amountMinor: null, month: monthOf(new Date()) });
    const month = monthOf(new Date());
    const empty = await env.api('post', `/v3/admin/commission/months/${month}/close`, admin, {}); expect(empty.body.data).toMatchObject({ noSlabs: true, approved: 0 });
    expect((await env.api('post', '/v3/admin/commission/payouts', admin, { partnerId: partner.partnerId, month, reference: 'UTR000111' })).body.code).toBe('COMMISSION_MONTH_NOT_CLOSED');
  });

  it('slab rows by ADMIN, an idempotent close, one payout with a reference, the CSV, and the partner sees only its own, with no contact details', async () => {
    const month = monthOf(new Date());
    expect((await env.api('post', '/v3/admin/commission/slabs', mkt, { minVendors: 1 })).status).toBe(403);
    const row = await env.api('post', '/v3/admin/commission/slabs', sup, { minVendors: 1, maxVendors: null, amountPerVendorMinor: 100_000, effectiveFrom: '2026-01-01T00:00:00Z' }); expect(row.status).toBe(200);
    const closed = await env.api('post', `/v3/admin/commission/months/${month}/close`, admin, {}); expect(closed.body.data).toMatchObject({ noSlabs: false, approved: 1 });
    expect((await env.api('post', `/v3/admin/commission/months/${month}/close`, admin, {})).body.data.approved).toBe(0);
    expect((await env.api('post', '/v3/admin/commission/payouts', admin, { partnerId: partner.partnerId, month, reference: '' })).body.code).toBe('COMMISSION_PAYOUT_INVALID');
    const paid = await env.api('post', '/v3/admin/commission/payouts', admin, { partnerId: partner.partnerId, month, reference: 'UPI 4821 7766' }); expect(paid.status).toBe(200); expect(paid.body.data).toMatchObject({ totalMinor: 100_000, status: 'PAID' });
    expect((await env.api('post', '/v3/admin/commission/payouts', admin, { partnerId: partner.partnerId, month, reference: 'UPI 9999 9999' })).body.code).toBe('COMMISSION_PAYOUT_EXISTS');
    const csv = await env.api('get', `/v3/admin/commission/ledger/export.csv?month=${month}`, ops); expect(csv.status).toBe(200); expect(csv.headers['content-type']).toContain('text/csv');
    const mine = await env.api('get', '/v3/partner/commission', partner.token); expect(mine.body.data.items[0]).toMatchObject({ month, status: 'PAID', amountMinor: 100_000 });
    const vendors = await env.api('get', '/v3/partner/vendors', partner.token); expect(vendors.body.data.total).toBe(1); expect(JSON.stringify(vendors.body)).not.toMatch(new RegExp(`${A.email}|${A.vendorId}|9000001`));
  });

  it('a full refund of the qualifying payment reverses the line and flags it for the owner', async () => {
    const line = await prisma.commissionLedger.findFirstOrThrow({ where: { vendorId: A.vendorId } });
    const total = (await prisma.v3PlanOrder.findUniqueOrThrow({ where: { id: line.orderId } })).paidAmountPaise as number;
    expect((await env.api('post', `/v3/admin/billing/orders/${line.orderId}/refund`, sup, { amountPaise: total, note: 'refunded by the gateway dashboard' })).status).toBe(200);
    await wait(async () => (await prisma.commissionLedger.findUniqueOrThrow({ where: { id: line.id } })).status === 'REVERSED');
    const after = await prisma.commissionLedger.findUniqueOrThrow({ where: { id: line.id } }); expect(after).toMatchObject({ status: 'REVERSED', flagged: true }); expect(after.flagReason).toMatch(/owner decides/);
  });
});
