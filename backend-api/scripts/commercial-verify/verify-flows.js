// Commercial Engine v1 — end-to-end flow assertions against the REAL compiled services (dist/),
// with the database replaced by an in-memory fake and Razorpay by an in-memory gateway.
const fs = require('fs');
const os = require('os');
const path = require('path');
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-commercial-'))); // proofs are written under cwd/private-uploads

const { dist, ok, rejects, section, finish, makeRazorpay, recorder } = require('../security-verify/harness');
const { createMemPrisma } = require('./mem-prisma');
const { ValidationPipe } = require('@nestjs/common');
const THROTTLER_LIMIT = 'THROTTLER:LIMIT'; // @nestjs/throttler metadata key prefix (not exported at the package top level)

const { PaymentsService } = dist('payments/payments.service');
const { WalletService } = dist('wallet/wallet.service');
const { InvoicesService } = dist('invoices/invoices.service');
const { CmsService } = dist('cms/cms.service');
const F = dist('commercial/foundation.services');
const { BillingGateService } = dist('commercial/billing-gate.service');
const { InvoiceBuilderService } = dist('commercial/invoice-builder.service');
const { SettlementService, decidePayment } = dist('commercial/settlement.service');
const { DealsService } = dist('commercial/deals.service');
const { PayService, AttemptLimiter } = dist('commercial/pay.service');
const { ManualPaymentsService } = dist('commercial/manual-payments.service');
const { TermsService, PlanChangeService } = dist('commercial/terms.service');
const { InvoiceAdminService, PromosService } = dist('commercial/promos-and-invoices.service');
const { RenewalService } = dist('commercial/renewal.service');
const { ArrangementsService } = dist('commercial/arrangements.service');
const C = dist('commercial/commercial.controllers');
const DTO = dist('commercial/dto');
const { redactSecrets } = dist('common/utils/redact-secrets');
const { IS_PUBLIC_KEY } = dist('common/decorators/public.decorator');
const M = dist('commercial/pricing-math');

