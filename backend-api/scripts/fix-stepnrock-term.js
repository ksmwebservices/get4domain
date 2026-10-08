#!/usr/bin/env node
'use strict';
/**
 * Stepnrock term correction (handover dispatch 08-Oct-2026, Task 9) — KSM runs this on the VM.
 *
 *   node scripts/fix-stepnrock-term.js                 # DRY RUN (default): read-only, writes NOTHING
 *   STEPNROCK_TERM_FIX_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/fix-stepnrock-term.js --apply
 *
 * What it does (and ONLY this): for the vendor with subdomain "stepnrock" it sets the CURRENT billing term to
 *   paymentDueAt = now + 7 days, graceDays = 7
 * and the open activation invoice's due date to the same moment. It reports every activation invoice (duplicates / void ones),
 * confirms exactly one open activation invoice remains, and writes an audit entry on the term and on the vendor.
 * It never touches amounts, plan, period, credits, wallets or any other vendor. Messages are NOT sent.
 * Re-running is safe: a corrected term is reported as "already fixed" (use --force to move the date again).
 *
 * Run `set -a; . ./.env; set +a` first (or the script reads DATABASE_URL from backend-api/.env). Needs `npx nest build`.
 */
const path = require('path');
const fs = require('fs');
const { planTermFix, verifyAfter, TARGET } = require('./fix-stepnrock-term-lib');
const dist = (p) => require(path.join(__dirname, '..', 'dist', 'src', p));

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const FORCE = argv.includes('--force');
const CONFIRM = 'I_HAVE_READ_THE_DRY_RUN';
const line = (s = '') => console.log(s);
const head = (s) => { line(); line(`── ${s} ${'─'.repeat(Math.max(0, 70 - s.length))}`); };
const rupees = (p) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—');

