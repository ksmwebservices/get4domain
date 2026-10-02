// FIX 1 + FIX 2: platform payment verification and server-side order amounts.
const { dist, ok, rejects, section, finish, hmac, makeRazorpay, recorder } = require('./harness');
const { PaymentsService } = dist('payments/payments.service');
const { CreateInvoiceOrderDto } = dist('payments/dto/create-invoice-order.dto');
const { ValidationPipe } = require('@nestjs/common');

function invoiceStore(rows) {
  const map = new Map(rows.map((r) => [r.id, { ...r }]));
  return {
    map,
    model: {
      async findUnique({ where: { id } }) { const i = map.get(id); return i ? { ...i } : null; },
      async findUniqueOrThrow({ where: { id } }) {
        const i = map.get(id);
        return { ...i, vendor: { id: i.vendorId, email: 'v@x.in', businessName: 'V', name: 'V' }, subscription: null };
      },
      async findFirst({ where }) {
        for (const i of map.values()) {
          if (where.razorpayPaymentId && i.razorpayPaymentId === where.razorpayPaymentId && (!where.id || !where.id.not || i.id !== where.id.not)) return { ...i };
        }
        return null;
      },
      async updateMany({ where, data }) {
        const i = map.get(where.id);
        if (!i || (where.status && where.status.notIn && where.status.notIn.includes(i.status))) return { count: 0 };
        Object.assign(i, data);
        return { count: 1 };
      },
    },
  };
}

function build(rows) {
  const store = invoiceStore(rows);
  const incomeCalls = [];
  const prisma = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'invoice') return store.model;
      if (prop === 'platformIncome') return { create: async (a) => { incomeCalls.push(a); } };
      if (prop === 'then') return undefined;
      return recorder(String(prop));
    },
  });
  const svc = new PaymentsService(prisma, recorder('email'), recorder('notif'), recorder('wa'), recorder('settings'));
  const rz = makeRazorpay();
  svc.razorpay = rz;
  return { svc, rz, store, incomeCalls };
}

const A = { sub: 'vendorA', role: 'VENDOR' };
const B = { sub: 'vendorB', role: 'VENDOR' };
const big = { id: 'inv_big', vendorId: 'vendorA', invoiceNumber: 'INV-2026-0001', totalAmount: 1414584, status: 'PENDING' };
const small = { id: 'inv_small', vendorId: 'vendorA', invoiceNumber: 'INV-2026-0002', totalAmount: 11800, status: 'PENDING' };
const bInv = { id: 'inv_b', vendorId: 'vendorB', invoiceNumber: 'INV-2026-0003', totalAmount: 500000, status: 'PENDING' };

