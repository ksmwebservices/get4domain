#!/usr/bin/env node
'use strict';
/**
 * Stepnrock commercial activation (dispatch 07-Oct-2026) — KSM runs this on the VM.
 *
 *   node scripts/activate-stepnrock.js                  # DRY RUN (default): read-only, writes NOTHING
 *   STEPNROCK_ACTIVATE_CONFIRM=I_HAVE_APPLIED_THE_COMMERCIAL_ENGINE_MIGRATION \
 *     node scripts/activate-stepnrock.js --apply        # creates the deal, invoice, term; prints the pay link
 *   (Lost the link after activation? Admin → Commerce → Invoices → Copy link. A leftover unpaid invoice with no term gets a fresh link automatically.)
 *
 * The deal (KSM's terms): WORKSPACE · HALF_YEARLY · net ₹5,994.00 (599400 paise) · GST mode NONE · grace 7 days
 * · source ADMIN_DEAL · channels RAZORPAY + UPI_QR · "activate now, payment due in N days" (default 7).
 *
 * Prerequisites: `npx nest build` (this script runs the compiled services) and migration
 * 20261007120000_commercial_engine applied. Safe to re-run: it never creates a second activation invoice. A leftover
 * UNPAID activation invoice with no billing term (e.g. from a failed Deal-builder click) is RESUMED: no new invoice, the
 * term/credit/theme allowance are created on it and a fresh link is printed. A leftover that does not match the agreed
 * deal is voided and replaced (only if it has no payments); otherwise the script refuses.
 * Messages are NOT sent (stubs) — the pay link is printed for KSM to share.
 */
const path = require('path');
const dist = (p) => require(path.join(__dirname, '..', 'dist', 'src', p));
const { decideStepnrock } = require('./activate-stepnrock-lib');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const dueArg = argv.find((a) => a.startsWith('--due-days='));
const DUE_DAYS = dueArg ? Number(dueArg.split('=')[1]) : 7;
const CONFIRM = 'I_HAVE_APPLIED_THE_COMMERCIAL_ENGINE_MIGRATION';

const DEAL = {
  planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', graceDays: 7,
  allowedChannels: ['RAZORPAY', 'UPI_QR'], linkExpiryDays: 30, paymentDueDays: DUE_DAYS,
  notes: 'Stepnrock launch deal — admin-agreed ₹5,994 half-yearly Workspace, no GST (KSM).',
};
const EXPECTED_NET_PAISE = 599400;
const line = (s = '') => console.log(s);
const head = (s) => { line(); line(`── ${s} ${'─'.repeat(Math.max(0, 70 - s.length))}`); };
const rupees = (p) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const noop = new Proxy({}, { get: (_t, prop) => (prop === 'then' ? undefined : async () => ({ status: 'mock', mock: true })) });

