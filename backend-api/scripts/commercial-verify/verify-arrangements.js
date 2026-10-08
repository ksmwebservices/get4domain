// Release 1A, Phase 7: special arrangements (half-year term, manual QR payment, GST not charged). Runs the REAL compiled services against the
// in-memory Prisma stand-in; no external system is touched. Run `npx nest build` first.
const fs = require('fs');
const os = require('os');
const path = require('path');
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-arrangements-')));

const { dist, ok, rejects, section, finish, recorder } = require('../security-verify/harness');
const { createMemPrisma } = require('./mem-prisma');

const F = dist('commercial/foundation.services');
const { WalletService } = dist('wallet/wallet.service');
const { BillingGateService } = dist('commercial/billing-gate.service');
const { InvoiceBuilderService } = dist('commercial/invoice-builder.service');
const { SettlementService } = dist('commercial/settlement.service');
const { DealsService } = dist('commercial/deals.service');
const { TermsService, PlanChangeService } = dist('commercial/terms.service');
const { RenewalService } = dist('commercial/renewal.service');
const { ArrangementsService } = dist('commercial/arrangements.service');
const { AdminArrangementsController } = dist('commercial/arrangements.controller');
const R = dist('commercial/arrangement-rules');
const M = dist('commercial/pricing-math');

