#!/usr/bin/env node
'use strict';
/**
 * B3.0: READ-ONLY report of the paid plan prices: for each plan and term every price row (status, amount, start, currency, GST flag), which one is IN FORCE right now, and, where the
 * public pricing says PRICE_PENDING, the reason. It writes nothing. Run it before and after correcting prices.
 *
 *   node scripts/live/price-book-report.js --staging     staging
 *   node scripts/live/price-book-report.js               live (export .env.live first)
 *
 * Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');
const { liveSeedEnv } = require('./live-env-lib');

const BACKEND = path.resolve(__dirname, '..', '..');
const rupees = (paise) => `Rs ${(paise / 100).toFixed(2)}`;
const ist = (d) => new Date(d.getTime() + 330 * 60_000).toISOString().replace('T', ' ').slice(0, 16) + ' IST';

(async () => {
  const flags = process.argv.slice(2);
  if (flags.some((f) => f !== '--staging')) { console.error('REPORT REFUSED: the only flag is --staging.'); process.exitCode = 2; return; }
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  let conn;
  if (flags.includes('--staging')) conn = require(path.join(__dirname, '..', 'staging', 'guard')).loadStagingEnv();
  else { const live = liveSeedEnv(process.env, dist('common/startup-check').checkDatabaseUrls); if (!live.ok) { console.error(`REPORT REFUSED: ${live.problems.join('; ')}.`); process.exitCode = 3; return; } conn = live; }

  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  try {
    const now = new Date();
    console.log(`Price book report, ${flags.includes('--staging') ? 'staging' : 'LIVE'}, now ${ist(now)} (${now.toISOString()})`);
    const tax = await prisma.v3TaxRate.findFirst({ where: { active: true }, select: { name: true, ratePercent: true } }).catch(() => null);
    console.log(`active tax rate: ${tax ? `${tax.name} ${tax.ratePercent}%` : 'NONE (a price that already holds GST shows PRICE_PENDING without it)'}`);
    const plans = await prisma.v3Plan.findMany({ where: { level: 'PRO' }, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }], select: { id: true, key: true, status: true, isPublic: true } });
    for (const p of plans) {
      console.log(`\n${p.key}  plan status ${p.status}, public ${p.isPublic}${p.status !== 'ACTIVE' || !p.isPublic ? '   <-- the public pricing lists only ACTIVE public plans' : ''}`);
      const rows = await prisma.v3PlanPrice.findMany({ where: { planId: p.id }, orderBy: [{ termMonths: 'asc' }, { effectiveFrom: 'desc' }] });
      for (const term of [3, 6, 12]) {
        const mine = rows.filter((r) => r.termMonths === term);
        const inForce = mine.filter((r) => r.status === 'APPROVED' && r.currency === 'INR' && r.effectiveFrom.getTime() <= now.getTime())[0] ?? null;
        console.log(`  ${term} months: ${inForce ? `IN FORCE ${rupees(inForce.amountPaise)} (id ${inForce.id})` : 'NOTHING IN FORCE -> PRICE_PENDING'}`);
        if (!inForce) {
          const future = mine.filter((r) => r.status === 'APPROVED' && r.effectiveFrom.getTime() > now.getTime());
          if (future.length) console.log(`      reason: approved but starts later, ${future.map((r) => `${ist(r.effectiveFrom)}`).join(', ')}`);
          else if (mine.some((r) => r.status === 'APPROVED' && r.currency !== 'INR')) console.log('      reason: the approved row is not in INR');
          else if (mine.some((r) => r.status === 'PROPOSED')) console.log('      reason: only PROPOSED rows (they are approved in the admin Prices screen)');
          else console.log('      reason: no price row at all');
        } else if (inForce.taxInclusive && !tax) console.log('      note: the price holds GST and no tax rate exists, so the public pricing shows PRICE_PENDING');
        for (const r of mine) {
          const where = r.status === 'APPROVED' ? (r.effectiveFrom.getTime() <= now.getTime() ? (r === inForce ? 'in force' : 'started, replaced by a newer start') : 'FUTURE: not started') : r.status.toLowerCase();
          console.log(`      ${r.status.padEnd(9)} ${rupees(r.amountPaise).padStart(12)}  starts ${ist(r.effectiveFrom)}  ${r.taxInclusive ? 'GST inside' : 'before GST'}  ${r.currency}  ${where}  id ${r.id}`);
        }
      }
    }
    console.log('\n(read only: nothing was written)');
  } catch (e) {
    console.error('ERROR:', conn.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
