#!/usr/bin/env node
'use strict';
/**
 * B3.0 staging rehearsal of the live price correction, through the real audited service (STAGING ONLY, the guard refuses anything else):
 *   1. a wrongly approved FUTURE-dated price is made, shown not to be in force, withdrawn with a reason, and checked (row kept, audit row written);
 *   2. with --approve-nine the nine owner proposals (see scripts/live/propose-v3-prices-lib.js) are approved from now and checked to be the prices in force.
 *
 *   node scripts/staging/b3-price-check.js                 step 1
 *   node scripts/staging/b3-price-check.js --approve-nine  steps 1 and 2
 */
const path = require('path');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
const { loadStagingEnv } = require('./guard');
const BACKEND = path.resolve(__dirname, '..', '..');
const { wantedRows } = require(path.join(BACKEND, 'scripts/live/propose-v3-prices-lib.js'));

(async () => {
  const conn = loadStagingEnv();
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  let failed = 0; const check = (n, ok, x = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? `  (${x})` : ''}`); };
  const inForce = async (planId, term) => (await prisma.v3PlanPrice.findMany({ where: { planId, termMonths: term, status: 'APPROVED', currency: 'INR', effectiveFrom: { lte: new Date() } }, orderBy: { effectiveFrom: 'desc' }, take: 1 }))[0] ?? null;
  try {
    const { PlansAdminService } = require(path.join(BACKEND, 'src/plans/admin/plans-admin.service'));
    const { AuditService } = require(path.join(BACKEND, 'src/plans/admin/audit.service'));
    const svc = new PlansAdminService(prisma, new AuditService(prisma), { invalidateAll() {} });
    const actor = { type: 'SYSTEM', id: null, ip: null };
    const plan = await prisma.v3Plan.findUnique({ where: { key: 'handyman_pro' } });
    const before = await inForce(plan.id, 3);

    // 1. a wrong future-dated approval
    const wrong = await svc.createPrice(plan.id, { termMonths: 3, amountPaise: 99_900, taxInclusive: false, status: 'PROPOSED' }, actor);
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    await svc.approvePrice(wrong.id, { effectiveFrom: future }, actor);
    const same = await inForce(plan.id, 3);
    check('an approved price that starts in five days is NOT in force (the older price still is)', same && before && same.id === before.id);
    const w = await svc.withdrawPrice(wrong.id, 'staging rehearsal: wrong start date', actor);
    check('withdraw answers WITHDRAWN, not in force, and says what stays in force', w.status === 'WITHDRAWN' && w.wasInForce === false && w.inForceAfter && before && w.inForceAfter.id === before.id);
    const row = await prisma.v3PlanPrice.findUnique({ where: { id: wrong.id } });
    check('the withdrawn row keeps its amount and start date', row.status === 'WITHDRAWN' && row.amountPaise === 99_900 && row.effectiveFrom.toISOString() === future);
    const log = await prisma.v3AuditLog.findFirst({ where: { action: 'price.withdraw', entityId: wrong.id } });
    check('one audit row with the reason', !!log && JSON.stringify(log.afterJson).includes('staging rehearsal'));
    await svc.withdrawPrice(wrong.id, 'a second try changes nothing', actor);
    check('withdrawing again adds no audit row', (await prisma.v3AuditLog.count({ where: { action: 'price.withdraw', entityId: wrong.id } })) === 1);

    // 2. the nine
    if (process.argv.includes('--approve-nine')) {
      const plans = await prisma.v3Plan.findMany({ where: { key: { in: ['handyman_pro', 'professional_pro', 'ecommerce_pro'] } }, select: { id: true, key: true } });
      const today = new Date().toISOString().slice(0, 10);
      for (const w9 of wantedRows()) {
        const p = plans.find((x) => x.key === w9.planKey);
        const prop = await prisma.v3PlanPrice.findFirst({ where: { planId: p.id, termMonths: w9.termMonths, status: 'PROPOSED', amountPaise: w9.amountPaise } });
        if (prop) await svc.approvePrice(prop.id, { effectiveFrom: today }, actor);
        const now = await inForce(p.id, w9.termMonths);
        check(`${w9.planKey} ${w9.termMonths} months is in force at Rs ${w9.amountPaise / 100}`, !!now && now.amountPaise === w9.amountPaise);
      }
    }
    console.log(failed === 0 ? 'ALL PRICE CHECKS PASSED' : `${failed} CHECK(S) FAILED`); if (failed) process.exitCode = 1;
  } catch (e) { console.error('ERROR:', conn.mask(String(e && e.message)).split('\n').slice(-3).join(' | ')); process.exitCode = 1; } finally { await prisma.$disconnect(); }
})();
