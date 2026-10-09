// LeadSpace wallet refill on REAL Postgres (PGlite) through the REAL NestJS API, with a stand-in for Razorpay:
// packs, GST inclusive and exclusive, the captured-payment checks, one credit per payment, the tax invoice, the receipt list, release of held customers,
// the webhook and admin reconcile, and who may touch what.
// Needs `npx nest build` first and PGlite (SKIPs cleanly when it is not installed).
const crypto = require('crypto');
const { startHarness, available } = require('../e2e/bos-harness');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - LeadSpace wallet proofs not run'); process.exit(0); }
  process.env.RAZORPAY_KEY_SECRET = 'rzp-test-secret-for-harness';
  const h = await startHarness({ port: 3094, pgPort: 54334 });
  process.env.RAZORPAY_KEY_SECRET = 'rzp-test-secret-for-harness';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp-webhook-secret-for-harness';
  const { prisma, call } = h;
  const refill = h.svc('LeadRefillService', 'leadspace/refill.service');
  const purse = h.svc('LeadPurseService', 'leadspace/purse.service');
  const gateway = h.svc('WhatsappGatewayService', 'messaging/whatsapp/whatsapp-gateway.service');
  const sandbox = gateway.getProvider();
  let code = 0;
  try {
    // — a stand-in for Razorpay: orders we create, payments a customer "makes" —
    const orders = new Map(); const payments = new Map(); let seq = 0;
    const gone = () => Object.assign(new Error('not found'), { statusCode: 404 });
    refill.setGateway({
      orders: {
        create: async (o) => { const id = `order_T${++seq}`; const row = { id, amount: o.amount, currency: o.currency, notes: o.notes }; orders.set(id, row); return row; },
        fetch: async (id) => { if (!orders.has(id)) throw gone(); return orders.get(id); },
      },
      payments: { fetch: async (id) => { if (!payments.has(id)) throw gone(); return payments.get(id); } },
    });
    const sign = (orderId, paymentId, secret = process.env.RAZORPAY_KEY_SECRET) => crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    const pay = (orderId, over = {}) => {
      const o = orders.get(orderId); const id = `pay_T${++seq}`;
      payments.set(id, { id, order_id: orderId, amount: o.amount, currency: 'INR', status: 'captured', ...over });
      return { razorpayOrderId: orderId, razorpayPaymentId: id, razorpaySignature: sign(orderId, id) };
    };

    const admin = await h.createAdmin({ key: 'wadmin' });
    const A = admin.token;
    const shop = await h.createVendor({ key: 'wshop', industry: 'retail', plan: 'WORKSPACE' });
    const V = shop.token;
    const other = await h.createVendor({ key: 'wother', industry: 'retail', plan: 'WORKSPACE' });
    await prisma.leadspaceProfile.create({ data: { vendorId: shop.id, slug: 'wshop-chennai', category: 'home-services', city: 'Chennai', goal: 'ENQUIRY', businessName: 'W Shop', phone: '9700000001', alertWhatsapp: '9700000001', status: 'PUBLISHED' } });

    section('[feat:leadspace.refill] Packs, GST mode and the credited amount are admin data');
    let r = await call('GET', '/leadspace/wallet/packs', undefined, V);
    ok('the vendor sees two starting packs: Rs 1,999 and Rs 2,999, plus a custom amount', r.data.packs.length === 2 && r.data.packs[0].payPaise === 199900 && r.data.packs[1].payPaise === 299900 && r.data.custom.minPaise > 0, J(r.data));
    const p0 = r.data.packs[0];
    const taxable = Math.round(199900 / 1.18);
    ok('an inclusive pack charges exactly its price and shows the GST inside it', p0.gstMode === 'INCLUSIVE' && p0.quote.chargePaise === 199900 && p0.quote.gstPaise === 199900 - taxable, J(p0.quote));
    r = await call('PUT', '/admin/leadspace/packs', { label: 'Bonus 1000', payPaise: 100000, creditPaise: 110000, gstMode: 'EXCLUSIVE' }, A);
    const bonus = r.data;
    ok('the admin adds an exclusive pack that credits more than it costs', r.status < 300 && bonus.gstMode === 'EXCLUSIVE' && bonus.creditPaise === 110000, J(r.body));
    r = await call('GET', '/leadspace/wallet/packs', undefined, V);
    const bq = r.data.packs.find((p) => p.id === bonus.id).quote;
    ok('GST is added on top for an exclusive pack: Rs 1,000 + 18% = Rs 1,180', bq.chargePaise === 118000 && bq.gstPaise === 18000, J(bq));
    r = await call('PUT', '/admin/leadspace/packs', { label: 'Silly', payPaise: 100000, creditPaise: 10000, gstMode: 'INCLUSIVE' }, A);
    ok('a pack that credits far less than it costs is refused', r.status === 400, J(r.body));
    ok('a vendor cannot edit packs', (await call('PUT', '/admin/leadspace/packs', { label: 'Mine', payPaise: 100000, creditPaise: 100000, gstMode: 'INCLUSIVE' }, V)).status === 403);
    const guard = new (h.dist('commercial/foundation.services').CommercialAdminGuard)();
    const staff = new (h.dist('leadspace/staff.guard').LeadspaceStaffGuard)();
    const ctx = (user) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    let money = false; try { guard.canActivate(ctx({ role: 'ADMIN', adminRole: 'MARKETING' })); } catch { money = true; }
    let nonMoney = true; try { staff.canActivate(ctx({ role: 'ADMIN', adminRole: 'MARKETING' })); } catch { nonMoney = false; }
    ok('MARKETING staff are refused on the money routes (packs, prices, disputes, refunds) but may work the page queue', money && nonMoney);

    section('[feat:leadspace.refill-pay] Pay, verify, credit once, tax invoice');
    r = await call('POST', '/leadspace/wallet/refill', { packId: bonus.id }, V);
    const o1 = r.data;
    ok('starting a refill creates an order for the amount to pay (GST included in the charge)', r.status < 300 && orders.get(o1.orderId).amount === 118000 && orders.get(o1.orderId).notes.purpose === 'leadspace_refill' && orders.get(o1.orderId).notes.vendorId === shop.id, J(r.body));
    const pay1 = pay(o1.orderId);
    const before = await purse.balance(shop.id);
    r = await call('POST', '/leadspace/wallet/refill/verify', pay1, V);
    ok('a captured payment credits the wallet with the PACK\'s credit (Rs 1,100), not the amount paid', r.status < 300 && r.data.credited === true && (await purse.balance(shop.id)) === before + 110000, J(r.body));
    const entry = await prisma.leadPurseEntry.findFirst({ where: { idempotencyKey: `refill:${pay1.razorpayPaymentId}` } });
    ok('the ledger row is a REFILL with the payment id, running balance and an expiry date', entry && entry.reason === 'REFILL' && entry.razorpayId === pay1.razorpayPaymentId && entry.balanceAfter === before + 110000 && entry.expiresAt > new Date(), J(entry));
    const inv = await prisma.invoice.findFirst({ where: { razorpayPaymentId: pay1.razorpayPaymentId } });
    ok('a GST tax invoice exists for the amount charged with the line "LeadSpace wallet refill"', inv && /LeadSpace wallet refill/.test(inv.description) && inv.totalAmount === 118000 && inv.gstAmount === 18000 && inv.amount === 100000 && inv.status === 'PAID', J(inv));
    ok('the invoice is booked as platform income', (await prisma.platformIncome.count({ where: { invoiceId: inv.id, source: 'leadspace_refill' } })) === 1);
    r = await call('POST', '/leadspace/wallet/refill/verify', pay1, V);
    ok('confirming the same payment again credits nothing more and makes no second invoice', r.data.credited === false && (await purse.balance(shop.id)) === before + 110000 && (await prisma.invoice.count({ where: { razorpayPaymentId: pay1.razorpayPaymentId } })) === 1, J(r.body));
    r = await call('GET', '/leadspace/wallet/receipts', undefined, V);
    ok('the Wallet tab lists the refill with its invoice number and total', r.data.length === 1 && r.data[0].invoiceNumber === inv.invoiceNumber && r.data[0].totalPaise === 118000 && r.data[0].creditPaise === 110000, J(r.data));
    ok('the receipt e-mail went through the existing invoice mailer (invoice number set)', Boolean(inv.invoiceNumber));
    ok('the refill receipt WhatsApp (utility template) was sent to the alert number', Boolean(sandbox.lastTo('9700000001')?.template === 'leadspace_refill_receipt'), J(sandbox.lastTo('9700000001')));

    section('[feat:leadspace.refill-safety] A payment only counts if Razorpay says so for this vendor and purpose');
    const o2 = (await call('POST', '/leadspace/wallet/refill', { packId: p0.id }, V)).data;
    let bad = pay(o2.orderId); bad = { ...bad, razorpaySignature: 'f'.repeat(64) };
    ok('a forged signature is refused', (await call('POST', '/leadspace/wallet/refill/verify', bad, V)).status === 400);
    const notCaptured = pay(o2.orderId, { status: 'authorized' });
    ok('a payment that is only authorised, not captured, is refused', (await call('POST', '/leadspace/wallet/refill/verify', notCaptured, V)).status === 400);
    const short = pay(o2.orderId, { amount: 100 });
    ok('a payment for a smaller amount than the order is refused', (await call('POST', '/leadspace/wallet/refill/verify', short, V)).status === 400);
    const good2 = pay(o2.orderId);
    r = await call('POST', '/leadspace/wallet/refill/verify', good2, other.token);
    ok('another vendor cannot claim this payment', r.status === 400 && (await purse.balance(other.id)) === 0, J(r.body));
    orders.set('order_TOPUP', { id: 'order_TOPUP', amount: 500000, currency: 'INR', notes: { purpose: 'wallet_topup', vendorId: shop.id } });
    const topupPay = pay('order_TOPUP');
    ok('a payment made for an AI wallet top-up cannot be reused as a LeadSpace refill', (await call('POST', '/leadspace/wallet/refill/verify', topupPay, V)).status === 400);
    ok('an order id that does not exist is refused', (await call('POST', '/leadspace/wallet/refill/verify', { razorpayOrderId: 'order_nope', razorpayPaymentId: 'pay_nope', razorpaySignature: 'x' }, V)).status === 400);
    const b2 = await purse.balance(shop.id);
    r = await call('POST', '/leadspace/wallet/refill/verify', good2, V);
    ok('the good payment then credits Rs 1,999 once', r.data.credited === true && (await purse.balance(shop.id)) === b2 + 199900, J(r.body));
    const par = pay((await call('POST', '/leadspace/wallet/refill', { packId: p0.id }, V)).data.orderId);
    const both = await Promise.all([call('POST', '/leadspace/wallet/refill/verify', par, V), call('POST', '/leadspace/wallet/refill/verify', par, V)]);
    ok('two confirmations of one payment racing each other credit exactly once', both.filter((x) => x.data?.credited === true).length === 1 && (await prisma.leadPurseEntry.count({ where: { razorpayId: par.razorpayPaymentId } })) === 1, J(both.map((x) => x.data)));

    section('[feat:leadspace.refill-custom] Custom amounts: limits, credit percent, GST mode');
    r = await call('POST', '/leadspace/wallet/refill', { customPaise: 5000 }, V);
    ok('a custom amount below the minimum is refused in plain words', r.status === 400 && /between/.test(r.body.message), J(r.body));
    r = await call('POST', '/leadspace/wallet/refill', { customPaise: 999999999 }, V);
    ok('a custom amount above the maximum is refused', r.status === 400, J(r.body));
    r = await call('POST', '/leadspace/wallet/refill', { customPaise: 150000 }, V);
    ok('a custom amount of Rs 1,500 is quoted and credited one for one by default', r.status < 300 && r.data.quote.creditPaise === 150000 && r.data.quote.chargePaise === 150000, J(r.body));
    await call('PUT', '/admin/leadspace/settings/customCreditPercent', { value: 110 }, A);
    await call('PUT', '/admin/leadspace/settings/customGstMode', { value: 'EXCLUSIVE' }, A);
    r = await call('POST', '/leadspace/wallet/refill', { customPaise: 100000 }, V);
    ok('the admin can change the custom credit to 110% and GST to exclusive', r.data.quote.creditPaise === 110000 && r.data.quote.chargePaise === 118000 && r.data.quote.gstMode === 'EXCLUSIVE', J(r.data.quote));
    ok('GST mode accepts only inclusive or exclusive', (await call('PUT', '/admin/leadspace/settings/customGstMode', { value: 'MAYBE' }, A)).status === 400);
    r = await call('POST', '/leadspace/wallet/refill', {}, V);
    ok('asking for a refill without a pack or an amount is refused', r.status === 400);

    section('[feat:leadspace.refill-release] A refill releases waiting customers, oldest first');
    const heldVendor = await h.createVendor({ key: 'wheld', industry: 'retail', plan: 'WORKSPACE' });
    await prisma.leadspaceProfile.create({ data: { vendorId: heldVendor.id, slug: 'wheld-chennai', category: 'home-services', city: 'Chennai', goal: 'ENQUIRY', businessName: 'Held Shop', phone: '9700000002', alertWhatsapp: '9700000002', status: 'PUBLISHED' } });
    await call('POST', '/admin/leadspace/prices', { eventType: 'ENQUIRY', pricePaise: 100000 }, A);
    for (let i = 0; i < 3; i++) {
      await prisma.leadEvent.create({ data: { vendorId: heldVendor.id, type: 'ENQUIRY', customerName: `Held ${i}`, customerPhone: `98000000${i}0`, phoneHash: `h${i}`, payload: { message: 'hello there' }, status: 'HELD', priceQuotedPaise: 100000, idempotencyKey: `held-${i}`, createdAt: new Date(Date.now() - (3 - i) * 60_000) } });
    }
    const oh = (await call('POST', '/leadspace/wallet/refill', { packId: p0.id }, heldVendor.token)).data;
    r = await call('POST', '/leadspace/wallet/refill/verify', pay(oh.orderId), heldVendor.token);
    ok('a refill of Rs 1,999 releases one waiting customer at Rs 1,000 and keeps two waiting', r.data.released === 1 && r.data.balancePaise === 99900, J(r.data));
    const rows = await prisma.leadEvent.findMany({ where: { vendorId: heldVendor.id }, orderBy: { createdAt: 'asc' } });
    ok('the oldest was the one released', rows[0].status === 'DELIVERED' && rows[1].status === 'HELD' && rows[2].status === 'HELD', J(rows.map((x) => x.status)));

    section('[feat:leadspace.refill-recover] Paid but never confirmed: webhook and admin reconcile');
    const lost = pay((await call('POST', '/leadspace/wallet/refill', { packId: p0.id }, V)).data.orderId);
    const b3 = await purse.balance(shop.id);
    const hook = { event: 'payment.captured', payload: { payment: { entity: { id: lost.razorpayPaymentId } } } };
    const wsig = (raw) => crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    r = await call('POST', '/leadspace/refill/webhook', hook, undefined, { 'x-razorpay-signature': 'bad' });
    ok('a webhook with a wrong signature is refused', r.status === 400, J(r.body));
    r = await call('POST', '/leadspace/refill/webhook', hook, undefined, { 'x-razorpay-signature': wsig(JSON.stringify(hook)) });
    ok('a signed payment.captured webhook credits the wallet', r.status < 300 && (await purse.balance(shop.id)) === b3 + 199900, J(r.body));
    r = await call('POST', '/admin/leadspace/refills/reconcile', { razorpayPaymentId: lost.razorpayPaymentId }, A);
    ok('reconciling the same payment again changes nothing', r.data.credited === false && (await purse.balance(shop.id)) === b3 + 199900, J(r.body));
    r = await call('POST', '/admin/leadspace/refills/reconcile', { razorpayPaymentId: 'pay_unknown' }, A);
    ok('an unknown payment is reported in plain words, not credited', r.data.credited === false && /could not find/.test(r.data.reason), J(r.body));
    const authOnly = pay((await call('POST', '/leadspace/wallet/refill', { packId: p0.id }, V)).data.orderId, { status: 'authorized' });
    r = await call('POST', '/admin/leadspace/refills/reconcile', { razorpayPaymentId: authOnly.razorpayPaymentId }, A);
    ok('a payment that is not captured is not credited by reconcile either', r.data.credited === false && /not captured/.test(r.data.reason), J(r.body));
    r = await call('GET', '/admin/leadspace/refills', undefined, A);
    ok('the admin lists recent refills across vendors', Array.isArray(r.data) && r.data.length >= 3, J(r.body));
    ok('a vendor cannot reconcile', (await call('POST', '/admin/leadspace/refills/reconcile', { razorpayPaymentId: lost.razorpayPaymentId }, V)).status === 403);
    ok('the wallet routes need a login', (await call('GET', '/leadspace/wallet/packs')).status === 401);
  } catch (e) {
    console.log(`  FAIL  suite crashed -> ${e.stack || e}`); fail += 1; failures.push('crash');
  } finally {
    await h.stop();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log('FAILED:\n - ' + failures.join('\n - '));
  code = fail ? 1 : 0;
  setTimeout(() => process.exit(code), 300);
})();
