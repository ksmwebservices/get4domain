// FIX 3: public checkout — server-side pricing, cart-bound orders, replay protection.
const { dist, ok, rejects, section, finish, hmac, makeRazorpay, recorder } = require('./harness');
const { PublicCheckoutService } = dist('engine/public-checkout.service');
const { parseListedPrice, baseProductName } = dist('engine/checkout-pricing');

function build() {
  const sales = [];
  const stockOps = [];
  const leads = [];
  const catalog = [{ id: 'c1', name: 'Team Tee', price: 499, stock: 3 }];
  const products = [
    { id: 'p1', name: 'Aero Flight Sneakers', price: '89.99' },
    { id: 'p2', name: 'Velocity Pro Running', price: '₹1,119.50' },
    { id: 'p3', name: 'Custom Lessons', price: 'from ₹500' },
    { id: 'p4', name: 'Dup Name', price: '10' },
    { id: 'p5', name: 'Dup Name', price: '20' },
  ];
  const prisma = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'vendorProduct') return { findMany: async () => products };
      if (prop === 'catalogItem') return { findMany: async () => catalog, updateMany: async (a) => { stockOps.push(a); return { count: 1 }; } };
      if (prop === 'posSale') return {
        findUnique: async ({ where }) => sales.find((s) => s.razorpayPaymentId === where.razorpayPaymentId) ?? null,
        create: async ({ data }) => { const s = { id: `sale_${sales.length + 1}`, ...data }; sales.push(s); return s; },
        findMany: async () => sales,
      };
      if (prop === '$transaction') return async (fn) => fn(prisma);
      if (prop === '$queryRawUnsafe') return async () => [];
      if (prop === 'then') return undefined;
      return recorder(String(prop));
    },
  });
  const rz = makeRazorpay('vendor_secret');
  const vendorPayments = { getKeys: async () => ({ keyId: 'rzp_test_vendor', keySecret: 'vendor_secret' }) };
  const crm = { createLead: async (v, d) => { leads.push({ v, d }); return { id: 'lead1' }; } };
  const svc = new PublicCheckoutService(prisma, vendorPayments, crm);
  svc.razorpayFor = () => rz;
  return { svc, rz, sales, stockOps, leads, products, catalog };
}

const buyer = { name: 'Ravi', phone: '9876543210' };

