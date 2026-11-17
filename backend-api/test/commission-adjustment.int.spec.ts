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
import { SeededTenant, cleanupTenants, newPrisma, seedPartnerLogin, seedStaff, seedTenant } from './support/fixtures';
import { makeSiteVendor } from './support/site-staging';
import { bootWave3, Wave3Env } from './support/wave3-staging';

/**
 * Wave 4 W4 (and W8's payout record) on STAGING (in-memory gateways, real database): a commission line is made by a real cash payment; it is approved by a month close and paid out; the payment is then reversed by a
 * recorded FULL refund, so the PAID line stays PAID and a separate negative ADJUSTMENT line is made once; the migration objects hold (one line per vendor and kind, the amount rule); the next month's close nets the
 * adjustment when the partner has enough that month and carries it forward when not; closing again changes nothing. Synthetic data only. NOT RUN in the build session that wrote it (a lane that never touches a
 * database): the owner applies the migration 20261230100000_v3_wave4_commission_adjustment on staging and then runs this file alone.
 */
jest.setTimeout(300_000);

describe('commission adjustment on staging', () => {
  let env: Wave3Env; let prisma: PrismaClient; let fx: BillingFixture; let A: SeededTenant; let B: SeededTenant; let C: SeededTenant;
  let sup: string; let admin: string; let ops: string; let partner: { partnerId: string; token: string };
  const now = new Date(); const thisMonth = monthOf(now);
  const nextMonth = monthOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15)));
  const cashBody = (amountPaise: number) => ({ method: 'CASH', reference: `RCPT-${RUN_ID}`, receivedOn: new Date().toISOString().slice(0, 10), amountPaise, specialCase: true, reason: 'paid cash at the office, no card or bank' });
  const until = async <T>(what: string, fn: () => Promise<T | null | undefined>, ms = 15_000): Promise<T> => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 300)); } };
  let orderId = ''; let paidPaise = 0;

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    fx = await setUpBilling(prisma); env = await bootWave3(prisma);
    A = await seedTenant(prisma, 'w4ca', RUN_ID); await makeSiteVendor(prisma, env.app.get(SubscriptionsService), A, RUN_ID, {});
    B = await seedTenant(prisma, 'w4cb', RUN_ID); C = await seedTenant(prisma, 'w4cc', RUN_ID);
    sup = await seedStaff(prisma, 'w4csup', RUN_ID, 'SUPER_ADMIN'); admin = await seedStaff(prisma, 'w4cadm', RUN_ID, 'ADMIN'); ops = await seedStaff(prisma, 'w4cops', RUN_ID, 'OPERATIONS');
    partner = await seedPartnerLogin(prisma, 'w4cp', RUN_ID);
    await prisma.referralAttribution.create({ data: { vendorId: A.vendorId, partnerId: partner.partnerId, source: 'ON_BEHALF' } });
  }, 300000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => env?.app.close(), () => prisma?.$disconnect()]); }, 180000);

  const ledger = async (token = sup) => (await env.api('get', `/v3/admin/commission/ledger?partnerId=${partner.partnerId}&pageSize=100`, token)).body.data.items as Array<{ id: string; vendorId: string; kind: string; status: string; month: string; amountMinor: number | null; adjustsLineId: string | null; flagged: boolean }>;

  it('a real paid plan makes ONE commission line; a month close approves it by the slab; the payout is recorded as gross, TDS and net (no TDS percent set: TDS is 0)', async () => {
    const made = await env.api('post', `/v3/admin/billing/vendors/${A.vendorId}/cash-orders`, admin, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: env.key('w4c') }); expect(made.status).toBe(200);
    orderId = made.body.data.id as string; paidPaise = made.body.data.amountPaise as number;
    expect((await env.api('post', `/v3/admin/billing/orders/${orderId}/mark-paid`, admin, cashBody(paidPaise))).status).toBe(200);
    const line = await until('the commission line', async () => (await ledger()).find((l) => l.vendorId === A.vendorId && l.kind === 'COMMISSION'));
    expect(line).toMatchObject({ status: 'ACCRUED', month: thisMonth, amountMinor: null });
    expect((await env.api('post', '/v3/admin/commission/slabs', sup, { minVendors: 1, maxVendors: 2, amountPerVendorMinor: 100_000, effectiveFrom: '2026-01-01T00:00:00Z' })).status).toBe(200);
    expect((await env.api('post', '/v3/admin/commission/slabs', sup, { minVendors: 3, maxVendors: null, amountPerVendorMinor: 150_000, effectiveFrom: '2026-01-01T00:00:00Z' })).status).toBe(200);
    expect((await env.api('post', `/v3/admin/commission/months/${thisMonth}/close`, ops)).status).toBe(403);
    const close = await env.api('post', `/v3/admin/commission/months/${thisMonth}/close`, admin); expect(close.status).toBe(200); expect(close.body.data.approved).toBe(1);
    const pre = await env.api('get', `/v3/admin/commission/payouts/preview?partnerId=${partner.partnerId}&month=${thisMonth}`, ops); expect(pre.status).toBe(200);
    expect(pre.body.data).toMatchObject({ grossMinor: 100_000, tdsMinor: 0, netMinor: 100_000, panOnRecord: false });
    const pay = await env.api('post', '/v3/admin/commission/payouts', admin, { partnerId: partner.partnerId, month: thisMonth, reference: `UTR-${RUN_ID}-1` });
    expect(pay.status).toBe(200); expect(pay.body.data).toMatchObject({ totalMinor: 100_000, grossMinor: 100_000, tdsMinor: 0, netMinor: 100_000 });
    expect((await ledger()).find((l) => l.vendorId === A.vendorId)).toMatchObject({ kind: 'COMMISSION', status: 'PAID', amountMinor: 100_000 });
  });

  it('a recorded FULL refund after the payout leaves the PAID line PAID and makes ONE negative ADJUSTMENT line, flagged; repeating the refund call changes nothing', async () => {
    const refund = await env.api('post', `/v3/admin/billing/orders/${orderId}/refund`, sup, { amountPaise: paidPaise, note: 'refunded in the gateway dashboard' }); expect(refund.status).toBe(200);
    const adj = await until('the adjustment line', async () => (await ledger()).find((l) => l.kind === 'ADJUSTMENT'));
    const paid = (await ledger()).find((l) => l.kind === 'COMMISSION' && l.vendorId === A.vendorId)!;
    expect(adj).toMatchObject({ vendorId: A.vendorId, status: 'ACCRUED', amountMinor: -100_000, adjustsLineId: paid.id, flagged: true });
    expect(paid).toMatchObject({ status: 'PAID', flagged: true });
    expect((await prisma.commissionPayout.findFirstOrThrow({ where: { partnerId: partner.partnerId } })).totalMinor).toBe(100_000);   // the payout record is history
    await env.api('post', `/v3/admin/billing/orders/${orderId}/refund`, sup, { amountPaise: 1, note: 'a second record that must not repeat the reversal' });
    expect((await ledger()).filter((l) => l.kind === 'ADJUSTMENT')).toHaveLength(1);
  });

  it('the partner sees the adjustment as a negative line without any internal note; the CSV and the admin ledger carry the kind', async () => {
    const mine = await env.api('get', '/v3/partner/commission', partner.token); expect(mine.status).toBe(200);
    expect(mine.body.data.items.find((i: { kind: string }) => i.kind === 'ADJUSTMENT')).toMatchObject({ kind: 'ADJUSTMENT', amountMinor: -100_000, status: 'ACCRUED' });
    expect(JSON.stringify(mine.body)).not.toMatch(/adjustsLineId|flagReason|owner decides|refunded in the gateway/);
    const csv = await env.api('get', `/v3/admin/commission/ledger/export.csv?partnerId=${partner.partnerId}`, admin); expect(csv.status).toBe(200);
    expect(csv.text.split('\n')[0]).toContain('month,kind,'); expect(csv.text).toContain('ADJUSTMENT'); expect(csv.text).toContain('-1000.00');
    const payouts = await env.api('get', '/v3/partner/payouts', partner.token); expect(payouts.body.data.items[0]).toMatchObject({ grossMinor: 100_000, tdsMinor: 0, netMinor: 100_000 });
  });

  it('the database holds the rules: one line per vendor and kind, a positive adjustment and an unknown kind are refused', async () => {
    const dup = prisma.commissionLedger.create({ data: { partnerId: partner.partnerId, vendorId: A.vendorId, month: thisMonth, orderId: 'dup', qualifiedAt: new Date(), kind: 'ADJUSTMENT', status: 'ACCRUED', amountMinor: -5, adjustsLineId: 'x' } });
    await expect(dup).rejects.toThrow();   // a vendor already has its adjustment
    await expect(prisma.commissionLedger.create({ data: { partnerId: partner.partnerId, vendorId: B.vendorId, month: thisMonth, orderId: 'pos', qualifiedAt: new Date(), kind: 'ADJUSTMENT', status: 'ACCRUED', amountMinor: 5, adjustsLineId: 'x' } })).rejects.toThrow();
    await expect(prisma.commissionLedger.create({ data: { partnerId: partner.partnerId, vendorId: B.vendorId, month: thisMonth, orderId: 'kind', qualifiedAt: new Date(), kind: 'BONUS', status: 'ACCRUED' } })).rejects.toThrow();
    await expect(prisma.commissionLedger.create({ data: { partnerId: partner.partnerId, vendorId: B.vendorId, month: thisMonth, orderId: 'neg', qualifiedAt: new Date(), kind: 'COMMISSION', status: 'ACCRUED', amountMinor: -5 } })).rejects.toThrow();
  });

  it('closing the SAME month again carries the adjustment (the partner already has a payout that month) and changes nothing else', async () => {
    const before = JSON.stringify((await ledger()).map((l) => [l.id, l.status, l.month, l.amountMinor]).sort());
    const again = await env.api('post', `/v3/admin/commission/months/${thisMonth}/close`, admin); expect(again.status).toBe(200); expect(again.body.data.approved).toBe(0);
    expect(JSON.stringify((await ledger()).map((l) => [l.id, l.status, l.month, l.amountMinor]).sort())).toBe(before);
  });

  it('the NEXT month: with too little commission the adjustment is carried forward; with enough it is netted, moves to that month, and the payout is commission minus the adjustment; a repeat close is safe', async () => {
    // one vendor in the next month: 100000 against an adjustment of -100000 leaves nothing above zero, so it is carried
    await prisma.commissionLedger.create({ data: { partnerId: partner.partnerId, vendorId: B.vendorId, month: nextMonth, orderId: `w4c-${RUN_ID}-b`, qualifiedAt: new Date(), kind: 'COMMISSION', status: 'ACCRUED' } });
    const thin = await env.api('post', `/v3/admin/commission/months/${nextMonth}/close`, admin); expect(thin.status).toBe(200); expect(thin.body.data.approved).toBe(1);
    expect(thin.body.data.partners[0]).toMatchObject({ adjustmentMinor: 0, carriedMinor: -100_000 });
    expect((await ledger()).find((l) => l.kind === 'ADJUSTMENT')).toMatchObject({ status: 'ACCRUED' });
    // a second vendor that month: 2 vendors x 100000 = 200000, so the adjustment now fits
    await prisma.commissionLedger.create({ data: { partnerId: partner.partnerId, vendorId: C.vendorId, month: nextMonth, orderId: `w4c-${RUN_ID}-c`, qualifiedAt: new Date(), kind: 'COMMISSION', status: 'ACCRUED' } });
    const fat = await env.api('post', `/v3/admin/commission/months/${nextMonth}/close`, admin); expect(fat.status).toBe(200);
    expect(fat.body.data.partners[0]).toMatchObject({ adjustmentMinor: -100_000, carriedMinor: 0 });
    expect((await ledger()).find((l) => l.kind === 'ADJUSTMENT')).toMatchObject({ status: 'APPROVED', month: nextMonth, amountMinor: -100_000 });
    const pre = await env.api('get', `/v3/admin/commission/payouts/preview?partnerId=${partner.partnerId}&month=${nextMonth}`, admin);
    expect(pre.body.data).toMatchObject({ grossMinor: 100_000, tdsMinor: 0, netMinor: 100_000 });   // 200000 commission minus the 100000 adjustment
    const repeat = await env.api('post', `/v3/admin/commission/months/${nextMonth}/close`, admin); expect(repeat.body.data.approved).toBe(0);
    const pay = await env.api('post', '/v3/admin/commission/payouts', sup, { partnerId: partner.partnerId, month: nextMonth, reference: `UTR-${RUN_ID}-2` });
    expect(pay.status).toBe(200); expect(pay.body.data).toMatchObject({ grossMinor: 100_000, netMinor: 100_000 });
  });

  it('TDS on a payout: a changed amount needs a reason, net is gross minus TDS, the partner sees gross, TDS and net (the reason stays internal), and only SUPER_ADMIN sets the percent', async () => {
    const D = await seedTenant(prisma, 'w4cd', RUN_ID); const p2 = await seedPartnerLogin(prisma, 'w4cq', RUN_ID);
    await prisma.commissionLedger.create({ data: { partnerId: p2.partnerId, vendorId: D.vendorId, month: thisMonth, orderId: `w4c-${RUN_ID}-d`, qualifiedAt: new Date(), kind: 'COMMISSION', status: 'APPROVED', amountMinor: 200_000, approvedAt: new Date() } });
    const preUrl = `/v3/admin/commission/payouts/preview?partnerId=${p2.partnerId}&month=${thisMonth}`;
    expect((await env.api('get', preUrl, admin)).body.data).toMatchObject({ grossMinor: 200_000, tdsPercentBp: null, tdsMinor: 0, netMinor: 200_000 });   // no percent set: no TDS
    expect((await env.api('put', '/v3/admin/plan-settings/tdsPercent', admin, { valueJson: 10 })).status).toBe(403);
    try {
      expect((await env.api('put', '/v3/admin/plan-settings/tdsPercent', sup, { valueJson: 10 })).status).toBe(200);
      expect((await env.api('put', '/v3/admin/plan-settings/tdsPercent', sup, { valueJson: 101 })).status).toBe(400);
      // the percent is read with a short cache: wait until the preview pre-fills it
      const pre = await until('the pre-filled TDS', async () => { const r = await env.api('get', preUrl, admin); return r.body.data?.tdsMinor === 20_000 ? r.body.data : null; }, 20_000);
      expect(pre).toMatchObject({ grossMinor: 200_000, tdsPercentBp: 1000, tdsMinor: 20_000, netMinor: 180_000 });
      const noReason = await env.api('post', '/v3/admin/commission/payouts', admin, { partnerId: p2.partnerId, month: thisMonth, reference: `UTR-${RUN_ID}-3`, tdsMinor: 15_000 });
      expect([noReason.status, noReason.body.code]).toEqual([400, 'COMMISSION_PAYOUT_INVALID']);
      const ok = await env.api('post', '/v3/admin/commission/payouts', admin, { partnerId: p2.partnerId, month: thisMonth, reference: `UTR-${RUN_ID}-3`, tdsMinor: 15_000, tdsReason: 'CA certificate for a lower rate' });
      expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ grossMinor: 200_000, tdsMinor: 15_000, netMinor: 185_000, tdsPercentBp: 1000, tdsEdited: true });
      const mine = await env.api('get', '/v3/partner/payouts', p2.token); expect(mine.body.data.items[0]).toMatchObject({ grossMinor: 200_000, tdsMinor: 15_000, netMinor: 185_000 });
      expect(JSON.stringify(mine.body)).not.toMatch(/CA certificate|tdsReason|tdsPercent/);
      const csv = await env.api('get', `/v3/admin/commission/payouts/export.csv?partnerId=${p2.partnerId}`, admin); expect(csv.status).toBe(200);
      expect(csv.text.split(String.fromCharCode(10))[0]).toBe('month,partner,partnerId,pan,reference,grossRupees,tdsPercent,tdsRupees,netRupees,tdsChanged,tdsReason,paidAt');
      expect(csv.text).toContain('2000.00'); expect(csv.text).toContain('150.00'); expect(csv.text).toContain('1850.00'); expect(csv.text).toContain('CA certificate for a lower rate');
      expect((await env.api('get', `/v3/admin/commission/payouts/export.csv?partnerId=${p2.partnerId}`, ops)).status).toBe(403);   // the CSV carries the PAN: ADMIN and SUPER_ADMIN only
    } finally { await prisma.v3PlanSetting.deleteMany({ where: { key: 'tdsPercent' } }); }
  });
});
