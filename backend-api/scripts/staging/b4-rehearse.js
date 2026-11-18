#!/usr/bin/env node
'use strict';
/**
 * B4 staging rehearsal helper (STAGING ONLY, guarded): makes the live situation on staging through the audited service: the nine OLD amounts approved with a start in the future, plus two rows that
 * must be left alone (an old amount of another plan/term, and an unrelated amount, both future dated). Then run:
 *   node scripts/live/withdraw-future-prices.js --staging            (dry run)
 *   node scripts/live/withdraw-future-prices.js --staging --apply    (writes)
 *   node scripts/live/withdraw-future-prices.js --staging --apply    (second run: nothing to do)
 *   node scripts/staging/b4-rehearse.js verify                       (checks the result)
 */
const path = require('path');
const { loadStagingEnv } = require('./guard');
const BACKEND = path.resolve(__dirname, '..', '..');
const { OLD_RUPEES, REASON } = require(path.join(BACKEND, 'scripts/live/withdraw-future-prices-lib.js'));

(async () => {
  const mode = process.argv[2];
  const conn = loadStagingEnv();
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  try {
    const plans = await prisma.v3Plan.findMany({ where: { key: { in: Object.keys(OLD_RUPEES) } }, select: { id: true, key: true } });
    const idOf = (k) => plans.find((p) => p.key === k).id;
    if (mode === 'make') {
      const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
      const { PlansAdminService } = dist('plans/admin/plans-admin.service');
      const { AuditService } = dist('plans/admin/audit.service');
      const svc = new PlansAdminService(prisma, new AuditService(prisma), { invalidateAll() {} });
      const actor = { type: 'SYSTEM', id: null, ip: null };
      const future = (d) => new Date(Date.now() + d * 86_400_000 + Math.floor(Math.random() * 60_000)).toISOString();
      const mk = async (key, term, rupees, days) => { const r = await svc.createPrice(idOf(key), { termMonths: term, amountPaise: rupees * 100, taxInclusive: false, status: 'PROPOSED' }, actor); await svc.approvePrice(r.id, { effectiveFrom: future(days) }, actor); return r.id; };
      for (const [key, amounts] of Object.entries(OLD_RUPEES)) for (const [i, term] of [3, 6, 12].entries()) await mk(key, term, amounts[i], 4);
      await mk('handyman_pro', 3, 2997, 5);   // another plan's old amount: must stay
      await mk('professional_pro', 12, 12345, 5);   // unrelated amount: must stay
      console.log('made: nine old-amount future rows and two that must be left alone');
    } else if (mode === 'verify') {
      const rows = await prisma.v3PlanPrice.findMany({ where: { planId: { in: plans.map((p) => p.id) } } });
      const key = (p) => plans.find((x) => x.id === p.planId).key;
      const old = rows.filter((r) => r.termMonths && OLD_RUPEES[key(r)] && r.amountPaise === OLD_RUPEES[key(r)][[3, 6, 12].indexOf(r.termMonths)] * 100 && r.effectiveFrom.getTime() > Date.now() - 86_400_000 * 0 && r.createdAt.getTime() > Date.now() - 3_600_000);
      const withdrawn = old.filter((r) => r.status === 'WITHDRAWN');
      const stay = rows.filter((r) => r.status === 'APPROVED' && r.effectiveFrom.getTime() > Date.now() && ((key(r) === 'handyman_pro' && r.termMonths === 3 && r.amountPaise === 299700) || (key(r) === 'professional_pro' && r.termMonths === 12 && r.amountPaise === 1234500)));
      const logs = await prisma.v3AuditLog.count({ where: { action: 'price.withdraw', at: { gt: new Date(Date.now() - 3_600_000) }, afterJson: { path: ['reason'], equals: REASON } } });
      let bad = 0; const check = (n, ok) => { if (!ok) bad += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`); };
      check(`the nine old-amount future rows are WITHDRAWN (${withdrawn.length})`, withdrawn.length === 9);
      check(`the two rows that must stay are still APPROVED and future (${stay.length})`, stay.length === 2);
      check(`at least nine audit rows with the reason (${logs}; earlier rehearsal rows count too)`, logs >= 9);
      const inForce = rows.filter((r) => r.status === 'APPROVED' && r.effectiveFrom.getTime() <= Date.now());
      check('no price in force was touched (none withdrawn that had started)', rows.filter((r) => r.status === 'WITHDRAWN').every((r) => r.effectiveFrom.getTime() > r.createdAt.getTime()) && inForce.length > 0);
      console.log(bad === 0 ? 'REHEARSAL OK' : `${bad} CHECK(S) FAILED`); if (bad) process.exitCode = 1;
    } else if (mode === 'cleanup') {
      const n = await prisma.v3PlanPrice.deleteMany({ where: { status: { in: ['APPROVED', 'WITHDRAWN'] }, effectiveFrom: { gt: new Date() }, planId: { in: plans.map((p) => p.id) } } });
      console.log(`cleanup: ${n.count} future-dated rehearsal rows deleted on staging`);
    } else console.log('usage: b4-rehearse.js make | verify | cleanup');
  } catch (e) { console.error('ERROR:', conn.mask(String(e && e.message)).split('\n').slice(-2).join(' | ')); process.exitCode = 1; } finally { await prisma.$disconnect(); }
})();