if (!process.env.DATABASE_URL) {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(__dirname, '..', name);
    if (!fs.existsSync(file)) continue;
    for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

async function readState(prisma, vendorId) {
  const [terms, invoices, audits] = await Promise.all([
    prisma.billingTerm.findMany({ where: { vendorId }, orderBy: { createdAt: 'asc' } }),
    prisma.invoice.findMany({ where: { vendorId }, orderBy: { createdAt: 'asc' } }),
    prisma.commercialAuditLog.findMany({ where: { action: 'term.fix_stepnrock_dates', entityType: 'BillingTerm' }, select: { entityId: true } }),
  ]);
  const submissionsByInvoice = {};
  for (const inv of invoices.filter((i) => i.kind === 'ACTIVATION')) {
    submissionsByInvoice[inv.id] = await prisma.manualPaymentSubmission.count({ where: { invoiceId: inv.id } });
  }
  return { terms, invoices, submissionsByInvoice, alreadyFixedTermIds: audits.map((a) => a.entityId) };
}

(async () => {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (export it from backend-api/.env first).'); process.exit(2); }
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host; } catch { return 'unknown'; } })();
  line(`Stepnrock term correction — ${APPLY ? 'APPLY' : 'DRY RUN (read-only)'} — database host: ${host}`);
  const { PrismaService } = dist('prisma/prisma.service');
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    head('Vendor');
    const vendor = await prisma.vendor.findUnique({ where: { subdomain: 'stepnrock' }, select: { id: true, businessName: true, email: true, status: true, isSandbox: true } });
    if (!vendor) { console.error('No vendor with subdomain "stepnrock" found. Aborting.'); process.exitCode = 1; return; }
    line(`${vendor.businessName} · ${vendor.status} · ${vendor.isSandbox ? 'SANDBOX' : 'live'} · id ${vendor.id}`);

    const now = new Date();
    const state = await readState(prisma, vendor.id);
    const plan = planTermFix({ now, ...state, force: FORCE });

    head('Activation invoices');
    for (const x of plan.report.activationInvoices) line(`${x.number}  ${x.status.padEnd(8)}  ${rupees(x.totalAmount)}  due ${when(x.dueDate)}`);
    if (!plan.report.activationInvoices.length) line('none');
    line(plan.report.duplicates ? `⚠ ${plan.report.activationInvoices.length} activation invoices exist — duplicate/void: ${plan.report.voided.join(', ') || 'none void'}; open: ${plan.report.open.join(', ') || 'none'}; paid: ${plan.report.paid.join(', ') || 'none'}` : 'one activation invoice (no duplicates)');

    head('Billing terms');
    for (const t of plan.report.terms) line(`${t.current ? 'CURRENT ' : 'old     '} ${t.id}  ${t.status.padEnd(18)} grace ${t.graceDays}d  payment due ${when(t.paymentDueAt)}  invoice ${t.activationInvoiceId}`);
    if (plan.report.orphanTerms.length) line(`ℹ ${plan.report.orphanTerms.length} superseded term(s) belong to a VOID invoice (${plan.report.orphanTerms.join(', ')}); they are not current and are left untouched.`);

    head('Plan');
    line(`result: ${plan.level} — ${plan.reasons.join(' | ')}`);
    for (const a of plan.actions) {
      if (a.type === 'SET_TERM') line(`• term ${a.termId}: paymentDueAt ${when(a.before.paymentDueAt)} → ${when(a.paymentDueAt)};  graceDays ${a.before.graceDays} → ${a.graceDays}`);
      if (a.type === 'SET_INVOICE_DUE') line(`• invoice ${a.invoiceNumber}: dueDate ${when(a.before.dueDate)} → ${when(a.dueDate)}`);
    }
    line(`after applying, exactly ONE open activation invoice must remain — currently open: ${plan.report.open.join(', ') || 'none'}`);

    if (!APPLY) {
      head('DRY RUN COMPLETE');
      line('Nothing was written.');
      if (plan.level === 'FIX') line(`To apply:  STEPNROCK_TERM_FIX_CONFIRM=${CONFIRM} node scripts/fix-stepnrock-term.js --apply`);
      return;
    }

    // ── APPLY ─────────────────────────────────────────────────────────────────────
    if (process.env.STEPNROCK_TERM_FIX_CONFIRM !== CONFIRM) { console.error(`\nABORT: set STEPNROCK_TERM_FIX_CONFIRM=${CONFIRM} to confirm.`); process.exitCode = 2; return; }
    if (plan.level === 'REFUSE') { console.error(`\nABORT: ${plan.reasons.join(' | ')}`); process.exitCode = 1; return; }
    if (plan.level === 'NOTHING') { head('NOTHING TO DO'); line(plan.reasons.join(' | ')); return; }

    head('APPLY');
    await prisma.$transaction(async (tx) => {
      for (const a of plan.actions) {
        if (a.type === 'SET_TERM') {
          await tx.billingTerm.update({ where: { id: a.termId }, data: { paymentDueAt: a.paymentDueAt, graceDays: a.graceDays } });
          const detail = { before: a.before, after: { paymentDueAt: a.paymentDueAt.toISOString(), graceDays: a.graceDays }, reason: 'stepnrock agreed terms: payment due in 7 days, grace 7 days' };
          const entry = { actor: 'script:fix-stepnrock-term', actorRole: 'system', detail };
          await tx.commercialAuditLog.create({ data: { ...entry, action: 'term.fix_stepnrock_dates', entityType: 'BillingTerm', entityId: a.termId } });
          await tx.commercialAuditLog.create({ data: { ...entry, action: 'term.fix_stepnrock_dates', entityType: 'Vendor', entityId: vendor.id } });
          line(`updated term ${a.termId}`);
        }
        if (a.type === 'SET_INVOICE_DUE') {
          await tx.invoice.update({ where: { id: a.invoiceId }, data: { dueDate: a.dueDate } });
          await tx.commercialAuditLog.create({ data: { actor: 'script:fix-stepnrock-term', actorRole: 'system', action: 'invoice.fix_due_date', entityType: 'Invoice', entityId: a.invoiceId, detail: { before: a.before, after: { dueDate: a.dueDate.toISOString() } } } });
          line(`updated invoice ${a.invoiceNumber} due date`);
        }
      }
    });

    head('Result (read back from the database)');
    const after = await readState(prisma, vendor.id);
    const v = verifyAfter({ terms: after.terms, invoices: after.invoices, now: new Date() });
    for (const [name, pass] of v.checks) line(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
    line(v.ok ? '\nDONE — Admin → Customers → stepnrock → Billing now shows the corrected dates, and the Audit trail lists this change.' : '\nCHECK FAILED — do not share the pay link until this is resolved.');
    if (!v.ok) process.exitCode = 1;
    line(`(target: payment due in ${TARGET.dueDays} days, grace ${TARGET.graceDays} days)`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
