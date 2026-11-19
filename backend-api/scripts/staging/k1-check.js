#!/usr/bin/env node
'use strict';
/**
 * K1 staging check (STAGING ONLY). Runs GET /v3/admin/overview's service against the real staging database and proves the SQL fits the real tables.
 * Nothing permanent is created: the one write step (a fixture vendor, a paid order and its invoice, to see real numbers move) runs inside a transaction that is ROLLED BACK at the end.
 * Output is yes/no results and counts; no connection string or key value is printed (the guard refuses any database that is not on the staging allow-list).
 *
 *   node scripts/staging/k1-check.js
 */
const path = require('path');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
const { loadStagingEnv } = require('./guard');

const BACKEND = path.resolve(__dirname, '..', '..');
const src = (p) => require(path.join(BACKEND, 'src', p));
class Rollback extends Error {}

(async () => {
  const conn = loadStagingEnv();
  process.env.DATABASE_URL = conn.DATABASE_URL; process.env.DIRECT_URL = conn.DIRECT_URL;
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  const { AdminOverviewService } = src('v3-admin-overview/admin-overview.service');
  const { OVERVIEW_SECTIONS } = src('v3-admin-overview/overview-core');
  let failed = 0;
  const check = (name, ok, extra = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); };
  const settingsOf = (mode) => ({ get: async () => ({ paymentsMode: mode }) });
  const fresh = (db, mode) => new AdminOverviewService(db, settingsOf(mode));
  try {
    // 1. the real service, the real tables, payments forced "test" so the revenue SQL runs
    const t0 = Date.now();
    const all = await fresh(prisma, 'test').overview('SUPER_ADMIN');
    console.log(`INFO  overview answered in ${Date.now() - t0} ms`);
    check('SUPER_ADMIN gets every section', OVERVIEW_SECTIONS.every((s) => s in all) && all.sections.length === 6);
    check('generatedAt is a date and the cache hint is 60', !Number.isNaN(Date.parse(all.generatedAt)) && all.cacheSeconds === 60);
    for (const k of ['vendors', 'enquiries', 'paidOrders']) check(`daily series "${k}" is 30 days ending today`, Array.isArray(all.dailySeries[k]) && all.dailySeries[k].length === 30);
    // 2. numbers agree with straight counts
    const realVendors = await prisma.vendor.count({ where: { role: 'VENDOR', isSandbox: false } });
    check('vendors.total equals a direct count', all.vendors.total === realVendors, `${realVendors} vendors`);
    const planned = all.vendors.byPlan.free + all.vendors.byPlan.pro.reduce((n, p) => n + p.vendors, 0) + all.vendors.byPlan.noPlan;
    check('Free + each Pro + no plan adds up to the total (when no vendor sits on a Free plan of a track outside the list)', planned === all.vendors.total, `${planned} of ${all.vendors.total}`);
    const openTickets = await prisma.v3Ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_VENDOR'] } } });
    check('support.openTickets equals a direct count', all.support.openTickets === openTickets, `${openTickets} open`);
    check('series totals do not exceed the 30-day counts', all.dailySeries.vendors.reduce((n, d) => n + d.count, 0) <= all.vendors.total);
    // 3. role filtering on the real service
    const sales = await fresh(prisma, 'test').overview('MARKETING');
    check('SALES gets vendors, enquiries and referrals only', JSON.stringify(sales.sections) === JSON.stringify(['vendors', 'enquiries', 'referrals']) && !('revenue' in sales) && !('support' in sales));
    // 4. payments off
    const off = await fresh(prisma, 'off').overview('SUPER_ADMIN');
    check('payments off: revenue and the paid-orders series are null', off.revenue === null && off.dailySeries.paidOrders === null);
    // 5. real numbers move: a fixture inside a transaction that is rolled back
    const plan = await prisma.v3Plan.findFirst({ select: { id: true } });
    if (!plan) { console.log('INFO  no plan rows on staging: the fixture step is skipped'); } else {
      try {
        await prisma.$transaction(async (tx) => {
          const before = await fresh(tx, 'test').overview('SUPER_ADMIN');
          const tag = `zz-k1-check-${Date.now().toString(36)}`;
          const v = await tx.vendor.create({ data: { name: 'ZZ K1 Check', email: `${tag}@v3test.invalid`, password: 'not-a-real-hash', businessName: 'ZZ K1 Check', subdomain: tag, siteProvisionStatus: 'FAILED', siteProvisionCode: 'SITE_BUILD_FAILED', siteProvisionFailedAt: new Date() }, select: { id: true } });
          const now = new Date();
          const o = await tx.v3PlanOrder.create({ data: { vendorId: v.id, planId: plan.id, termMonths: 3, quoteJson: {}, amountPaise: 11800, status: 'PAID', paidAmountPaise: 11800, paidAt: now, idempotencyKey: tag, expiresAt: new Date(now.getTime() + 3600_000), refundRecordedPaise: 500, refundRecordedAt: now }, select: { id: true } });
          await tx.v3PlanInvoice.create({ data: { vendorId: v.id, orderId: o.id, invoiceNumber: `ZZ-${tag}`, financialYear: '2026-27', issuedAt: now, snapshotJson: { amountPaise: 11800 }, taxBreakdownJson: { taxMinor: 1800 } } });
          await tx.v3Ticket.create({ data: { vendorId: v.id, requesterType: 'VENDOR', subject: 'ZZ K1 check', status: 'OPEN' } });
          const after = await fresh(tx, 'test').overview('SUPER_ADMIN');
          check('new vendor moves vendors.total, new7Days and sites.failed by one', after.vendors.total === before.vendors.total + 1 && after.vendors.new7Days === before.vendors.new7Days + 1 && after.vendors.sites.failed === before.vendors.sites.failed + 1);
          check('paid order moves this month: 1 order, 1 invoice, 11800 gross, 1800 GST, 10000 before GST', after.revenue.thisMonth.paidOrders === before.revenue.thisMonth.paidOrders + 1 && after.revenue.thisMonth.invoices === before.revenue.thisMonth.invoices + 1 && after.revenue.thisMonth.grossPaise === before.revenue.thisMonth.grossPaise + 11800 && after.revenue.thisMonth.gstPaise === before.revenue.thisMonth.gstPaise + 1800 && after.revenue.thisMonth.netOfGstPaise === before.revenue.thisMonth.netOfGstPaise + 10000);
          check('recorded refund moves this month by 500', after.revenue.thisMonth.refunds.paise === before.revenue.thisMonth.refunds.paise + 500);
          check('open ticket moves support.openTickets by one', after.support.openTickets === before.support.openTickets + 1);
          const today = after.dailySeries.vendors[29].count - before.dailySeries.vendors[29].count;
          check('today in the vendors and paid-orders series moves by one', today === 1 && after.dailySeries.paidOrders[29].count === before.dailySeries.paidOrders[29].count + 1);
          throw new Rollback('rollback');
        }, { timeout: 60_000, maxWait: 20_000 });
      } catch (e) { if (!(e instanceof Rollback)) throw e; console.log('INFO  fixture rolled back (nothing was kept)'); }
      const left = await prisma.vendor.count({ where: { email: { endsWith: '@v3test.invalid' }, name: 'ZZ K1 Check' } });
      check('no fixture row remains', left === 0);
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(failed === 0 ? '\nALL K1 STAGING CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exitCode = failed === 0 ? 0 : 1;
})().catch((e) => { console.error(`staging check stopped: ${e && e.message ? String(e.message).split('\n').map((x) => x.trim()).filter(Boolean).slice(-2).join(' | ').slice(0, 260) : 'error'}`); process.exitCode = 2; });