const ADMIN = { id: 'admin1', email: 'admin@get4domain.com', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' };
const DAY = 86_400_000;
const inDays = (n, from = new Date()) => new Date(from.getTime() + n * DAY);

function world() {
  const prisma = createMemPrisma({
    vendor: [
      { id: 'v1', name: 'One', email: 'one@x.in', businessName: 'One Co', phone: '9000000001', subdomain: 'oneco', isSandbox: false, expiresAt: null, status: 'ACTIVE', role: 'VENDOR' },
      { id: 'v2', name: 'Two', email: 'two@x.in', businessName: 'Two Co', phone: '9000000002', subdomain: 'twoco', isSandbox: false, expiresAt: null, status: 'ACTIVE', role: 'VENDOR' },
    ],
    wallet: [{ id: 'w1', vendorId: 'v1', balance: 0, totalCredited: 0, totalDebited: 0 }, { id: 'w2', vendorId: 'v2', balance: 0, totalCredited: 0, totalDebited: 0 }],
    specialArrangement: [],
  });
  const email = recorder('email');
  const notif = recorder('notif');
  const legacy = { resolveCompany: async () => ({ name: 'KSM' }) };
  const gate = new BillingGateService(prisma);
  const wallet = new WalletService(prisma, legacy, gate);
  const audit = new F.CommercialAuditService(prisma);
  const messenger = new F.CommercialMessenger(email, recorder('wa', { sendMessage: async () => ({ status: 'mock', mock: true }) }), notif);
  const builder = new InvoiceBuilderService(prisma);
  const settlement = new SettlementService(prisma, audit, messenger, legacy, email);
  const arrangements = new ArrangementsService(prisma, audit, messenger);
  const deals = new DealsService(prisma, wallet, builder, settlement, audit, messenger, email, arrangements);
  const terms = new TermsService(prisma, audit, settlement);
  const planChanges = new PlanChangeService(prisma, audit, messenger, deals, builder, terms, arrangements);
  const renewal = new RenewalService(prisma, builder, deals, messenger, audit, arrangements);
  return { prisma, deals, arrangements, planChanges, renewal, settlement, audit, notif, t: prisma.$tables };
}
const rows = (w, n) => w.t[n] ?? [];
const standard = (over = {}) => ({ vendorId: 'v1', planKey: 'WORKSPACE', billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE', graceDays: 7, allowedChannels: ['RAZORPAY'], ...over });
// A half-year deal at the KSM-approved net (list is 55% of annual = 6,593.40; net 5,994.00).
const half = (over = {}) => standard({ billingCycle: 'HALF_YEARLY', gstMode: 'NONE', discount: { mode: 'FLAT', value: 59940, reason: 'approved net 5,994.00' }, ...over });
const arr = (over = {}) => ({ vendorId: 'v1', allowHalfYear: true, gstMode: 'NONE', allowedChannels: ['UPI_QR'], validUntil: inDays(90), reason: 'Founding client on special terms', ...over });

(async () => {
  section('[feat:account.billing.arrangements] pure rules');
  {
    const now = new Date('2026-10-09T00:00:00Z');
    const bad = (label, input, text) => { try { R.validateArrangementInput(input, now); ok(label, false, 'accepted'); } catch (e) { ok(`${label} [${e.message.slice(0, 70)}]`, e instanceof RangeError && (!text || e.message.includes(text))); } };
    ok('constants live in one place: half-year list 55%, GST-none at most 6 months', M.HALF_YEAR_LIST_PERCENT === 55 && R.MAX_GST_NONE_MONTHS === 6 && R.ARRANGEMENT_WARN_DAYS === 15);
    bad('GST not charged WITHOUT a reason is rejected', arr({ reason: '' , validUntil: inDays(30, now) }), 'reason');
    bad('GST not charged WITHOUT an end date is rejected', arr({ validUntil: null }), 'end date');
    bad('GST not charged for more than 6 months is rejected', arr({ validUntil: inDays(200, now) }), '6 months');
    bad('an end date in the past is rejected', arr({ validUntil: inDays(-1, now) }), 'future');
    bad('an arrangement that grants nothing is rejected', { allowHalfYear: false, gstMode: 'EXCLUSIVE', allowedChannels: [], validUntil: inDays(30, now), reason: 'nothing at all here' }, 'at least one exception');
    bad('RAZORPAY is not an exception, and unknown channels are refused', { ...arr(), allowedChannels: ['CASH'] }, 'UPI QR and Offline');
    ok('a valid GST-none arrangement of 5 months passes', R.validateArrangementInput(arr({ validUntil: inDays(150, now) }), now).gstMode === 'NONE');
    ok('a half-year-only arrangement may run up to 24 months', R.validateArrangementInput({ allowHalfYear: true, validUntil: inDays(700, now), reason: 'two year partner deal' }, now).allowHalfYear === true);
    const live = { allowHalfYear: true, gstMode: 'NONE', allowedChannels: ['UPI_QR'], validUntil: inDays(10, now), active: true };
    ok('violations: none with the right arrangement', R.arrangementViolations({ planKey: 'BOS', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', channels: ['RAZORPAY', 'UPI_QR'] }, live, now).length === 0);
    ok('violations: Custom is never a term, even with an arrangement', R.arrangementViolations({ planKey: 'CUSTOM', billingCycle: 'HALF_YEARLY', gstMode: 'EXCLUSIVE', channels: ['RAZORPAY'] }, live, now).some((m) => m.includes('Essentials and Pro')));
    ok('violations: an ended or expired arrangement grants nothing', R.arrangementViolations({ planKey: 'BOS', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', channels: ['UPI_QR'] }, { ...live, validUntil: inDays(-1, now) }, now).length === 3 && R.arrangementViolations({ planKey: 'BOS', billingCycle: 'HALF_YEARLY', gstMode: 'NONE', channels: ['UPI_QR'] }, { ...live, active: false }, now).length === 3);
    ok('violations: OFFLINE is refused when only UPI_QR is allowed', R.arrangementViolations({ planKey: 'BOS', billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE', channels: ['OFFLINE'] }, live, now).length === 1);
    const sg = R.shadowGst(599400, new Date('2027-03-31T00:00:00Z'));
    ok('shadow GST is 18% of the net and the note names the end date', sg.gstForgonePaise === 107892 && /^GST not charged — special arrangement until 31 Mar 2027$/.test(sg.gstNote), sg.gstNote);
    const rb = R.renewalBilling({ billingCycle: 'HALF_YEARLY', cycleMonths: 6, gstMode: 'NONE', allowedChannels: ['RAZORPAY', 'UPI_QR'], planKey: 'WORKSPACE' }, null, now);
    ok('renewalBilling with no arrangement: annual, GST on top, Razorpay only, and it says what changed', rb.billingCycle === 'ANNUAL' && rb.months === 12 && rb.gstMode === 'EXCLUSIVE' && rb.channels.join() === 'RAZORPAY' && rb.reverted.length === 3);
    const keep = R.renewalBilling({ billingCycle: 'HALF_YEARLY', cycleMonths: 6, gstMode: 'NONE', allowedChannels: ['RAZORPAY', 'UPI_QR'], planKey: 'WORKSPACE' }, live, now);
    ok('renewalBilling with the arrangement in force keeps the terms', keep.billingCycle === 'HALF_YEARLY' && keep.gstMode === 'NONE' && keep.channels.includes('UPI_QR') && keep.reverted.length === 0);
    const pr = { active: true, validUntil: inDays(14, now), expiryWarnedAt: null, expiredNotifiedAt: null };
    ok('expiry notices: warn at 15 days, once; expired once; nothing for an ended one', R.expiryAction(pr, now) === 'WARN' && R.expiryAction({ ...pr, expiryWarnedAt: now }, now) === 'NONE' && R.expiryAction({ ...pr, validUntil: inDays(-1, now) }, now) === 'EXPIRED' && R.expiryAction({ ...pr, validUntil: inDays(-1, now), expiredNotifiedAt: now }, now) === 'NONE' && R.expiryAction({ ...pr, active: false }, now) === 'NONE' && R.expiryAction({ ...pr, validUntil: inDays(40, now) }, now) === 'NONE');
  }

  section('[feat:account.billing.arrangements] admin service: create, edit, end, history, audit');
  {
    const w = world();
    const a = await w.arrangements.create(arr(), ADMIN);
    ok('create stores the arrangement active, with a history entry and audit entries on the arrangement and on the client', a.active === true && a.history.length === 1 && rows(w, 'commercialAuditLog').filter((x) => x.action === 'arrangement.created').length === 2);
    await rejects('a second active arrangement for the same client is refused', w.arrangements.create(arr(), ADMIN), { status: 409 });
    await rejects('an unknown client is a clean 404', w.arrangements.create(arr({ vendorId: 'ghost' }), ADMIN), { status: 404 });
    await rejects('creating without a reason is a 400', w.arrangements.create(arr({ reason: 'short' }), ADMIN), { status: 400 });
    const edited = await w.arrangements.update(a.id, { allowedChannels: ['UPI_QR', 'OFFLINE'], validUntil: inDays(120), reason: 'Added offline for cheque payments' }, ADMIN);
    ok('edit changes the arrangement, appends to history and audits before/after', edited.allowedChannels.includes('OFFLINE') && edited.history.length === 2 && rows(w, 'commercialAuditLog').some((x) => x.action === 'arrangement.edited' && x.entityType === 'SpecialArrangement'));
    await rejects('ending needs a real reason', w.arrangements.end(a.id, 'no', ADMIN), { status: 400 });
    const ended = await w.arrangements.end(a.id, 'Client moved to standard annual plan', ADMIN);
    ok('ending switches it off, records who/why/when and keeps the row (history is never deleted)', ended.active === false && ended.endedBy === ADMIN.email && ended.endReason.includes('standard annual') && ended.history.length === 3 && rows(w, 'specialArrangement').length === 1);
    await rejects('an ended arrangement cannot be edited or ended again', w.arrangements.update(a.id, { reason: 'trying to edit after the end' }, ADMIN), { status: 409 });
    ok('after the end, the client has no arrangement in force', (await w.arrangements.activeFor('v1')) === null);
    const h = await w.arrangements.history(a.id);
    ok('history API returns the change list and the audit entries', h.history.length === 3 && h.audit.length >= 3);
    const again = await w.arrangements.create(arr({ reason: 'Renewed as a new arrangement for 90 days' }), ADMIN);
    ok('a NEW arrangement can follow an ended one (renewal is a fresh, audited decision)', again.active === true && rows(w, 'specialArrangement').length === 2);
    const list = await w.arrangements.list('active');
    ok('list shows client, plan context, state and supports filters', list.length === 1 && list[0].vendor.businessName === 'One Co' && list[0].state === 'ACTIVE' && (await w.arrangements.list('expired')).length === 0);
  }

  section('[feat:account.billing.arrangements] server-side enforcement in the deal builder');
  {
    const w = world();
    await rejects('half-year with NO arrangement is rejected', w.deals.createInvoice(half(), ADMIN, {}), { status: 400, includes: 'half-year' });
    await rejects('GST not charged with NO arrangement is rejected', w.deals.createInvoice(standard({ gstMode: 'NONE' }), ADMIN, {}), { status: 400, includes: 'GST' });
    await rejects('manual UPI QR with NO arrangement is rejected', w.deals.createInvoice(standard({ allowedChannels: ['RAZORPAY', 'UPI_QR'] }), ADMIN, {}), { status: 400, includes: 'UPI QR' });
    await rejects('offline payment with NO arrangement is rejected', w.deals.createInvoice(standard({ allowedChannels: ['OFFLINE'] }), ADMIN, {}), { status: 400, includes: 'Offline' });
    await rejects('the same rules apply to saving a draft and to the live preview', w.deals.saveDraft(half(), ADMIN), { status: 400 });
    await rejects('…and to the preview', w.deals.preview(half()), { status: 400 });
    ok('nothing was created by any refused attempt', rows(w, 'invoice').length === 0 && rows(w, 'billingDeal').length === 0);
    const std = await w.deals.createInvoice(standard(), ADMIN, {});
    ok('the STANDARD deal (annual, Razorpay, GST 18% on top) always works', std.invoice.gstMode === 'EXCLUSIVE' && std.invoice.billingCycle === 'ANNUAL' && std.invoice.gstForgonePaise == null && std.invoice.allowedChannels.join() === 'RAZORPAY');

    await w.arrangements.create(arr(), ADMIN);
    const h1 = await w.deals.createInvoice(half({ vendorId: 'v1', graceDays: 7 }), ADMIN, { overrideReason: 'second invoice for the same client in this test' });
    ok('half-year on WORKSPACE passes with an arrangement; list is 55% and the approved net is honoured', h1.invoice.billingCycle === 'HALF_YEARLY' && h1.invoice.listAmountPaise === 659340 && h1.invoice.amount === 599400);
    const h2 = await w.deals.createInvoice(half({ vendorId: 'v1', planKey: 'BOS', discount: { mode: 'FLAT', value: 100000, reason: 'approved net for BOS half-year' } }), ADMIN, { overrideReason: 'second invoice for the same client in this test' });
    ok('half-year on BOS passes too', h2.invoice.billingCycle === 'HALF_YEARLY' && h2.invoice.planKey === 'BOS');
    await rejects('half-year on Custom (not a plan, not a term) is rejected even with an arrangement', w.deals.createInvoice(half({ planKey: 'CUSTOM' }), ADMIN, {}), { status: 400, includes: 'Essentials and Pro' });
    ok('GST not charged: the invoice stores the GST it would have carried (18% of the net) and the printed note', h1.invoice.gstMode === 'NONE' && h1.invoice.gstAmount === 0 && h1.invoice.gstForgonePaise === Math.round(599400 * 0.18) && /^GST not charged — special arrangement until /.test(h1.invoice.gstNote));
    const up = await w.deals.createInvoice(standard({ allowedChannels: ['RAZORPAY', 'UPI_QR'] }), ADMIN, { overrideReason: 'second invoice for the same client in this test' });
    ok('UPI QR passes when the arrangement allows it', up.invoice.allowedChannels.includes('UPI_QR'));
    await rejects('…but OFFLINE is still refused when the arrangement lists only UPI QR', w.deals.createInvoice(standard({ allowedChannels: ['OFFLINE'] }), ADMIN, { overrideReason: 'second invoice for the same client in this test' }), { status: 400 });
    await rejects('another client gets nothing from this client\'s arrangement', w.deals.createInvoice(half({ vendorId: 'v2' }), ADMIN, {}), { status: 400 });
    ok('every created invoice with NONE carries a shadow GST; standard invoices carry none', rows(w, 'invoice').filter((i) => i.gstMode === 'NONE').every((i) => i.gstForgonePaise > 0) && rows(w, 'invoice').filter((i) => i.gstMode !== 'NONE').every((i) => i.gstForgonePaise == null));

    // expiry: the arrangement's end date passes -> the same deal is refused again
    const ar = rows(w, 'specialArrangement')[0]; ar.validUntil = inDays(-1);
    await rejects('EXPIRY: once the end date has passed the same half-year deal is refused again', w.deals.createInvoice(half({ vendorId: 'v1' }), ADMIN, { overrideReason: 'second invoice for the same client in this test' }), { status: 400 });
  }

  section('[feat:account.billing.arrangements] renewal: continues only while in force, then reverts to annual / EXCLUSIVE / Razorpay');
  {
    const make = async (validDays) => {
      const w = world();
      await w.arrangements.create(arr({ validUntil: inDays(validDays) }), ADMIN);
      const T0 = new Date();
      await w.deals.createInvoice(half({ allowedChannels: ['RAZORPAY', 'UPI_QR'] }), ADMIN, {});
      const inv = rows(w, 'invoice')[0];
      await w.settlement.applyPayment(inv.id, { amountPaise: inv.totalAmount, via: 'OFFLINE', actor: ADMIN, now: T0 });
      return { w, T0, term: rows(w, 'billingTerm').find((t) => t.isCurrent) };
    };
    const a = await make(150);
    ok('setup: a paid half-year term with GST not charged and UPI QR allowed', a.term.billingCycle === 'HALF_YEARLY' && a.term.gstMode === 'NONE' && a.term.allowedChannels.includes('UPI_QR'));
    const r1 = await a.w.renewal.createRenewalInvoice(a.term, inDays(20, a.T0));
    const inv1 = rows(a.w, 'invoice').find((i) => i.id === r1.invoiceId);
    ok('arrangement IN FORCE at renewal: the half-year terms continue (still NONE, shadow GST stored)', inv1.billingCycle === 'HALF_YEARLY' && inv1.gstMode === 'NONE' && inv1.gstForgonePaise > 0 && inv1.allowedChannels.includes('UPI_QR'));

    const b = await make(60);
    const late = inDays(100, b.T0); // 40 days after the arrangement ended
    const notifBefore = b.w.notif.calls.length;
    const r2 = await b.w.renewal.createRenewalInvoice(b.term, late);
    const inv2 = rows(b.w, 'invoice').find((i) => i.id === r2.invoiceId);
    const annualList = M.planListPaise(1198800, 12);
    ok('arrangement ENDED before renewal: the invoice is ANNUAL, GST 18% on top, Razorpay only', inv2.billingCycle === 'ANNUAL' && inv2.cycleMonths === 12 && inv2.gstMode === 'EXCLUSIVE' && inv2.allowedChannels.join() === 'RAZORPAY', JSON.stringify({ c: inv2.billingCycle, g: inv2.gstMode, ch: inv2.allowedChannels }));
    ok('…priced at the ANNUAL list with 18% GST added, no shadow GST, no half-year net carried over', inv2.amount === annualList && inv2.gstAmount === Math.round(annualList * 0.18) && inv2.totalAmount === annualList + Math.round(annualList * 0.18) && inv2.gstForgonePaise == null && inv2.discountPaise === 0);
    ok('…KSM is told, and the reversion is in the audit log', b.w.notif.calls.length > notifBefore && rows(b.w, 'commercialAuditLog').some((x) => x.action === 'renewal.reverted_to_standard' && x.detail.reverted.length === 3));
    await b.w.settlement.applyPayment(inv2.id, { amountPaise: inv2.totalAmount, via: 'OFFLINE', actor: ADMIN, now: late });
    const nt = rows(b.w, 'billingTerm').find((t) => t.isCurrent);
    ok('after paying, the NEW term is annual / EXCLUSIVE / Razorpay only (it does not inherit UPI QR or GST-none from the old term)', nt.billingCycle === 'ANNUAL' && nt.gstMode === 'EXCLUSIVE' && nt.allowedChannels.join() === 'RAZORPAY');

    const c = await make(150);
    await c.w.arrangements.end(rows(c.w, 'specialArrangement')[0].id, 'Ended by KSM before the renewal', ADMIN);
    const r3 = await c.w.renewal.createRenewalInvoice(c.term, inDays(20, c.T0));
    const inv3 = rows(c.w, 'invoice').find((i) => i.id === r3.invoiceId);
    ok('renewal after an arrangement was ENDED early is annual / EXCLUSIVE / Razorpay', inv3.billingCycle === 'ANNUAL' && inv3.gstMode === 'EXCLUSIVE' && inv3.allowedChannels.join() === 'RAZORPAY');
  }

  section('[feat:account.billing.arrangements] plan change requests respect the same rule');
  {
    const w = world();
    await w.deals.createInvoice(standard(), ADMIN, {});
    const inv = rows(w, 'invoice')[0];
    await w.settlement.applyPayment(inv.id, { amountPaise: inv.totalAmount, via: 'OFFLINE', actor: ADMIN, now: new Date() });
    await rejects('a vendor cannot request a half-year plan without an arrangement', w.planChanges.request('v1', { toPlanKey: 'WORKSPACE', toCycle: 'HALF_YEARLY' }), { status: 400, includes: 'half-year' });
    await w.arrangements.create(arr(), ADMIN);
    const req = await w.planChanges.request('v1', { toPlanKey: 'BOS', toCycle: 'HALF_YEARLY' });
    ok('…and can once KSM has allowed it (the request is created, KSM still approves it)', req.status === 'REQUESTED' && req.toCycle === 'HALF_YEARLY');
    rows(w, 'specialArrangement')[0].validUntil = inDays(-1);
    await rejects('if the arrangement ended before KSM approves, approval is refused', w.planChanges.approve(req.id, { effective: 'AT_RENEWAL' }, ADMIN), { status: 400 });
  }

  section('[feat:account.billing.arrangements] daily notices: 15 days before and when ended, idempotent');
  {
    const w = world();
    const a = await w.arrangements.create(arr({ validUntil: inDays(40) }), ADMIN);
    const now0 = new Date();
    ok('nothing to say 40 days out', (await w.arrangements.runNotices(now0)).warned === 0 && w.notif.calls.length === 0);
    const n15 = inDays(26, now0); // 14 days before the end
    const first = await w.arrangements.runNotices(n15);
    ok('14 days before: one warning, to the admin, naming the client and the date', first.warned === 1 && w.notif.calls.length === 1 && JSON.stringify(w.notif.calls[0]).includes('One Co'));
    const second = await w.arrangements.runNotices(inDays(27, now0));
    ok('IDEMPOTENT: running again (or on the next day) sends nothing more', second.warned === 0 && second.expired === 0 && w.notif.calls.length === 1);
    const gone = inDays(41, now0);
    const third = await w.arrangements.runNotices(gone);
    ok('after the end date: exactly one "ended" notice and an audit entry', third.expired === 1 && w.notif.calls.length === 2 && rows(w, 'commercialAuditLog').some((x) => x.action === 'arrangement.expired'));
    ok('…and no repeat', (await w.arrangements.runNotices(inDays(42, now0))).expired === 0 && w.notif.calls.length === 2);
    const b = await w.arrangements.create(arr({ vendorId: 'v2', validUntil: inDays(10) }), ADMIN);
    await w.arrangements.runNotices(now0);
    const calls = w.notif.calls.length;
    await w.arrangements.update(b.id, { validUntil: inDays(100), reason: 'Extended after talking to the client' }, ADMIN);
    ok('moving the end date clears the notice flags so the new date gets its own notices', rows(w, 'specialArrangement').find((x) => x.id === b.id).expiryWarnedAt === null && calls >= 3);
    ok('a notice for a still-running arrangement outside the 15-day window never fires', (await w.arrangements.runNotices(now0)).warned === 0);
    ok('the first arrangement id exists and stays untouched by the other', rows(w, 'specialArrangement').find((x) => x.id === a.id).vendorId === 'v1');
  }

  section('[feat:account.billing.arrangements] "GST not collected" report for the CA');
  {
    const w = world();
    await w.arrangements.create(arr(), ADMIN);
    await w.arrangements.create(arr({ vendorId: 'v2' }), ADMIN);
    const i1 = await w.deals.createInvoice(half({ vendorId: 'v1' }), ADMIN, {});
    const i2 = await w.deals.createInvoice(half({ vendorId: 'v2' }), ADMIN, {});
    const i3 = await w.deals.createInvoice(half({ vendorId: 'v2', discount: { mode: 'FLAT', value: 59940, reason: 'second approved net' } }), ADMIN, { overrideReason: 'second invoice for the same client in this test' });
    const inv3 = rows(w, 'invoice').find((x) => x.id === i3.invoice.id);
    inv3.status = 'VOID';
    const inv2 = rows(w, 'invoice').find((x) => x.id === i2.invoice.id);
    inv2.createdAt = new Date('2026-09-15T00:00:00Z');
    await w.settlement.applyPayment(i1.invoice.id, { amountPaise: i1.invoice.totalAmount, via: 'OFFLINE', actor: ADMIN, now: new Date() });
    const rep = await w.arrangements.gstReport({});
    const per = Math.round(599400 * 0.18);
    ok('report groups by month and client; void invoices are left out', rep.rows.length === 2 && rep.rows.some((r) => r.month === '2026-09' && r.businessName === 'Two Co' && r.gstForgonePaise === per) && rep.totalPaise === per * 2, JSON.stringify(rep.rows));
    ok('…and separates what is already paid', rep.paidTotalPaise === per && rep.rows.find((r) => r.businessName === 'One Co').paidGstForgonePaise === per);
    const filtered = await w.arrangements.gstReport({ from: '2026-09-01T00:00:00Z', to: '2026-09-30T23:59:59Z' });
    ok('a date range narrows the report', filtered.rows.length === 1 && filtered.rows[0].month === '2026-09');
  }

  section('[feat:account.billing.arrangements] permissions: platform admins only, MARKETING gets 403');
  {
    const guards = Reflect.getMetadata('__guards__', AdminArrangementsController) || [];
    ok('the whole controller sits behind CommercialAdminGuard', guards.includes(F.CommercialAdminGuard));
    const proto = AdminArrangementsController.prototype;
    const writes = ['create', 'update', 'end'].map((m) => Reflect.getMetadata('__guards__', proto[m]) || []);
    ok('create, edit and end also sit behind MoneyAdminGuard', writes.every((g) => g.includes(F.MoneyAdminGuard)));
    const ctx = (user) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    const denied = (g, user) => { try { g.canActivate(ctx(user)); return false; } catch (e) { return e.getStatus && e.getStatus() === 403; } };
    const base = new F.CommercialAdminGuard();
    const money = new F.MoneyAdminGuard();
    ok('MARKETING staff, vendors, team members and sandbox users get 403 from both guards', [base, money].every((g) => denied(g, { role: 'ADMIN', adminRole: 'MARKETING' }) && denied(g, { role: 'VENDOR' }) && denied(g, { role: 'ADMIN', kind: 'team_member' }) && denied(g, { role: 'ADMIN', kind: 'sandbox' }) && denied(g, undefined)));
    ok('a platform admin is allowed', base.canActivate(ctx({ role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' })) === true && money.canActivate(ctx({ role: 'ADMIN', adminRole: 'OPERATIONS' })) === true);
    const routes = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');
    ok('every route is documented (ApiOperation) and there are no unguarded extras', routes.length === 7 && routes.every((n) => Reflect.getMetadata('swagger/apiOperation', proto[n])));
  }

  finish();
})().catch((e) => { console.error(e); process.exit(1); });