(async () => {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (source backend-api/.env first).'); process.exit(2); }
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host; } catch { return 'unknown'; } })();
  line(`Stepnrock activation — ${APPLY ? 'APPLY' : 'DRY RUN (read-only)'} — database host: ${host}`);

  const { PrismaService } = dist('prisma/prisma.service');
  const prisma = new PrismaService();
  await prisma.$connect();
  const q = (sql) => prisma.$queryRawUnsafe(sql);
  try {
    // 0. Is the schema migration applied?
    head('Schema state');
    const needTables = ['g4d_billing_terms', 'g4d_billing_deals', 'g4d_payee_settings'];
    const haveTables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['${needTables.join("','")}'])`)).map((r) => r.table_name);
    const haveCols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_name='Invoice' AND column_name IN ('kind','payTokenHash','paidPaise')`)).map((r) => r.column_name);
    const schemaReady = needTables.every((t) => haveTables.includes(t)) && haveCols.length === 3;
    line(schemaReady ? 'Commercial Engine schema is APPLIED.' : `Commercial Engine schema is NOT applied (missing tables: ${needTables.filter((t) => !haveTables.includes(t)).join(', ') || 'none'}; Invoice columns found: ${haveCols.join(',') || 'none'}).`);

    // 1. Vendor (read-only)
    head('Vendor');
    const vendor = (await q(`SELECT id, name, email, "businessName", subdomain, status, "isSandbox" FROM "Vendor" WHERE subdomain='stepnrock'`))[0];
    if (!vendor) { console.error('No vendor with subdomain "stepnrock" found. Aborting.'); process.exitCode = 1; return; }
    line(`${vendor.businessName} (${vendor.email}) · ${vendor.status} · ${vendor.isSandbox ? 'SANDBOX' : 'live'} · id ${vendor.id}`);
    if (vendor.isSandbox) line('NOTE: vendor is flagged sandbox; it will be flipped live on activation.');

    // 2. Existing commercial state
    head('Current commercial state');
    let existingInvoice = null; let currentTerm = null; let submissionCount = 0;
    if (schemaReady) {
      currentTerm = (await q(`SELECT id, status, "planKey", "billingCycle", "periodEnd", source FROM g4d_billing_terms WHERE "vendorId"='${vendor.id}' AND "isCurrent"=true`))[0] ?? null;
      existingInvoice = (await q(`SELECT id, "invoiceNumber", status, "totalAmount", "planKey", "billingCycle", "gstMode", "paidPaise" FROM "Invoice" WHERE "vendorId"='${vendor.id}' AND kind='ACTIVATION' ORDER BY "createdAt" DESC LIMIT 1`))[0] ?? null;
      if (existingInvoice) submissionCount = (await q(`SELECT count(*)::int n FROM g4d_manual_payment_submissions WHERE "invoiceId"='${existingInvoice.id}'`))[0].n;
    }
    const legacySubs = (await q(`SELECT count(*)::int n FROM "Subscription" WHERE "vendorId"='${vendor.id}'`))[0].n;
    const legacyInv = (await q(`SELECT count(*)::int n FROM "Invoice" WHERE "vendorId"='${vendor.id}'`))[0].n;
    line(`legacy subscriptions: ${legacySubs} · invoices (all kinds): ${legacyInv}`);
    line(currentTerm ? `billing term: ${currentTerm.status} ${currentTerm.planKey}/${currentTerm.billingCycle} ending ${currentTerm.periodEnd?.toISOString?.().slice(0, 10)}` : 'billing term: none');
    line(existingInvoice ? `activation invoice: ${existingInvoice.invoiceNumber} ${existingInvoice.status} ${rupees(existingInvoice.totalAmount)} (${existingInvoice.planKey}/${existingInvoice.billingCycle}, GST ${existingInvoice.gstMode}, paid ${rupees(existingInvoice.paidPaise ?? 0)}, ${submissionCount} proof(s))` : 'activation invoice: none');
    const decision = decideStepnrock({ currentTerm, invoice: existingInvoice, submissionCount });
    line(`decision: ${decision.action} — ${decision.reason}`);

    // 3. Payee / gateway readiness (warnings only)
    head('Readiness');
    const payee = schemaReady ? (await q(`SELECT "upiId", "payeeName" FROM g4d_payee_settings WHERE key='default'`))[0] : null;
    line(payee?.upiId ? `payee UPI ID: ${payee.upiId} (${payee.payeeName ?? 'no name'})` : 'WARNING: no payee UPI ID — set Admin → Commerce → Payee & QR before sharing the link (UPI QR will say "not set up").');
    line(process.env.RAZORPAY_KEY_ID && !String(process.env.RAZORPAY_KEY_ID).startsWith('placeholder') ? 'Razorpay key: configured' : 'WARNING: Razorpay keys are not configured — card/UPI-intent checkout will be unavailable.');

    // 4. The plan (computed with the SAME code that issues the invoice)
    head('Deal to create');
    const { buildQuote } = dist('commercial/quote-builder');
    const { WORKSPACE_YEARLY_PAISE, BOS_YEARLY_PAISE } = dist('payments/plan-pricing.constants');
    let rates = { WORKSPACE: WORKSPACE_YEARLY_PAISE, BOS: BOS_YEARLY_PAISE };
    if (schemaReady) {
      const rows = await q(`SELECT key, value FROM g4d_platform_settings WHERE category='pricing' AND key IN ('domainapp_workspace_yearly','domainapp_bos_yearly')`);
      for (const r of rows) { const rup = Number(r.value); if (Number.isFinite(rup) && rup > 0) rates[r.key === 'domainapp_bos_yearly' ? 'BOS' : 'WORKSPACE'] = Math.round(rup * 100); }
    }
    const quote = buildQuote(DEAL, rates);
    line(`plan ...... ${quote.lines[0].label}`);
    line(`list ...... ${rupees(quote.totals.subtotalPaise)}   discount ${rupees(quote.totals.discountPaise)}   GST mode NONE   GST ${rupees(quote.totals.gstPaise)}`);
    line(`TOTAL ..... ${rupees(quote.totals.totalPaise)}  (${quote.totals.totalPaise} paise)   grace ${DEAL.graceDays} days   channels ${DEAL.allowedChannels.join(' + ')}`);
    line(`term ...... ACTIVE_PAYMENT_DUE now → ${DUE_DAYS} day(s) to pay; ${quote.months}-month period; source ADMIN_DEAL`);
    if (quote.totals.totalPaise !== EXPECTED_NET_PAISE) { console.error(`ABORT: computed total ${quote.totals.totalPaise} ≠ agreed ${EXPECTED_NET_PAISE}. The Pricing Manager workspace rate may have been changed.`); process.exitCode = 1; return; }
    line('✓ total matches the agreed ₹5,994.00');

    // 5. What apply would do / refuse
    head('What --apply does');
    if (decision.action === 'REFUSE_HAS_TERM') line(`REFUSES: ${decision.reason}. Use Admin → Vendor → Billing terms to change it.`);
    else if (decision.action === 'REFUSE_HAS_PAYMENTS') line(`REFUSES: ${decision.reason}.`);
    else if (decision.action === 'RESUME') {
      line(`RESUMES on ${existingInvoice.invoiceNumber} (unpaid, ${rupees(existingInvoice.totalAmount)}) — creates NO new invoice and NO new deal:`);
      line('1. term → ACTIVE_PAYMENT_DUE (all Workspace features on immediately)');
      line('2. legacy Subscription row with theme limit 2 and reset date +12 months');
      line(`3. one-time ${rupees(49900)} AI Studio credit, exactly once (skipped if any 'ai_studio_bonus' already exists)`);
      line('4. issues a FRESH pay link and prints it (the link from the interrupted attempt was never shown; the old one stops working)');
    } else if (decision.action === 'VOID_AND_REPLACE') {
      line(`VOIDS ${existingInvoice.invoiceNumber} (it does not match the agreed deal; no payments) and creates the correct invoice + activation:`);
      line('1. void the old invoice with an audit reason, then create a BillingDeal (SENT) and a new ACTIVATION invoice + link');
      line('2. term, theme allowance, one-time AI credit as in a normal run');
    } else {
      line('1. creates a BillingDeal (SENT) and the ACTIVATION invoice with a 256-bit pay link (link printed ONCE, only its hash is stored)');
      line('2. term → ACTIVE_PAYMENT_DUE (all Workspace features on immediately)');
      line('3. legacy Subscription row with theme limit 2 and reset date +12 months');
      line(`4. one-time ${rupees(49900)} AI Studio credit, exactly once (skipped if any 'ai_studio_bonus' already exists)`);
      line('5. audit-log entries; NO message is sent');
    }

    if (!APPLY) { head('DRY RUN COMPLETE'); line('Nothing was written.'); if (!schemaReady) line('Apply migration 20261007120000_commercial_engine first, then re-run.'); return; }

    // ── APPLY ───────────────────────────────────────────────────────────────
    if (!schemaReady) { console.error('\nABORT: the commercial engine migration is not applied.'); process.exitCode = 2; return; }
    if (process.env.STEPNROCK_ACTIVATE_CONFIRM !== CONFIRM) { console.error(`\nABORT: set STEPNROCK_ACTIVATE_CONFIRM=${CONFIRM} to confirm.`); process.exitCode = 2; return; }
    if (decision.action === 'REFUSE_HAS_TERM' || decision.action === 'REFUSE_HAS_PAYMENTS') { console.error(`\nABORT: ${decision.reason}.`); process.exitCode = 1; return; }

    const F = dist('commercial/foundation.services');
    const { BillingGateService } = dist('commercial/billing-gate.service');
    const { WalletService } = dist('wallet/wallet.service');
    const { InvoiceBuilderService } = dist('commercial/invoice-builder.service');
    const { SettlementService } = dist('commercial/settlement.service');
    const { DealsService } = dist('commercial/deals.service');
    const { InvoiceAdminService } = dist('commercial/promos-and-invoices.service');
    const audit = new F.CommercialAuditService(prisma);
    const messenger = new F.CommercialMessenger(noop, noop, noop); // stubs: nothing is sent from this script
    const builder = new InvoiceBuilderService(prisma);
    const wallet = new WalletService(prisma, { resolveCompany: async () => ({}) }, new BillingGateService(prisma));
    const settlement = new SettlementService(prisma, audit, messenger, { resolveCompany: async () => ({}) }, noop);
    const deals = new DealsService(prisma, wallet, builder, settlement, audit, messenger, noop);
    const invAdmin = new InvoiceAdminService(prisma, builder, deals, { resolveCompany: async () => ({}) }, audit);
    const actor = { id: 'script', email: 'ksm+activate-stepnrock@get4domain.com', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' };

    head('APPLY');
    let payLink = null; let invoiceId = null;
    const create = async () => {
      const r = await deals.createInvoice({ ...DEAL, vendorId: vendor.id }, actor, { activateNow: true });
      invoiceId = r.invoice.id; payLink = r.payLink;
      line(`Created invoice ${r.invoice.invoiceNumber} for ${rupees(r.invoice.totalAmount)} (deal ${r.dealId}).`);
    };
    if (decision.action === 'RESUME') {
      invoiceId = existingInvoice.id;
      line(`Resuming on existing invoice ${existingInvoice.invoiceNumber} — no new invoice is created.`);
      await deals.activateNow(invoiceId, DUE_DAYS, DEAL.graceDays, actor); // idempotent: reuses a term if one is already attached
      payLink = (await invAdmin.reissueLink(invoiceId, actor, { expiryDays: DEAL.linkExpiryDays })).payLink;
    } else if (decision.action === 'VOID_AND_REPLACE') {
      line(`Voiding ${existingInvoice.invoiceNumber}: ${decision.reason}.`);
      await invAdmin.void(existingInvoice.id, 'Replaced by scripts/activate-stepnrock.js: did not match the agreed 5,994 half-yearly Workspace deal', actor);
      await create();
    } else {
      await create();
    }

    // Verification read-back
    head('Result (read back from the database)');
    const term = (await q(`SELECT status, "planKey", "billingCycle", "cycleMonths", "periodStart", "periodEnd", "paymentDueAt", "graceDays", source FROM g4d_billing_terms WHERE "vendorId"='${vendor.id}' AND "isCurrent"=true`))[0];
    const sub = (await q(`SELECT "themeChangesUsed", "themeChangesLimit", "themeChangesResetAt" FROM "Subscription" WHERE "vendorId"='${vendor.id}' ORDER BY "createdAt" DESC LIMIT 1`))[0];
    const credit = (await q(`SELECT amount FROM g4d_wallet_transactions WHERE "vendorId"='${vendor.id}' AND service='ai_studio_bonus'`));
    const wal = (await q(`SELECT balance FROM g4d_wallets WHERE "vendorId"='${vendor.id}'`))[0];
    line(`term: ${term.status} ${term.planKey}/${term.billingCycle} (${term.cycleMonths} mo) ${term.periodStart.toISOString().slice(0, 10)} → ${term.periodEnd.toISOString().slice(0, 10)} · payment due ${term.paymentDueAt?.toISOString().slice(0, 10)} · grace ${term.graceDays}d · ${term.source}`);
    line(`theme changes: ${sub.themeChangesUsed}/${sub.themeChangesLimit} used · resets ${sub.themeChangesResetAt.toISOString().slice(0, 10)}`);
    line(`AI Studio credit rows: ${credit.length} (${credit.map((c) => rupees(c.amount)).join(', ')}) · wallet balance ${rupees(wal.balance)}`);
    if (credit.length !== 1) line('WARNING: expected exactly one ai_studio_bonus credit.');

    head('PAY LINK');
    if (payLink) { line(payLink); line('(Shown once. Only its hash is stored. Lost it? Admin → Commerce → Invoices → Copy link — the old link stops working.)'); }
    else line('(No new link printed. Use Admin → Commerce → Invoices → Copy link.)');
    line(`Invoice id: ${invoiceId}`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error('\nERROR:', e && e.message ? e.message : e); process.exit(1); });
