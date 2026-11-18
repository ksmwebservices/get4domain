#!/usr/bin/env node
'use strict';
/**
 * B2.3: PROPOSES the nine owner plan prices (Handyman, Professional, Ecommerce Pro: quarterly, half-yearly, annual; before GST) on the LIVE database, or on STAGING with --staging.
 * It goes through PlansAdminService (the same service the admin Prices screen calls), so each write has its audit row (actor SYSTEM, source below). It NEVER approves a price:
 * a super admin approves each one in the admin Prices screen. It supersedes older PROPOSED rows of the same plan and term (deleted through the audited service) and never touches an APPROVED row.
 *
 *   node scripts/live/propose-v3-prices.js --staging            DRY RUN on staging (the default: nothing is written)
 *   node scripts/live/propose-v3-prices.js --staging --apply    writes on staging
 *   node scripts/live/propose-v3-prices.js                      DRY RUN on live (export .env.live first)
 *   node scripts/live/propose-v3-prices.js --apply              writes on live; asks you to type LIVE first, in a terminal
 *
 * Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');
const readline = require('readline');
const { liveSeedEnv, applyConfirmed } = require('./live-env-lib');
const { SOURCE, planWrites } = require('./propose-v3-prices-lib');

const BACKEND = path.resolve(__dirname, '..', '..');
const ask = (q) => new Promise((resolve) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); resolve(a); }); });
const fail = (msg, code) => { console.error(`PROPOSE REFUSED: ${msg}`); process.exitCode = code; };
const rupees = (paise) => `Rs ${(paise / 100).toFixed(2)}`;

(async () => {
  const flags = process.argv.slice(2);
  if (flags.some((f) => !['--apply', '--staging'].includes(f))) return fail('the only flags are --apply and --staging.', 2);
  const apply = flags.includes('--apply');
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));

  let conn;
  if (flags.includes('--staging')) {
    conn = require(path.join(__dirname, '..', 'staging', 'guard')).loadStagingEnv();
  } else {
    const live = liveSeedEnv(process.env, dist('common/startup-check').checkDatabaseUrls);
    if (!live.ok) return fail(live.problems.join('; ') + '.', 3);
    conn = live;
  }
  if (apply && !flags.includes('--staging')) {
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

    const plans = await prisma.v3Plan.findMany({ where: { key: { in: ['handyman_pro', 'professional_pro', 'ecommerce_pro'] } }, select: { id: true, key: true } });
    const prices = await prisma.v3PlanPrice.findMany({ where: { planId: { in: plans.map((p) => p.id) } }, select: { id: true, planId: true, termMonths: true, amountPaise: true, status: true } });
    const plan = planWrites(plans, prices);

    console.log(apply ? `APPLYING to ${flags.includes('--staging') ? 'staging' : 'LIVE'} (source ${SOURCE}, before GST, PROPOSED only):` : `DRY RUN on ${flags.includes('--staging') ? 'staging' : 'live'} (nothing written). Add --apply to write.`);
    for (const r of plan.missingPlans) console.log(`  MISSING PLAN ${r}: nothing proposed for it (run the plans loader first)`);
    for (const r of plan.approvedKept) console.log(`  approved price kept, untouched: ${r.planKey} ${r.termMonths}m ${rupees(r.amountPaise)}`);
    for (const r of plan.unchanged) console.log(`  already proposed, same amount: ${r.planKey} ${r.termMonths}m ${rupees(r.amountPaise)}`);
    for (const r of plan.supersede) console.log(`  ${apply ? 'superseded' : 'would supersede'} older proposal: ${r.planKey} ${r.termMonths}m ${rupees(r.amountPaise)}`);
    for (const r of plan.create) console.log(`  ${apply ? 'proposed' : 'would propose'}: ${r.planKey} ${r.termMonths}m ${rupees(r.amountPaise)}`);

    if (apply) {
      // an approved row is never in `supersede`; the service call below is re-checked against the row's status so a race cannot delete one
      for (const r of plan.supersede) {
        const row = await prisma.v3PlanPrice.findUnique({ where: { id: r.priceId }, select: { status: true } });
        if (row && row.status === 'PROPOSED') await service.deletePrice(r.priceId, actor);
      }
      for (const r of plan.create) await service.createPrice(r.planId, { termMonths: r.termMonths, amountPaise: r.amountPaise, taxInclusive: false, status: 'PROPOSED' }, actor);
    }
    console.log('  rows written with status APPROVED: 0 (this script never approves; a super admin approves each in the admin Prices screen)');
  } catch (e) {
    console.error('ERROR:', conn.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
