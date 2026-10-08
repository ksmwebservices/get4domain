// Stepnrock handover — stock, availability, movement ledger and order-request checkout.
// Runs the REAL compiled services (dist/) against the in-memory Prisma fake WITH rollback (sequential tests).
// Concurrency / atomicity on real Postgres is proven separately by verify-stock-pg.js.
const { dist, ok, rejects, section, finish, makeRazorpay } = require('../security-verify/harness');
const { createMemPrisma } = require('./mem-prisma');

const R = dist('stock/stock-rules');
const { StockService } = dist('stock/stock.service');
const { CmsService } = dist('cms/cms.service');
const { PublicCheckoutService } = dist('engine/public-checkout.service');

const PUBLIC_KEYS = ['availability', 'category', 'categoryId', 'createdAt', 'customFields', 'description', 'id', 'image', 'maxQty', 'name', 'price', 'priceAmount', 'unit'];

function world({ mode = 'ORDER_REQUEST', keys = false, extraSeed = {}, rollback = true } = {}) {
  const prisma = createMemPrisma({
    vendor: [
      { id: 'v1', name: 'Suresh', email: 's@x.in', businessName: 'Step N Rock', industry: 'retail', subdomain: 'shop', isSandbox: false },
      { id: 'v2', name: 'Other', email: 'o@x.in', businessName: 'Other', industry: 'retail', subdomain: 'other', isSandbox: false },
    ],
    vendorPaymentConfig: mode ? [{ vendorId: 'v1', checkoutMode: mode, enabled: keys, razorpayKeyId: keys ? 'rzp_test' : null, razorpayKeySecret: keys ? 'enc' : null }] : [],
    ...extraSeed,
  }, { rollback });
  const notes = []; const leads = [];
  const notifications = { notifyVendor: async (...a) => { notes.push(a); } };
  const stock = new StockService(prisma, notifications);
  const cms = new CmsService(prisma, undefined, stock);
  const rz = makeRazorpay('audit_secret');
  const vpay = { getKeys: async () => (keys ? { keyId: 'rzp_test', keySecret: 'audit_secret' } : null) };
  const crm = { createLead: async (v, d) => { leads.push({ v, d }); return { id: 'lead1' }; } };
  const checkout = new PublicCheckoutService(prisma, vpay, crm, stock, notifications);
  checkout.razorpayFor = () => rz;
  return { prisma, stock, cms, checkout, notes, leads, rz, t: prisma.$tables };
}
const addr = '12 Main Street, Vadapalani, Chennai 600026';
const buyer = (key, items, extra = {}) => ({ items, name: 'Ravi', phone: '98765 43210', address: addr, idempotencyKey: key, ...extra });
const rows = (w, n) => w.t[n] ?? [];
const prod = (w, id) => rows(w, 'vendorProduct').find((p) => p.id === id);
const moves = (w, id) => rows(w, 'stockMovement').filter((m) => m.productId === id);
// ledger invariant: every balanceAfter equals the running sum, and the last one equals the product's stock
function ledgerOk(w, id) {
  let run = 0;
  for (const m of moves(w, id)) { run += m.delta; if (m.balanceAfter !== run) return false; }
  return run === (prod(w, id).stockQty ?? 0);
}
const newProduct = (w, o = {}) => w.cms.addProduct('v1', { name: 'Aero Sneaker', price: '1000', category: 'Sneakers', trackStock: true, stockQty: 3, reorderLevel: 1, ...o }, 'owner');