(async () => {
  section('FIX 3 — pure helpers');
  ok("parseListedPrice('89.99') = 89.99", parseListedPrice('89.99') === 89.99);
  ok("parseListedPrice('₹1,119.50') = 1119.5", parseListedPrice('₹1,119.50') === 1119.5);
  ok("parseListedPrice('from ₹500') = null (not purchasable online)", parseListedPrice('from ₹500') === null);
  ok("parseListedPrice('0') / '' / null = null", parseListedPrice('0') === null && parseListedPrice('') === null && parseListedPrice(null) === null);
  ok("variant suffix stripped: 'Aero Flight Sneakers — 9 / Black' → 'aero flight sneakers'", baseProductName('Aero Flight Sneakers — 9 / Black') === 'aero flight sneakers');

  section('FIX 3 — a tampered price is ignored; the server prices from the database');
  {
    const { svc } = build();
    const o1 = await svc.createOrder('v1', { ...buyer, items: [{ name: 'Aero Flight Sneakers — 9 / Black', price: 1, qty: 1 }] });
    ok('client says ₹1 → order is created for the DB price ₹89.99 (8999 paise)', o1.amount === 8999, `amount=${o1.amount}`);
    const o2 = await svc.createOrder('v1', { ...buyer, items: [{ name: 'Aero Flight Sneakers', price: 0, qty: 3 }] });
    ok('client says ₹0 × 3 → ₹269.97', o2.amount === 26997, `amount=${o2.amount}`);
    const o3 = await svc.createOrder('v1', { ...buyer, items: [{ productId: 'p2', name: 'whatever', price: 0.01, qty: 2 }] });
    ok('productId reference, client price ₹0.01 → server price 2 × ₹1,119.50 = ₹2,239', o3.amount === 223900, `amount=${o3.amount}`);
    const o4 = await svc.createOrder('v1', { ...buyer, items: [{ name: 'Aero Flight Sneakers', qty: 1 }] });
    ok('price field omitted entirely still works (price is optional now)', o4.amount === 8999);
    await rejects('NEGATIVE-style trick: unknown item name cannot be priced by the client', svc.createOrder('v1', { ...buyer, items: [{ name: 'Gold Bar', price: 1, qty: 1 }] }), { status: 400, includes: 'no longer available' });
    await rejects('unknown productId', svc.createOrder('v1', { ...buyer, items: [{ productId: 'nope', name: 'x', price: 1, qty: 1 }] }), { status: 400 });
    await rejects('non-purchasable listing ("from ₹500") cannot be bought by naming a price', svc.createOrder('v1', { ...buyer, items: [{ productId: 'p3', name: 'Custom Lessons', price: 1, qty: 1 }] }), { status: 400 });
    await rejects('ambiguous name (two products share it) is rejected, never guessed', svc.createOrder('v1', { ...buyer, items: [{ name: 'Dup Name', price: 1, qty: 1 }] }), { status: 400 });
    await rejects('quantity above available stock', svc.createOrder('v1', { ...buyer, items: [{ catalogItemId: 'c1', name: 'Team Tee', qty: 5 }] }), { status: 400, includes: 'out of stock' });
  }

  section('FIX 3 — confirm: bound to the cart, vendor and a captured payment');
  {
    const { svc, rz, sales, stockOps, leads } = build();
    const items = [{ name: 'Aero Flight Sneakers — 9 / Black', price: 1, qty: 1 }, { catalogItemId: 'c1', name: 'Team Tee', qty: 2 }];
    const order = await svc.createOrder('v1', { ...buyer, items });
    ok('order total = 89.99 + 2 × 499 = ₹1,087.99', order.amount === 108799, `amount=${order.amount}`);
    const pay = rz.pay(order.razorpayOrderId);

    await rejects('forged signature at confirm', svc.confirm('v1', { ...buyer, items, razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: pay.razorpayPaymentId, razorpaySignature: 'f'.repeat(64) }), { status: 400, includes: 'signature' });
    await rejects('ATTACK: confirm a DIFFERENT (bigger) cart with a payment made for a small one',
      svc.confirm('v1', { ...buyer, items: [{ name: 'Velocity Pro Running', qty: 5 }], ...pay }), { status: 400, includes: 'could not be verified' });
    await rejects('ATTACK: same cart but the payment was only authorized, not captured',
      svc.confirm('v1', { ...buyer, items, ...rz.pay(order.razorpayOrderId, { status: 'authorized' }) }), { status: 400 });
    await rejects('ATTACK: confirm on vendor "v2" with v1\'s payment (order notes name v1)',
      svc.confirm('v2', { ...buyer, items, ...pay }), { status: 400 });
    ok('nothing was recorded by any rejected attempt', sales.length === 0 && stockOps.length === 0 && leads.length === 0);

    const done = await svc.confirm('v1', { ...buyer, items, ...pay });
    ok('genuine confirm records exactly one sale', done.ok && sales.length === 1);
    ok('recorded total is the amount actually paid (₹1,087.99), from the server', sales[0].total === 1087.99 && sales[0].subtotal === 1087.99, `total=${sales[0].total}`);
    ok('sale stores the Razorpay order + payment ids', sales[0].razorpayPaymentId === pay.razorpayPaymentId && sales[0].razorpayOrderId === order.razorpayOrderId);
    ok('recorded line prices are the DB prices, not the client\'s ₹1', JSON.stringify(sales[0].items).includes('89.99') && !JSON.stringify(sales[0].items).includes('"price":1,'));
    ok('stock decremented once for the tracked catalogue line', stockOps.length === 1 && stockOps[0].data.stock.decrement === 2);
    ok('one CRM lead created', leads.length === 1);

    section('FIX 3 — REPLAY: resending the captured confirm request has no further effect');
    const replay1 = await svc.confirm('v1', { ...buyer, items, ...pay });
    const replay2 = await svc.confirm('v1', { ...buyer, items, ...pay });
    ok('replay returns the ORIGINAL sale id (idempotent)', replay1.saleId === done.saleId && replay2.saleId === done.saleId);
    ok('still exactly one sale after two replays', sales.length === 1);
    ok('stock NOT decremented again', stockOps.length === 1);
    ok('no duplicate CRM lead', leads.length === 1);
    const [c1, c2] = await Promise.all([svc.confirm('v1', { ...buyer, items, ...pay }), svc.confirm('v1', { ...buyer, items, ...pay })]);
    ok('concurrent replays also collapse to the one sale', c1.saleId === done.saleId && c2.saleId === done.saleId && sales.length === 1);
  }

  section('FIX 3 — a catalogue price change between order and confirm does not lose a legitimate paid order');
  {
    const { svc, rz, sales, products } = build();
    const items = [{ name: 'Aero Flight Sneakers', qty: 1 }];
    const order = await svc.createOrder('v1', { ...buyer, items });
    products[0].price = '99.99'; // vendor edits the price while the buyer is on the Razorpay window
    const done = await svc.confirm('v1', { ...buyer, items, ...rz.pay(order.razorpayOrderId) });
    ok('paid ₹89.99 order is still recorded, at the amount actually paid', done.ok && sales[0].total === 89.99);
  }

  finish();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
