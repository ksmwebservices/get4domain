// FIX 1 (same root cause): wallet top-up, go-live conversion and theme unlock must confirm payments with Razorpay.
const { dist, ok, rejects, section, finish, hmac, makeRazorpay, recorder } = require('./harness');
const RAW = require('../commercial-verify/raw-fake');
const { PaymentsService } = dist('payments/payments.service');
const { WalletService } = dist('wallet/wallet.service');
const { DemoService } = dist('demo/demo.service');
const { WebsiteThemesService } = dist('website-themes/website-themes.service');

const payments = (rz) => { const p = new PaymentsService(recorder('prisma'), recorder('e'), recorder('n'), recorder('w'), recorder('s')); p.razorpay = rz; return p; };

(async () => {
  section('WALLET TOP-UP');
  {
    const wallets = new Map();
    const txns = [];
    const invoiceCalls = [];
    const tx = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'wallet') return {
          upsert: async ({ where: { vendorId }, create, update }) => {
            const w = wallets.get(vendorId);
            if (!w) { const n = { id: `w_${vendorId}`, vendorId, balance: create.balance, totalCredited: create.totalCredited }; wallets.set(vendorId, n); return { ...n }; }
            w.balance += update.balance.increment; w.totalCredited += update.totalCredited.increment; return { ...w };
          },
          findUnique: async ({ where: { vendorId } }) => (wallets.get(vendorId) ? { ...wallets.get(vendorId) } : null),
        };
        if (prop === 'walletTransaction') return {
          findFirst: async ({ where }) => txns.find((t) => t.razorpayId === where.razorpayId) ?? null,
          create: async ({ data }) => { txns.push(data); return data; },
        };
        if (prop === '$transaction') return async (fn) => fn(tx);
        // Like real Prisma: a void SELECT (pg_advisory_xact_lock) through $queryRaw* throws; locks go through $executeRaw.
        if (prop === '$queryRawUnsafe') return async (sql) => { RAW.assertQueryRawOk('$queryRawUnsafe', sql); return []; };
        if (prop === '$executeRaw') return async () => 1;
        if (prop === 'then') return undefined;
        return recorder(String(prop));
      },
    });
    const invoices = { createPaidTopupInvoice: async (...a) => { invoiceCalls.push(a); } };
    const rz = makeRazorpay();
    const svc = new WalletService(tx, invoices);
    svc.razorpay = rz;

    const top = await svc.topup('vendorA', { amount: 99900 });
    const pay = rz.pay(top.orderId);
    await rejects('forged signature', svc.verifyTopup('vendorA', { ...pay, razorpaySignature: '0'.repeat(64) }), { status: 400, includes: 'signature' });
    await rejects('payment only authorized', svc.verifyTopup('vendorA', rz.pay(top.orderId, { status: 'authorized' })), { status: 400 });
    await rejects("ATTACK: vendor B claims vendor A's payment (order notes name A)", svc.verifyTopup('vendorB', pay), { status: 400 });
    ok('nothing credited by rejected attempts', wallets.size === 0 && txns.length === 0);

    const w1 = await svc.verifyTopup('vendorA', pay);
    ok('genuine top-up credits the PAID amount + 10% bonus (₹999 → 109,890 paise)', w1.balance === 109890, `balance=${w1.balance}`);
    const w2 = await svc.verifyTopup('vendorA', pay);
    const w3 = await svc.verifyTopup('vendorA', pay);
    ok('REPLAY ×2 of the same payment does NOT credit again', w2.balance === 109890 && w3.balance === 109890 && txns.length === 1, `balance=${w3.balance} txns=${txns.length}`);
    ok('no second GST invoice on replay', invoiceCalls.length === 1);
  }

  section('GO-LIVE CONVERSION (sandbox → paid Workspace/BOS)');
  {
    const rz = makeRazorpay();
    const pay = payments(rz);
    const vendorUpdates = [];
    const subs = [];
    const prisma = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'vendor') return {
          findUnique: async ({ where: { id } }) => ({ id, isSandbox: true, name: 'Sandbox', phone: '999', email: 'sb@x.in' }),
          findFirst: async () => null,
          update: async ({ data }) => { vendorUpdates.push(data); return { id: 'sb1', email: data.email, name: 'N', phone: '999', businessName: data.businessName }; },
        };
        if (prop === 'subscription') return { create: async ({ data }) => { subs.push(data); return { id: 'sub1', ...data }; } };
        if (prop === 'then') return undefined;
        return recorder(String(prop));
      },
    });
    const wallet = { getRate: async (_k, d) => d, grantCredit: async () => {} };
    const auth = { mintVendorToken: () => 'jwt' };
    const demo = new DemoService(prisma, recorder('wa'), wallet, pay, recorder('inv'), auth, recorder('email'), recorder('sms'));
    const dto = (extra) => ({ businessName: 'Biz', email: 'new@biz.in', password: 'Secret1', name: 'N', phone: '999', ...extra });

    const real = await demo.createBuyOrder('sb1', 'workspace');
    ok('go-live order amount is server-derived: Workspace ₹11,988 + 18% GST = ₹14,145.84', real.amount === 1414584, `amount=${real.amount}`);

    // ATTACK 1: a real ₹1 order on the platform account (obtainable via any flow) used to convert.
    const tiny = await rz.orders.create({ amount: 100, currency: 'INR', receipt: 'x', notes: { purpose: 'golive', vendorId: 'sb1', plan: 'workspace' } });
    await rejects('ATTACK: ₹1 order (even with correct notes) cannot buy a ₹14,145.84 plan', demo.convertSandbox('sb1', dto({ plan: 'workspace', ...rz.pay(tiny.id) })), { status: 400 });
    // ATTACK 2: pay for Workspace, claim BOS.
    await rejects('ATTACK: Workspace payment submitted as a BOS purchase', demo.convertSandbox('sb1', dto({ plan: 'bos', ...rz.pay(real.orderId) })), { status: 400 });
    // ATTACK 3: another sandbox's payment.
    await rejects("ATTACK: another sandbox's payment used for this account", demo.convertSandbox('sb2', dto({ plan: 'workspace', ...rz.pay(real.orderId) })), { status: 400 });
    await rejects('forged signature', demo.convertSandbox('sb1', dto({ plan: 'workspace', razorpayOrderId: real.orderId, razorpayPaymentId: 'pay_x', razorpaySignature: 'a'.repeat(64) })), { status: 400 });
    ok('sandbox untouched by every rejected attempt (no vendor update, no subscription)', vendorUpdates.length === 0 && subs.length === 0);

    const done = await demo.convertSandbox('sb1', dto({ plan: 'workspace', ...rz.pay(real.orderId) }));
    ok('genuine Workspace payment converts the sandbox', done.vendorId === 'sb1' && vendorUpdates.length === 1 && subs.length === 1);
  }

  section('PREMIUM THEME UNLOCK');
  {
    const rz = makeRazorpay();
    const pay = payments(rz);
    const unlocks = new Map();
    const invoiceCalls = [];
    const themes = { t1: { id: 't1', name: 'Gold', price: 999, active: true }, t2: { id: 't2', name: 'Cheap', price: 10, active: true } };
    const prisma = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'websiteTheme') return { findUnique: async ({ where: { id } }) => themes[id] ?? null };
        if (prop === 'vendorTemplateUnlock') return {
          findUnique: async ({ where }) => unlocks.get(`${where.vendorId_themeId.vendorId}:${where.vendorId_themeId.themeId}`) ?? null,
          upsert: async ({ where, create }) => { unlocks.set(`${where.vendorId_themeId.vendorId}:${where.vendorId_themeId.themeId}`, create); return create; },
        };
        if (prop === 'then') return undefined;
        return recorder(String(prop));
      },
    });
    const svc = new WebsiteThemesService(prisma, pay, { createPaidInvoice: async (a) => { invoiceCalls.push(a); } });
    const cheap = await svc.createUnlockOrder('vA', 't2');
    const gold = await svc.createUnlockOrder('vA', 't1');
    ok('unlock order amount is server-derived (₹999 + 18% GST = ₹1,178.82)', gold.amount === 117882, `amount=${gold.amount}`);
    await rejects('ATTACK: pay for the cheap theme, unlock the expensive one', svc.confirmUnlock('vA', 't1', rz.pay(cheap.orderId)), { status: 400 });
    await rejects("ATTACK: another vendor uses vendor A's payment", svc.confirmUnlock('vB', 't1', rz.pay(gold.orderId)), { status: 400 });
    await rejects('forged signature', svc.confirmUnlock('vA', 't1', { razorpayOrderId: gold.orderId, razorpayPaymentId: 'p', razorpaySignature: 'b'.repeat(64) }), { status: 400 });
    ok('nothing unlocked by rejected attempts', unlocks.size === 0 && invoiceCalls.length === 0);
    const p = rz.pay(gold.orderId);
    await svc.confirmUnlock('vA', 't1', p);
    ok('genuine payment unlocks the theme + issues one invoice', unlocks.has('vA:t1') && invoiceCalls.length === 1);
    await svc.confirmUnlock('vA', 't1', p);
    ok('REPLAY of the same payment is a no-op (no second invoice)', invoiceCalls.length === 1);
  }

  finish();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