(async () => {
  section('FIX 2 — create-order: amount comes from the invoice, never from the client');
  {
    const { svc } = build([big, small, bInv]);
    const order = await svc.createInvoiceOrder(A, 'inv_big');
    ok('order amount equals the invoice total stored in the DB (₹14,145.84)', order.amount === 1414584, `amount=${order.amount}`);
    ok('order is stamped with purpose/invoice/vendor notes', order.notes.purpose === 'invoice' && order.notes.invoiceId === 'inv_big' && order.notes.vendorId === 'vendorA');
    await rejects("another vendor's invoice cannot be ordered", svc.createInvoiceOrder(B, 'inv_big'), { status: 404 });
    await rejects('nonexistent invoice', svc.createInvoiceOrder(A, 'nope'), { status: 404 });

    const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
    await rejects('HTTP body {invoiceId, amount:100} is REJECTED by the validation pipe (client amount not accepted)',
      pipe.transform({ invoiceId: 'inv_big', amount: 100 }, { type: 'body', metatype: CreateInvoiceOrderDto }), { status: 400 });
    await rejects('HTTP body {amount, receipt} with no invoiceId is rejected',
      pipe.transform({ amount: 100, receipt: 'x' }, { type: 'body', metatype: CreateInvoiceOrderDto }), { status: 400 });

    const paid = { ...small, status: 'PAID' };
    const b2 = build([paid]);
    await rejects('an already-paid invoice cannot be ordered again', b2.svc.createInvoiceOrder(A, 'inv_small'), { status: 400 });
  }

  section('FIX 1 — verify: forged / mismatched signatures are rejected');
  {
    const { svc, rz, store, incomeCalls } = build([big, small, bInv]);
    const order = await svc.createInvoiceOrder(A, 'inv_big');
    const good = rz.pay(order.id);

    await rejects('random forged signature', svc.verifyPayment(A, { invoiceId: 'inv_big', razorpayOrderId: order.id, razorpayPaymentId: good.razorpayPaymentId, razorpaySignature: 'a'.repeat(64) }), { status: 400, includes: 'signature' });
    await rejects('empty signature', svc.verifyPayment(A, { invoiceId: 'inv_big', razorpayOrderId: order.id, razorpayPaymentId: good.razorpayPaymentId, razorpaySignature: '' }), { status: 400 });
    await rejects('signature made with the WRONG secret', svc.verifyPayment(A, { invoiceId: 'inv_big', razorpayOrderId: order.id, razorpayPaymentId: good.razorpayPaymentId, razorpaySignature: hmac('attacker_secret', order.id, good.razorpayPaymentId) }), { status: 400, includes: 'signature' });
    await rejects('valid signature but for a DIFFERENT payment id', svc.verifyPayment(A, { invoiceId: 'inv_big', razorpayOrderId: order.id, razorpayPaymentId: 'pay_other', razorpaySignature: good.razorpaySignature }), { status: 400 });
    ok('invoice is still PENDING after every forged attempt', store.map.get('inv_big').status === 'PENDING');
    ok('no income was recorded for forged attempts', incomeCalls.length === 0);
  }

  section('FIX 1 — verify: a REAL signature is not enough (binding to invoice, vendor, amount, capture)');
  {
    const { svc, rz, store, incomeCalls } = build([big, small, bInv]);

    // Attack: pay a cheap order legitimately, then use that valid triple against the big invoice.
    const cheap = await svc.createInvoiceOrder(A, 'inv_small'); // ₹118
    const cheapPay = rz.pay(cheap.id);
    await rejects('ATTACK: valid ₹118 payment replayed against the ₹14,145 invoice', svc.verifyPayment(A, { invoiceId: 'inv_big', ...cheapPay }), { status: 400, includes: 'could not be verified' });
    ok('big invoice NOT marked paid by the cheap payment', store.map.get('inv_big').status === 'PENDING');

    // Attack: a wallet top-up style order (different purpose) used for an invoice.
    const topup = await rz.orders.create({ amount: 1414584, currency: 'INR', receipt: 'wallet_x', notes: { vendorId: 'vendorA', purpose: 'wallet_topup' } });
    const topupPay = rz.pay(topup.id);
    await rejects('ATTACK: exact-amount payment from a different purpose (wallet top-up) used on an invoice', svc.verifyPayment(A, { invoiceId: 'inv_big', ...topupPay }), { status: 400 });

    // Attack: an order the attacker made directly with notes forged to name the invoice — needs OUR Razorpay key to create.
    // (Orders without our server's notes are rejected.)
    const noNotes = await rz.orders.create({ amount: 1414584, currency: 'INR', receipt: 'x' });
    await rejects('ATTACK: correctly-priced order that our server never stamped', svc.verifyPayment(A, { invoiceId: 'inv_big', ...rz.pay(noNotes.id) }), { status: 400 });

    // Attack: vendor B submits vendor A's real, captured payment for A's invoice.
    const aOrder = await svc.createInvoiceOrder(A, 'inv_big');
    const aPay = rz.pay(aOrder.id);
    await rejects("ATTACK: vendor B submits vendor A's valid payment for A's invoice", svc.verifyPayment(B, { invoiceId: 'inv_big', ...aPay }), { status: 404 });
    ok("A's invoice still PENDING", store.map.get('inv_big').status === 'PENDING');

    // Not captured / amount mismatch on the payment itself.
    const o2 = await svc.createInvoiceOrder(A, 'inv_big');
    await rejects('payment only AUTHORIZED (not captured)', svc.verifyPayment(A, { invoiceId: 'inv_big', ...rz.pay(o2.id, { status: 'authorized' }) }), { status: 400 });
    await rejects('payment amount differs from the order', svc.verifyPayment(A, { invoiceId: 'inv_big', ...rz.pay(o2.id, { amount: 100 }) }), { status: 400 });
    await rejects('unknown order/payment ids (valid HMAC over fantasy ids)', svc.verifyPayment(A, { invoiceId: 'inv_big', razorpayOrderId: 'order_fake', razorpayPaymentId: 'pay_fake', razorpaySignature: hmac(rz.secret, 'order_fake', 'pay_fake') }), { status: 400 });

    rz.down = true;
    await rejects('gateway unreachable → fails CLOSED (503), never open', svc.verifyPayment(A, { invoiceId: 'inv_big', ...aPay }), { status: 503 });
    rz.down = false;
    ok('still PENDING after all of the above', store.map.get('inv_big').status === 'PENDING' && incomeCalls.length === 0);
  }

  section('FIX 1 — verify: the legitimate payment succeeds exactly once (replay protection)');
  {
    const { svc, rz, store, incomeCalls } = build([big, small, bInv]);
    const order = await svc.createInvoiceOrder(A, 'inv_big');
    const pay = rz.pay(order.id);
    const r1 = await svc.verifyPayment(A, { invoiceId: 'inv_big', ...pay });
    ok('genuine captured payment for the right invoice/vendor/amount → verified', r1.verified === true && store.map.get('inv_big').status === 'PAID');
    ok('invoice now carries the payment id', store.map.get('inv_big').razorpayPaymentId === pay.razorpayPaymentId);
    ok('income recorded once', incomeCalls.length === 1);

    const r2 = await svc.verifyPayment(A, { invoiceId: 'inv_big', ...pay });
    ok('REPLAY of the same request is idempotent (returns verified, no second effect)', r2.verified === true && incomeCalls.length === 1);

    const o2 = await svc.createInvoiceOrder(A, 'inv_small');
    await rejects('REPLAY: the same payment triple applied to a DIFFERENT invoice', svc.verifyPayment(A, { invoiceId: 'inv_small', ...pay }), { status: 400 });
    await rejects('a different payment on an already-paid invoice', svc.verifyPayment(A, { invoiceId: 'inv_big', ...rz.pay(o2.id) }), { status: 400, includes: 'already paid' });
  }

  section('FIX 1 — verify: concurrent double-submit finalises once');
  {
    const { svc, rz, incomeCalls } = build([big]);
    const order = await svc.createInvoiceOrder(A, 'inv_big');
    const pay = rz.pay(order.id);
    const results = await Promise.allSettled([svc.verifyPayment(A, { invoiceId: 'inv_big', ...pay }), svc.verifyPayment(A, { invoiceId: 'inv_big', ...pay })]);
    ok('both concurrent calls return verified', results.every((r) => r.status === 'fulfilled' && r.value.verified));
    ok('income/bonus finalised exactly ONCE under concurrency', incomeCalls.length === 1, `incomeCalls=${incomeCalls.length}`);
  }

  finish();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