(async () => {
  section('RULES: status, availability, purchase limit, public whitelist');
  {
    ok('legacy status values map: active→AVAILABLE, out_of_stock→OUT_OF_STOCK, inactive/draft/archived→HIDDEN, active=false→HIDDEN', R.normaliseStatus('active', true) === 'AVAILABLE' && R.normaliseStatus('out_of_stock', true) === 'OUT_OF_STOCK' && ['inactive', 'draft', 'archived', 'HIDDEN'].every((s) => R.normaliseStatus(s, true) === 'HIDDEN') && R.normaliseStatus('active', false) === 'HIDDEN');
    const base = { active: true, status: 'AVAILABLE', trackStock: true, stockQty: 5, reorderLevel: 2 };
    ok('availability: in / low / out for tracked stock', R.availabilityOf(base) === 'in' && R.availabilityOf({ ...base, stockQty: 2 }) === 'low' && R.availabilityOf({ ...base, stockQty: 0 }) === 'out');
    ok('availability: untracked is always "in"; explicit OUT_OF_STOCK wins over quantity; hidden is not shown', R.availabilityOf({ ...base, trackStock: false, stockQty: null }) === 'in' && R.availabilityOf({ ...base, status: 'OUT_OF_STOCK' }) === 'out' && R.availabilityOf({ ...base, status: 'HIDDEN' }) === null);
    ok('purchase limit: capped at 10, never above stock, 0 when out; untracked = 10', R.maxOrderQty({ ...base, stockQty: 50 }) === 10 && R.maxOrderQty({ ...base, stockQty: 3 }) === 3 && R.maxOrderQty({ ...base, stockQty: 0 }) === 0 && R.maxOrderQty({ ...base, trackStock: false }) === 10);
    const cf = R.sanitiseCustomFields({ stockQty: 12, stock: 'In stock', SKU: 'X1', cost: 400, supplier: 'ACME', gallery: ['a'], sizes: ['8'] });
    ok('internal keys inside customFields never leave the server (stockQty, stock, sku, cost, supplier)', !('stockQty' in cf) && !('stock' in cf) && !('SKU' in cf) && !('cost' in cf) && !('supplier' in cf) && cf.gallery[0] === 'a' && cf.sizes[0] === '8');
    const pub = R.toPublicProduct({ id: 'p', name: 'n', description: null, price: '1', priceAmount: null, image: null, category: null, categoryId: null, unit: null, customFields: null, createdAt: new Date(), ...base, vendorId: 'v1', sku: 'S', sourceModel: 'x', operationKey: 'y' });
    ok('the public product has EXACTLY the whitelisted keys — no stockQty, sku, status, trackStock, reorderLevel, vendorId, sourceModel', JSON.stringify(Object.keys(pub).sort()) === JSON.stringify(PUBLIC_KEYS), Object.keys(pub).join());
    ok('the whitelist select asks for no internal column beyond the stock inputs', !('vendorId' in R.PUBLIC_PRODUCT_SELECT) && !('sku' in R.PUBLIC_PRODUCT_SELECT) && !('sourceModel' in R.PUBLIC_PRODUCT_SELECT));
    ok('reason/mode matrix: SHOP_SALE & DAMAGE only remove, RETURN only adds, RECOUNT only sets', R.reasonAllowsMode('SHOP_SALE', 'remove') && !R.reasonAllowsMode('SHOP_SALE', 'add') && !R.reasonAllowsMode('DAMAGE', 'set') && R.reasonAllowsMode('RETURN', 'add') && !R.reasonAllowsMode('RETURN', 'remove') && R.reasonAllowsMode('RECOUNT', 'set') && !R.reasonAllowsMode('RECOUNT', 'add'));
    ok('quantity validation: whole numbers, add/remove need > 0, set may be 0', R.validateAdjustQuantity('add', 0) !== null && R.validateAdjustQuantity('set', 0) === null && R.validateAdjustQuantity('remove', 1.5) !== null && R.validateAdjustQuantity('add', -1) !== null);
  }

  section('MY PRODUCTS: stock fields, opening stock, status, public API');
  {
    const w = world();
    const p = await newProduct(w);
    ok('create with track stock + opening quantity: stored, ONE opening movement with the right balance', p.trackStock === true && p.stockQty === 3 && p.reorderLevel === 1 && moves(w, p.id).length === 1 && moves(w, p.id)[0].reason === 'OPENING' && moves(w, p.id)[0].balanceAfter === 3 && moves(w, p.id)[0].delta === 3);
    const plain = await w.cms.addProduct('v1', { name: 'Plain', price: '500' });
    ok('an untracked product writes no movement and keeps trackStock=false', plain.trackStock === false && moves(w, plain.id).length === 0 && plain.status === 'AVAILABLE');
    await rejects('a quantity without "track stock" is refused', w.cms.addProduct('v1', { name: 'Bad', price: '1', stockQty: 5 }), { status: 400 });
    await rejects('changing the quantity of a tracked product by edit is refused — it must go through Adjust stock', w.cms.updateProduct(p.id, { stockQty: 99 }), { status: 400, includes: 'Adjust stock' });
    ok('…and the quantity did not change', prod(w, p.id).stockQty === 3);
    await w.cms.updateProduct(plain.id, { trackStock: true, stockQty: 4 });
    ok('switching tracking ON for an existing product records the opening quantity as a movement', prod(w, plain.id).trackStock === true && prod(w, plain.id).stockQty === 4 && moves(w, plain.id).length === 1 && moves(w, plain.id)[0].reason === 'OPENING');
    await w.cms.updateProduct(plain.id, { trackStock: false });
    ok('switching tracking OFF keeps the quantity (nothing is erased)', prod(w, plain.id).trackStock === false && prod(w, plain.id).stockQty === 4);
    await w.cms.updateProduct(p.id, { status: 'OUT_OF_STOCK' });
    ok('status OUT_OF_STOCK keeps the product listed (active) …', prod(w, p.id).status === 'OUT_OF_STOCK' && prod(w, p.id).active === true);
    await w.cms.updateProduct(p.id, { status: 'HIDDEN' });
    ok('… HIDDEN removes it (active=false)', prod(w, p.id).active === false);
    await w.cms.updateProduct(p.id, { active: true });
    ok('the old Show toggle (active:true) brings a hidden product back as AVAILABLE; Hide (active:false) maps to HIDDEN', prod(w, p.id).status === 'AVAILABLE' && prod(w, p.id).active === true);
    await w.cms.updateProduct(p.id, { active: false });
    ok('legacy Hide → status HIDDEN', prod(w, p.id).status === 'HIDDEN');
    await w.cms.updateProduct(p.id, { status: 'AVAILABLE' });

    // public API
    const legacy = await w.cms.addProduct('v1', { name: 'Showcase Shoe', price: '89.99', customFields: { stockQty: 12, stock: 'In Stock', gallery: ['g1'], sizes: ['9'] } });
    const site = await w.cms.getSiteBySubdomain('shop');
    const byId = Object.fromEntries(site.products.map((x) => [x.id, x]));
    ok('PUBLIC site API: only whitelisted fields on every product', site.products.every((x) => JSON.stringify(Object.keys(x).sort()) === JSON.stringify(PUBLIC_KEYS)));
    ok('PUBLIC site API: availability only — in for 3 (level 1), no stockQty/status/sku/trackStock anywhere', byId[p.id].availability === 'in' && !JSON.stringify(site.products).match(/stockQty|trackStock|reorderLevel|"sku"|"status"/));
    ok('the fake "10 in stock" is gone: a product with no tracking is just available (maxQty is a limit, not a count)', byId[legacy.id].availability === 'in' && byId[legacy.id].maxQty === 10 && !('stock' in byId[legacy.id]));
    ok('legacy customFields.stockQty / stock are stripped from the public payload but display fields stay', byId[legacy.id].customFields.gallery[0] === 'g1' && !('stockQty' in byId[legacy.id].customFields) && !('stock' in byId[legacy.id].customFields));
    await w.stock.adjust('v1', p.id, { mode: 'remove', quantity: 2, reason: 'SHOP_SALE' }, 'owner'); // 3 → 1 = at the low level
    ok('low: at or below the low-stock level', (await w.cms.getSiteBySubdomain('shop')).products.find((x) => x.id === p.id).availability === 'low');
    await w.stock.adjust('v1', p.id, { mode: 'remove', quantity: 1, reason: 'SHOP_SALE' }, 'owner');
    const outNow = (await w.cms.getSiteBySubdomain('shop')).products.find((x) => x.id === p.id);
    ok('out: quantity 0 → availability "out" and maxQty 0 (still listed so the shopper sees "Out of stock")', outNow.availability === 'out' && outNow.maxQty === 0);
    await w.cms.updateProduct(p.id, { status: 'HIDDEN' });
    ok('hidden products are not in the public payload at all', !(await w.cms.getSiteBySubdomain('shop')).products.some((x) => x.id === p.id));
    ok('public product list route is whitelisted too', (await w.cms.getPublicProducts('v1')).every((x) => JSON.stringify(Object.keys(x).sort()) === JSON.stringify(PUBLIC_KEYS)));
    ok('the vendor\'s own manage list still returns FULL rows (stock fields) incl. hidden', (await w.cms.getVendorProducts('v1')).some((x) => x.id === p.id && 'stockQty' in x));
    ok('checkoutMode: ORDER_REQUEST for stepnrock-style config; NONE without config; ONLINE with enabled keys', site.checkoutMode === 'ORDER_REQUEST' && (await world({ mode: null }).cms.getSiteBySubdomain('shop')).checkoutMode === 'NONE' && (await world({ mode: 'ONLINE', keys: true }).cms.getSiteBySubdomain('shop')).checkoutMode === 'ONLINE');
  }

  section('ADJUST STOCK: add / remove / set, never below 0, history, idempotency, low-stock alert');
  {
    const w = world();
    const p = await newProduct(w, { stockQty: 5, reorderLevel: 2 });
    const a = await w.stock.adjust('v1', p.id, { mode: 'add', quantity: 4, reason: 'RETURN', note: 'customer return' }, 'staff1');
    ok('add 4 (Return): 5 → 9, movement +4 with balanceAfter 9 and the note/actor', a.stockQty === 9 && a.movement.delta === 4 && a.movement.balanceAfter === 9 && a.movement.reason === 'RETURN' && a.movement.note === 'customer return' && a.movement.createdBy === 'staff1');
    const b = await w.stock.adjust('v1', p.id, { mode: 'remove', quantity: 3, reason: 'DAMAGE' }, 'owner');
    ok('remove 3 (Damage): 9 → 6', b.stockQty === 6 && b.movement.delta === -3 && b.movement.balanceAfter === 6);
    const c = await w.stock.adjust('v1', p.id, { mode: 'set', quantity: 4, reason: 'RECOUNT' }, 'owner');
    ok('set counted 4 (Recount): 6 → 4, movement −2', c.stockQty === 4 && c.movement.delta === -2 && c.movement.balanceAfter === 4);
    await rejects('removing more than is in stock is refused (cannot go below 0)', w.stock.adjust('v1', p.id, { mode: 'remove', quantity: 5, reason: 'SHOP_SALE' }, 'owner'), { status: 400, includes: 'below 0' });
    ok('…and nothing changed (no movement, stock still 4)', prod(w, p.id).stockQty === 4 && moves(w, p.id).length === 4);
    const d = await w.stock.adjust('v1', p.id, { mode: 'remove', quantity: 4, reason: 'SHOP_SALE' }, 'owner');
    ok('removing exactly what is there is allowed and leaves 0', d.stockQty === 0 && prod(w, p.id).stockQty === 0);
    await rejects('the reason must fit the direction (Shop sale cannot add)', w.stock.adjust('v1', p.id, { mode: 'add', quantity: 1, reason: 'SHOP_SALE' }, 'owner'), { status: 400 });
    await rejects('an untracked product cannot be adjusted', w.stock.adjust('v1', (await w.cms.addProduct('v1', { name: 'U', price: '1' })).id, { mode: 'add', quantity: 1, reason: 'RETURN' }, 'owner'), { status: 400, includes: 'track stock' });
    await rejects('another vendor cannot adjust this product', w.stock.adjust('v2', p.id, { mode: 'add', quantity: 1, reason: 'RETURN' }, 'x'), { status: 404 });
    await rejects('zero / fractional quantities are refused', Promise.all([w.stock.adjust('v1', p.id, { mode: 'add', quantity: 0, reason: 'RETURN' }, 'o')]).then(() => w.stock.adjust('v1', p.id, { mode: 'add', quantity: 1.5, reason: 'RETURN' }, 'o')), { status: 400 });
    ok('LEDGER: every balanceAfter equals the running total and the last equals the product stock', ledgerOk(w, p.id));

    await new Promise((r) => setTimeout(r, 5)); // distinct createdAt (the fake stamps with ms precision)
    const k1 = await w.stock.adjust('v1', p.id, { mode: 'add', quantity: 7, reason: 'RETURN', idempotencyKey: 'retry-1' }, 'o');
    const k2 = await w.stock.adjust('v1', p.id, { mode: 'add', quantity: 7, reason: 'RETURN', idempotencyKey: 'retry-1' }, 'o');
    ok('IDEMPOTENCY: the same key twice applies once (7, not 14) and reports the replay', k1.replayed === false && k2.replayed === true && prod(w, p.id).stockQty === 7 && moves(w, p.id).filter((m) => m.idempotencyKey.endsWith('retry-1')).length === 1);
    const hist = await w.stock.history('v1', p.id);
    ok('history lists the movements newest first with reasons', hist.length === moves(w, p.id).length && hist[0].reason === 'RETURN');

    // low-stock notifications
    const w2 = world();
    const q = await newProduct(w2, { stockQty: 5, reorderLevel: 2 });
    await w2.stock.adjust('v1', q.id, { mode: 'remove', quantity: 2, reason: 'SHOP_SALE' }, 'o'); // 5 → 3 (above level 2)
    ok('no alert while stock is above the low level', w2.notes.length === 0);
    await w2.stock.adjust('v1', q.id, { mode: 'remove', quantity: 1, reason: 'SHOP_SALE' }, 'o'); // 3 → 2 (= level)
    ok('crossing the low level raises ONE "Low stock" notification', w2.notes.length === 1 && w2.notes[0][1] === 'LOW_STOCK' && /Low stock/.test(w2.notes[0][2]));
    await w2.stock.adjust('v1', q.id, { mode: 'remove', quantity: 1, reason: 'SHOP_SALE' }, 'o'); // 2 → 1 (already low)
    ok('no repeat alert while already low', w2.notes.length === 1);
    await w2.stock.adjust('v1', q.id, { mode: 'remove', quantity: 1, reason: 'SHOP_SALE' }, 'o'); // → 0
    ok('running out raises an "Out of stock" notification', w2.notes.length === 2 && /Out of stock/.test(w2.notes[1][2]));
    const low = await w2.stock.lowStock('v1');
    ok('the Low stock list shows tracked products at/below their level (and only those with a level)', low.length === 1 && low[0].id === q.id);
  }

  section('ORDER REQUESTS (no online payment): reserve, idempotency, all-or-nothing, cancel, paid');
  {
    const w = world();
    const p = await newProduct(w, { stockQty: 3, reorderLevel: 1 });
    const o = await w.checkout.placeOrderRequest('v1', buyer('cart-key-0001', [{ productId: p.id, name: 'Aero Sneaker — 9 / Black', qty: 2 }]));
    const sale = rows(w, 'posSale').find((s) => s.id === o.orderId);
    ok('an order request is saved as PENDING_PAYMENT with the customer, a normalised phone and the delivery address', o.ok && sale.status === 'PENDING_PAYMENT' && sale.customerName === 'Ravi' && sale.customerPhone === '9876543210' && sale.deliveryAddress === addr && sale.paymentMethod === 'order_request' && o.amount === 2000);
    ok('stock was reserved atomically with the order: 3 → 1, with an ORDER movement (refId = the order, balanceAfter 1)', prod(w, p.id).stockQty === 1 && moves(w, p.id).some((m) => m.reason === 'ONLINE_ORDER' && m.refType === 'ORDER' && m.refId === o.orderId && m.delta === -2 && m.balanceAfter === 1));
    ok('the server price was used (₹1,000 × 2), never the client\'s', sale.total === 2000);
    ok('the vendor was notified (NEW_ORDER) and a CRM lead was created', w.notes.some((n) => n[1] === 'NEW_ORDER') && w.leads.length === 1);
    ok('crossing the low level on the order raised a Low stock alert', w.notes.some((n) => n[1] === 'LOW_STOCK'));
    const again = await w.checkout.placeOrderRequest('v1', buyer('cart-key-0001', [{ productId: p.id, name: 'Aero Sneaker', qty: 2 }]));
    ok('IDEMPOTENCY: the same key again returns the SAME order — one sale, stock reserved once', again.replayed === true && again.orderId === o.orderId && rows(w, 'posSale').filter((s) => s.type === 'web').length === 1 && prod(w, p.id).stockQty === 1);
    await rejects('a different shopper asking for more than is left is refused ("only 1 left")', w.checkout.placeOrderRequest('v1', buyer('cart-key-0002', [{ productId: p.id, name: 'Aero Sneaker', qty: 2 }])), { status: 400, includes: 'only 1 left' });
    ok('…and no order or movement was created, stock still 1 (never negative)', rows(w, 'posSale').length === 1 && prod(w, p.id).stockQty === 1);
    const list = await w.checkout.listWebOrders('v1');
    ok('the vendor\'s Orders list carries name, phone, address, items and status', list.length === 1 && list[0].customerName === 'Ravi' && list[0].deliveryAddress === addr && list[0].status === 'PENDING_PAYMENT' && Array.isArray(list[0].items) && list[0].items[0].qty === 2);

    // a racing duplicate submit: both pass the "already exists?" look-up, the unique key rejects the loser (P2002) and the
    // loser must hand back the winner's order with its stock reserved exactly once
    // (own world WITHOUT the fake's snapshot rollback — that rollback is only valid for sequential tests)
    const wr = world({ rollback: false });
    const rp = await newProduct(wr, { name: 'Race Product', stockQty: 10 });
    const race = await Promise.allSettled(Array.from({ length: 4 }, () => wr.checkout.placeOrderRequest('v1', buyer('cart-key-race', [{ productId: rp.id, name: 'Race Product', qty: 2 }]))));
    const raceIds = new Set(race.filter((x) => x.status === 'fulfilled').map((x) => x.value.orderId));
    ok('RACING DUPLICATE SUBMITS (same key ×4): every caller gets the one order, nobody gets an error', race.every((x) => x.status === 'fulfilled') && raceIds.size === 1, race.map((x) => x.status === 'rejected' ? x.reason.message : 'ok').join());
    ok('…exactly one sale row and the stock reserved once (10 → 8)', rows(wr, 'posSale').filter((s) => s.idempotencyKey === 'cart-key-race').length === 1 && prod(wr, rp.id).stockQty === 8 && ledgerOk(wr, rp.id));

    // all-or-nothing across lines (StockService.reserve in one transaction)
    const a = await newProduct(w, { name: 'Line A', stockQty: 5 });
    const b = await newProduct(w, { name: 'Line B', stockQty: 1 });
    await rejects('ALL-OR-NOTHING: a cart where line B cannot be fulfilled fails as a whole', w.prisma.$transaction((tx) => w.stock.reserve(tx, 'v1', [{ productId: a.id, qty: 2 }, { productId: b.id, qty: 3 }], { type: 'ORDER', id: 'x' }, 'order:x')), { status: 400 });
    ok('…line A\'s reservation was rolled back too (stock 5, no movement beyond opening)', prod(w, a.id).stockQty === 5 && moves(w, a.id).length === 1);
    const multi = await w.checkout.placeOrderRequest('v1', buyer('cart-key-0003', [{ productId: a.id, name: 'Line A', qty: 2 }, { productId: b.id, name: 'Line B', qty: 1 }]));
    ok('a valid two-line order reserves both lines', prod(w, a.id).stockQty === 3 && prod(w, b.id).stockQty === 0 && multi.ok);

    // cancel restores exactly once
    const c1 = await w.checkout.cancelOrder('v1', o.orderId, 'owner');
    ok('CANCEL: status CANCELLED and the stock is back (1 → 3) with a CANCEL movement', c1.status === 'CANCELLED' && prod(w, p.id).stockQty === 3 && moves(w, p.id).some((m) => m.reason === 'CANCEL' && m.refId === o.orderId && m.delta === 2 && m.balanceAfter === 3));
    await rejects('a second cancel is refused …', w.checkout.cancelOrder('v1', o.orderId, 'owner'), { status: 409 });
    ok('… and stock was NOT restored twice', prod(w, p.id).stockQty === 3);
    await rejects('another vendor cannot cancel or see this order', w.checkout.cancelOrder('v2', multi.orderId, 'x'), { status: 404 });
    const paid = await w.checkout.markOrderPaid('v1', multi.orderId);
    ok('MARK PAID: PENDING_PAYMENT → completed with a paid time', paid.status === 'completed' && paid.paidAt instanceof Date);
    await rejects('an order that is already paid cannot be marked paid again', w.checkout.markOrderPaid('v1', multi.orderId), { status: 409 });
    await w.checkout.cancelOrder('v1', multi.orderId, 'owner');
    ok('cancelling a PAID order also restores its stock (refund itself is outside the system)', prod(w, a.id).stockQty === 5 && prod(w, b.id).stockQty === 1);

    // availability rules at order time
    await w.cms.updateProduct(a.id, { status: 'OUT_OF_STOCK' });
    await rejects('an OUT_OF_STOCK product cannot be ordered even if a quantity remains', w.checkout.placeOrderRequest('v1', buyer('cart-key-0004', [{ productId: a.id, name: 'Line A', qty: 1 }])), { status: 400, includes: 'out of stock' });
    await w.cms.updateProduct(a.id, { status: 'HIDDEN' });
    await rejects('a HIDDEN product cannot be ordered', w.checkout.placeOrderRequest('v1', buyer('cart-key-0005', [{ productId: a.id, name: 'Line A', qty: 1 }])), { status: 400 });
    const free = await w.cms.addProduct('v1', { name: 'Untracked Cap', price: '300' });
    const u = await w.checkout.placeOrderRequest('v1', buyer('cart-key-0006', [{ productId: free.id, name: 'Untracked Cap', qty: 4 }]));
    ok('an untracked product can be ordered and writes no movement', u.ok && moves(w, free.id).length === 0);
    await rejects('bad phone is refused', w.checkout.placeOrderRequest('v1', buyer('cart-key-0007', [{ productId: free.id, name: 'x', qty: 1 }], { phone: '123' })), { status: 400 });
    const closed = world({ mode: null });
    const cp = await closed.cms.addProduct('v1', { name: 'P', price: '100' });
    await rejects('a shop that has not enabled order requests refuses them', closed.checkout.placeOrderRequest('v1', buyer('cart-key-0008', [{ productId: cp.id, name: 'P', qty: 1 }])), { status: 400, includes: 'not taking order requests' });
    ok('LEDGER: every product\'s movements add up to its stock', [p, a, b, free].every((x) => ledgerOk(w, x.id)));
  }

  section('ONLINE checkout (vendor\'s own Razorpay): VendorProduct stock is now reserved; a shortage after payment is loud, not silent');
  {
    const w = world({ mode: 'ONLINE', keys: true });
    const p = await newProduct(w, { stockQty: 3 });
    const items = [{ productId: p.id, name: 'Aero Sneaker', qty: 2 }];
    const order = await w.checkout.createOrder('v1', { items, name: 'Ravi', phone: '9876543210' });
    const pay = w.rz.pay(order.razorpayOrderId);
    const done = await w.checkout.confirm('v1', { items, name: 'Ravi', phone: '9876543210', ...pay });
    ok('a paid online order reserves VendorProduct stock (3 → 1) with a movement tied to the sale and payment', done.ok && prod(w, p.id).stockQty === 1 && moves(w, p.id).some((m) => m.reason === 'ONLINE_ORDER' && m.refId === done.saleId && m.idempotencyKey.startsWith('pay:')));
    const replay = await w.checkout.confirm('v1', { items, name: 'Ravi', phone: '9876543210', ...pay });
    ok('replaying the same confirmation does not reserve again', replay.saleId === done.saleId && prod(w, p.id).stockQty === 1);
    const o2 = await w.checkout.createOrder('v1', { items: [{ productId: p.id, name: 'x', qty: 1 }], name: 'R', phone: '9876543210' });
    const pay2 = w.rz.pay(o2.razorpayOrderId);
    await w.stock.adjust('v1', p.id, { mode: 'remove', quantity: 1, reason: 'SHOP_SALE' }, 'owner'); // sold in the shop meanwhile
    let err = null;
    try { await w.checkout.confirm('v1', { items: [{ productId: p.id, name: 'x', qty: 1 }], name: 'R', phone: '9876543210', ...pay2 }); } catch (e) { err = e; }
    ok('PAID but sold out meanwhile: the shopper gets a clear conflict that quotes the payment id (not a bare 400)', err && err.getStatus() === 409 && err.message.includes(pay2.razorpayPaymentId));
    ok('…and the VENDOR is told (PAID_SHORTFALL with the payment id) so the money can be refunded', w.notes.some((n) => n[1] === 'PAID_SHORTFALL' && String(n[3]).includes(pay2.razorpayPaymentId)));
    ok('…no sale was recorded and stock is untouched (0, never negative)', rows(w, 'posSale').filter((s) => s.razorpayPaymentId === pay2.razorpayPaymentId).length === 0 && prod(w, p.id).stockQty === 0);
    ok('LEDGER holds on the online path too', ledgerOk(w, p.id));
  }

  section('EVERY STOCK PATH WRITES A MOVEMENT; random sequence keeps stock ≥ 0 and the ledger exact');
  {
    const w = world();
    const items = [];
    for (let i = 0; i < 3; i += 1) items.push(await newProduct(w, { name: `Rnd ${i}`, stockQty: 4 + i * 3, reorderLevel: 2 }));
    let seed = 20261008;
    const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const live = [];
    let negative = false; let broken = false; let n = 0;
    for (let i = 0; i < 160; i += 1) {
      const p = items[Math.floor(rnd() * items.length)];
      const r = rnd();
      try {
        if (r < 0.25) await w.stock.adjust('v1', p.id, { mode: 'add', quantity: 1 + Math.floor(rnd() * 4), reason: 'RETURN' }, 'o');
        else if (r < 0.5) await w.stock.adjust('v1', p.id, { mode: 'remove', quantity: 1 + Math.floor(rnd() * 5), reason: 'SHOP_SALE' }, 'o');
        else if (r < 0.62) await w.stock.adjust('v1', p.id, { mode: 'set', quantity: Math.floor(rnd() * 12), reason: 'RECOUNT' }, 'o');
        else if (r < 0.9) { n += 1; const o = await w.checkout.placeOrderRequest('v1', buyer(`rnd-key-${n}-${i}`, [{ productId: p.id, name: p.name, qty: 1 + Math.floor(rnd() * 3) }])); live.push(o.orderId); }
        else if (live.length) { const id = live.splice(Math.floor(rnd() * live.length), 1)[0]; await w.checkout.cancelOrder('v1', id, 'o'); }
      } catch { /* refusals (out of stock, below 0) are expected */ }
      for (const x of items) { if ((prod(w, x.id).stockQty ?? 0) < 0) negative = true; if (!ledgerOk(w, x.id)) broken = true; }
    }
    ok('160 random adds/removes/recounts/orders/cancels: stock never went negative', negative === false);
    ok('…and after EVERY step each ledger summed exactly to the product stock with correct balanceAfter', broken === false);
    const reasons = new Set(rows(w, 'stockMovement').map((m) => m.reason));
    ok('movements were written for every path exercised: OPENING, ADJUSTMENT-family, ONLINE_ORDER, CANCEL', ['OPENING', 'ONLINE_ORDER', 'CANCEL'].every((r) => reasons.has(r)) && ['RETURN', 'SHOP_SALE', 'RECOUNT'].every((r) => reasons.has(r)), [...reasons].join());
  }

  finish();
})().catch((e) => { console.error(e); process.exit(1); });
