#!/usr/bin/env node
'use strict';
/**
 * B4: withdraws the WRONGLY approved plan prices that have not started yet (start date in the future) on the LIVE database, or on STAGING with --staging.
 * Only a row that is APPROVED, INR, not started, for handyman_pro, professional_pro or ecommerce_pro, 3, 6 or 12 months, with EXACTLY one of the nine old amounts (rupees before GST:
 * handyman 1497, 2695, 4790; professional 2997, 5395, 9590; ecommerce 4497, 8095, 14390). It never touches a price in force, a PROPOSED row or any other amount. Safe to run twice.
 * It goes through PlansAdminService.withdrawPrice, the same audited service as POST /v3/admin/prices/:id/withdraw (actor SYSTEM, the reason below), never SQL. History is not edited.
 *
 *   node scripts/live/withdraw-future-prices.js --staging            DRY RUN on staging (the default: nothing is written)
 *   node scripts/live/withdraw-future-prices.js --staging --apply    writes on staging
 *   node scripts/live/withdraw-future-prices.js                      DRY RUN on live (export .env.live first)
 *   node scripts/live/withdraw-future-prices.js --apply              writes on live; asks you to type LIVE first, in a terminal
 *
 * Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');
const readline = require('readline');
const { liveSeedEnv, applyConfirmed } = require('./live-env-lib');
const { REASON, planWithdrawals, summarise } = require('./withdraw-future-prices-lib');

const BACKEND = path.resolve(__dirname, '..', '..');
const ask = (q) => new Promise((resolve) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); resolve(a); }); });
const fail = (msg, code) => { console.error(`WITHDRAW REFUSED: ${msg}`); process.exitCode = code; };
const rupees = (paise) => `Rs ${(paise / 100).toFixed(2)}`;
const ist = (d) => `${new Date(d.getTime() + 330 * 60_000).toISOString().replace('T', ' ').slice(0, 16)} IST`;

(async () => {
  const flags = process.argv.slice(2);
  if (flags.some((f) => !['--apply', '--staging'].includes(f))) return fail('the only flags are --apply and --staging.', 2);
  const apply = flags.includes('--apply');
  const staging = flags.includes('--staging');
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));

  let conn;
  if (staging) conn = require(path.join(__dirname, '..', 'staging', 'guard')).loadStagingEnv();
  else {
    const live = liveSeedEnv(process.env, dist('common/startup-check').checkDatabaseUrls);
    if (!live.ok) return fail(live.problems.join('; ') + '.', 3);
    conn = live;
  }
  if (apply && !staging) {
    if (!process.stdin.isTTY) return fail('--apply on live needs a terminal, so a person types the confirmation.', 2);
    if (!applyConfirmed(await ask('This WRITES to the LIVE database. Type LIVE to continue: '))) return fail('not confirmed; nothing was written.', 2);
  }

  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  try {
    const { PlansAdminService } = dist('plans/admin/plans-admin.service');
    const { AuditService } = dist('plans/admin/audit.service');
    const { EntitlementsService } = dist('plans/entitlements/entitlements.service');
    const { PrismaPlansRepository } = dist('plans/entitlements/plans.repository');
    const service = new PlansAdminService(prisma, new AuditService(prisma), new EntitlementsService(new PrismaPlansRepository(prisma)));
    const actor = { type: 'SYSTEM', id: null, ip: null };
    const where = staging ? 'staging' : 'LIVE';
    const load = async () => {
      const plans = await prisma.v3Plan.findMany({ where: { key: { in: ['handyman_pro', 'professional_pro', 'ecommerce_pro'] } }, select: { id: true, key: true } });
      const prices = await prisma.v3PlanPrice.findMany({ where: { planId: { in: plans.map((p) => p.id) } }, select: { id: true, planId: true, termMonths: true, amountPaise: true, currency: true, status: true, effectiveFrom: true } });
      return { plans, prices };
    };

    let { plans, prices } = await load();
    const plan = planWithdrawals(plans, prices, new Date());
    console.log(`${apply ? 'APPLYING to' : 'DRY RUN on'} ${where} (reason: "${REASON}"):`);
    for (const m of plan.missingPlans) console.log(`  MISSING PLAN ${m}: nothing to do for it`);
    if (plan.withdraw.length === 0) console.log('  nothing to withdraw: no approved, not-started row with one of the nine old amounts');
    for (const r of plan.withdraw) console.log(`  ${apply ? 'withdrawing' : 'would withdraw'}: ${r.planKey} ${r.termMonths} months ${rupees(r.amountPaise)} starts ${ist(r.effectiveFrom)} (id ${r.priceId})`);
    console.log(`  rows left alone: ${plan.leftAlone}`);

    let done = 0;
    if (apply) {
      for (const r of plan.withdraw) {
        // re-checked against the row's current state, so a row that started or changed in the meantime is not withdrawn
        const row = await prisma.v3PlanPrice.findUnique({ where: { id: r.priceId }, select: { status: true, effectiveFrom: true, amountPaise: true } });
        if (row && row.status === 'APPROVED' && row.effectiveFrom.getTime() > Date.now() && row.amountPaise === r.amountPaise) { await service.withdrawPrice(r.priceId, REASON, actor); done += 1; }
        else console.log(`  skipped (changed meanwhile): ${r.priceId}`);
      }
      ({ plans, prices } = await load());
    }
    console.log(`\nAfter${apply ? '' : ' (nothing written; this is the state now)'}: in force and proposed, per plan and term, before GST`);
    for (const s of summarise(plans, prices, new Date())) console.log(`  ${s.planKey.padEnd(17)} ${String(s.termMonths).padStart(2)} months  in force: ${s.inForce === null ? 'NOTHING (PRICE_PENDING)' : rupees(s.inForce)}   proposed: ${s.proposed.length ? s.proposed.map(rupees).join(', ') : 'none'}`);
    console.log(`  rows withdrawn by this run: ${done}; rows approved: 0 (this script never approves)`);
  } catch (e) {
    console.error('ERROR:', conn.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