const ADMIN = { id: 'admin1', email: 'admin@get4domain.com', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' };
const tokenOf = (link) => link.split('/pay/')[1];
// Some setups deliberately create a second activation invoice for the same vendor; the Deal-builder guard needs a typed reason for that.
const OVERRIDE = 'verify suite: deliberate second activation invoice for channel/limit testing';
const d = (iso) => new Date(iso);

function world(extraSeed = {}) {
  const prisma = createMemPrisma({
    vendor: [
      { id: 'v_step', name: 'Suresh', email: 'owner.stepnrock@get4domain.com', businessName: 'Step N Rock', phone: '9360011107', subdomain: 'stepnrock', isSandbox: false, expiresAt: null, status: 'ACTIVE' },
      { id: 'v_other', name: 'Other', email: 'other@x.in', businessName: 'Other Co', phone: '9000000000', subdomain: 'otherco', isSandbox: false, expiresAt: null, status: 'ACTIVE' },
    ],
    specialArrangement: [{ id: 'arr_step', vendorId: 'v_step', active: true, allowHalfYear: true, gstMode: 'NONE', allowedChannels: ['UPI_QR'], validUntil: new Date('2027-03-31T00:00:00Z'), reason: 'test fixture: the stepnrock arrangement', createdBy: 'test', history: [], createdAt: new Date('2026-10-01T00:00:00Z') }, { id: 'arr_other', vendorId: 'v_other', active: true, allowHalfYear: true, gstMode: 'NONE', allowedChannels: ['UPI_QR', 'OFFLINE'], validUntil: new Date('2027-03-31T00:00:00Z'), reason: 'test fixture: deliberate other-vendor arrangement', createdBy: 'test', history: [], createdAt: new Date('2026-10-01T00:00:00Z') }],
    wallet: [{ id: 'w_step', vendorId: 'v_step', balance: 0, totalCredited: 0, totalDebited: 0 }],
    vendorProduct: [{ id: 'p1', vendorId: 'v_step', name: 'Shoe' }, { id: 'p2', vendorId: 'v_step', name: 'Sandal' }],
    contact: [{ id: 'c1', vendorId: 'v_step', name: 'Cust' }],
    ...extraSeed,
  });
  const rz = makeRazorpay();
  const email = recorder('email');
  const whatsapp = recorder('wa', { sendMessage: async () => ({ status: 'mock', mock: true }) });
  const notifications = recorder('notif');
  const legacyInvoices = { resolveCompany: async () => ({ name: 'KSM Quantum Technologies' }) };
  const payments = new PaymentsService(prisma, email, notifications, recorder('wa2'), recorder('settings'));
  payments.razorpay = rz;
  const gate = new BillingGateService(prisma);
  const wallet = new WalletService(prisma, legacyInvoices, gate);
  const audit = new F.CommercialAuditService(prisma);
  const messenger = new F.CommercialMessenger(email, whatsapp, notifications);
  const builder = new InvoiceBuilderService(prisma);
  const settlement = new SettlementService(prisma, audit, messenger, legacyInvoices, email);
  const arrangements = new ArrangementsService(prisma, audit, messenger);
  const deals = new DealsService(prisma, wallet, builder, settlement, audit, messenger, email, arrangements);
  const payee = new F.PayeeService(prisma, audit);
  const pay = new PayService(prisma, payments, builder, settlement, payee, audit, messenger);
  const manual = new ManualPaymentsService(prisma, settlement, audit, messenger);
  const terms = new TermsService(prisma, audit, settlement);
  const planChanges = new PlanChangeService(prisma, audit, messenger, deals, builder, terms, arrangements);
  const renewal = new RenewalService(prisma, builder, deals, messenger, audit, arrangements);
  const invAdmin = new InvoiceAdminService(prisma, builder, deals, legacyInvoices, audit);
  const promos = new PromosService(prisma, audit);
  const t = prisma.$tables;
  return { prisma, rz, email, whatsapp, payments, wallet, gate, audit, messenger, arrangements, builder, settlement, deals, payee, pay, manual, terms, planChanges, renewal, invAdmin, promos, t, legacyInvoices };
}

const stepSpec = (over = {}) => {
  const o = { vendorId: 'v_step', planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', graceDays: 7, allowedChannels: ['RAZORPAY', 'UPI_QR'], ...over };
  // The 6-month LIST is 55% of annual (₹6,593.40); KSM approves the ₹5,994.00 net with a reason, exactly as the live deal did.
  if (o.billingCycle === 'HALF_YEARLY' && o.planKey && !over.discount) o.discount = { mode: 'FLAT', value: 59940, reason: 'Approved launch net 5,994.00 (list is 55% of annual)' };
  return o;
};
const rows = (w, name) => w.t[name] ?? [];

(async () => {
  // ───────────────────────────────────────────────────────────────────────────────────────────────
  section('DEAL → INVOICE: amounts are derived on the server; the stepnrock deal');
  {
    const w = world();
    await w.payee.update({ upiId: 'get4domain@okhdfcbank', payeeName: 'KSM Quantum Technologies' }, ADMIN);
    const r = await w.deals.createInvoice(stepSpec({ paymentDueDays: 7 }), ADMIN, { activateNow: true });
    const inv = rows(w, 'invoice')[0];
    ok('invoice total is ₹5,994.00 (599400 paise), GST mode NONE, kind ACTIVATION', inv.totalAmount === 599400 && inv.gstAmount === 0 && inv.gstMode === 'NONE' && inv.kind === 'ACTIVATION', JSON.stringify({ t: inv.totalAmount, g: inv.gstAmount }));
    ok('status SENT; channels RAZORPAY + UPI_QR', inv.status === 'SENT' && inv.allowedChannels.join() === 'RAZORPAY,UPI_QR');
    ok('pay link is /pay/<43-char token>', /\/pay\/[A-Za-z0-9_-]{43}$/.test(r.payLink));
    ok('the clear token is NOT stored anywhere (only its SHA-256)', JSON.stringify(rows(w, 'invoice')).indexOf(tokenOf(r.payLink)) === -1 && inv.payTokenHash.length === 64);
    const term = rows(w, 'billingTerm')[0];
    ok('"Activate now": term ACTIVE_PAYMENT_DUE, ADMIN_DEAL, WORKSPACE half-yearly, grace 7, due in 7 days', term.status === 'ACTIVE_PAYMENT_DUE' && term.source === 'ADMIN_DEAL' && term.planKey === 'WORKSPACE' && term.billingCycle === 'HALF_YEARLY' && term.cycleMonths === 6 && term.graceDays === 7 && term.paymentDueAt instanceof Date, JSON.stringify(term));
    ok('period is 6 months from now', M.addMonths(term.periodStart, 6).getTime() === term.periodEnd.getTime());
    const sub = rows(w, 'subscription')[0];
    ok('entitlements: theme limit 2/yr, counter 0, reset date one YEAR out (not 6 months)', sub.themeChangesLimit === 2 && sub.themeChangesUsed === 0 && M.addMonths(term.periodStart, 12).getTime() === sub.themeChangesResetAt.getTime());
    const credits = rows(w, 'walletTransaction').filter((x) => x.service === 'ai_studio_bonus');
    ok('₹250 AI Studio credit (Workspace half-yearly, prorated from ₹499) granted exactly once, at activation', credits.length === 1 && credits[0].amount === 25000 && rows(w, 'wallet')[0].balance === 25000);
    ok('stepnrock stays a live vendor', rows(w, 'vendor')[0].isSandbox === false);
    const mods = rows(w, 'vendorModule').filter((m) => m.vendorId === 'v_step' && m.enabled).map((m) => m.moduleKey);
    ok('[feat:account.billing.provisioning] activation provisions the Essentials modules (telecrm, website_manager, ...) and only for this vendor', ['telecrm', 'website_manager'].every((k) => mods.includes(k)) && rows(w, 'vendorModule').every((m) => m.vendorId === 'v_step') && rows(w, 'commercialAuditLog').some((a) => a.action === 'vendor.modules_provisioned' && a.entityId === 'v_step'));
    ok('audit trail records the invoice and the activation', rows(w, 'commercialAuditLog').some((a) => a.action === 'deal.invoice_created') && rows(w, 'commercialAuditLog').some((a) => a.action === 'term.activate_now'));
  }

  section('GST modes persisted correctly on real invoices');
  for (const [mode, expectTotal, expectGst] of [['EXCLUSIVE', 707292, 107892], ['INCLUSIVE', 599400, 91434], ['NONE', 599400, 0]]) {
    const w = world();
    await w.deals.createInvoice(stepSpec({ gstMode: mode }), ADMIN, {});
    const inv = rows(w, 'invoice')[0];
    ok(`${mode}: total ${expectTotal}, GST ${expectGst}, taxable+GST=total`, inv.totalAmount === expectTotal && inv.gstAmount === expectGst && inv.amount + inv.gstAmount === inv.totalAmount, JSON.stringify({ t: inv.totalAmount, g: inv.gstAmount, a: inv.amount }));
  }
  {
    const w = world();
    await w.deals.createInvoice(stepSpec({ gstMode: 'EXCLUSIVE', planKey: 'BOS', billingCycle: 'ANNUAL', discount: { mode: 'PERCENT', value: 10, reason: 'launch partner' } }), ADMIN, {});
    const inv = rows(w, 'invoice')[0];
    ok('EXCLUSIVE + 10% discount on BOS annual: GST charged on the net after discount', inv.amount === 2158920 && inv.gstAmount === Math.round(2158920 * 0.18) && inv.discountPaise === 239880 && inv.discountReason === 'launch partner', JSON.stringify(inv));
    ok('discount is audit-logged with its reason', rows(w, 'commercialAuditLog').some((a) => a.action === 'deal.invoice_created' && a.detail.discountPaise === 239880 && a.detail.discountReason === 'launch partner'));
  }

  section('CLIENT-SUPPLIED AMOUNTS ARE REJECTED everywhere');
  {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    await rejects('deal spec carrying an "amount" field is rejected', pipe.transform({ gstMode: 'NONE', planKey: 'BOS', billingCycle: 'ANNUAL', amount: 1 }, { type: 'body', metatype: DTO.DealSpecDto }), { status: 400 });
    await rejects('deal spec carrying "totalAmount" is rejected', pipe.transform({ gstMode: 'NONE', totalAmount: 1 }, { type: 'body', metatype: DTO.CreateDealInvoiceDto }), { status: 400 });
    await rejects('Razorpay verify carrying an "amount" is rejected', pipe.transform({ razorpayOrderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 's', amount: 1 }, { type: 'body', metatype: DTO.RazorpayVerifyDto }), { status: 400 });
    await rejects('promo apply carrying a discount/amount is rejected', pipe.transform({ code: 'ABC', discount: 5000 }, { type: 'body', metatype: DTO.PromoApplyDto }), { status: 400 });
    await rejects('proof form carrying receivedAmountPaise is rejected', pipe.transform({ utr: '1', amount: '1', paidAt: 'x', receivedAmountPaise: 1 }, { type: 'body', metatype: DTO.ProofFormDto }), { status: 400 });
    await rejects('plan-change request cannot set a price', pipe.transform({ toPlanKey: 'BOS', toCycle: 'ANNUAL', priceAmount: 1 }, { type: 'body', metatype: DTO.PlanChangeRequestDto }), { status: 400 });
    const w = world();
    const r = await w.deals.createInvoice(stepSpec({ allowedChannels: ['RAZORPAY'] }), ADMIN, {});
    const ctx = await w.pay.loadByToken(tokenOf(r.payLink));
    const o = await w.pay.razorpayOrder(ctx);
    ok('Razorpay order amount is the invoice balance (599400) — razorpayOrder() takes no amount at all', o.amount === 599400 && w.pay.razorpayOrder.length === 1);
  }

  section('PAY-LINK TOKENS: guess, shape, expiry, rotation, void');
  {
    const w = world();
    const r = await w.deals.createInvoice(stepSpec(), ADMIN, {});
    const token = tokenOf(r.payLink);
    await rejects('a random well-formed token → 404', w.pay.loadByToken('A'.repeat(43)), { status: 404 });
    await rejects('garbage token → 404', w.pay.loadByToken('not-a-token'), { status: 404 });
    await rejects('path-traversal token → 404', w.pay.loadByToken('../../etc/passwd'), { status: 404 });
    await rejects('the token with one character changed → 404', w.pay.loadByToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')), { status: 404 });
    ok('the real token works', (await w.pay.loadByToken(token)).invoice.invoiceNumber.startsWith('INV-'));
    rows(w, 'invoice')[0].tokenExpiresAt = d('2020-01-01T00:00:00Z');
    await rejects('an expired link → 410 Gone', w.pay.loadByToken(token), { status: 410 });
    rows(w, 'invoice')[0].tokenExpiresAt = d('2099-01-01T00:00:00Z');
    const fresh = await w.invAdmin.reissueLink(rows(w, 'invoice')[0].id, ADMIN, {});
    await rejects('after "copy link" the OLD link stops working (rotation)', w.pay.loadByToken(token), { status: 404 });
    ok('the NEW link works', Boolean(await w.pay.loadByToken(tokenOf(fresh.payLink))));
    const list = await w.invAdmin.list({});
    const one = await w.invAdmin.get(rows(w, 'invoice')[0].id);
    ok('admin invoice LIST never contains a token or its hash', !JSON.stringify(list).includes('payTokenHash') && !JSON.stringify(list).includes(tokenOf(fresh.payLink)));
    ok('admin invoice DETAIL never contains a token or its hash', !JSON.stringify(one).includes('payTokenHash') && !JSON.stringify(one).includes(tokenOf(fresh.payLink)));
    ok('even a raw invoice row is scrubbed by the global response redaction', !('payTokenHash' in redactSecrets(rows(w, 'invoice')[0])) && !('screenshotUrl' in redactSecrets({ screenshotUrl: 'x', ok: 1 })));
    const view = await w.pay.view(await w.pay.loadByToken(tokenOf(fresh.payLink)));
    ok('the pay-page payload carries no token/hash/internal ids', !JSON.stringify(view).includes('payTokenHash') && view.invoice.id === undefined);
    await w.invAdmin.void(rows(w, 'invoice')[0].id, 'issued by mistake', ADMIN);
    await rejects('a voided invoice link → 404', w.pay.loadByToken(tokenOf(fresh.payLink)), { status: 404 });
    const handlers = ['view', 'order', 'verify', 'upi', 'proof', 'promo', 'removePromo'];
    ok('every public pay endpoint is rate-limited (per-route @Throttle)', handlers.every((h) => Reflect.getMetadata(THROTTLER_LIMIT + 'default', C.PublicPayController.prototype[h]) > 0), handlers.map((h) => Reflect.getMetadata(THROTTLER_LIMIT + 'default', C.PublicPayController.prototype[h])).join());
    ok('the public pay controller is @Public; the admin and vendor controllers are NOT', Reflect.getMetadata(IS_PUBLIC_KEY, C.PublicPayController) === true && !Reflect.getMetadata(IS_PUBLIC_KEY, C.AdminCommerceController) && !Reflect.getMetadata(IS_PUBLIC_KEY, C.VendorBillingController));
    const lim = new AttemptLimiter(3, 60_000);
    [1, 2, 3].forEach(() => lim.fail('k'));
    ok('attempt limiter blocks after N failures and recovers after the window', lim.allowed('k') === false && lim.allowed('k', Date.now() + 61_000) === true);
  }

  section('RAZORPAY: server-derived order, captured-only, idempotent, bound to THIS invoice');
  {
    const w = world();
    const r = await w.deals.createInvoice(stepSpec({ allowedChannels: ['RAZORPAY'] }), ADMIN, { activateNow: true });
    const ctx = await w.pay.loadByToken(tokenOf(r.payLink));
    const order = await w.pay.razorpayOrder(ctx);
    const good = w.rz.pay(order.orderId);
    const res = await w.pay.razorpayVerify(ctx, good);
    ok('captured payment → invoice PAID', res.verified && rows(w, 'invoice')[0].status === 'PAID' && rows(w, 'invoice')[0].paidPaise === 599400 && rows(w, 'invoice')[0].paidVia === 'RAZORPAY');
    ok('[feat:commercial.vendor-billing] paying the activation settles "payment due": term ACTIVE, due date cleared, effects applied once', rows(w, 'billingTerm')[0].status === 'ACTIVE' && rows(w, 'billingTerm')[0].paymentDueAt === null && rows(w, 'invoice')[0].effectsAppliedAt instanceof Date);
    const again = await w.pay.razorpayVerify(await w.pay.loadByToken(tokenOf(r.payLink)), good);
    ok('REPLAY of the same payment is idempotent (no second income / credit / term)', again.verified && rows(w, 'platformIncome').length === 1 && rows(w, 'walletTransaction').filter((x) => x.service === 'ai_studio_bonus').length === 1 && rows(w, 'billingTerm').length === 1, `income=${rows(w, 'platformIncome').length}`);
    await rejects('a PAID invoice cannot get a second order', w.pay.razorpayOrder(await w.pay.loadByToken(tokenOf(r.payLink))), { status: 400 });
  }
  {
    const w = world();
    const r = await w.deals.createInvoice(stepSpec({ allowedChannels: ['RAZORPAY'] }), ADMIN, {});
    const ctx = await w.pay.loadByToken(tokenOf(r.payLink));
    const cheap = await w.rz.orders.create({ amount: 100, currency: 'INR', receipt: 'x', notes: { purpose: 'invoice', invoiceId: rows(w, 'invoice')[0].id, vendorId: 'v_step' } });
    await rejects('a ₹1 order stamped with this invoice cannot pay a ₹5,994 invoice', w.pay.razorpayVerify(ctx, w.rz.pay(cheap.id)), { status: 400 });
    const foreign = await w.rz.orders.create({ amount: 599400, currency: 'INR', receipt: 'x', notes: { purpose: 'invoice', invoiceId: 'someone_elses', vendorId: 'v_other' } });
    await rejects('a payment stamped for a different invoice is rejected', w.pay.razorpayVerify(ctx, w.rz.pay(foreign.id)), { status: 400 });
    const ord = await w.pay.razorpayOrder(ctx);
    await rejects('an authorised-but-not-captured payment is rejected', w.pay.razorpayVerify(ctx, w.rz.pay(ord.orderId, { status: 'authorized' })), { status: 400 });
    ok('invoice is still unpaid after every failed attempt', rows(w, 'invoice')[0].status === 'SENT' && rows(w, 'platformIncome').length === 0);
    w.rz.down = true;
    await rejects('gateway down fails closed (503), never "assume paid"', w.pay.razorpayVerify(ctx, w.rz.pay(ord.orderId)), {});
    w.rz.down = false;
    const uOnly = await w.deals.createInvoice(stepSpec({ allowedChannels: ['UPI_QR'] }), ADMIN, { overrideReason: OVERRIDE });
    await rejects('Razorpay disabled for an invoice → 403', w.pay.razorpayOrder(await w.pay.loadByToken(tokenOf(uOnly.payLink))), { status: 403 });
    const vctx = w.pay.loadForVendor(rows(w, 'invoice')[0].id, 'v_other');
    await rejects("another vendor cannot open this invoice from the dashboard route", vctx, { status: 404 });
  }

  section('UPI QR: server-built link, proof submission, validation, private storage');
  {
    const w = world();
    await w.payee.update({ upiId: 'get4domain@okhdfcbank', payeeName: 'KSM Quantum Technologies', bankName: 'HDFC', bankAccountName: 'KSM', bankAccountNumber: '50100123456789', bankIfsc: 'HDFC0001234', instructions: 'Add the invoice number in remarks' }, ADMIN);
    const r = await w.deals.createInvoice(stepSpec(), ADMIN, { activateNow: true });
    const tok = tokenOf(r.payLink);
    let ctx = await w.pay.loadByToken(tok);
    const upi = await w.pay.upi(ctx);
    ok('UPI link carries the EXACT server balance (₹5,994.00) and the invoice number', upi.upiLink.includes('am=5994.00') && upi.upiLink.includes(`tn=${ctx.invoice.invoiceNumber}`) && upi.qrDataUrl.startsWith('data:image/png;base64,'), upi.upiLink);
    const view = await w.pay.view(ctx);
    ok('pay view exposes the UPI id + bank details to a payer on a UPI invoice', view.channels.upiQr === true && view.payee.upiId === 'get4domain@okhdfcbank' && view.payee.bank.ifsc === 'HDFC0001234');

    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
    const base = { utr: '412345678901', claimedAmountRupees: 5994, paidAt: new Date().toISOString(), payerNote: 'paid via GPay', file: { buffer: png, mimetype: 'image/png', size: png.length }, ip: '1.2.3.4' };
    await rejects('invalid UTR rejected', w.pay.submitProof(ctx, { ...base, utr: '123' }), { status: 400 });
    await rejects('future payment date rejected', w.pay.submitProof(ctx, { ...base, paidAt: new Date(Date.now() + 5 * 86400000).toISOString() }), { status: 400 });
    await rejects('missing amount rejected', w.pay.submitProof(ctx, { ...base, claimedAmountRupees: undefined }), { status: 400 });
    await rejects('oversize screenshot (>3 MB) rejected', w.pay.submitProof(ctx, { ...base, file: { buffer: Buffer.alloc(4 * 1024 * 1024, 1), mimetype: 'image/png', size: 4 * 1024 * 1024 } }), { status: 400 });
    await rejects('SVG disguised as image/png rejected (magic-byte check, not the declared type)', w.pay.submitProof(ctx, { ...base, file: { buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), mimetype: 'image/png', size: 70 } }), { status: 400 });
    await rejects('HTML disguised as image/jpeg rejected', w.pay.submitProof(ctx, { ...base, file: { buffer: Buffer.from('<html><body>x</body></html>      '), mimetype: 'image/jpeg', size: 40 } }), { status: 400 });
    ok('nothing was stored by the rejected attempts', rows(w, 'manualPaymentSubmission').length === 0);

    const sub = await w.pay.submitProof(ctx, base);
    const s = rows(w, 'manualPaymentSubmission')[0];
    ok('valid proof stored: SUBMITTED, UTR normalised, invoice → PAYMENT_SUBMITTED', sub.submitted && s.status === 'SUBMITTED' && s.utr === '412345678901' && rows(w, 'invoice')[0].status === 'PAYMENT_SUBMITTED');
    ok('screenshot is a PRIVATE reference, not a URL', s.screenshotUrl.startsWith('private:') && !/^https?:/.test(s.screenshotUrl) && s.screenshotMime === 'image/png');
    const dir = path.join(process.cwd(), 'private-uploads', 'payment-proofs');
    ok('file landed in private-uploads/ (never in the public /uploads folder)', fs.existsSync(dir) && !fs.existsSync(path.join(process.cwd(), 'uploads')));
    const queue = await w.manual.list('SUBMITTED');
    ok('"Payments to confirm" queue shows UTR, claimed amount, invoice, vendor — and only a hasScreenshot flag', queue.length === 1 && queue[0].utr === '412345678901' && queue[0].invoice.number === ctx.invoice.invoiceNumber && queue[0].vendor.businessName === 'Step N Rock' && queue[0].hasScreenshot === true && !JSON.stringify(queue).includes('private:') && !JSON.stringify(queue).includes('screenshotUrl'));
    const file = await w.manual.proof(s.id);
    ok('the admin proof endpoint returns the exact bytes with the sniffed mime', Buffer.compare(file.buffer, png) === 0 && file.mime === 'image/png');
    rows(w, 'manualPaymentSubmission')[0].screenshotUrl = 'private:../../../../etc/passwd';
    await rejects('a tampered proof path cannot escape the private folder', w.manual.proof(s.id), { status: 404 });
    rows(w, 'manualPaymentSubmission')[0].screenshotUrl = s.screenshotUrl;

    ctx = await w.pay.loadByToken(tok);
    await rejects('the same UTR twice → 409', w.pay.submitProof(ctx, base), { status: 409 });
    const q2 = await w.manual.list('SUBMITTED');
    ok('a duplicate UTR is FLAGGED on the queue row and in the audit log', q2[0].duplicateUtrAttempts === 1 && rows(w, 'commercialAuditLog').some((a) => a.action === 'payment.duplicate_utr'));
    ok('UTR uniqueness holds even across invoices (global unique)', rows(w, 'manualPaymentSubmission').length === 1);
  }

  section('ADMIN CONFIRMATION: exact, partial, over-payment, idempotent, concurrent, reject');
  {
    const mk = async () => {
      const w = world();
      await w.payee.update({ upiId: 'get4domain@okhdfcbank', payeeName: 'KSM' }, ADMIN);
      const r = await w.deals.createInvoice(stepSpec({ allowedChannels: ['UPI_QR'] }), ADMIN, {});
      const ctx = await w.pay.loadByToken(tokenOf(r.payLink));
      let n = 0;
      const link = { value: r.payLink }; // the link changes whenever the admin re-issues it
      const submit = async (amountRupees) => { n += 1; await w.pay.submitProof(await w.pay.loadByToken(tokenOf(link.value)), { utr: `UTR00000000${String(n).padStart(2, '0')}`, claimedAmountRupees: amountRupees, paidAt: new Date().toISOString(), file: null, ip: `9.9.9.${n}` }); return rows(w, 'manualPaymentSubmission')[n - 1].id; };
      return { w, r, ctx, submit, link };
    };
    {
      const { w, submit } = await mk();
      const id = await submit(5994);
      const res = await w.manual.confirm(id, 599400, ADMIN);
      const inv = rows(w, 'invoice')[0];
      ok('EXACT amount → PAID, no balance, no overpayment', res.confirmed && inv.status === 'PAID' && inv.paidPaise === 599400 && inv.overpaymentPaise === 0 && inv.paidVia === 'UPI_QR');
      ok('exact confirmation activates the term (ACTIVE, not payment-due) and grants entitlements once', rows(w, 'billingTerm')[0].status === 'ACTIVE' && rows(w, 'subscription').length === 1 && rows(w, 'walletTransaction').filter((x) => x.service === 'ai_studio_bonus').length === 1);
      const second = await w.manual.confirm(id, 599400, ADMIN);
      ok('confirming the SAME submission again is idempotent (no double income, no double credit)', second.alreadyConfirmed === true && rows(w, 'platformIncome').length === 1 && rows(w, 'walletTransaction').filter((x) => x.service === 'ai_studio_bonus').length === 1);
      ok('confirmation is audit-logged with the actor', rows(w, 'commercialAuditLog').some((a) => a.action === 'payment.confirm' && a.actor === ADMIN.email));
    }
    {
      const { w, submit, link } = await mk();
      const id1 = await submit(5994);
      const r1 = await w.manual.confirm(id1, 200000, ADMIN); // received only ₹2,000
      let inv = rows(w, 'invoice')[0];
      ok('LESS than due → PARTIALLY_PAID, balance ₹3,994 still due, nothing activated', r1.invoiceStatus === 'PARTIALLY_PAID' && inv.paidPaise === 200000 && r1.balanceDuePaise === 399400 && !rows(w, 'billingTerm').length);
      link.value = (await w.invAdmin.reissueLink(inv.id, ADMIN, {})).payLink;
      const upi = await w.pay.upi(await w.pay.loadByToken(tokenOf(link.value)));
      ok('the UPI QR now asks for the REMAINING balance only (₹3,994.00)', upi.upiLink.includes('am=3994.00'), upi.upiLink);
      const id2 = await submit(3994);
      const r2 = await w.manual.confirm(id2, 399400, ADMIN);
      inv = rows(w, 'invoice')[0];
      ok('second confirmation pays the balance → PAID; activation happens now, once', r2.invoiceStatus === 'PAID' && inv.paidPaise === 599400 && rows(w, 'billingTerm').length === 1 && rows(w, 'billingTerm')[0].status === 'ACTIVE');
      ok('platform income recorded per receipt (2,000 + 3,994 = 5,994)', rows(w, 'platformIncome').reduce((s, x) => s + x.amount, 0) === 599400);
    }
    {
      const { w, submit } = await mk();
      const id = await submit(7000);
      const res = await w.manual.confirm(id, 700000, ADMIN); // received ₹7,000 for a ₹5,994 invoice
      const inv = rows(w, 'invoice')[0];
      ok('MORE than due → PAID with an overpayment note of ₹1,006 (no automatic refund)', res.invoiceStatus === 'PAID' && inv.overpaymentPaise === 100600 && inv.paidPaise === 700000, JSON.stringify({ s: res.invoiceStatus, o: inv.overpaymentPaise }));
    }
    {
      const { w, submit } = await mk();
      const id = await submit(5994);
      await rejects('admin must enter the amount actually received (0 / negative / fractional rejected)', Promise.all([w.manual.confirm(id, 0, ADMIN), w.manual.confirm(id, -5, ADMIN), w.manual.confirm(id, 10.5, ADMIN)].map((p) => p.then(() => { throw new Error('accepted'); }, (e) => { throw e; }))), { status: 400 });
      const [a, b] = await Promise.allSettled([w.manual.confirm(id, 599400, ADMIN), w.manual.confirm(id, 599400, ADMIN)]);
      const fulfilled = [a, b].filter((x) => x.status === 'fulfilled');
      ok('two admins confirming at the SAME moment apply the money exactly once', rows(w, 'platformIncome').length === 1 && rows(w, 'invoice')[0].paidPaise === 599400 && fulfilled.length >= 1, `income=${rows(w, 'platformIncome').length} paid=${rows(w, 'invoice')[0].paidPaise}`);
    }
    {
      const { w, submit } = await mk();
      const id = await submit(5994);
      await rejects('reject needs a reason', w.manual.reject(id, '  ', ADMIN), { status: 400 });
      const emailBefore = w.email.calls.length;
      await w.manual.reject(id, 'Amount not found in our bank statement', ADMIN);
      ok('reject: submission REJECTED with the reason, invoice returns to SENT', rows(w, 'manualPaymentSubmission')[0].status === 'REJECTED' && rows(w, 'manualPaymentSubmission')[0].reason.includes('bank statement') && rows(w, 'invoice')[0].status === 'SENT');
      ok('reject notifies the vendor with the reason (email sent)', w.email.calls.length > emailBefore && JSON.stringify(w.email.calls.slice(emailBefore)).includes('bank statement'));
      await rejects('a rejected submission cannot be confirmed afterwards', w.manual.confirm(id, 599400, ADMIN), { status: 409 });
      ok('nothing was credited by a rejection', rows(w, 'platformIncome').length === 0 && rows(w, 'invoice')[0].paidPaise === 0);
      const sid = await submit(5994);
      await w.invAdmin.void(rows(w, 'invoice')[0].id, 'customer cancelled', ADMIN);
      ok('voiding an invoice auto-rejects its waiting submissions', rows(w, 'manualPaymentSubmission').find((x) => x.id === sid).status === 'REJECTED' && rows(w, 'invoice')[0].status === 'VOID');
    }
  }

  section('AUTHORISATION: platform-admin only, explicit role checks');
  {
    const ctxFor = (user) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    const g = new F.CommercialAdminGuard();
    const mg = new F.MoneyAdminGuard();
    const pass = (guard, user) => { try { return guard.canActivate(ctxFor(user)) === true; } catch { return false; } };
    ok('bootstrap admin passes', pass(g, { sub: 'a', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' }));
    ok('ADMIN-role vendor principal passes', pass(g, { sub: 'a', role: 'ADMIN' }));
    ok('internal staff (admin_member) passes', pass(g, { sub: 'm', role: 'ADMIN', adminRole: 'OPERATIONS', kind: 'admin_member' }));
    ok('a normal vendor is rejected', !pass(g, { sub: 'v', role: 'VENDOR' }));
    ok('a vendor TEAM MEMBER is rejected', !pass(g, { sub: 'v', role: 'VENDOR', kind: 'team_member', modules: ['wallet'] }));
    ok('a demo SANDBOX principal is rejected', !pass(g, { sub: 'v', role: 'ADMIN', kind: 'sandbox' }));
    ok('no user at all is rejected', !pass(g, undefined));
    const MKT = { sub: 'm', role: 'ADMIN', adminRole: 'MARKETING', kind: 'admin_member' };
    ok('MARKETING staff are refused by CommercialAdminGuard AND MoneyAdminGuard (403, not just hidden)', !pass(g, MKT) && !pass(mg, MKT) && !pass(g, { ...MKT, role: 'SUPER_ADMIN' }));
    // Every route of the admin-commerce controller, discovered from the Nest route metadata, run through its REAL guard stack.
    const proto = C.AdminCommerceController.prototype;
    const routeNames = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor' && typeof proto[n] === 'function' && Reflect.getMetadata('path', proto[n]) !== undefined && Reflect.getMetadata('method', proto[n]) !== undefined);
    const stackFor = (n) => [...(Reflect.getMetadata('__guards__', C.AdminCommerceController) ?? []), ...(Reflect.getMetadata('__guards__', proto[n]) ?? [])].map((G) => new G());
    const statusOf = (n, user) => { try { stackFor(n).forEach((gd) => gd.canActivate(ctxFor(user))); return 200; } catch (e) { return typeof e.getStatus === 'function' ? e.getStatus() : 500; } };
    ok(`found the admin-commerce routes by metadata (${routeNames.length}, not a vacuous check)`, routeNames.length >= 25, String(routeNames.length));
    ok('MARKETING gets 403 on EVERY admin-commerce route (reads included)', routeNames.every((n) => statusOf(n, MKT) === 403), routeNames.filter((n) => statusOf(n, MKT) !== 403).join());
    ok('SUPER_ADMIN and OPERATIONS still pass every route (the guard is not over-broad)', routeNames.every((n) => statusOf(n, { sub: 'a', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' }) === 200 && statusOf(n, { sub: 'o', role: 'ADMIN', adminRole: 'OPERATIONS', kind: 'admin_member' }) === 200));
    ok('a vendor and a vendor team member get 403 on every admin-commerce route', routeNames.every((n) => statusOf(n, { sub: 'v', role: 'VENDOR' }) === 403 && statusOf(n, { sub: 'v', role: 'VENDOR', kind: 'team_member', modules: ['wallet'] }) === 403));
    ok('OPERATIONS staff and SUPER_ADMIN pass the money guard', pass(mg, { sub: 'm', role: 'ADMIN', adminRole: 'OPERATIONS', kind: 'admin_member' }) && pass(mg, { sub: 'a', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' }));
    const classGuards = Reflect.getMetadata('__guards__', C.AdminCommerceController) ?? [];
    ok('EVERY admin-commerce route sits behind CommercialAdminGuard (class level)', classGuards.includes(F.CommercialAdminGuard));
    const moneyRoutes = ['updatePayee', 'createInvoice', 'link', 'voidInvoice', 'confirm', 'reject', 'proof', 'createPromo', 'updatePromo', 'override', 'schedule', 'clearSchedule', 'approve', 'rejectPlan', 'runRenewal'];
    ok('every money-moving route also carries MoneyAdminGuard', moneyRoutes.every((m) => (Reflect.getMetadata('__guards__', C.AdminCommerceController.prototype[m]) ?? []).includes(F.MoneyAdminGuard)), moneyRoutes.filter((m) => !(Reflect.getMetadata('__guards__', C.AdminCommerceController.prototype[m]) ?? []).includes(F.MoneyAdminGuard)).join());
    const w = world();
    const vc = new C.VendorBillingController(w.pay, w.terms, w.planChanges, w.invAdmin, w.prisma);
    await rejects('a sandbox principal cannot use vendor billing', vc.me({ sub: 'v_step', email: 'x', role: 'VENDOR', kind: 'sandbox' }), { status: 403 });
    await rejects('a team member without the wallet area cannot use vendor billing', vc.me({ sub: 'v_step', email: 'x', role: 'VENDOR', kind: 'team_member', modules: ['crm'] }), { status: 403 });
    ok('the owner can', Boolean(await vc.me({ sub: 'v_step', email: 'x', role: 'VENDOR' })));
    const payeeAfter = await w.payee.update({ upiId: 'ok@okbank' }, ADMIN);
    await rejects('an invalid UPI id cannot be saved', w.payee.update({ upiId: 'nonsense' }, ADMIN), { status: 400 });
    await rejects('an invalid IFSC cannot be saved', w.payee.update({ bankIfsc: 'XX' }, ADMIN), { status: 400 });
    ok('payee settings persist', payeeAfter.upiId === 'ok@okbank');
    const ac = new C.AdminCommerceController(w.payee, w.deals, w.invAdmin, w.manual, w.promos, w.terms, w.planChanges, w.renewal, w.prisma, w.audit);
    const out = await ac.createInvoice({ ...stepSpec(), activateNow: false }, { sub: 'admin1', email: ADMIN.email, role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' });
    ok('the create-invoice API response has the link ONCE and no hash inside the invoice object', /\/pay\//.test(out.payLink) && !('payTokenHash' in out.invoice) && !JSON.stringify(out.invoice).includes(tokenOf(out.payLink)));
  }

  section('PROMO CODES through the real pay flow (server-side recompute)');
  {
    const w = world();
    const LIST6 = M.planListPaise(1198800, 6); // 659340: 55% of the annual list
    const sp = (o = {}) => stepSpec({ discount: { mode: 'NONE' }, ...o });
    const WITH_GST = (n) => n + Math.round(n * 0.18);
    await w.promos.create({ code: 'diwali10', type: 'PERCENT', value: 10, minCycleMonths: 6, appliesToPlans: ['WORKSPACE'] }, ADMIN);
    await w.promos.create({ code: 'bosonly', type: 'PERCENT', value: 50, appliesToPlans: ['BOS'] }, ADMIN);
    await w.promos.create({ code: 'once', type: 'FLAT', value: 50000, maxRedemptions: 1 }, ADMIN);
    const r = await w.deals.createInvoice(sp({ gstMode: 'EXCLUSIVE', allowPromoEntry: true }), ADMIN, {});
    let ctx = await w.pay.loadByToken(tokenOf(r.payLink));
    ok('before: list ₹6,593.40 + 18% GST', ctx.invoice.totalAmount === WITH_GST(LIST6));
    await rejects('unknown code', w.pay.applyPromo(ctx, 'NOPE123', '1.1.1.1'), { status: 400 });
    await rejects('a plan-restricted code is rejected on the wrong plan', w.pay.applyPromo(ctx, 'BOSONLY', '1.1.1.1'), { status: 400 });
    const a = await w.pay.applyPromo(ctx, ' Diwali10 ', '1.1.1.1');
    ctx = await w.pay.loadByToken(tokenOf(r.payLink));
    const off = Math.round(LIST6 * 0.1);
    const net = LIST6 - off;
    ok('case-insensitive code applies; GST recomputed on the discounted net (₹5,394.60 + GST)', a.applied && ctx.invoice.discountPaise === off && ctx.invoice.amount === net && ctx.invoice.gstAmount === Math.round(net * 0.18) && ctx.invoice.totalAmount === net + Math.round(net * 0.18), JSON.stringify({ d: ctx.invoice.discountPaise, t: ctx.invoice.totalAmount }));
    ok('NO redemption is recorded while the invoice is unpaid', rows(w, 'promoRedemption').length === 0);
    await rejects('a second promo on the same invoice is rejected', w.pay.applyPromo(ctx, 'ONCE', '1.1.1.1'), { status: 400 });
    await w.pay.removePromo(ctx);
    ctx = await w.pay.loadByToken(tokenOf(r.payLink));
    ok('removing the promo restores the original total', ctx.invoice.totalAmount === WITH_GST(LIST6) && ctx.invoice.discountPaise === 0 && ctx.invoice.promoCodeId === null);
    await w.pay.applyPromo(ctx, 'DIWALI10', '1.1.1.1');
    ctx = await w.pay.loadByToken(tokenOf(r.payLink));
    await w.settlement.applyPayment(ctx.invoice.id, { amountPaise: ctx.invoice.totalAmount, via: 'OFFLINE', actor: ADMIN });
    ok('redemption is recorded ONLY when the invoice reaches PAID', rows(w, 'promoRedemption').length === 1 && rows(w, 'promoRedemption')[0].discountPaise === off && rows(w, 'promoRedemption')[0].invoiceId === ctx.invoice.id);
    await rejects('a PAID invoice cannot take a promo', w.pay.applyPromo(await w.pay.loadByToken(tokenOf(r.payLink)), 'ONCE', '1.1.1.1'), { status: 400 });
    // per-vendor limit: a second invoice for the same vendor
    const r2 = await w.deals.createInvoice(sp({ gstMode: 'EXCLUSIVE', allowPromoEntry: true, kind: 'ADDON', planKey: undefined, billingCycle: undefined, addons: [{ kind: 'CUSTOM', label: 'Setup', amountPaise: 500000 }] }), ADMIN, {});
    await rejects('per-vendor limit: the same vendor cannot reuse a once-per-vendor code', w.pay.applyPromo(await w.pay.loadByToken(tokenOf(r2.payLink)), 'DIWALI10', '2.2.2.2'), { status: 400 });
    await w.pay.applyPromo(await w.pay.loadByToken(tokenOf(r2.payLink)), 'ONCE', '2.2.2.2');
    await w.settlement.applyPayment(rows(w, 'invoice')[1].id, { amountPaise: rows(w, 'invoice')[1].totalAmount, via: 'OFFLINE', actor: ADMIN });
    const r3 = await w.deals.createInvoice({ ...sp({ gstMode: 'EXCLUSIVE', allowPromoEntry: true, kind: 'ADDON', planKey: undefined, billingCycle: undefined, addons: [{ kind: 'CUSTOM', label: 'Setup', amountPaise: 500000 }] }), vendorId: 'v_other' }, ADMIN, {});
    await rejects('global redemption cap: a 1-use code is exhausted after one PAID redemption', w.pay.applyPromo(await w.pay.loadByToken(tokenOf(r3.payLink)), 'ONCE', '3.3.3.3'), { status: 400 });
    // not allowed on this invoice
    const r4 = await w.deals.createInvoice(sp({ allowPromoEntry: false }), ADMIN, {});
    await rejects('promo entry is refused when the invoice does not allow it', w.pay.applyPromo(await w.pay.loadByToken(tokenOf(r4.payLink)), 'DIWALI10', '4.4.4.4'), { status: 403 });
    // stacking
    await w.promos.create({ code: 'stack10', type: 'PERCENT', value: 10, perVendorLimit: 5 }, ADMIN);
    const r5 = await w.deals.createInvoice(sp({ allowPromoEntry: true, discount: { mode: 'PERCENT', value: 5, reason: 'repeat client' } }), ADMIN, { overrideReason: OVERRIDE });
    await rejects('NO stacking on an admin discount by default', w.pay.applyPromo(await w.pay.loadByToken(tokenOf(r5.payLink)), 'STACK10', '5.5.5.5'), { status: 400 });
    const r6 = await w.deals.createInvoice(sp({ allowPromoEntry: true, allowPromoStacking: true, discount: { mode: 'PERCENT', value: 5, reason: 'repeat client' } }), ADMIN, { overrideReason: OVERRIDE });
    const stacked = await w.pay.applyPromo(await w.pay.loadByToken(tokenOf(r6.payLink)), 'STACK10', '6.6.6.6');
    ok('stacking works when the admin allowed it (5% + 10% off the subtotal)', stacked.applied && (await w.pay.loadByToken(tokenOf(r6.payLink))).invoice.discountPaise === Math.round(LIST6 * 0.05) + Math.round(LIST6 * 0.1));
    // throttled attempts
    const r7 = await w.deals.createInvoice(sp({ allowPromoEntry: true }), ADMIN, { overrideReason: OVERRIDE });
    const c7 = await w.pay.loadByToken(tokenOf(r7.payLink));
    for (let i = 0; i < 6; i += 1) { try { await w.pay.applyPromo(c7, `BADCODE${i}`, '7.7.7.7'); } catch { /* expected */ } }
    await rejects('brute-forcing codes is throttled (429) after repeated failures — even a VALID code is refused while throttled', w.pay.applyPromo(c7, 'STACK10', '7.7.7.7'), { status: 429 });
    const pid = rows(w, 'promoCode').find((x) => x.code === 'DIWALI10').id;
    await w.promos.update(pid, { value: 99, type: 'FLAT', active: false }, ADMIN);
    const after = rows(w, 'promoCode').find((x) => x.id === pid);
    ok('promo type/value are IMMUTABLE after creation (an applied-but-unpaid invoice must keep its discount); other fields can change', after.value === 10 && after.type === 'PERCENT' && after.active === false);
    const pipe2 = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    await rejects('…and the update API does not even accept value/type', pipe2.transform({ value: 5 }, { type: 'body', metatype: DTO.PromoUpdateDto }), { status: 400 });
  }

  section('ENTITLEMENTS depend on planKey, never on price; ₹0 deals settle themselves');
  {
    const w = world();
    const r = await w.deals.createInvoice(stepSpec({ planKey: 'BOS', billingCycle: 'ANNUAL', gstMode: 'NONE', discount: { mode: 'FLAT', value: 2398799, reason: 'symbolic ₹0.01 partner deal', confirm: 'CONFIRM' } }), ADMIN, {});
    const inv = rows(w, 'invoice')[0];
    ok('a BOS annual deal for ₹0.01 is created', inv.totalAmount === 1);
    await w.settlement.applyPayment(inv.id, { amountPaise: 1, via: 'OFFLINE', actor: ADMIN });
    const sub = rows(w, 'subscription')[0];
    ok('…and the vendor gets FULL BOS entitlements (4 theme changes, ₹1,299 credit, BOS term)', sub.themeChangesLimit === 4 && rows(w, 'walletTransaction').find((x) => x.service === 'ai_studio_bonus').amount === 129900 && rows(w, 'billingTerm')[0].planKey === 'BOS');
    const w2 = world();
    await w2.deals.createInvoice(stepSpec({ discount: { mode: 'PERCENT', value: 100, reason: 'free pilot', confirm: 'CONFIRM' } }), ADMIN, {});
    ok('a 100%-discount (₹0) invoice settles itself and activates the plan', rows(w2, 'invoice')[0].status === 'PAID' && rows(w2, 'invoice')[0].totalAmount === 0 && rows(w2, 'billingTerm')[0]?.status === 'ACTIVE' && rows(w2, 'subscription')[0].themeChangesLimit === 2);
    const dec = decidePayment({ status: 'SENT', totalAmount: 1000, paidPaise: 0 }, 1000);
    ok('decidePayment: exact → PAID; partial → PARTIALLY_PAID; over → PAID + overpayment', dec.newStatus === 'PAID' && decidePayment({ status: 'SENT', totalAmount: 1000, paidPaise: 0 }, 400).newStatus === 'PARTIALLY_PAID' && decidePayment({ status: 'SENT', totalAmount: 1000, paidPaise: 0 }, 1300).overpaymentPaise === 300);
    ok('decidePayment rejects VOID / DRAFT / EXPIRED / already PAID invoices', ['VOID', 'DRAFT', 'EXPIRED', 'PAID'].every((s) => decidePayment({ status: s, totalAmount: 1000, paidPaise: 0 }, 1000).action === 'reject'));
  }

  section('PROSPECT deal: a new prospect + demo subdomain goes live only when paid');
  {
    const w = world();
    const r = await w.deals.createInvoice({
      prospect: { name: 'Anita Rao', phone: '9811111111', email: 'anita@acme.in', business: 'Acme Tours', demoSubdomain: 'acme-demo' },
      planKey: 'BOS', billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE', allowedChannels: ['RAZORPAY'],
    }, ADMIN, {});
    const v = rows(w, 'vendor').find((x) => x.subdomain === 'acme-demo');
    ok('a pre-sale vendor row is created: hidden (isSandbox) and never auto-deleted (no expiry)', v && v.isSandbox === true && v.expiresAt === null && v.businessName === 'Acme Tours');
    const before = v.password;
    await w.settlement.applyPayment(rows(w, 'invoice')[0].id, { amountPaise: rows(w, 'invoice')[0].totalAmount, via: 'OFFLINE', actor: ADMIN });
    const after = rows(w, 'vendor').find((x) => x.subdomain === 'acme-demo');
    ok('on payment the demo site flips LIVE (isSandbox=false, ACTIVE)', after.isSandbox === false && after.status === 'ACTIVE');
    ok('…and the owner receives a first password (hash changed, welcome email sent)', after.password !== before && w.email.calls.some((c) => c.fn === 'sendWelcomeEmail'));
    await rejects('an invalid demo subdomain is refused', w.deals.createInvoice({ prospect: { name: 'X', email: 'x@y.in', business: 'Y', demoSubdomain: 'ADMIN' }, planKey: 'BOS', billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE', allowedChannels: ['RAZORPAY'] }, ADMIN, {}), { status: 400 });
    const vendorsBefore = rows(w, 'vendor').length;
    await rejects('[feat:account.billing.arrangements] a NEW prospect cannot get a half-year, no-GST or manual-QR deal (no client, so no arrangement) and no vendor is created for the refused deal', w.deals.createInvoice({ prospect: { name: 'Z', email: 'z@acme.in', business: 'Zed', demoSubdomain: 'zed-demo' }, planKey: 'BOS', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', allowedChannels: ['RAZORPAY', 'UPI_QR'] }, ADMIN, {}), { status: 400 });
    ok('…the refused prospect deal created no vendor row', rows(w, 'vendor').length === vendorsBefore);
    await rejects('a prospect without an email is refused', w.deals.createInvoice({ prospect: { name: 'X', business: 'Y' }, planKey: 'BOS', billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE', allowedChannels: ['RAZORPAY'] }, ADMIN, {}), { status: 400 });
  }

  section('RENEWAL ENGINE: T-15 invoice, reminders, extend-from-periodEnd, no lost days');
  {
    const w = world();
    const T0 = d('2026-10-07T06:00:00Z');
    const r = await w.deals.createInvoice(stepSpec({ allowedChannels: ['RAZORPAY'] }), ADMIN, {});
    const actInv = rows(w, 'invoice')[0];
    await w.settlement.applyPayment(actInv.id, { amountPaise: actInv.totalAmount, via: 'OFFLINE', actor: ADMIN, now: T0 });
    const t1 = rows(w, 'billingTerm').find((t) => t.isCurrent);
    ok('activation term ACTIVE, 6 months from payment', t1.status === 'ACTIVE' && t1.periodStart.getTime() === T0.getTime() && t1.periodEnd.toISOString().startsWith('2027-04-07'), t1.periodEnd.toISOString());
    const sent0 = w.email.calls.filter((c) => c.fn === 'sendGeneric').length;

    let s = await w.renewal.runOnce(d('2027-03-22T00:00:00Z'));
    ok('T-16: nothing happens', s.invoicesCreated === 0 && s.reminders === 0, JSON.stringify(s));
    s = await w.renewal.runOnce(d('2027-03-23T00:00:00Z'));
    const renewals = rows(w, 'invoice').filter((i) => i.kind === 'RENEWAL');
    ok('T-15: exactly ONE renewal invoice, same net (₹5,994 NONE), SENT, linked to the term, link emailed', s.invoicesCreated === 1 && renewals.length === 1 && renewals[0].totalAmount === 599400 && renewals[0].status === 'SENT' && renewals[0].termId === t1.id && rows(w, 'billingTerm').find((t) => t.id === t1.id).renewalInvoiceId === renewals[0].id, JSON.stringify({ s, n: renewals.length, tot: renewals[0] && renewals[0].totalAmount, st: renewals[0] && renewals[0].status, termId: renewals[0] && renewals[0].termId, t1: t1.id, link: rows(w, 'billingTerm').find((t) => t.id === t1.id).renewalInvoiceId, rid: renewals[0] && renewals[0].id }));
    ok('the renewal period starts at the OLD periodEnd', renewals[0].periodStart.toISOString().startsWith('2027-04-07') && renewals[0].periodEnd.toISOString().startsWith('2027-10-07'));
    const afterT15 = w.email.calls.filter((c) => c.fn === 'sendGeneric').length;
    ok('T-15 sent one message set', afterT15 > sent0);
    s = await w.renewal.runOnce(d('2027-03-23T12:00:00Z'));
    ok('running the job AGAIN the same day creates nothing and sends nothing (idempotent)', s.invoicesCreated === 0 && s.reminders === 0 && rows(w, 'invoice').filter((i) => i.kind === 'RENEWAL').length === 1 && w.email.calls.filter((c) => c.fn === 'sendGeneric').length === afterT15);
    s = await w.renewal.runOnce(d('2027-03-31T00:00:00Z'));
    ok('T-7 reminder sent once', s.reminders === 1, JSON.stringify(s));
    s = await w.renewal.runOnce(d('2027-04-06T00:00:00Z'));
    ok('T-1 reminder sent once', s.reminders === 1, JSON.stringify(s));
    ok('exactly T15, T7, T1 were recorded as sent', Object.keys(rows(w, 'billingTerm').find((t) => t.id === t1.id).reminders).sort().join() === 'T1,T15,T7');
    ok('a second concurrent run is a no-op (advisory lock)', (await Promise.all([w.renewal.runOnce(d('2027-04-06T00:00:00Z')), w.renewal.runOnce(d('2027-04-06T00:00:00Z'))])).filter((x) => x.ran).length >= 1);

    // EARLY payment of the renewal (5 Apr): the new term must start at the OLD end (7 Apr) — no lost days
    await w.settlement.applyPayment(renewals[0].id, { amountPaise: renewals[0].totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2027-04-05T10:00:00Z') });
    const terms = rows(w, 'billingTerm').sort((a, b) => a.createdAt - b.createdAt);
    const cur = terms.find((t) => t.isCurrent);
    ok('renewal paid early: NEW term row, period 7 Apr 2027 → 7 Oct 2027 (extends from previous periodEnd)', terms.length === 2 && cur.id !== t1.id && cur.periodStart.toISOString().startsWith('2027-04-07') && cur.periodEnd.toISOString().startsWith('2027-10-07') && cur.status === 'ACTIVE', JSON.stringify(cur));
    ok('history kept: the old term is retired (isCurrent=false), not edited', terms.find((t) => t.id === t1.id).isCurrent === false && terms.find((t) => t.id === t1.id).periodEnd.toISOString().startsWith('2027-04-07'));
    ok('the one-time AI credit is NOT granted again on renewal', rows(w, 'walletTransaction').filter((x) => x.service === 'ai_studio_bonus').length === 1);
    ok('the subscription (theme counter) end date follows the term, reset date stays yearly', rows(w, 'subscription')[0].endDate.toISOString().startsWith('2027-10-07') && rows(w, 'subscription')[0].themeChangesResetAt.toISOString().startsWith('2027-10-07'));
    s = await w.renewal.runOnce(d('2027-04-10T00:00:00Z'));
    ok('after renewal no new invoice/reminder until the next window', s.invoicesCreated === 0 && s.reminders === 0);
  }

  section('LAPSE: after periodEnd + grace — blocks publish/messaging/AI, deletes NOTHING, payment lifts it');
  {
    const w = world();
    const r = await w.deals.createInvoice(stepSpec({ allowedChannels: ['RAZORPAY'], graceDays: 7 }), ADMIN, {});
    const inv0 = rows(w, 'invoice')[0];
    await w.settlement.applyPayment(inv0.id, { amountPaise: inv0.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-10-07T06:00:00Z') });
    const end = rows(w, 'billingTerm').find((t) => t.isCurrent).periodEnd; // 2027-04-07
    const snapshot = { products: rows(w, 'vendorProduct').length, contacts: rows(w, 'contact').length, vendors: rows(w, 'vendor').length, wallet: rows(w, 'wallet')[0].balance, invoices: rows(w, 'invoice').length };
    await w.renewal.runOnce(d('2027-03-23T00:00:00Z'));
    let s = await w.renewal.runOnce(new Date(end.getTime() + 7 * 86400000 - 1000));
    ok('inside the grace period (1s before periodEnd+7d): still ACTIVE', rows(w, 'billingTerm').find((t) => t.isCurrent).status === 'ACTIVE' && s.lapsed === 0);
    s = await w.renewal.runOnce(new Date(end.getTime() + 7 * 86400000 + 1000));
    const lapsed = rows(w, 'billingTerm').find((t) => t.isCurrent);
    ok('1s after periodEnd + grace: term LAPSED, lapse timestamp set', s.lapsed === 1 && lapsed.status === 'LAPSED' && lapsed.lapsedAt instanceof Date);
    ok('LAPSE DELETES NOTHING (products, contacts, vendor, wallet balance, invoices all intact)', rows(w, 'vendorProduct').length === snapshot.products && rows(w, 'contact').length === snapshot.contacts && rows(w, 'vendor').length === snapshot.vendors && rows(w, 'wallet')[0].balance === snapshot.wallet && rows(w, 'invoice').length >= snapshot.invoices);
    ok('the vendor account stays ACTIVE (login and read access preserved)', rows(w, 'vendor')[0].status === 'ACTIVE');
    await rejects('LAPSED: AI Studio spend is blocked', w.wallet.deduct('v_step', 500, 'AI content', 'ai_content_social'), { status: 403 });
    await rejects('LAPSED: messaging spend is blocked', w.wallet.deduct('v_step', 100, 'WhatsApp', 'comm_whatsapp'), { status: 403 });
    ok('LAPSED: a domain purchase is NOT gated (separate service)', WalletService.gatedActionFor('domain_registration') === null);
    const cms = new CmsService(w.prisma, w.gate);
    await rejects('LAPSED: publishing website changes is blocked', cms.updateVendorCMS('v_step', { businessName: 'New name' }), { status: 403 });
    ok('read access is untouched (gate only guards actions)', (await w.gate.isLapsed('v_step')) === true);
    ok('a vendor with NO billing term is never gated', (await w.gate.isLapsed('v_other')) === false);

    const renewalInv = rows(w, 'invoice').find((i) => i.kind === 'RENEWAL');
    await w.settlement.applyPayment(renewalInv.id, { amountPaise: renewalInv.totalAmount, via: 'OFFLINE', actor: ADMIN, now: new Date(end.getTime() + 9 * 86400000) });
    ok('a payment lifts the lapse INSTANTLY: new term ACTIVE', rows(w, 'billingTerm').find((t) => t.isCurrent).status === 'ACTIVE');
    const deducted = await w.wallet.deduct('v_step', 100, 'AI content', 'ai_content_social');
    ok('…and AI Studio spend works again immediately', deducted.balance === snapshot.wallet - 100);
  }
  {
    const w = world();
    await w.deals.createInvoice(stepSpec({ paymentDueDays: 3, graceDays: 2 }), ADMIN, { activateNow: true });
    await w.renewal.runOnce(new Date(Date.now() + 6 * 86400000));
    ok('"activate now" left unpaid past due + grace → LAPSED', rows(w, 'billingTerm')[0].status === 'LAPSED');
    const inv = rows(w, 'invoice')[0];
    await w.settlement.applyPayment(inv.id, { amountPaise: inv.totalAmount, via: 'OFFLINE', actor: ADMIN });
    ok('paying the original activation invoice reinstates the SAME term (ACTIVE, no duplicate term)', rows(w, 'billingTerm').length === 1 && rows(w, 'billingTerm')[0].status === 'ACTIVE' && rows(w, 'billingTerm')[0].lapsedAt === null);
  }

  section('PLAN CHANGES: downgrade only at renewal; upgrade now with proration credit; no cash refunds');
  {
    const w = world();
    const r = await w.deals.createInvoice(stepSpec({ planKey: 'BOS', billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE' }), ADMIN, {});
    const a = rows(w, 'invoice')[0];
    const T0 = d('2026-10-07T00:00:00Z');
    await w.settlement.applyPayment(a.id, { amountPaise: a.totalAmount, via: 'OFFLINE', actor: ADMIN, now: T0 });
    const term = rows(w, 'billingTerm').find((t) => t.isCurrent);
    await rejects('requesting the plan you already have is refused', w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL' }), { status: 400 });
    const down = await w.planChanges.request('v_step', { toPlanKey: 'WORKSPACE', toCycle: 'ANNUAL', effective: 'NOW', note: 'cheaper please' });
    ok('a downgrade requested for NOW is forced to AT_RENEWAL', down.effective === 'AT_RENEWAL');
    await rejects('only one open request at a time', w.planChanges.request('v_step', { toPlanKey: 'WORKSPACE', toCycle: 'MONTHLY' }), { status: 409 });
    await rejects('admin cannot approve a downgrade for NOW', w.planChanges.approve(down.id, { effective: 'NOW' }, ADMIN, d('2027-01-01T00:00:00Z')), { status: 400 });
    const ok1 = await w.planChanges.approve(down.id, { effective: 'AT_RENEWAL', adminNote: 'ok' }, ADMIN, d('2027-01-01T00:00:00Z'));
    const sched = rows(w, 'billingTerm').find((t) => t.isCurrent);
    ok('approved at renewal: nothing charged now; the change is scheduled on the term', ok1.invoiceId === null && sched.scheduledNextPlan === 'WORKSPACE' && sched.scheduledNextCycle === 'ANNUAL' && rows(w, 'invoice').length === 1);
    await w.renewal.runOnce(d('2027-09-22T00:00:00Z'));
    const ren = rows(w, 'invoice').find((i) => i.kind === 'RENEWAL');
    ok('the T-15 renewal invoice uses the SCHEDULED plan at LIST price (Workspace ₹11,988 + GST)', ren.planKey === 'WORKSPACE' && ren.amount === 1198800 && ren.totalAmount === 1198800 + Math.round(1198800 * 0.18), JSON.stringify({ p: ren.planKey, a: ren.amount }));
    await w.settlement.applyPayment(ren.id, { amountPaise: ren.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2027-10-01T00:00:00Z') });
    const nt = rows(w, 'billingTerm').find((t) => t.isCurrent);
    ok('after paying: term is WORKSPACE, scheduled fields cleared, request APPLIED', nt.planKey === 'WORKSPACE' && nt.scheduledNextPlan === null && rows(w, 'planChangeRequest')[0].status === 'APPLIED');
    ok('theme allowance follows the new plan (2/yr)', rows(w, 'subscription')[0].themeChangesLimit === 2);
  }
  {
    const w = world();
    await w.deals.createInvoice(stepSpec({ planKey: 'WORKSPACE', billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE', discount: { mode: 'FLAT', value: 198800, reason: 'founding customer' } }), ADMIN, {});
    const a = rows(w, 'invoice')[0]; // net = 1198800-198800 = 1,000,000 (₹10,000)
    await w.settlement.applyPayment(a.id, { amountPaise: a.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-01-01T00:00:00Z') });
    const term = rows(w, 'billingTerm').find((t) => t.isCurrent);
    ok('term net recorded as the discounted ₹10,000', term.netAmountPaise === 1000000);
    const req = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'NOW' });
    const now = d('2026-04-11T00:00:00Z'); // 100 days in → 265 unused of 365
    const res = await w.planChanges.approve(req.id, { effective: 'NOW' }, ADMIN, now);
    const credit = M.prorationCreditPaise(term, now);
    const inv = rows(w, 'invoice').find((i) => i.kind === 'PLAN_CHANGE');
    ok('upgrade NOW: PLAN_CHANGE invoice = BOS list price − proration credit (unused days × daily net rate)', res.invoiceId === inv.id && res.prorationCreditPaise === credit && inv.amount === 2398800 - credit, JSON.stringify({ credit, amt: inv.amount }));
    ok('the credit is a visible CREDIT line on the new invoice', inv.lineItems.some((l) => l.kind === 'CREDIT' && l.amountPaise === -credit));
    ok('credit is computed from the term\'s NET amount, not the list price', credit === Math.round((1000000 * 265) / 365) && credit === 726027, String(credit));
    await w.settlement.applyPayment(inv.id, { amountPaise: inv.totalAmount, via: 'OFFLINE', actor: ADMIN, now });
    const nt = rows(w, 'billingTerm').find((t) => t.isCurrent);
    ok('after paying: BOS from NOW (fresh 12-month period), entitlements upgraded, request APPLIED', nt.planKey === 'BOS' && nt.periodStart.getTime() === now.getTime() && nt.periodEnd.toISOString().startsWith('2027-04-11') && rows(w, 'subscription')[0].themeChangesLimit === 4 && rows(w, 'planChangeRequest')[0].status === 'APPLIED');
    ok('no cash refund exists anywhere — the credit only reduces the new invoice', rows(w, 'platformIncome').every((x) => x.amount > 0));
    const r2 = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'MONTHLY' }); // same plan, different cycle is allowed
    await w.planChanges.reject(r2.id, 'Not available on your deal', ADMIN);
    ok('rejecting a request notifies the vendor with the reason', rows(w, 'planChangeRequest').find((x) => x.id === r2.id).status === 'REJECTED' && JSON.stringify(w.email.calls).includes('Not available on your deal'));
  }
  {
    const w = world();
    await w.deals.createInvoice(stepSpec({ planKey: 'WORKSPACE', billingCycle: 'MONTHLY', gstMode: 'NONE' }), ADMIN, {});
    const a = rows(w, 'invoice')[0];
    await w.settlement.applyPayment(a.id, { amountPaise: a.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-10-07T00:00:00Z') });
    const req = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'NOW' });
    const res = await w.planChanges.approve(req.id, { effective: 'NOW' }, ADMIN, d('2026-10-08T00:00:00Z'));
    const inv = rows(w, 'invoice').find((i) => i.kind === 'PLAN_CHANGE');
    ok('the credit can never exceed the new plan price (no negative invoice)', inv.totalAmount >= 0 && res.prorationCreditPaise <= 2398800);
  }

  section('PLAN-CHANGE PRICE: default = list; editable net price with reason; renewal bills that price');
  {
    const LIST_WS = 1198800, LIST_BOS = 2398800;
    const setup = async (over = {}) => {
      const w = world();
      await w.deals.createInvoice(stepSpec({ planKey: 'WORKSPACE', billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE', ...over }), ADMIN, {});
      const a = rows(w, 'invoice')[0];
      await w.settlement.applyPayment(a.id, { amountPaise: a.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-01-01T00:00:00Z') });
      return w;
    };
    const cur = (w) => rows(w, 'billingTerm').find((t) => t.isCurrent);
    const audits = (w, action) => rows(w, 'commercialAuditLog').filter((x) => x.action === action);

    // — default: no override → list price, no override audit —
    {
      const w = await setup();
      const req = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'AT_RENEWAL' });
      const q = (await w.planChanges.queue('REQUESTED'))[0];
      ok('the admin queue quotes the server-side LIST price (BOS annual ₹23,988) and the credit an immediate change would earn today', q.quote.listPaise === LIST_BOS && q.quote.creditIfNowPaise === Math.min(M.prorationCreditPaise(cur(w), new Date()), LIST_BOS), JSON.stringify(q.quote));
      const res = await w.planChanges.approve(req.id, { effective: 'AT_RENEWAL' }, ADMIN, d('2026-06-01T00:00:00Z'));
      const row = rows(w, 'planChangeRequest')[0];
      ok('DEFAULT: approved net = list, no discount, no reason stored', res.approvedNetPaise === LIST_BOS && row.listPaise === LIST_BOS && row.approvedNetPaise === LIST_BOS && row.discountReason === null && res.overridden === false);
      ok('DEFAULT: nothing is stored on the term and no override audit row is written', cur(w).scheduledNextNetPaise === null && audits(w, 'planchange.price_override').length === 0);
      await w.renewal.runOnce(d('2026-12-17T00:00:00Z'));
      const ren = rows(w, 'invoice').find((i) => i.kind === 'RENEWAL');
      ok('DEFAULT: the renewal after the change bills the BOS list price (₹23,988 + 18% GST)', ren.planKey === 'BOS' && ren.amount === LIST_BOS && ren.discountPaise === 0 && ren.totalAmount === LIST_BOS + Math.round(LIST_BOS * 0.18), JSON.stringify({ a: ren.amount, d: ren.discountPaise }));
    }

    // — override at renewal: validation, audit, renewal amount, and it sticks for later renewals —
    {
      const w = await setup();
      const req = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'AT_RENEWAL' });
      const tryApprove = (b) => w.planChanges.approve(req.id, { effective: 'AT_RENEWAL', ...b }, ADMIN, d('2026-06-01T00:00:00Z'));
      await rejects('a lower price without a reason is refused', tryApprove({ netPaise: 2000000 }), { status: 400, includes: 'reason' });
      await rejects('a price above the list price is refused (this is a discount, not a mark-up)', tryApprove({ netPaise: LIST_BOS + 1, discountReason: 'x y z' }), { status: 400, includes: 'higher than the list' });
      await rejects('a negative price is refused', tryApprove({ netPaise: -5, discountReason: 'loyal' }), { status: 400 });
      await rejects('a fractional paise price is refused', tryApprove({ netPaise: 1000.5, discountReason: 'loyal' }), { status: 400 });
      await rejects('a non-numeric price is refused', tryApprove({ netPaise: 'free', discountReason: 'loyal' }), { status: 400 });
      await rejects('more than 20% off needs CONFIRM', tryApprove({ netPaise: 1800000, discountReason: 'loyal customer' }), { status: 400, includes: 'CONFIRM' });
      await rejects('a wrong confirmation word is not accepted', tryApprove({ netPaise: 1800000, discountReason: 'loyal customer', confirm: 'yes' }), { status: 400, includes: 'CONFIRM' });
      ok('every refused attempt left the request untouched (still REQUESTED, nothing scheduled, no audit row)', rows(w, 'planChangeRequest')[0].status === 'REQUESTED' && cur(w).scheduledNextPlan === null && audits(w, 'planchange.price_override').length === 0);

      const res = await tryApprove({ netPaise: 1800000, discountReason: 'loyal customer', confirm: 'CONFIRM' });
      const row = rows(w, 'planChangeRequest')[0];
      ok('OVERRIDE approved: list, net and reason are stored on the request', res.approvedNetPaise === 1800000 && row.listPaise === LIST_BOS && row.approvedNetPaise === 1800000 && row.discountReason === 'loyal customer' && row.status === 'APPROVED');
      const au = audits(w, 'planchange.price_override');
      ok('the override is audit-logged with who, list, net and reason', au.length === 1 && au[0].actor === ADMIN.email && au[0].detail.listPaise === LIST_BOS && au[0].detail.approvedNetPaise === 1800000 && au[0].detail.discountReason === 'loyal customer', JSON.stringify(au[0]));
      ok('the approved net is carried on the term for the renewal job', cur(w).scheduledNextNetPaise === 1800000 && cur(w).scheduledNextDiscountReason === 'loyal customer');

      await w.renewal.runOnce(d('2026-12-17T00:00:00Z'));
      const ren = rows(w, 'invoice').find((i) => i.kind === 'RENEWAL');
      ok('RENEWAL INVOICE bills the approved price: taxable ₹18,000, GST 18% on that, total ₹21,240', ren.planKey === 'BOS' && ren.amount === 1800000 && ren.gstAmount === 324000 && ren.totalAmount === 2124000, JSON.stringify({ a: ren.amount, g: ren.gstAmount, t: ren.totalAmount }));
      ok('the renewal invoice shows list, discount and the reason', ren.listAmountPaise === LIST_BOS && ren.discountPaise === LIST_BOS - 1800000 && ren.discountReason === 'loyal customer' && ren.lineItems.length === 1);
      await w.settlement.applyPayment(ren.id, { amountPaise: ren.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-12-20T00:00:00Z') });
      const nt = cur(w);
      ok('after paying: BOS term whose price IS the approved net (list kept, discount recorded), schedule cleared', nt.planKey === 'BOS' && nt.netAmountPaise === 1800000 && nt.listAmountPaise === LIST_BOS && nt.discountPaise === LIST_BOS - 1800000 && nt.scheduledNextNetPaise === null && rows(w, 'planChangeRequest')[0].status === 'APPLIED');
      await w.renewal.runOnce(d('2027-12-17T00:00:00Z'));
      const ren2 = rows(w, 'invoice').filter((i) => i.kind === 'RENEWAL')[1];
      ok('the NEXT renewal (a year later) still bills the approved ₹18,000 — the price sticks', Boolean(ren2) && ren2.amount === 1800000 && ren2.totalAmount === 2124000, JSON.stringify(ren2 && { a: ren2.amount }));
    }

    // — override NOW: proration credit + approved price; renewal afterwards bills the price, not price-minus-credit —
    {
      const w = await setup();
      const term = cur(w);
      const req = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'NOW' });
      const now = d('2026-04-11T00:00:00Z');
      const credit = M.prorationCreditPaise(term, now);
      ok('queue quotes the credit an immediate change would earn (unused days × daily net)', (await w.planChanges.queue('REQUESTED'))[0].quote.listPaise === LIST_BOS && credit === Math.round((LIST_WS * 265) / 365), String(credit));
      const res = await w.planChanges.approve(req.id, { effective: 'NOW', netPaise: 2000000, discountReason: 'founding customer' }, ADMIN, now);
      const inv = rows(w, 'invoice').find((i) => i.kind === 'PLAN_CHANGE');
      const taxable = 2000000 - credit;
      ok('NOW + override: invoice taxable = approved net − proration credit', inv.amount === taxable && res.prorationCreditPaise === credit && res.approvedNetPaise === 2000000, JSON.stringify({ a: inv.amount, taxable, credit }));
      ok('GST is on that net-after-credit amount only', inv.gstAmount === Math.round(taxable * 0.18) && inv.totalAmount === taxable + Math.round(taxable * 0.18));
      ok('the invoice shows PLAN at list, the CREDIT line, and the discount with its reason', inv.lineItems.some((l) => l.kind === 'PLAN' && l.amountPaise === LIST_BOS) && inv.lineItems.some((l) => l.kind === 'CREDIT' && l.amountPaise === -credit) && inv.discountPaise === LIST_BOS - 2000000 && inv.discountReason === 'founding customer');
      ok('the override is audit-logged against the vendor with the new invoice id', audits(w, 'planchange.price_override').length === 1 && audits(w, 'planchange.price_override')[0].detail.invoiceId === inv.id);
      await w.settlement.applyPayment(inv.id, { amountPaise: inv.totalAmount, via: 'OFFLINE', actor: ADMIN, now });
      const nt = cur(w);
      ok('after paying: the term price is the approved ₹20,000 — the ONE-TIME credit did not leak into it', nt.planKey === 'BOS' && nt.netAmountPaise === 2000000 && nt.listAmountPaise === LIST_BOS && nt.discountPaise === LIST_BOS - 2000000, JSON.stringify({ n: nt.netAmountPaise, l: nt.listAmountPaise }));
      await w.renewal.runOnce(d('2027-03-27T00:00:00Z'));
      const ren = rows(w, 'invoice').find((i) => i.kind === 'RENEWAL');
      ok('RENEWAL after the change bills the approved price (₹20,000 + GST), not price minus the old credit', Boolean(ren) && ren.amount === 2000000 && ren.totalAmount === 2360000, JSON.stringify(ren && { a: ren.amount }));
    }

    // — default NOW (no override): same leak regression, plus plain list pricing —
    {
      const w = await setup();
      const req = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'NOW' });
      const now = d('2026-04-11T00:00:00Z');
      const credit = M.prorationCreditPaise(cur(w), now);
      const res = await w.planChanges.approve(req.id, { effective: 'NOW' }, ADMIN, now);
      const inv = rows(w, 'invoice').find((i) => i.kind === 'PLAN_CHANGE');
      ok('NOW default: invoice = list − credit; no discount, no override audit', inv.amount === LIST_BOS - credit && inv.discountPaise === 0 && res.overridden === false && audits(w, 'planchange.price_override').length === 0);
      await w.settlement.applyPayment(inv.id, { amountPaise: inv.totalAmount, via: 'OFFLINE', actor: ADMIN, now });
      ok('NOW default: the term price is the full list price (the credit is not baked in)', cur(w).netAmountPaise === LIST_BOS && cur(w).listAmountPaise === LIST_BOS && cur(w).discountPaise === 0);
      await w.renewal.runOnce(d('2027-03-27T00:00:00Z'));
      const ren = rows(w, 'invoice').find((i) => i.kind === 'RENEWAL');
      ok('NOW default: the renewal bills the full BOS list price', Boolean(ren) && ren.amount === LIST_BOS, JSON.stringify(ren && { a: ren.amount }));
    }

    // — credit larger than the approved price: invoice is ₹0 and settles itself —
    {
      const w = await setup();
      const req = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'NOW' });
      const now = d('2026-01-02T00:00:00Z'); // almost the whole Workspace term unused (credit ≈ ₹11,955)
      ok('precondition: the credit exceeds the approved price', M.prorationCreditPaise(cur(w), now) > 500000);
      const res = await w.planChanges.approve(req.id, { effective: 'NOW', netPaise: 500000, discountReason: 'migration offer', confirm: 'CONFIRM' }, ADMIN, now);
      const inv = rows(w, 'invoice').find((i) => i.kind === 'PLAN_CHANGE');
      ok('the credit is capped at the price actually charged: invoice total is exactly ₹0, never negative', inv.totalAmount === 0 && inv.amount === 0 && res.prorationCreditPaise === 500000, JSON.stringify({ t: inv.totalAmount, c: res.prorationCreditPaise }));
      ok('a ₹0 plan-change invoice settles itself and the new plan goes live at the approved ₹5,000', res.settledFree === true && inv.status === 'PAID' && cur(w).planKey === 'BOS' && cur(w).netAmountPaise === 500000, JSON.stringify({ s: inv.status, n: cur(w).netAmountPaise }));
      ok('entitlements follow the plan, not the price (BOS allowance on a ₹5,000 term)', rows(w, 'subscription')[0].themeChangesLimit === 4);
    }

    // — authorisation + server-only price —
    {
      const w = await setup();
      const req = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'AT_RENEWAL' });
      const ac = new C.AdminCommerceController(w.payee, w.deals, w.invAdmin, w.manual, w.promos, w.terms, w.planChanges, w.renewal, w.prisma, w.audit);
      const guards = Reflect.getMetadata('__guards__', C.AdminCommerceController.prototype.approve) ?? [];
      ok('plan-change approval (with the price override) sits behind MoneyAdminGuard', guards.includes(F.MoneyAdminGuard));
      const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
      const bad = async (body) => { try { await pipe.transform(body, { type: 'body', metatype: DTO.PlanChangeApproveDto }); return false; } catch { return true; } };
      ok('the approve DTO rejects a negative, fractional, string and absurdly large price', (await bad({ netPaise: -1 })) && (await bad({ netPaise: 1.5 })) && (await bad({ netPaise: '1000' })) && (await bad({ netPaise: 1e12 })));
      ok('the approve DTO rejects unknown fields (no hidden amount/total/gst inputs)', (await bad({ totalAmount: 1 })) && (await bad({ amount: 1 })) && (await bad({ gstAmount: 1 })));
      ok('the approve DTO accepts the legitimate shape', !(await bad({ effective: 'AT_RENEWAL', netPaise: 1800000, discountReason: 'loyal', confirm: 'CONFIRM' })));
      void ac; void req;
    }
  }

  section('RAW SQL: void-returning functions (live incident 2026-10-07: "Failed to deserialize column of type \'void\'")');
  {
    const RAWF = require('./raw-fake');
    const { advisoryXactLock } = dist('common/db-lock');
    const { lockPayment } = dist('payments/payment-verification');
    const noVoid = async (label, fn) => {
      try { await fn(); ok(label, true); } catch (e) { ok(label, false, String(e.message).includes("'void'") ? 'THREW the Prisma void-deserialisation error' : e.message); }
    };

    // 1. The fake now behaves like real Prisma (this is what was missing).
    const probe = createMemPrisma({});
    await rejects('FAKE: $queryRawUnsafe(SELECT pg_advisory_xact_lock(...)) throws the real Prisma void error', probe.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'k'), { includes: "Failed to deserialize column of type 'void'" });
    await rejects('FAKE: $queryRaw`SELECT pg_advisory_lock(..)` throws too', probe.$queryRaw`SELECT pg_advisory_lock(${1})`, { includes: "'void'" });
    await rejects('FAKE: pg_notify and pg_sleep throw too', Promise.all([probe.$queryRawUnsafe(`SELECT pg_notify('c','x')`)]).then(() => probe.$queryRawUnsafe('SELECT pg_sleep(0)')), { includes: "'void'" });
    ok('FAKE: pg_try_advisory_xact_lock (boolean) is still allowed through $queryRawUnsafe', (await probe.$queryRawUnsafe('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok', 'k'))[0].ok === true);
    ok('FAKE: the helper path ($executeRaw) is accepted', (await probe.$transaction(async (tx) => { await advisoryXactLock(tx, 'k2'); return true; })) === true);
    ok('the detector regex does not confuse try_ variants or ordinary SQL', !RAWF.VOID_FN.test('SELECT pg_try_advisory_xact_lock(1)') && !RAWF.VOID_FN.test('SELECT count(*) FROM "Invoice"') && RAWF.VOID_FN.test('select PG_ADVISORY_XACT_LOCK (1)'));

    // 2. The helper really serialises: a second transaction on the same key waits for the first to finish.
    {
      const p = createMemPrisma({});
      const order = [];
      let releaseA;
      const aHolds = new Promise((r) => { releaseA = r; });
      let aHasLock;
      const aLocked = new Promise((r) => { aHasLock = r; });
      const A = p.$transaction(async (tx) => { await advisoryXactLock(tx, 'same'); order.push('A got lock'); aHasLock(); await aHolds; order.push('A done'); });
      await aLocked;
      const B = p.$transaction(async (tx) => { await advisoryXactLock(tx, 'same'); order.push('B got lock'); });
      const C = p.$transaction(async (tx) => { await advisoryXactLock(tx, 'different'); order.push('C got lock (other key)'); });
      await C; await new Promise((r) => setTimeout(r, 25));
      ok('different keys do not block each other; same key waits while A holds it', order.join('|') === 'A got lock|C got lock (other key)', order.join('|'));
      releaseA(); await Promise.all([A, B]);
      ok('after A commits, B proceeds (transaction-scoped release)', order.join('|') === 'A got lock|C got lock (other key)|A done|B got lock', order.join('|'));
    }

    // 3. Every code path that takes a lock now runs under the strict fake (each THROWS on the pre-fix code).
    const w = world();
    let created;
    await noVoid('DEAL-CREATE: createInvoice + activate-now (the exact Deal-builder click that failed live)', async () => { created = await w.deals.createInvoice(stepSpec(), ADMIN, { activateNow: true }); });
    ok('DEAL-CREATE: left a deal, one ACTIVATION invoice and an ACTIVE_PAYMENT_DUE term', rows(w, 'billingDeal').length === 1 && rows(w, 'invoice').length === 1 && rows(w, 'billingTerm')[0]?.status === 'ACTIVE_PAYMENT_DUE');
    await noVoid('DEAL-CREATE again for the same invoice is idempotent (second activate-now takes the lock and returns the same term)', async () => { const t2 = await w.deals.activateNow(created.invoice.id, 7, 7, ADMIN); ok('same term id', t2.termId === rows(w, 'billingTerm')[0].id); });
    {
      const w2 = world();
      const made = await Promise.all([1, 2, 3].map(() => w2.deals.createInvoice(stepSpec(), ADMIN, {})));
      const nums = made.map((m) => m.invoice.invoiceNumber);
      ok('INVOICE-NUMBER: three concurrent deal creations get three distinct sequential numbers', new Set(nums).size === 3 && nums.every((n) => /^INV-\d{4}-\d{4}$/.test(n)), nums.join());
    }
    const inv = rows(w, 'invoice')[0];
    const tokenFor = async () => tokenOf((await w.invAdmin.reissueLink(inv.id, ADMIN, { expiryDays: 30 })).payLink);
    await noVoid('PAY: UPI proof submission + admin confirmation (settlement lock, effects lock)', async () => {
      const view = await w.pay.loadByToken(await tokenFor());
      await w.pay.submitProof(view, { utr: '412345678901', claimedAmountRupees: inv.totalAmount / 100, paidAt: new Date().toISOString(), ip: '9.9.9.9' });
      await w.manual.confirm(rows(w, 'manualPaymentSubmission')[0].id, inv.totalAmount, ADMIN);
    });
    ok('PAY: the invoice settled to PAID through the lock-taking path', rows(w, 'invoice')[0].status === 'PAID' && rows(w, 'invoice')[0].paidPaise === inv.totalAmount);
    await noVoid('SETTLEMENT: applyPayment on a fresh invoice (invoice lock → effects lock → AI-credit lock)', async () => {
      const w3 = world();
      await w3.deals.createInvoice(stepSpec({ billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE' }), ADMIN, {});
      const i3 = rows(w3, 'invoice')[0];
      await w3.settlement.applyPayment(i3.id, { amountPaise: i3.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-01-01T00:00:00Z') });
      await w3.settlement.settleFree(i3.id, ADMIN).catch(() => undefined); // already paid → no-op or 400, never a void error
      ok('SETTLEMENT: PAID with an active term and the one-time credit', rows(w3, 'invoice')[0].status === 'PAID' && rows(w3, 'billingTerm').some((t) => t.isCurrent) && rows(w3, 'walletTransaction').filter((t) => t.service === 'ai_studio_bonus').length === 1);
      await noVoid('TERMS: admin override takes the per-vendor term lock', () => w3.terms.override('v_step', { reason: 'test', graceDays: 10 }, ADMIN));
      await noVoid('RENEWAL: the daily job (boolean try-lock stays a typed query) + the T-15 invoice', () => w3.renewal.runOnce(d('2026-12-17T00:00:00Z')));
      ok('RENEWAL: the T-15 invoice was created', rows(w3, 'invoice').some((x) => x.kind === 'RENEWAL'));
      const req = await w3.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'NOW' });
      await noVoid('PLAN CHANGE (now): approval issues the invoice under the same locks', () => w3.planChanges.approve(req.id, { effective: 'NOW' }, ADMIN, d('2026-04-01T00:00:00Z')));
    });
    await noVoid('WALLET / PUBLIC CHECKOUT: lockPayment(tx, paymentId) (pre-existing live payment paths)', () => probe.$transaction(async (tx) => { await lockPayment(tx, 'pay_123'); }));
  }

  section('STEPNROCK LEFTOVER: a half-finished deal (invoice, no term) is resumed — never double-billed');
  {
    const { decideStepnrock } = require('../activate-stepnrock-lib');
    const inv = (o = {}) => ({ status: 'SENT', totalAmount: 599400, planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', paidPaise: 0, ...o });
    const act = (s) => decideStepnrock(s).action;
    ok('no invoice and no term → CREATE', act({ currentTerm: null, invoice: null, submissionCount: 0 }) === 'CREATE');
    ok('unpaid matching invoice, no term (the 2026-10-07 leftover) → RESUME, not CREATE', act({ currentTerm: null, invoice: inv(), submissionCount: 0 }) === 'RESUME');
    ok('a PARTIALLY_PAID / PAYMENT_SUBMITTED matching invoice → RESUME as well (never a second invoice)', act({ currentTerm: null, invoice: inv({ status: 'PARTIALLY_PAID', paidPaise: 100000 }), submissionCount: 1 }) === 'RESUME' && act({ currentTerm: null, invoice: inv({ status: 'PAYMENT_SUBMITTED' }), submissionCount: 1 }) === 'RESUME');
    ok('a term already exists → REFUSE', act({ currentTerm: { status: 'ACTIVE_PAYMENT_DUE' }, invoice: inv(), submissionCount: 0 }) === 'REFUSE_HAS_TERM');
    ok('a PAID/VOID last invoice and no term → CREATE', act({ currentTerm: null, invoice: inv({ status: 'VOID' }), submissionCount: 0 }) === 'CREATE' && act({ currentTerm: { status: 'CANCELLED' }, invoice: inv({ status: 'PAID' }), submissionCount: 0 }) === 'CREATE');
    ok('unpaid invoice with the WRONG amount / plan / cycle / GST, no payments → VOID_AND_REPLACE', ['totalAmount', 'planKey', 'billingCycle', 'gstMode'].every((k) => act({ currentTerm: null, invoice: inv({ [k]: k === 'totalAmount' ? 707292 : k === 'planKey' ? 'BOS' : k === 'billingCycle' ? 'ANNUAL' : 'EXCLUSIVE' }), submissionCount: 0 }) === 'VOID_AND_REPLACE'));
    ok('a mismatching invoice that already has money or proofs → REFUSE (never void evidence)', act({ currentTerm: null, invoice: inv({ totalAmount: 1, paidPaise: 1 }), submissionCount: 0 }) === 'REFUSE_HAS_PAYMENTS' && act({ currentTerm: null, invoice: inv({ totalAmount: 1 }), submissionCount: 2 }) === 'REFUSE_HAS_PAYMENTS');

    // The real services on the exact leftover shape: deal + SENT activation invoice, NO term (created with activateNow = false).
    const w = world();
    await w.deals.createInvoice(stepSpec(), ADMIN, {});
    const leftover = rows(w, 'invoice')[0];
    ok('leftover shape: one deal, one unpaid ACTIVATION invoice, no term, no wallet credit', rows(w, 'billingDeal').length === 1 && leftover.status === 'SENT' && leftover.kind === 'ACTIVATION' && rows(w, 'billingTerm').length === 0 && rows(w, 'walletTransaction').length === 0);
    const oldToken = leftover.payTokenHash;
    const decision = decideStepnrock({ currentTerm: null, invoice: { ...leftover }, submissionCount: 0 });
    ok('the script would RESUME on it', decision.action === 'RESUME');
    // What the script does on RESUME: activateNow on the existing invoice + a fresh link.
    await w.deals.activateNow(leftover.id, 7, 7, ADMIN);
    const fresh = await w.invAdmin.reissueLink(leftover.id, ADMIN, { expiryDays: 30 });
    ok('RESUME: still exactly ONE invoice and ONE deal (no double-billing), now with an ACTIVE_PAYMENT_DUE term attached', rows(w, 'invoice').length === 1 && rows(w, 'billingDeal').length === 1 && rows(w, 'billingTerm').length === 1 && rows(w, 'billingTerm')[0].status === 'ACTIVE_PAYMENT_DUE' && rows(w, 'invoice')[0].termId === rows(w, 'billingTerm')[0].id);
    ok('RESUME: the one-time ₹250 AI credit (half-yearly) was granted exactly once and the theme allowance is 2', rows(w, 'walletTransaction').filter((t) => t.service === 'ai_studio_bonus').length === 1 && rows(w, 'subscription')[0].themeChangesLimit === 2);
    ok('RESUME: the invoice amount is untouched (₹5,994, GST none) and the old link is dead, the new one resolves', rows(w, 'invoice')[0].totalAmount === 599400 && rows(w, 'invoice')[0].payTokenHash !== oldToken && Boolean(await w.pay.loadByToken(tokenOf(fresh.payLink))));
    await w.deals.activateNow(leftover.id, 7, 7, ADMIN);
    ok('running activation a SECOND time is a no-op (same term, one credit)', rows(w, 'billingTerm').length === 1 && rows(w, 'walletTransaction').filter((t) => t.service === 'ai_studio_bonus').length === 1);
    ok('after activation the script REFUSES to run again', decideStepnrock({ currentTerm: rows(w, 'billingTerm')[0], invoice: { ...rows(w, 'invoice')[0] }, submissionCount: 0 }).action === 'REFUSE_HAS_TERM');

    // VOID_AND_REPLACE on a wrong leftover with no payments: exactly one live invoice remains, at the agreed amount.
    const w2 = world();
    await w2.deals.createInvoice(stepSpec({ billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE' }), ADMIN, {});
    const wrong = rows(w2, 'invoice')[0];
    ok('wrong leftover (₹14,146.84 annual + GST) → VOID_AND_REPLACE', decideStepnrock({ currentTerm: null, invoice: { ...wrong }, submissionCount: 0 }).action === 'VOID_AND_REPLACE', String(wrong.totalAmount));
    await w2.invAdmin.void(wrong.id, 'Replaced by scripts/activate-stepnrock.js', ADMIN);
    await w2.deals.createInvoice(stepSpec(), ADMIN, { activateNow: true });
    const live = rows(w2, 'invoice').filter((i) => i.status !== 'VOID');
    ok('after void-and-replace: exactly ONE non-void invoice, ₹5,994, with the term attached', live.length === 1 && live[0].totalAmount === 599400 && rows(w2, 'billingTerm').length === 1 && rows(w2, 'invoice').some((i) => i.id === wrong.id && i.status === 'VOID'));
  }

  section('AI STUDIO CREDIT prorated by term: grant = max(0, target − already granted); never claws back; existing wallets untouched');
  {
    const AIB = (w, vendor = 'v_step') => rows(w, 'walletTransaction').filter((t) => t.vendorId === vendor && t.service === 'ai_studio_bonus');
    const sum = (list) => list.reduce((a, t) => a + t.amount, 0);
    const walletOf = (w, vendor = 'v_step') => rows(w, 'wallet').find((x) => x.vendorId === vendor);
    const bystander = { wallet: [{ id: 'w_other', vendorId: 'v_other', balance: 12345, totalCredited: 20000, totalDebited: 7655 }], walletTransaction: [{ id: 'wt_old', vendorId: 'v_other', walletId: 'w_other', type: 'credit', amount: 20000, service: 'topup', description: 'old top-up', balanceAfter: 20000 }] };
    const snap = (w) => JSON.stringify({ wallet: rows(w, 'wallet').find((x) => x.vendorId === 'v_other'), tx: rows(w, 'walletTransaction').filter((t) => t.vendorId === 'v_other') });

    // 1. The stepnrock deal: Workspace half-yearly → ₹250, stored on deal and term, granted once at "activate now".
    const w = world(bystander);
    const before = snap(w);
    const pre = await w.deals.preview(stepSpec());
    ok('DEAL BUILDER preview returns the computed credit (₹250 half-yearly) — the UI prefills from the server, nothing is re-implemented client-side', pre.aiCredit.paise === 25000 && pre.aiCredit.computedPaise === 25000 && pre.aiCredit.overridden === false);
    ok('…and it follows plan/cycle/months: BOS monthly ₹108, Workspace custom 3 months ₹125, Workspace annual ₹499', (await w.deals.preview(stepSpec({ planKey: 'BOS', billingCycle: 'MONTHLY' }))).aiCredit.paise === 10800 && (await w.deals.preview(stepSpec({ billingCycle: 'CUSTOM_MONTHS', customMonths: 3 }))).aiCredit.paise === 12500 && (await w.deals.preview(stepSpec({ billingCycle: 'ANNUAL' }))).aiCredit.paise === 49900);
    const made = await w.deals.createInvoice(stepSpec(), ADMIN, { activateNow: true });
    ok('ACTIVATE NOW: exactly one ai_studio_bonus credit of ₹250 (25000 paise), wallet balance ₹250', AIB(w).length === 1 && AIB(w)[0].amount === 25000 && walletOf(w).balance === 25000);
    ok('the amount is stored on the deal AND on the term', rows(w, 'billingDeal')[0].aiCreditPaise === 25000 && rows(w, 'billingTerm')[0].aiCreditPaise === 25000);
    ok('the wallet transaction names the plan and the term', /Workspace/.test(AIB(w)[0].description) && /6-month/.test(AIB(w)[0].description), AIB(w)[0].description);
    ok('the credit is not a charge: invoice total is still ₹5,994 and no line mentions it', rows(w, 'invoice')[0].totalAmount === 599400 && !JSON.stringify(rows(w, 'invoice')[0].lineItems).toLowerCase().includes('credit'));
    const termId = rows(w, 'billingTerm')[0].id;
    const again = await Promise.all([w.deals.activateNow(made.invoice.id, 7, 7, ADMIN), w.deals.activateNow(made.invoice.id, 7, 7, ADMIN)]);
    ok('DOUBLE-CLICK / retry of activate-now: same term, still ONE credit', again.every((x) => x.termId === termId) && AIB(w).length === 1 && walletOf(w).balance === 25000);
    const g1 = await w.prisma.$transaction((tx) => w.settlement.grantAiCredit(tx, 'v_step', 'WORKSPACE', termId));
    const g2 = await w.prisma.$transaction((tx) => w.settlement.grantAiCredit(tx, 'v_step', 'WORKSPACE', termId));
    ok('calling the grant again (retry / double-settle) returns 0 and changes nothing', g1 === 0 && g2 === 0 && AIB(w).length === 1);
    const inv0 = rows(w, 'invoice')[0];
    await w.settlement.applyPayment(inv0.id, { amountPaise: inv0.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-10-09T00:00:00Z') });
    ok('PAYING the activation invoice later grants nothing more (still ₹250 once)', AIB(w).length === 1 && sum(AIB(w)) === 25000 && rows(w, 'billingTerm').find((t) => t.isCurrent).aiCreditPaise === 25000);
    await w.settlement.applyPayment(inv0.id, { amountPaise: inv0.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-10-09T00:00:00Z') }).catch(() => undefined);
    ok('DOUBLE-SETTLE of the same invoice: nothing is granted twice', AIB(w).length === 1 && sum(AIB(w)) === 25000);

    // 2. Half-yearly → annual (same plan, longer term) grants only the difference; then Workspace → BOS grants the difference again.
    let req = await w.planChanges.request('v_step', { toPlanKey: 'WORKSPACE', toCycle: 'ANNUAL', effective: 'NOW' });
    let res = await w.planChanges.approve(req.id, { effective: 'NOW' }, ADMIN, d('2026-11-01T00:00:00Z'));
    let pc = rows(w, 'invoice').find((i) => i.id === res.invoiceId);
    await w.settlement.applyPayment(pc.id, { amountPaise: pc.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-11-01T00:00:00Z') });
    ok('UPGRADE half-yearly → annual: grants ONLY the difference (₹249), total ₹499', AIB(w).length === 2 && AIB(w)[1].amount === 24900 && sum(AIB(w)) === 49900 && rows(w, 'billingTerm').find((t) => t.isCurrent).aiCreditPaise === 49900, AIB(w).map((t) => t.amount).join());
    req = await w.planChanges.request('v_step', { toPlanKey: 'BOS', toCycle: 'ANNUAL', effective: 'NOW' });
    res = await w.planChanges.approve(req.id, { effective: 'NOW' }, ADMIN, d('2027-01-01T00:00:00Z'));
    pc = rows(w, 'invoice').find((i) => i.id === res.invoiceId);
    await w.settlement.applyPayment(pc.id, { amountPaise: pc.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2027-01-01T00:00:00Z') });
    ok('UPGRADE Workspace → BOS annual: grants the difference up to ₹1,299 (₹800 more)', sum(AIB(w)) === 129900 && AIB(w).length === 3 && AIB(w)[2].amount === 80000, AIB(w).map((t) => t.amount).join());

    // 3. Renewal of the same plan/length grants nothing; a downgrade grants nothing and never claws back.
    const balanceBefore = walletOf(w).balance;
    await w.renewal.runOnce(d('2027-12-17T00:00:00Z'));
    const ren = rows(w, 'invoice').find((i) => i.kind === 'RENEWAL');
    await w.settlement.applyPayment(ren.id, { amountPaise: ren.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2027-12-20T00:00:00Z') });
    ok('RENEWAL (same plan and length) grants nothing; the new term carries the same credit', AIB(w).length === 3 && walletOf(w).balance === balanceBefore && rows(w, 'billingTerm').find((t) => t.isCurrent).aiCreditPaise === 129900);
    const dreq = await w.planChanges.request('v_step', { toPlanKey: 'WORKSPACE', toCycle: 'ANNUAL' });
    await w.planChanges.approve(dreq.id, { effective: 'AT_RENEWAL' }, ADMIN, d('2028-01-02T00:00:00Z'));
    await w.renewal.runOnce(d('2028-12-17T00:00:00Z'));
    const ren2 = rows(w, 'invoice').filter((i) => i.kind === 'RENEWAL')[1];
    await w.settlement.applyPayment(ren2.id, { amountPaise: ren2.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2028-12-20T00:00:00Z') });
    ok('DOWNGRADE BOS → Workspace at renewal: grants nothing and NEVER claws back (balance unchanged, term now targets ₹499)', rows(w, 'billingTerm').find((t) => t.isCurrent).planKey === 'WORKSPACE' && AIB(w).length === 3 && walletOf(w).balance === balanceBefore && rows(w, 'billingTerm').find((t) => t.isCurrent).aiCreditPaise === 49900);

    // 4. Admin override on the term: a higher figure grants the difference once; a lower figure grants nothing.
    const t0 = rows(w, 'billingTerm').find((t) => t.isCurrent);
    await w.terms.override('v_step', { reason: 'goodwill', aiCreditPaise: 200000 }, ADMIN);
    ok('TERM OVERRIDE to ₹2,000 grants the difference over what was granted (₹2,000 − ₹1,299 = ₹701)', AIB(w).length === 4 && AIB(w)[3].amount === 200000 - 129900 && sum(AIB(w)) === 200000, AIB(w).map((t) => t.amount).join());
    await w.terms.override('v_step', { reason: 'repeat', aiCreditPaise: 200000 }, ADMIN);
    await w.terms.override('v_step', { reason: 'lower', aiCreditPaise: 50000 }, ADMIN);
    ok('re-applying the same figure, or a lower one, grants nothing (no claw-back)', AIB(w).length === 4 && sum(AIB(w)) === 200000 && rows(w, 'billingTerm').find((t) => t.isCurrent).aiCreditPaise === 50000);
    await w.terms.override('v_step', { reason: 'grace only', graceDays: 12 }, ADMIN);
    ok('an override that does not touch the credit (grace days only) grants nothing', AIB(w).length === 4);
    await rejects('an override above ₹5,000 is refused', w.terms.override('v_step', { reason: 'too much', aiCreditPaise: 500001 }, ADMIN), { status: 400 });
    ok('the term override is audit-logged with before/after/computed', rows(w, 'commercialAuditLog').some((a) => a.action === 'term.ai_credit' && a.detail.afterPaise === 200000 && a.detail.beforePaise === 49900 && a.detail.computedPaise === 49900));
    ok('EXISTING WALLETS UNTOUCHED: another vendor\'s wallet and transactions are byte-identical after all of the above', snap(w) === before);
    ok('the vendor view says what is included (Rs X) for the CURRENT term', (() => { const T = dist('commercial/terms.service'); const v = T.vendorTermView(rows(w, 'billingTerm').find((t) => t.isCurrent)); return v.aiCreditIncludedPaise === 50000; })());
    const av = await w.terms.adminView('v_step');
    ok('the admin term view shows target, computed and granted', av.aiCredit.targetPaise === 50000 && av.aiCredit.computedPaise === 49900 && av.aiCredit.grantedPaise === 200000, JSON.stringify(av.aiCredit));

    // 5. Paid activation (no activate-now), annual, and the audit of a deal-level override.
    {
      const w2 = world(bystander);
      await w2.deals.createInvoice(stepSpec({ billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE' }), ADMIN, {});
      const i2 = rows(w2, 'invoice')[0];
      ok('before payment nothing is granted', AIB(w2).length === 0);
      await w2.settlement.applyPayment(i2.id, { amountPaise: i2.totalAmount, via: 'OFFLINE', actor: ADMIN, now: d('2026-10-09T00:00:00Z') });
      ok('PAID ACTIVATION, annual Workspace: ₹499 once; nothing audit-logged because it equals the computed value', AIB(w2).length === 1 && AIB(w2)[0].amount === 49900 && rows(w2, 'commercialAuditLog').filter((a) => a.action === 'deal.ai_credit_override').length === 0);
    }
    {
      const w3 = world(bystander);
      const m3 = await w3.deals.createInvoice(stepSpec({ aiCreditPaise: 0 }), ADMIN, { activateNow: true });
      ok('DEAL OVERRIDE ₹0: no wallet credit at all, term and deal store 0', AIB(w3).length === 0 && rows(w3, 'billingTerm')[0].aiCreditPaise === 0 && rows(w3, 'billingDeal')[0].aiCreditPaise === 0);
      const au = rows(w3, 'commercialAuditLog').filter((a) => a.action === 'deal.ai_credit_override');
      ok('…and the override is audit-logged (computed ₹250 vs entered ₹0, by whom)', au.length === 1 && au[0].detail.computedPaise === 25000 && au[0].detail.enteredPaise === 0 && au[0].actor === ADMIN.email);
      const w4 = world(bystander);
      await w4.deals.createInvoice(stepSpec({ aiCreditPaise: 100000 }), ADMIN, { activateNow: true });
      ok('DEAL OVERRIDE custom ₹1,000: exactly that is granted, once', AIB(w4).length === 1 && AIB(w4)[0].amount === 100000 && rows(w4, 'billingTerm')[0].aiCreditPaise === 100000);
      await rejects('a deal override above ₹5,000 is refused before anything is created', world().deals.createInvoice(stepSpec({ aiCreditPaise: 500001 }), ADMIN, { activateNow: true }), { status: 400 });
      const w5 = world(bystander);
      await w5.deals.saveDraft(stepSpec({ aiCreditPaise: 77700 }), ADMIN);
      ok('a saved draft stores the figure on the deal and logs the override', rows(w5, 'billingDeal')[0].aiCreditPaise === 77700 && rows(w5, 'commercialAuditLog').some((a) => a.action === 'deal.ai_credit_override'));
      void m3;
    }
    // 6. A vendor who already received the old flat ₹499 (legacy flow) gets nothing more on a half-yearly term.
    {
      const w6 = world({ wallet: [{ id: 'w_step', vendorId: 'v_step', balance: 49900, totalCredited: 49900, totalDebited: 0 }], walletTransaction: [{ id: 'wt_legacy', vendorId: 'v_step', walletId: 'w_step', type: 'credit', amount: 49900, service: 'ai_studio_bonus', description: 'legacy', balanceAfter: 49900 }] });
      await w6.deals.createInvoice(stepSpec(), ADMIN, { activateNow: true });
      ok('LEGACY ₹499 already granted: half-yearly activation adds nothing (granted ≥ target), wallet untouched', AIB(w6).length === 1 && walletOf(w6).balance === 49900);
    }
    // 7. The stepnrock-leftover path (RESUME) back-fills the figure on the existing deal.
    {
      const w7 = world();
      await w7.deals.createInvoice(stepSpec(), ADMIN, {});
      rows(w7, 'billingDeal')[0].aiCreditPaise = null; // a deal created before this feature
      await w7.deals.activateNow(rows(w7, 'invoice')[0].id, 7, 7, ADMIN);
      ok('RESUME of a pre-feature leftover: ₹250 granted once, stored on the term AND back-filled on the deal', AIB(w7).length === 1 && AIB(w7)[0].amount === 25000 && rows(w7, 'billingTerm')[0].aiCreditPaise === 25000 && rows(w7, 'billingDeal')[0].aiCreditPaise === 25000);
    }
  }

  section('LEGACY paths cannot bypass the commercial engine');
  {
    const w = world();
    const r = await w.deals.createInvoice(stepSpec({ allowedChannels: ['RAZORPAY'] }), ADMIN, {});
    const inv = rows(w, 'invoice')[0];
    await rejects('legacy create-order refuses a commercial invoice', w.payments.createInvoiceOrder({ sub: 'v_step', role: 'VENDOR' }, inv.id), { status: 400 });
    const legacy = new InvoicesService(w.prisma, w.email, w.payments, recorder('settings'));
    await rejects('legacy admin "mark paid" refuses a commercial invoice (must go through Payments to confirm)', legacy.markAsPaid(inv.id, 'pay_x'), { status: 400 });
    await rejects('legacy payment link refuses a commercial invoice', legacy.sendPaymentLink(inv.id), { status: 400 });
    ok('the commercial invoice is untouched', rows(w, 'invoice')[0].status === 'SENT' && rows(w, 'invoice')[0].paidPaise === 0);
  }

  section('SEO keyword allowance & theme-reset (existing CMS code)');
  {
    const w = world();
    await w.deals.createInvoice(stepSpec({ planKey: 'WORKSPACE', billingCycle: 'ANNUAL', gstMode: 'NONE' }), ADMIN, {});
    const a = rows(w, 'invoice')[0];
    await w.settlement.applyPayment(a.id, { amountPaise: a.totalAmount, via: 'OFFLINE', actor: ADMIN });
    const cms = new CmsService(w.prisma, w.gate);
    await rejects('Workspace allows 3 SEO keywords — a 4th is refused', cms.updateVendorCMS('v_step', { seoKeywords: 'a, b, c, d' }), { status: 400 });
    const { nextYearlyReset } = dist('cms/cms.service');
    ok('theme reset moves ONE YEAR at a time (not to a shorter billing-cycle end)', nextYearlyReset(d('2027-04-07T00:00:00Z'), d('2027-05-01T00:00:00Z')).toISOString().startsWith('2028-04-07') && nextYearlyReset(d('2024-04-07T00:00:00Z'), d('2027-05-01T00:00:00Z')).toISOString().startsWith('2028-04-07'));
  }

  finish();
})().catch((e) => { console.error(e); process.exit(1); });
