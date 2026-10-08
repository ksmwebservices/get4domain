// Task 9: Deal-builder guard (no second activation), vendor Audit trail, structured error details, and the fix-stepnrock-term plan.
const fs = require('fs');
const os = require('os');
const path = require('path');
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-guard-')));

const { dist, ok, rejects, section, finish, makeRazorpay, recorder } = require('../security-verify/harness');
const { createMemPrisma } = require('./mem-prisma');
const { ValidationPipe } = require('@nestjs/common');

const { WalletService } = dist('wallet/wallet.service');
const F = dist('commercial/foundation.services');
const { BillingGateService } = dist('commercial/billing-gate.service');
const { InvoiceBuilderService } = dist('commercial/invoice-builder.service');
const { SettlementService } = dist('commercial/settlement.service');
const { DealsService } = dist('commercial/deals.service');
const { TermsService } = dist('commercial/terms.service');
const { InvoiceAdminService } = dist('commercial/promos-and-invoices.service');
const G = dist('commercial/activation-guard');
const DTO = dist('commercial/dto');
const { HttpExceptionFilter } = dist('common/filters/http-exception.filter');
const { planTermFix, verifyAfter } = require('../fix-stepnrock-term-lib');

const ADMIN = { id: 'admin1', email: 'admin@get4domain.com', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' };
const DAY = 86_400_000;

function world() {
  const prisma = createMemPrisma({
    vendor: [
      { id: 'v_step', name: 'Suresh', email: 'owner.stepnrock@get4domain.com', businessName: 'Step N Rock', phone: '9360011107', subdomain: 'stepnrock', isSandbox: false, status: 'ACTIVE' },
      { id: 'v_other', name: 'Other', email: 'other@x.in', businessName: 'Other Co', phone: '9000000000', subdomain: 'otherco', isSandbox: false, status: 'ACTIVE' },
    ],
    wallet: [{ id: 'w1', vendorId: 'v_step', balance: 0, totalCredited: 0, totalDebited: 0 }],
    specialArrangement: [{ id: 'arr_step', vendorId: 'v_step', active: true, allowHalfYear: true, gstMode: 'NONE', allowedChannels: ['UPI_QR'], validUntil: new Date('2027-03-31T00:00:00Z'), reason: 'test fixture', createdBy: 'test', history: [], createdAt: new Date('2026-10-01T00:00:00Z') }, { id: 'arr_other', vendorId: 'v_other', active: true, allowHalfYear: true, gstMode: 'NONE', allowedChannels: ['UPI_QR', 'OFFLINE'], validUntil: new Date('2027-03-31T00:00:00Z'), reason: 'test fixture', createdBy: 'test', history: [], createdAt: new Date('2026-10-01T00:00:00Z') }],
  });
  const email = recorder('email');
  const legacy = { resolveCompany: async () => ({ name: 'KSM' }) };
  const gate = new BillingGateService(prisma);
  const wallet = new WalletService(prisma, legacy, gate);
  const audit = new F.CommercialAuditService(prisma);
  const messenger = new F.CommercialMessenger(email, recorder('wa', { sendMessage: async () => ({ status: 'mock', mock: true }) }), recorder('notif'));
  const builder = new InvoiceBuilderService(prisma);
  const settlement = new SettlementService(prisma, audit, messenger, legacy, email);
  const arrangements = new (dist('commercial/arrangements.service').ArrangementsService)(prisma, audit, messenger);
  const deals = new DealsService(prisma, wallet, builder, settlement, audit, messenger, email, arrangements);
  const terms = new TermsService(prisma, audit, settlement);
  const invAdmin = new InvoiceAdminService(prisma, builder, deals, legacy, audit);
  return { prisma, deals, terms, invAdmin, audit, t: prisma.$tables };
}
const spec = (over = {}) => {
  const o = { vendorId: 'v_step', planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', graceDays: 7, allowedChannels: ['RAZORPAY', 'UPI_QR'], ...over };
  // The 6-month LIST is 55% of annual (₹6,593.40); KSM approves the ₹5,994.00 net with a reason, exactly as the live deal did.
  if (o.billingCycle === 'HALF_YEARLY' && o.planKey && !over.discount) o.discount = { mode: 'FLAT', value: 59940, reason: 'Approved launch net 5,994.00 (list is 55% of annual)' };
  return o;
};
const rows = (w, n) => w.t[n] ?? [];
const failsWith = async (p) => { try { await p; return null; } catch (e) { return e; } };

(async () => {
  section('guard rules (pure)');
  {
    const inv = (status, n = 'INV-2026-0006') => ({ id: `i_${n}`, invoiceNumber: n, status, totalAmount: 599400 });
    ok('no open invoice and no unpaid term → allowed', G.findActivationConflict([], null) === null && G.findActivationConflict([], { id: 't', status: 'ACTIVE', activationInvoiceId: 'x' }) === null);
    const c = G.findActivationConflict([inv('SENT')], { id: 't', status: 'ACTIVE_PAYMENT_DUE', activationInvoiceId: 'i_INV-2026-0006' });
    ok('an open activation invoice → OPEN_ACTIVATION naming the invoice number and amount, with its id for the link', c.code === 'OPEN_ACTIVATION' && /INV-2026-0006/.test(c.message) && /5,994/.test(c.message) && c.details.invoiceId === 'i_INV-2026-0006');
    const u = G.findActivationConflict([], { id: 't9', status: 'ACTIVE_PAYMENT_DUE', activationInvoiceId: 'i_voided' });
    ok('no open invoice but the current term is still waiting for payment → UNPAID_TERM', u.code === 'UNPAID_TERM' && u.details.termId === 't9');
    ok('every unpaid status counts as open; PAID / VOID / CANCELLED / EXPIRED do not', ['DRAFT', 'SENT', 'PENDING', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID'].every((s) => G.OPEN_INVOICE_STATUSES.includes(s)) && !['PAID', 'VOID', 'CANCELLED', 'EXPIRED'].some((s) => G.OPEN_INVOICE_STATUSES.includes(s)));
    ok('an override reason must be a real sentence (≥ 10 chars after trimming)', !G.validOverrideReason('') && !G.validOverrideReason('   ok   ') && !G.validOverrideReason(undefined) && G.validOverrideReason('customer asked for a second quote'));
  }

  section('DEAL BUILDER: a second activation for the same vendor is refused');
  {
    const w = world();
    const first = await w.deals.createInvoice(spec({ paymentDueDays: 7 }), ADMIN, { activateNow: true });
    ok('the first activation works (invoice SENT, term ACTIVE_PAYMENT_DUE)', rows(w, 'invoice').length === 1 && rows(w, 'billingTerm')[0].status === 'ACTIVE_PAYMENT_DUE');
    const before = { inv: rows(w, 'invoice').length, deals: rows(w, 'billingDeal').length, terms: rows(w, 'billingTerm').length };
    const e = await failsWith(w.deals.createInvoice(spec({ paymentDueDays: 2, graceDays: 2 }), ADMIN, { activateNow: true }));
    ok('createInvoice(activateNow) → 409 Conflict', e && e.getStatus() === 409, String(e && e.message));
    const body = e && e.getResponse();
    ok('the message names the open invoice and says what to do', /INV-\d{4}-\d{4}/.test(body.message) && /open activation invoice/.test(body.message) && /void it first|Pay or void/.test(body.message));
    ok('the response carries code + details (invoice id / number / status) so the screen can link to it', body.code === 'OPEN_ACTIVATION' && body.details.invoiceId === first.invoice.id && body.details.invoiceStatus === 'SENT');
    ok('NOTHING was created by the refused attempt (no deal, invoice or term)', rows(w, 'invoice').length === before.inv && rows(w, 'billingDeal').length === before.deals && rows(w, 'billingTerm').length === before.terms);
    const e2 = await failsWith(w.deals.createInvoice(spec(), ADMIN, {}));
    ok('also refused WITHOUT activateNow (a plain second activation invoice)', e2 && e2.getStatus() === 409 && rows(w, 'invoice').length === 1);
    const addon = await w.deals.createInvoice({ vendorId: 'v_step', kind: 'ADDON', gstMode: 'NONE', addons: [{ kind: 'CUSTOM', label: 'Extra page', amountPaise: 50000 }], allowedChannels: ['UPI_QR'] }, ADMIN, {});
    ok('an ADDON invoice for the same vendor is NOT blocked (only activations are)', addon.invoice.kind === 'ADDON' && rows(w, 'invoice').length === 2);
    const other = await w.deals.createInvoice(spec({ vendorId: 'v_other' }), ADMIN, { activateNow: true });
    ok('a different vendor is unaffected', other.invoice.vendorId === 'v_other');
  }
  {
    const w = world();
    const a = await w.deals.createInvoice(spec(), ADMIN, {});
    await w.invAdmin.void(a.invoice.id, 'created by mistake', ADMIN);
    const b = await w.deals.createInvoice(spec(), ADMIN, {});
    ok('after the first invoice is VOIDED a new activation is allowed', b.invoice.id !== a.invoice.id);
  }
  {
    const w = world();
    const a = await w.deals.createInvoice(spec(), ADMIN, { activateNow: true });
    await w.prisma.invoice.update({ where: { id: a.invoice.id }, data: { status: 'VOID' } }); // invoice dead but the term still waits for payment
    const e = await failsWith(w.deals.createInvoice(spec(), ADMIN, {}));
    ok('a current term still waiting for payment blocks a new activation even if its invoice is gone (UNPAID_TERM)', e && e.getResponse().code === 'UNPAID_TERM');
  }

  section('OVERRIDE: only with a typed reason, and it is audit-logged');
  {
    const w = world();
    await w.deals.createInvoice(spec(), ADMIN, { activateNow: true });
    const e = await failsWith(w.deals.createInvoice(spec(), ADMIN, { overrideReason: 'ok' }));
    ok('a too-short reason does not override', e && e.getStatus() === 409);
    const r = await w.deals.createInvoice(spec(), ADMIN, { overrideReason: 'Suresh asked for a quarterly quote as a second option' });
    ok('a proper reason lets the second invoice through', rows(w, 'invoice').length === 2 && r.invoice.kind === 'ACTIVATION');
    const log = rows(w, 'commercialAuditLog').filter((x) => x.action === 'deal.guard_override');
    ok('the override is audit-logged on the vendor with the reason, actor and the invoice it bypassed', log.length === 1 && log[0].entityType === 'Vendor' && log[0].entityId === 'v_step' && /quarterly quote/.test(log[0].detail.reason) && log[0].actor === ADMIN.email && !!log[0].detail.invoiceId);
    const a2 = await w.deals.createInvoice(spec(), ADMIN, { overrideReason: 'third option for comparison purposes only', activateNow: true });
    ok('override + activateNow does not trip the term guard either', !!a2.invoice.id);
  }
  {
    const w = world();
    const a = await w.deals.createInvoice(spec(), ADMIN, { activateNow: true });
    const second = await w.deals.createInvoice(spec(), ADMIN, { overrideReason: 'deliberate second invoice for the test of activateNow' });
    const e = await failsWith(w.deals.activateNow(second.invoice.id, 7, 7, ADMIN));
    ok('activateNow() on a different invoice refuses to retire a term that is still waiting for ITS payment (defence in depth)', e && e.getStatus() === 409 && e.getResponse().code === 'UNPAID_TERM');
    ok('…and the existing term is untouched', rows(w, 'billingTerm').filter((t) => t.isCurrent).length === 1 && rows(w, 'billingTerm')[0].activationInvoiceId === a.invoice.id);
    const same = await w.deals.activateNow(a.invoice.id, 7, 7, ADMIN);
    ok('re-activating the SAME invoice is still idempotent (the stepnrock resume path)', same.termId === rows(w, 'billingTerm')[0].id);
  }

  section('HTTP shape: the global filter passes structured details through');
  {
    const w = world();
    await w.deals.createInvoice(spec(), ADMIN, { activateNow: true });
    const e = await failsWith(w.deals.createInvoice(spec(), ADMIN, {}));
    let sent = null;
    const res = { status(c) { this.code = c; return this; }, json(b) { sent = { code: this.code, ...b }; } };
    new HttpExceptionFilter().catch(e, { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'POST', url: '/admin/commerce/deals/invoice' }) }) });
    ok('409 with the human message AND data.details.invoiceId / invoiceNumber', sent.code === 409 && sent.success === false && /open activation invoice/.test(sent.message) && !!sent.data?.invoiceId && /^INV-/.test(sent.data.invoiceNumber), JSON.stringify(sent).slice(0, 160));
    let plain = null;
    const res2 = { status(c) { this.code = c; return this; }, json(b) { plain = b; } };
    new HttpExceptionFilter().catch(new (require('@nestjs/common').BadRequestException)('nope'), { switchToHttp: () => ({ getResponse: () => res2, getRequest: () => ({ method: 'GET', url: '/x' }) }) });
    ok('ordinary errors still return data: null (no change for any other endpoint)', plain.data === null && plain.message === 'nope');
  }

  section('DTO: overrideReason is validated');
  {
    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    const base = { planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', vendorId: 'v_step' };
    ok('a 10+ char overrideReason is accepted by the DTO', Boolean(await pipe.transform({ ...base, overrideReason: 'a proper reason here' }, { type: 'body', metatype: DTO.CreateDealInvoiceDto })));
    const bad = await failsWith(pipe.transform({ ...base, overrideReason: 'short' }, { type: 'body', metatype: DTO.CreateDealInvoiceDto }));
    ok('a short one is rejected with a 400 before it reaches the service', bad && bad.getStatus() === 400);
  }

  section('VENDOR AUDIT TRAIL: deal, invoice and term actions now appear (was "Nothing recorded yet")');
  {
    const w = world();
    const a = await w.deals.createInvoice(spec({ paymentDueDays: 7 }), ADMIN, { activateNow: true });
    await w.deals.createInvoice(spec({ vendorId: 'v_other' }), ADMIN, { activateNow: true });
    const view = await w.terms.adminView('v_step');
    const actions = view.audit.map((x) => x.action);
    ok('the trail shows the invoice creation and the term activation', actions.includes('deal.invoice_created') && actions.includes('term.activate_now'), actions.join());
    ok('the trail is NOT empty any more', view.audit.length >= 2);
    ok('it never includes another vendor\'s entries', view.audit.every((x) => !(x.entityType === 'Invoice' && x.entityId !== a.invoice.id) && !(x.entityType === 'BillingTerm' && x.entityId !== rows(w, 'billingTerm').find((t) => t.vendorId === 'v_step').id)));
    ok('the old behaviour (entityType Vendor only) would have returned nothing — the reason for the bug', (await w.audit.list('Vendor', 'v_step')).filter((x) => x.action !== 'vendor.modules_provisioned').length === 0);
    await w.terms.override('v_step', { planKey: 'WORKSPACE', billingCycle: 'ANNUAL', reason: 'agreed upgrade' }, ADMIN).catch(() => undefined);
    const after = (await w.terms.adminView('v_step')).audit.map((x) => x.action);
    ok('a later term override shows up too', after.includes('term.override') || after.length > actions.length, after.join());
    const isolated = (await w.terms.adminView('v_other')).audit;
    ok('the other vendor sees only its own entries', isolated.length >= 2 && isolated.every((x) => x.entityId !== a.invoice.id));
  }

  section('fix-stepnrock-term: the plan, on the REAL production shape');
  {
    const now = new Date('2026-10-08T06:17:44.994Z');
    const live = {
      now,
      terms: [
        { id: 'tOld', status: 'ACTIVE_PAYMENT_DUE', isCurrent: false, graceDays: 7, paymentDueAt: new Date('2026-10-15T03:55:25Z'), activationInvoiceId: 'i5' },
        { id: 'tCur', status: 'ACTIVE_PAYMENT_DUE', isCurrent: true, graceDays: 2, paymentDueAt: new Date('2026-10-10T04:03:51Z'), activationInvoiceId: 'i6' },
      ],
      invoices: [
        { id: 'i5', invoiceNumber: 'INV-2026-0005', kind: 'ACTIVATION', status: 'VOID', totalAmount: 599400, dueDate: new Date('2026-10-09T19:15:00Z'), termId: 'tOld' },
        { id: 'i6', invoiceNumber: 'INV-2026-0006', kind: 'ACTIVATION', status: 'SENT', totalAmount: 599400, dueDate: new Date('2026-10-10T04:03:51Z'), termId: 'tCur' },
      ],
    };
    const p = planTermFix(live);
    ok('FIX: the current term gets paymentDueAt = now + 7 days and graceDays = 7', p.level === 'FIX' && p.actions.some((a) => a.type === 'SET_TERM' && a.termId === 'tCur' && a.graceDays === 7 && a.paymentDueAt.getTime() === now.getTime() + 7 * DAY));
    ok('…and the open invoice\'s due date moves with it', p.actions.some((a) => a.type === 'SET_INVOICE_DUE' && a.invoiceId === 'i6' && a.dueDate.getTime() === now.getTime() + 7 * DAY));
    ok('only the CURRENT term and the OPEN invoice are touched (the old term and the void invoice are left alone)', p.actions.length === 2 && p.actions.every((a) => (a.termId ?? a.invoiceId) !== 'tOld' && (a.termId ?? a.invoiceId) !== 'i5'));
    ok('it REPORTS the duplicate/void invoice and the orphan term', p.report.duplicates === true && p.report.voided.includes('INV-2026-0005') && p.report.open.length === 1 && p.report.open[0] === 'INV-2026-0006' && p.report.orphanTerms.includes('tOld'));
    const fixed = { ...live, terms: [live.terms[0], { ...live.terms[1], graceDays: 7, paymentDueAt: new Date(now.getTime() + 7 * DAY) }], invoices: [live.invoices[0], { ...live.invoices[1], dueDate: new Date(now.getTime() + 7 * DAY) }] };
    ok('IDEMPOTENT: a corrected term yields NOTHING to do', planTermFix(fixed).level === 'NOTHING' && planTermFix({ ...fixed, now: new Date(now.getTime() + 2 * 3600_000) }).level === 'NOTHING');
    ok('a term the script already touched (audit marker) is not moved again without --force', planTermFix({ ...live, alreadyFixedTermIds: ['tCur'] }).level === 'NOTHING' && planTermFix({ ...live, alreadyFixedTermIds: ['tCur'], force: true }).level === 'FIX');
    ok('REFUSES with two OPEN activation invoices (will not guess which to keep)', planTermFix({ ...live, invoices: [{ ...live.invoices[0], status: 'SENT' }, live.invoices[1]] }).level === 'REFUSE');
    ok('REFUSES when there is no current term', planTermFix({ ...live, terms: live.terms.map((t) => ({ ...t, isCurrent: false })) }).level === 'REFUSE');
    ok('REFUSES when the open invoice is not the current term\'s', planTermFix({ ...live, terms: [live.terms[0], { ...live.terms[1], activationInvoiceId: 'someone_else' }] }).level === 'REFUSE');
    ok('REFUSES when a payment or proof is already in flight on the invoice', planTermFix({ ...live, submissionsByInvoice: { i6: 1 } }).level === 'REFUSE' && planTermFix({ ...live, invoices: [live.invoices[0], { ...live.invoices[1], paidPaise: 100 }] }).level === 'REFUSE');
    ok('a PAID activation with an ACTIVE term needs nothing', planTermFix({ now, terms: [{ ...live.terms[1], status: 'ACTIVE' }], invoices: [{ ...live.invoices[1], status: 'PAID' }] }).level === 'NOTHING');
    const v = verifyAfter({ terms: fixed.terms, invoices: fixed.invoices, now });
    ok('verifyAfter confirms: exactly one open invoice, it is the current term\'s, grace 7, due ~7 days, invoice date matches', v.ok, v.checks.filter(([, p2]) => !p2).map(([n]) => n).join());
    ok('verifyAfter FAILS on the uncorrected production shape', !verifyAfter({ terms: live.terms, invoices: live.invoices, now }).ok);
  }

  finish();
})().catch((e) => { console.error(e); process.exit(1); });
