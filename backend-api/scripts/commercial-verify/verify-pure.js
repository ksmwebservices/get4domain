// Commercial Engine v1 — pure-logic assertions (money math, rules, tokens, UPI). No I/O.
const { dist, ok, rejects, section, finish } = require('../security-verify/harness');

const M = dist('commercial/pricing-math');
const E = dist('commercial/entitlements');
const R = dist('commercial/promo-rules');
const T = dist('commercial/term-rules');
const K = dist('commercial/pay-token');
const U = dist('commercial/upi');
const Q = dist('commercial/quote-builder');

const throwsSync = (label, fn, includes) => {
  try { fn(); ok(label, false, 'expected a throw'); } catch (e) { ok(`${label} [${String(e.message).slice(0, 60)}]`, includes ? e.message.includes(includes) : true); }
};
const d = (iso) => new Date(iso);
const L = (amountPaise, label = 'x', kind = 'PLAN', qty = 1) => ({ kind, label, amountPaise, qty });

(async () => {
  section('TOTALS — GST is computed on the NET AFTER DISCOUNT, for every GST mode');
  {
    const ws6 = [L(599400)];
    let t = M.computeTotals(ws6, 0, 'EXCLUSIVE');
    ok('EXCLUSIVE no discount: ₹5,994 + 18% = ₹7,072.92', t.netPaise === 599400 && t.gstPaise === 107892 && t.totalPaise === 707292, JSON.stringify(t));
    t = M.computeTotals([L(1198800)], 119880, 'EXCLUSIVE'); // 10% off ₹11,988
    ok('EXCLUSIVE with 10% discount: GST on net (₹10,789.20), NOT on the list price', t.netPaise === 1078920 && t.gstPaise === Math.round(1078920 * 0.18) && t.totalPaise === 1078920 + t.gstPaise, JSON.stringify(t));
    ok('…and that differs from GST-on-list (guards against the classic bug)', t.gstPaise !== Math.round(1198800 * 0.18));
    t = M.computeTotals([L(1000000)], 0, 'INCLUSIVE');
    ok('INCLUSIVE ₹10,000: total stays ₹10,000, taxable ₹8,474.58, GST ₹1,525.42', t.totalPaise === 1000000 && t.taxablePaise === 847458 && t.gstPaise === 152542, JSON.stringify(t));
    t = M.computeTotals([L(1000000)], 100000, 'INCLUSIVE');
    ok('INCLUSIVE with ₹1,000 off: total ₹9,000, GST backed out of the NET (₹1,372.88)', t.totalPaise === 900000 && t.taxablePaise === 762712 && t.gstPaise === 137288, JSON.stringify(t));
    t = M.computeTotals(ws6, 0, 'NONE');
    ok('NONE (stepnrock deal): total = ₹5,994.00 exactly, no GST', t.totalPaise === 599400 && t.gstPaise === 0 && t.taxablePaise === 599400, JSON.stringify(t));
    t = M.computeTotals([L(500000), L(250000, 'add', 'ADDON', 2)], 50000, 'EXCLUSIVE');
    ok('multiple lines with qty: subtotal 10,00,000 → net 9,50,000', t.subtotalPaise === 1000000 && t.netPaise === 950000, JSON.stringify(t));
    t = M.computeTotals([L(1000000), L(-200000, 'credit', 'CREDIT')], 0, 'EXCLUSIVE');
    ok('a CREDIT line reduces the net before GST', t.netPaise === 800000 && t.gstPaise === 144000, JSON.stringify(t));
    for (const mode of ['EXCLUSIVE', 'INCLUSIVE', 'NONE']) {
      const x = M.computeTotals([L(123457)], 12345, mode);
      ok(`${mode}: taxable + GST == total (no paisa lost)`, x.taxablePaise + x.gstPaise === x.totalPaise, JSON.stringify(x));
    }
    throwsSync('discount larger than subtotal is rejected', () => M.computeTotals(ws6, 599401, 'NONE'), 'exceed');
    throwsSync('negative discount is rejected', () => M.computeTotals(ws6, -1, 'NONE'));
    throwsSync('fractional paise discount is rejected', () => M.computeTotals(ws6, 10.5, 'NONE'));
    ok('100% discount gives ₹0 (a free deal is representable)', M.computeTotals(ws6, 599400, 'EXCLUSIVE').totalPaise === 0);
  }

  section('DISCOUNT rules');
  {
    ok('percent discount: 10% of ₹11,988', M.discountFromPercent(1198800, 10) === 119880);
    ok('exactly 20% is NOT "big"', M.isBigDiscount(1000000, 200000) === false);
    ok('20.01% IS "big" (needs CONFIRM)', M.isBigDiscount(1000000, 200100) === true);
    const rates = { WORKSPACE: 1198800, BOS: 2398800 };
    const base = { planKey: 'WORKSPACE', billingCycle: 'ANNUAL', gstMode: 'EXCLUSIVE' };
    throwsSync('manual discount without a reason is rejected', () => Q.buildQuote({ ...base, discount: { mode: 'PERCENT', value: 10 } }, rates), 'reason');
    throwsSync('discount over 20% without CONFIRM is rejected', () => Q.buildQuote({ ...base, discount: { mode: 'PERCENT', value: 25, reason: 'friend of KSM' } }, rates), 'CONFIRM');
    const big = Q.buildQuote({ ...base, discount: { mode: 'PERCENT', value: 25, reason: 'friend of KSM', confirm: 'CONFIRM' } }, rates);
    ok('discount over 20% with CONFIRM is accepted and flagged big', big.bigDiscount === true && big.totals.discountPaise === 299700, JSON.stringify(big.totals));
    throwsSync('"confirm" must be typed exactly', () => Q.buildQuote({ ...base, discount: { mode: 'PERCENT', value: 25, reason: 'x y z', confirm: 'confirm' } }, rates), 'CONFIRM');
    const q = Q.buildQuote({ planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE' }, rates);
    ok('stepnrock deal: Workspace half-yearly lists at ₹5,994 (annual ÷ 12 × 6) and totals ₹5,994', q.lines[0].amountPaise === 599400 && q.totals.totalPaise === 599400 && q.months === 6, JSON.stringify(q.totals));
    throwsSync('add-on with a zero/negative amount is rejected', () => Q.buildQuote({ gstMode: 'NONE', addons: [{ kind: 'CUSTOM', label: 'x', amountPaise: 0 }] }, rates));
    throwsSync('a quote with no lines is rejected', () => Q.buildQuote({ gstMode: 'NONE' }, rates), 'plan or at least one');
    throwsSync('plan without a billing cycle is rejected', () => Q.buildQuote({ planKey: 'BOS', gstMode: 'NONE' }, rates), 'billing cycle');
  }

  section('CYCLES, list prices, month arithmetic');
  {
    ok('MONTHLY=1, HALF_YEARLY=6, ANNUAL=12', M.cycleMonths('MONTHLY') === 1 && M.cycleMonths('HALF_YEARLY') === 6 && M.cycleMonths('ANNUAL') === 12);
    ok('CUSTOM_MONTHS accepts 1..60', M.cycleMonths('CUSTOM_MONTHS', 7) === 7 && M.cycleMonths('CUSTOM_MONTHS', 60) === 60);
    for (const bad of [0, 61, 2.5, null, undefined]) throwsSync(`CUSTOM_MONTHS rejects ${bad}`, () => M.cycleMonths('CUSTOM_MONTHS', bad));
    ok('list price = annual ÷ 12 × months', M.planListPaise(1198800, 6) === 599400 && M.planListPaise(1198800, 1) === 99900 && M.planListPaise(2398800, 3) === 599700 && M.planListPaise(1198800, 12) === 1198800);
    ok('31 Jan + 1 month clamps to 28 Feb (no overflow into March)', M.addMonths(d('2026-01-31T00:00:00Z'), 1).toISOString().startsWith('2026-02-28'));
    ok('31 Jan + 1 month in a leap year → 29 Feb', M.addMonths(d('2028-01-31T00:00:00Z'), 1).toISOString().startsWith('2028-02-29'));
    ok('15 Dec + 2 months crosses the year', M.addMonths(d('2026-12-15T00:00:00Z'), 2).toISOString().startsWith('2027-02-15'));
    ok('+12 months is the same calendar day next year', M.addMonths(d('2026-10-07T05:00:00Z'), 12).toISOString() === '2027-10-07T05:00:00.000Z');
  }

  section('RENEWAL period extends from the previous periodEnd (no lost days)');
  {
    const now = d('2026-12-20T00:00:00Z');
    let p = M.renewalPeriod(d('2027-01-05T00:00:00Z'), now, 6);
    ok('early renewal: new period starts at the OLD end (5 Jan), not today', p.start.toISOString().startsWith('2027-01-05') && p.end.toISOString().startsWith('2027-07-05'), JSON.stringify(p));
    p = M.renewalPeriod(d('2026-12-10T00:00:00Z'), now, 6);
    ok('slightly late renewal stays contiguous from the old end', p.start.toISOString().startsWith('2026-12-10') && p.end.toISOString().startsWith('2027-06-10'));
    p = M.renewalPeriod(d('2026-01-01T00:00:00Z'), now, 3);
    ok('renewing so late the contiguous period is already over starts from today', p.start.getTime() === now.getTime() && p.end.toISOString().startsWith('2027-03-20'), JSON.stringify(p));
    p = M.renewalPeriod(null, now, 12);
    ok('no previous term: starts today', p.start.getTime() === now.getTime());
  }

  section('PRORATION = unused days × daily net rate');
  {
    const term = { netAmountPaise: 1200000, periodStart: d('2026-01-01T00:00:00Z'), periodEnd: d('2027-01-01T00:00:00Z') }; // 365 days
    ok('day 100 of 365 → 265 unused days → ₹8,712.33', M.prorationCreditPaise(term, d('2026-04-11T00:00:00Z')) === Math.round((1200000 * 265) / 365), String(M.prorationCreditPaise(term, d('2026-04-11T00:00:00Z'))));
    ok('exactly 871233 paise', M.prorationCreditPaise(term, d('2026-04-11T00:00:00Z')) === 871233);
    ok('on the last day: 1 unused day', M.prorationCreditPaise(term, d('2026-12-31T00:00:00Z')) === Math.round(1200000 / 365));
    ok('after the term ended: no credit', M.prorationCreditPaise(term, d('2027-02-01T00:00:00Z')) === 0);
    ok('before the term started: capped at the full net (never more)', M.prorationCreditPaise(term, d('2025-06-01T00:00:00Z')) === 1200000);
    ok('a free term has nothing to credit', M.prorationCreditPaise({ ...term, netAmountPaise: 0 }, d('2026-04-11T00:00:00Z')) === 0);
  }

  section('ENTITLEMENTS come from planKey only — never from price');
  {
    ok('entitlementsFor takes exactly one argument (the planKey)', E.entitlementsFor.length === 1);
    const w = E.entitlementsFor('WORKSPACE'); const b = E.entitlementsFor('BOS');
    ok('Workspace: ₹499 annual credit, 3 keywords, 2 theme changes, no BOS modules', w.aiCreditAnnualPaise === 49900 && w.seoKeywords === 3 && w.themeChangesPerYear === 2 && !w.hrm && !w.fullAccounting && !w.inventory && !w.whatsappBotReply);
    ok('BOS: ₹1,299 annual credit, 6 keywords, 4 theme changes, full back office', b.aiCreditAnnualPaise === 129900 && b.seoKeywords === 6 && b.themeChangesPerYear === 4 && b.hrm && b.fullAccounting && b.inventory && b.taskManagement && b.whatsappBotReply);
    ok('a plan is the same plan at ₹1 or ₹1,00,000 (nothing in the entitlement depends on an amount)', JSON.stringify(E.entitlementsFor('BOS')) === JSON.stringify(b));
    throwsSync('unknown plan key throws', () => E.entitlementsFor('PLATINUM'));
    ok('SEO keyword counting: dedupes, trims, splits , ; newline', E.countSeoKeywords(' Shoes, shoes ; running\nsneakers,, ') === 3);
    ok('empty keywords = 0', E.countSeoKeywords('') === 0 && E.countSeoKeywords(null) === 0);
  }

  section('PROMO rules (pure)');
  {
    const promo = { active: true, type: 'PERCENT', value: 10, appliesToPlans: [], appliesToCycles: [], appliesToKinds: [], minCycleMonths: null, validFrom: null, validTo: null, maxRedemptions: null, perVendorLimit: 1 };
    const ctx = { now: d('2026-10-07T00:00:00Z'), planKey: 'WORKSPACE', billingCycle: 'ANNUAL', cycleMonths: 12, kind: 'ACTIVATION', subtotalPaise: 1198800, adminDiscountPresent: false, allowStacking: false, redemptionsTotal: 0, redemptionsByVendor: 0, invoiceHasPromo: false };
    const run = (p, c) => R.evaluatePromo({ ...promo, ...p }, { ...ctx, ...c });
    ok('valid 10% promo → ₹1,198.80 off', run({}, {}).ok && run({}, {}).discountPaise === 119880);
    ok('FLAT promo is capped at the subtotal', run({ type: 'FLAT', value: 99999999 }, {}).discountPaise === 1198800);
    ok('inactive code rejected', !run({ active: false }, {}).ok);
    ok('before validFrom rejected', !run({ validFrom: d('2026-11-01T00:00:00Z') }, {}).ok);
    ok('after validTo rejected', !run({ validTo: d('2026-10-01T00:00:00Z') }, {}).ok);
    ok('inside the window accepted', run({ validFrom: d('2026-10-01T00:00:00Z'), validTo: d('2026-10-31T00:00:00Z') }, {}).ok);
    ok('plan restriction: BOS-only code rejected on Workspace', !run({ appliesToPlans: ['BOS'] }, {}).ok);
    ok('plan restriction: accepted on the right plan', run({ appliesToPlans: ['WORKSPACE', 'BOS'] }, {}).ok);
    ok('cycle restriction enforced', !run({ appliesToCycles: ['MONTHLY'] }, {}).ok && run({ appliesToCycles: ['ANNUAL'] }, {}).ok);
    ok('invoice-kind restriction enforced', !run({ appliesToKinds: ['RENEWAL'] }, {}).ok);
    ok('minimum cycle months enforced', !run({ minCycleMonths: 12 }, { cycleMonths: 6 }).ok && run({ minCycleMonths: 12 }, { cycleMonths: 12 }).ok);
    ok('global redemption cap enforced', !run({ maxRedemptions: 5 }, { redemptionsTotal: 5 }).ok && run({ maxRedemptions: 5 }, { redemptionsTotal: 4 }).ok);
    ok('per-vendor limit enforced', !run({ perVendorLimit: 1 }, { redemptionsByVendor: 1 }).ok && run({ perVendorLimit: 2 }, { redemptionsByVendor: 1 }).ok);
    ok('one promo per invoice', !run({}, { invoiceHasPromo: true }).ok);
    ok('no stacking on an admin discount by default', !run({}, { adminDiscountPresent: true }).ok);
    ok('stacking allowed when the admin allows it', run({}, { adminDiscountPresent: true, allowStacking: true }).ok);
    ok('codes normalise case-insensitively', R.normalizePromoCode(' diwali-25 ') === 'DIWALI-25' && R.normalizePromoCode('a') === null && R.normalizePromoCode("x'; DROP") === null);
  }

  section('TERM lifecycle decisions (renewal timing, reminders, lapse)');
  {
    const base = { status: 'ACTIVE', periodEnd: d('2026-12-31T00:00:00Z'), paymentDueAt: null, graceDays: 7, renewalInvoiceId: null, reminders: null };
    const at = (iso, over = {}) => T.decideRenewalStep({ ...base, ...over }, d(iso));
    let x = at('2026-12-15T00:00:00Z');
    ok('T-16: nothing yet', !x.createInvoice && !x.reminder && !x.lapse, JSON.stringify(x));
    x = at('2026-12-16T00:00:00Z');
    ok('T-15: create the renewal invoice + T15 reminder', x.createInvoice && x.reminder === 'T15' && x.daysLeft === 15, JSON.stringify(x));
    x = at('2026-12-16T00:00:00Z', { renewalInvoiceId: 'inv1', reminders: { T15: 'x' } });
    ok('T-15 again (job re-run): no second invoice, no second reminder', !x.createInvoice && !x.reminder);
    x = at('2026-12-24T00:00:00Z', { renewalInvoiceId: 'inv1', reminders: { T15: 'x' } });
    ok('T-7: reminder T7', x.reminder === 'T7' && !x.createInvoice, JSON.stringify(x));
    x = at('2026-12-30T00:00:00Z', { renewalInvoiceId: 'inv1', reminders: { T15: 'x', T7: 'x' } });
    ok('T-1: reminder T1', x.reminder === 'T1');
    x = at('2026-12-28T00:00:00Z', { renewalInvoiceId: null, reminders: null });
    ok('job was down until T-3: ONE reminder (the most urgent crossed, T7), invoice created, earlier ones marked sent', x.createInvoice && x.reminder === 'T7' && x.markReminders.includes('T15') && x.markReminders.includes('T7'), JSON.stringify(x));
    x = at('2027-01-02T00:00:00Z', { renewalInvoiceId: 'inv1', reminders: { T15: 'x', T7: 'x', T1: 'x' } });
    ok('overdue, inside grace: OVERDUE reminder, NOT lapsed', x.reminder === 'OVERDUE' && !x.lapse, JSON.stringify(x));
    x = at('2027-01-07T00:00:00Z', { renewalInvoiceId: 'inv1', reminders: { T15: 'x', T7: 'x', T1: 'x', OVERDUE: 'x' } });
    ok('exactly at periodEnd + grace: not lapsed yet', !x.lapse, JSON.stringify(x));
    x = at('2027-01-07T00:00:01Z', { renewalInvoiceId: 'inv1', reminders: { T15: 'x', T7: 'x', T1: 'x', OVERDUE: 'x' } });
    ok('one second past periodEnd + grace: LAPSE', x.lapse === true);
    x = at('2027-01-01T00:00:01Z', { graceDays: 0, renewalInvoiceId: 'inv1', reminders: { T15: 'x', T7: 'x', T1: 'x' } });
    ok('graceDays = 0 lapses immediately after the end', x.lapse === true);
    for (const st of ['DEMO', 'LAPSED', 'CANCELLED']) { x = at('2027-02-01T00:00:00Z', { status: st }); ok(`${st} term is never processed`, !x.lapse && !x.createInvoice && !x.reminder); }
    const due = { status: 'ACTIVE_PAYMENT_DUE', periodEnd: d('2027-06-01T00:00:00Z'), paymentDueAt: d('2026-10-14T00:00:00Z'), graceDays: 7, renewalInvoiceId: null, reminders: null };
    x = T.decideRenewalStep(due, d('2026-10-13T00:00:00Z'));
    ok('payment-due term: anchored on paymentDueAt (T-1 reminder), never creates a renewal invoice', x.reminder === 'T1' && !x.createInvoice, JSON.stringify(x));
    x = T.decideRenewalStep(due, d('2026-10-30T00:00:00Z'));
    ok('payment-due term unpaid past due + grace → LAPSE', x.lapse === true);
    ok('downgrade detection (BOS→Workspace only)', T.isDowngrade('BOS', 'WORKSPACE') && !T.isDowngrade('WORKSPACE', 'BOS') && !T.isDowngrade('BOS', 'BOS'));
  }

  section('PAY TOKENS, UPI, UTR, proof files');
  {
    const a = K.newPayToken(); const b = K.newPayToken();
    ok('token is 43 URL-safe chars (256 bits) and unique', a.length === 43 && /^[A-Za-z0-9_-]+$/.test(a) && a !== b);
    ok('hash is deterministic SHA-256 hex and not the token', K.hashPayToken(a) === K.hashPayToken(a) && K.hashPayToken(a).length === 64 && K.hashPayToken(a) !== a);
    ok('plausibility check rejects junk / traversal / short / non-strings', !K.isPlausiblePayToken('abc') && !K.isPlausiblePayToken('../../etc/passwd') && !K.isPlausiblePayToken(null) && !K.isPlausiblePayToken(a + 'x') && K.isPlausiblePayToken(a));
    ok('pay URL shape', K.payUrl(a, 'https://get4domain.com/') === `https://get4domain.com/pay/${a}`);

    const link = U.buildUpiLink({ vpa: 'get4domain@okhdfcbank', payeeName: 'KSM Quantum Technologies', amountPaise: 599400, note: 'INV-2026-0007' });
    ok('UPI link: payee, EXACT amount to 2dp, INR, invoice number as the note', link.startsWith('upi://pay?') && link.includes('pa=get4domain%40okhdfcbank') && link.includes('am=5994.00') && link.includes('cu=INR') && link.includes('tn=INV-2026-0007'), link);
    ok('UPI link encodes spaces as %20 (not +)', !link.includes('+') && link.includes('KSM%20Quantum%20Technologies'));
    throwsSync('UPI link rejects a bad VPA', () => U.buildUpiLink({ vpa: 'not a vpa', payeeName: 'x', amountPaise: 100, note: 'x' }));
    throwsSync('UPI link rejects a zero amount', () => U.buildUpiLink({ vpa: 'a@b', payeeName: 'x', amountPaise: 0, note: 'x' }));
    throwsSync('UPI link rejects a fractional paise amount', () => U.buildUpiLink({ vpa: 'ab@okbank', payeeName: 'x', amountPaise: 10.5, note: 'x' }));
    const qr = await U.upiQrDataUrl(link);
    ok('QR is a server-generated PNG data URL', qr.startsWith('data:image/png;base64,') && qr.length > 500);
    ok('VPA validation', U.isValidVpa('name@okhdfcbank') && U.isValidVpa('9876543210@ybl') && !U.isValidVpa('no-at-sign') && !U.isValidVpa('a b@c'));
    ok('UTR normalises (spaces/dashes/case) and validates 12–22 alphanumerics', U.normalizeUtr(' 4123 4567 8901 ') === '412345678901' && U.normalizeUtr('sbin-1234567890123') === 'SBIN1234567890123');
    ok('UTR too short / too long / symbols / non-string rejected', U.normalizeUtr('12345') === null && U.normalizeUtr('1'.repeat(23)) === null && U.normalizeUtr('1234567890!2') === null && U.normalizeUtr(123456789012) === null);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
    ok('image sniffing by magic bytes: png/jpg/webp accepted', U.sniffImage(png)?.mime === 'image/png' && U.sniffImage(jpg)?.mime === 'image/jpeg' && U.sniffImage(webp)?.mime === 'image/webp');
    ok('SVG, HTML, PDF, EXE renamed to .png are all rejected', [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>   '), Buffer.from('<html><script>alert(1)</script></html>'), Buffer.from('%PDF-1.7 ........'), Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00')].every((b) => U.sniffImage(b) === null));
    ok('max proof size is 3 MB', U.MAX_PROOF_BYTES === 3 * 1024 * 1024);
  }

  section('resolveApprovedNet — the editable plan-change price');
  {
    const L = 2398800;
    let r = M.resolveApprovedNet(L);
    ok('no price given → list price, not overridden', r.netPaise === L && r.discountPaise === 0 && r.overridden === false);
    r = M.resolveApprovedNet(L, L, 'whatever');
    ok('price equal to list is not an override (a stray reason is ignored)', r.overridden === false && r.netPaise === L);
    r = M.resolveApprovedNet(L, 2000000, 'loyal');
    ok('₹20,000 vs ₹23,988: discount ₹3,988, overridden, ≤20% so no CONFIRM', r.netPaise === 2000000 && r.discountPaise === 398800 && r.overridden && !r.needsConfirm);
    r = M.resolveApprovedNet(L, 0, 'free year', 'CONFIRM');
    ok('₹0 is allowed with a reason and CONFIRM', r.netPaise === 0 && r.discountPaise === L);
    throwsSync('a price above list is refused', () => M.resolveApprovedNet(L, L + 1, 'reason'), 'higher');
    throwsSync('a negative price is refused', () => M.resolveApprovedNet(L, -1, 'reason'));
    throwsSync('a fractional price is refused', () => M.resolveApprovedNet(L, 100.5, 'reason'));
    throwsSync('NaN is refused', () => M.resolveApprovedNet(L, NaN, 'reason'));
    throwsSync('missing reason is refused', () => M.resolveApprovedNet(L, 2000000), 'reason');
    throwsSync('a 2-character reason is refused', () => M.resolveApprovedNet(L, 2000000, 'ok'), 'reason');
    throwsSync('more than 20% off without CONFIRM is refused', () => M.resolveApprovedNet(L, 1000000, 'big deal'), 'CONFIRM');
    ok('exactly 20% off needs no CONFIRM; one paisa more does', M.resolveApprovedNet(1000000, 800000, 'exactly twenty').needsConfirm === false && M.resolveApprovedNet(1000000, 799999, 'a paisa over', 'CONFIRM').needsConfirm === true);
  }

  section('AI STUDIO CREDIT — prorated by billing term (KSM 2026-10-08): the rule, rounding, cap, override');
  {
    const AI = require('../../dist/src/commercial/ai-credit');
    const c = AI.aiStudioCreditPaise;
    ok('annual list amounts are held in one place: Workspace ₹499, BOS ₹1,299', AI.AI_CREDIT_ANNUAL_PAISE.WORKSPACE === 49900 && AI.AI_CREDIT_ANNUAL_PAISE.BOS === 129900);
    ok('Workspace table: 12 mo ₹499 · 6 mo ₹250 · 3 mo ₹125 · 1 mo ₹42', c('WORKSPACE', 12) === 49900 && c('WORKSPACE', 6) === 25000 && c('WORKSPACE', 3) === 12500 && c('WORKSPACE', 1) === 4200, [12, 6, 3, 1].map((m) => c('WORKSPACE', m)).join());
    ok('BOS table: 12 mo ₹1,299 · 6 mo ₹650 · 3 mo ₹325 · 1 mo ₹108', c('BOS', 12) === 129900 && c('BOS', 6) === 65000 && c('BOS', 3) === 32500 && c('BOS', 1) === 10800, [12, 6, 3, 1].map((m) => c('BOS', m)).join());
    ok('ROUNDING: ₹499 × 6/12 = ₹249.50 exactly → rounds HALF UP to ₹250 (24950 → 25000)', 49900 * 6 / 12 === 24950 && c('WORKSPACE', 6) === 25000);
    ok('ROUNDING: ₹499 × 3/12 = ₹124.75 → ₹125 (12475 → 12500)', 49900 * 3 / 12 === 12475 && c('WORKSPACE', 3) === 12500);
    ok('ROUNDING: ₹499 × 1/12 = ₹41.58 → ₹42; ₹499 × 9/12 = ₹374.25 → ₹374; ₹1,299 × 1/12 = ₹108.25 → ₹108', c('WORKSPACE', 1) === 4200 && c('WORKSPACE', 9) === 37400 && c('BOS', 1) === 10800);
    ok('CAP: a 24- or 60-month term never exceeds the annual amount', c('WORKSPACE', 24) === 49900 && c('WORKSPACE', 60) === 49900 && c('BOS', 24) === 129900);
    let prev = -1; let mono = true; let whole = true; let capped = true;
    for (let m = 1; m <= 60; m += 1) { for (const p of ['WORKSPACE', 'BOS']) { const v = c(p, m); if (p === 'WORKSPACE') { if (v < prev) mono = false; prev = v; } if (v % 100 !== 0) whole = false; if (v > AI.AI_CREDIT_ANNUAL_PAISE[p]) capped = false; } }
    ok('for months 1…60: never decreases with term length, always whole rupees, never above annual', mono && whole && capped);
    throwsSync('0 months is refused', () => c('WORKSPACE', 0), 'months');
    throwsSync('a fractional or NaN term is refused', () => c('WORKSPACE', 1.5), 'months');
    throwsSync('NaN months is refused', () => c('BOS', NaN), 'months');
    throwsSync('an unknown plan is refused', () => c('GOLD', 12), 'Unknown plan');

    let r = AI.resolveAiCredit('WORKSPACE', 6);
    ok('resolve: no override → the computed ₹250, not overridden', r.paise === 25000 && r.computedPaise === 25000 && r.overridden === false);
    r = AI.resolveAiCredit('WORKSPACE', 6, 0);
    ok('override ₹0 is allowed (no credit) and counts as an override', r.paise === 0 && r.overridden === true && r.computedPaise === 25000);
    r = AI.resolveAiCredit('WORKSPACE', 6, 100000);
    ok('override ₹1,000 (custom) is accepted and flagged', r.paise === 100000 && r.overridden === true);
    r = AI.resolveAiCredit('BOS', 12, 500000);
    ok('override at the ₹5,000 ceiling is accepted', r.paise === 500000);
    ok('entering exactly the computed value is NOT an override (nothing to audit)', AI.resolveAiCredit('WORKSPACE', 6, 25000).overridden === false);
    throwsSync('override above ₹5,000 is refused', () => AI.resolveAiCredit('WORKSPACE', 6, 500001), '₹5,000');
    throwsSync('negative override is refused', () => AI.resolveAiCredit('WORKSPACE', 6, -1), '₹5,000');
    throwsSync('fractional paise override is refused', () => AI.resolveAiCredit('WORKSPACE', 6, 100.5), '₹5,000');

    // The credit is independent of price: it comes from plan + term length only, never from the discount or GST mode.
    const rates = { WORKSPACE: 1198800, BOS: 2398800 };
    const base = { planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE' };
    const full = Q.buildQuote(base, rates);
    const cheap = Q.buildQuote({ ...base, gstMode: 'EXCLUSIVE', discount: { mode: 'PERCENT', value: 90, reason: 'founding deal', confirm: 'CONFIRM' } }, rates);
    ok('quote carries the credit (₹250 for half-yearly) and it is NOT part of the totals', full.aiCredit.paise === 25000 && full.totals.totalPaise === 599400);
    ok('a 90% discount and a different GST mode do not change the credit (entitlements never come from price)', cheap.aiCredit.paise === 25000 && cheap.totals.netPaise < full.totals.netPaise);
    ok('the credit follows plan/cycle/custom months: BOS half-yearly ₹650, Workspace monthly ₹42, Workspace custom 3 months ₹125', Q.buildQuote({ planKey: 'BOS', billingCycle: 'HALF_YEARLY', gstMode: 'NONE' }, rates).aiCredit.paise === 65000 && Q.buildQuote({ planKey: 'WORKSPACE', billingCycle: 'MONTHLY', gstMode: 'NONE' }, rates).aiCredit.paise === 4200 && Q.buildQuote({ planKey: 'WORKSPACE', billingCycle: 'CUSTOM_MONTHS', customMonths: 3, gstMode: 'NONE' }, rates).aiCredit.paise === 12500);
    ok('a quote with an admin figure uses it; an add-on-only quote has no credit', Q.buildQuote({ ...base, aiCreditPaise: 0 }, rates).aiCredit.paise === 0 && Q.buildQuote({ gstMode: 'NONE', addons: [{ kind: 'CUSTOM', label: 'Setup', amountPaise: 100000 }] }, rates).aiCredit === null);
    throwsSync('a quote with an out-of-range figure is refused (400)', () => Q.buildQuote({ ...base, aiCreditPaise: 600000 }, rates), '₹5,000');
    ok('entitlements expose the ANNUAL list credit only', E.entitlementsFor('WORKSPACE').aiCreditAnnualPaise === 49900 && E.entitlementsFor('BOS').aiCreditAnnualPaise === 129900 && !('aiCreditPaise' in E.entitlementsFor('BOS')));
  }

  finish();
})().catch((e) => { console.error(e); process.exit(1); });
