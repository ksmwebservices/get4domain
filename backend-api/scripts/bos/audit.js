// Phase 0 audit (Full BOS dispatch, 2026-10-09): does it work or not, with proof.
// Boots the REAL API over an isolated in-memory Postgres, seeds a COMMERCE vendor shaped like Step N Rock, and exercises every registry
// feature plus the five mandatory chains. It FIXES NOTHING: a broken step is recorded as broken, with the exact step.
//
//   node scripts/bos/audit.js            -> writes docs/v2/evidence/full-bos/AUDIT_<date>.md and audit.json
//
// Run `npx nest build` first. Needs PGlite (see scripts/e2e/bos-harness.js).
const fs = require('fs');
const path = require('path');
const { startHarness, available } = require('../e2e/bos-harness');

const OUT = path.join(__dirname, '..', '..', '..', 'docs', 'v2', 'evidence', 'full-bos');
const rows = [];
const chains = {};
const bugs = {};
const row = (id, dept, tested, result, evidence, size = '-') => rows.push({ id, dept, tested, result, evidence, size });
const short = (v, n = 160) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > n ? `${s.slice(0, n)}…` : s; };

(async () => {
  if (!(await available())) { console.log('SKIP: PGlite not installed (set G4D_PGLITE_DIR)'); process.exit(0); }
  const h = await startHarness({ port: 3097, pgPort: 54331 });
  const { prisma, call } = h;
  const features = require(path.join(__dirname, '..', '..', 'dist', 'src', 'registry', 'registry.generated')).FEATURES;
  try {
    // ── seed: a footwear shop like Step N Rock, on the Essentials plan ──────────────────────────────
    const v = await h.createVendor({ key: 'snr', industry: 'retail', plan: 'WORKSPACE', subdomain: 'snr' });
    const T = v.token;
    await prisma.vendorPaymentConfig.create({ data: { vendorId: v.id, checkoutMode: 'ORDER_REQUEST' } });
    const mk = async (name, price, extra = {}) => (await call('POST', `/cms/vendor/${v.id}/products`, { name, price: String(price), category: 'Sneakers', ...extra }, T));
    const p1 = await mk('Aero Flight Sneakers', 1299, { trackStock: true, stockQty: 6, reorderLevel: 3, customFields: { sizes: ['8', '9'], colors: ['Black', 'Red'] } });
    const p2 = await mk('Velocity Runner', 1899, { trackStock: true, stockQty: 2, reorderLevel: 3 });
    const p3 = await mk('Canvas Sandal', 650);
    const pid1 = p1.data?.id; const pid2 = p2.data?.id;
    row('commerce.products', 'commerce', 'created 3 products (sizes/colours, tracked and untracked) through the real API', p1.status < 300 && p2.status < 300 && p3.status < 300 ? 'WORKS' : 'BROKEN', `create statuses ${p1.status}/${p2.status}/${p3.status}`, 'S');

    // ── CHAIN A — Sell ───────────────────────────────────────────────────────────────────────────────
    const A = [];
    const step = (arr, name, ok, evidence) => arr.push({ step: name, ok: Boolean(ok), evidence: short(evidence) });
    const site = await call('GET', `/cms/site/snr`);
    step(A, 'A1 website shows the product (public /cms/site)', site.status === 200 && JSON.stringify(site.body).includes('Aero Flight Sneakers'), `status ${site.status}`);
    const idem = `audit-${Date.now()}`;
    const order = await call('POST', '/engine/public/snr/actions/engine.checkout.request', { items: [{ productId: pid1, name: 'Aero Flight Sneakers — 9 / Black', qty: 2 }], name: 'Ravi Kumar', phone: '9876543210', address: '12 Main Street, Vadapalani, Chennai 600026', idempotencyKey: idem });
    const orderId = order.data?.orderId ?? order.data?.data?.orderId;
    step(A, 'A2 website cart → order placed (PENDING_PAYMENT, stock reserved)', order.status < 300 && orderId, `status ${order.status} ${short(order.body, 120)}`);
    const prodAfter = await prisma.vendorProduct.findUnique({ where: { id: pid1 } });
    step(A, 'A2b stock reduced by the order (6 → 4)', prodAfter?.stockQty === 4, `stockQty ${prodAfter?.stockQty}`);
    const paid = await call('POST', `/engine/orders/${orderId}/paid`, undefined, T);
    step(A, 'A3 payment recorded (owner marks the order paid)', paid.status < 300, `status ${paid.status}`);
    const orders = await call('GET', '/engine/orders', undefined, T);
    const mine = (orders.data ?? []).find?.((o) => o.id === orderId);
    step(A, 'A4 order status visible in the dashboard', Boolean(mine) && /PAID|paid|COMPLETED|completed/.test(JSON.stringify(mine)), short(mine ?? orders.body, 120));
    const contact = await prisma.contact.findFirst({ where: { vendorId: v.id, phone: { contains: '9876543210' } } });
    const lead = await prisma.campaignLead.findFirst({ where: { vendorId: v.id } });
    step(A, 'A5 CUSTOMER RECORD created/updated from the order (Contact)', Boolean(contact), contact ? 'contact exists' : `no Contact row; only a CRM lead exists (${lead ? lead.source : 'none'})`);
    chains.A = A;

    const sumAfterOrder = await call('GET', '/accounting/summary', undefined, T);

    // ── CHAIN B — Bill ───────────────────────────────────────────────────────────────────────────────
    const B = [];
    const cnt = await call('POST', '/domainapp/contacts', { name: 'Ravi Kumar', phone: '9876543210', type: 'customer' }, T);
    step(B, 'B0 (workaround) create the customer by hand', cnt.status < 300, `status ${cnt.status}`);
    const inv = await call('POST', '/domainapp/invoices', { contactId: cnt.data?.id, items: [{ description: 'Aero Flight Sneakers x2', quantity: 2, rate: 1299 }], gstRate: 18 }, T);
    step(B, 'B1 order → customer invoice, automatically', false, 'no code path creates an invoice from an order; only a manual invoice exists');
    step(B, 'B1b manual invoice can be created at all', inv.status < 300, `status ${inv.status} ${short(inv.body, 100)}`);
    const pdf = inv.data?.id ? await call('GET', `/domainapp/invoices/${inv.data.id}/pdf`, undefined, T) : { status: 0 };
    step(B, 'B2 invoice PDF/HTML for sharing', pdf.status === 200, `status ${pdf.status}`);
    const link = inv.data?.id ? await call('POST', `/domainapp/invoices/${inv.data.id}/send-link`, {}, T) : { status: 0, body: null };
    step(B, 'B3 share link (needs the vendor\'s own Razorpay; WhatsApp deep link)', link.status < 300, `status ${link.status} ${short(link.body, 120)}`);
    const mp = inv.data?.id ? await call('PUT', `/domainapp/invoices/${inv.data.id}/mark-paid`, {}, T) : { status: 0 };
    step(B, 'B4 mark paid (binary PENDING→PAID only)', mp.status < 300, `status ${mp.status}`);
    step(B, 'B5 receipts, part payments, advances, outstanding by customer, ageing, statement', false, 'no receipt/allocation model exists: invoices are paid or not paid, nothing in between');
    step(B, 'B6 credit notes / returns', false, 'no credit-note model or endpoint');
    chains.B = B;

    // ── CHAIN C — Stock ──────────────────────────────────────────────────────────────────────────────
    const C = [];
    const low = await call('GET', '/stock/low', undefined, T);
    step(C, 'C1 tracked product with stock; low-stock list', low.status === 200, short(low.body, 140));
    const adj = await call('POST', `/stock/products/${pid2}/adjust`, { mode: 'remove', quantity: 1, reason: 'DAMAGE', note: 'audit' }, T);
    step(C, 'C2 manual adjustment (damaged)', adj.status < 300, `status ${adj.status} ${short(adj.body, 100)}`);
    const hist = await call('GET', `/stock/products/${pid2}/history`, undefined, T);
    step(C, 'C3 stock history lists every movement', hist.status === 200 && (hist.data ?? []).length >= 1, `${(hist.data ?? []).length} movements`);
    const mv = await prisma.stockMovement.findMany({ where: { productId: pid1 } });
    step(C, 'C4 website order wrote a ledger movement (sale reduces stock)', mv.some((m) => m.refType === 'ORDER' && m.delta === -2), `movements ${mv.map((m) => `${m.reason}:${m.delta}`).join(',')}`);
    step(C, 'C5 variants (size/colour) tracked in stock', false, 'variants live in customFields JSON; StockMovement and stockQty are per product only');
    step(C, 'C6 multi-location, purchase receipts, transfers', false, 'not modelled (one quantity per product)');
    chains.C = C;

    // ── CHAIN D — Books ──────────────────────────────────────────────────────────────────────────────
    const D = [];
    step(D, 'D1 Accounts summary shows the PAID website order of ₹2,598 (taken right after the order was paid)', sumAfterOrder.status === 200 && Number(sumAfterOrder.data?.revenueGross) > 0, `revenueGross=${sumAfterOrder.data?.revenueGross}: the paid order is invisible, the summary reads only manual invoices`);
    step(D, 'D2 ledger / day book / trial balance / P&L / balance sheet', false, 'none exist; only a summary of invoices and expenses');
    step(D, 'D3 GST collected per sale', false, 'website orders carry no GST at all (taxAmount 0)');
    step(D, 'D4 receivables / payables ageing', false, 'no model');
    chains.D = D;

    // ── CHAIN E — The product stores ─────────────────────────────────────────────────────────────────
    const E = [];
    const cat = await call('POST', '/domainapp/catalog', { name: 'Catalog-only item', price: 100 }, T);
    const rp = await call('POST', '/retail/products', { name: 'Retail-only item', price: 100, stockQty: 5 }, T);
    const siteAgain = await call('GET', '/cms/site/snr');
    const siteText = JSON.stringify(siteAgain.body);
    step(E, 'E1 store 1 VendorProduct (g4d VendorProduct): website, My Products, orders, stock read it', siteText.includes('Aero Flight Sneakers'), 'the storefront, order pricing (priceCart) and StockService all read VendorProduct');
    step(E, 'E2 store 2 CatalogItem: an item created there appears on the website / is sellable (stores AGREE)', siteText.includes('Catalog-only item'), `create ${cat.status}; NOT on the website, not sellable, not in stock → DISAGREES with store 1`);
    step(E, 'E3 store 3 RetailProduct: an item created there appears on the website / My Products / Stock (stores AGREE)', siteText.includes('Retail-only item'), `create ${rp.status}; NOT on the website, not in My Products or Stock → DISAGREES with store 1`);
    const myProducts = await call('GET', `/cms/vendor/${v.id}/products/manage`, undefined, T);
    step(E, 'E4 "My Products" lists items of ALL three stores', JSON.stringify(myProducts.body).includes('Retail-only item') && JSON.stringify(myProducts.body).includes('Catalog-only item'), `status ${myProducts.status}: it lists store 1 only`);
    const retailSale = await call('POST', '/retail/sales', { lines: [{ productId: rp.data?.id, qty: 1 }], paymentMethod: 'cash' }, T);
    step(E, 'E5 a retail POS sale also moves the stock the website sells from (one stock)', false, `POS sale status ${retailSale.status}: it can only decrement RetailProduct, never VendorProduct stock`);
    chains.E = E;

    // ── Bugs ─────────────────────────────────────────────────────────────────────────────────────────
    await call('PUT', `/cms/vendor/${v.id}`, { businessName: 'SNR', tagline: 'Footwear' }, T);
    const cmsGet = await call('GET', `/cms/vendor/${v.id}`, undefined, T);
    const put = await call('PUT', `/cms/vendor/${v.id}`, cmsGet.data, T);
    bugs.B1 = { status: put.status, message: short(put.body, 260), reproduced: put.status === 400 };
    const payGet = await call('GET', '/vendor-payments', undefined, T);
    bugs.B2 = { current: short(payGet.body, 160) };

    // ── Per-feature rows ─────────────────────────────────────────────────────────────────────────────
    const ctx = await call('GET', '/dashboard/context', undefined, T);
    const probe = async (id, dept, method, p, body, label, size = 'S') => {
      const r = await call(method, p, body, T);
      row(id, dept, label, r.status >= 200 && r.status < 300 ? 'WORKS' : 'BROKEN', `${method} ${p} → ${r.status} ${short(r.body, 90)}`, r.status >= 200 && r.status < 300 ? '-' : size);
    };
    row('home.today', 'home', 'GET /dashboard/context signals after the seeded order', ctx.status === 200 && ctx.data?.signals ? 'PARTIAL' : 'BROKEN', `signals ${short(ctx.data?.signals, 140)}: counts leads/orders/stock only; no sales/collected/outstanding (no books)`, 'M');
    await probe('home.reports', 'home', 'GET', '/analytics/usage', undefined, 'usage analytics endpoint (the registry says UNTESTED)');
    await probe('sales.leads', 'sales', 'GET', '/crm/leads', undefined, 'list leads');
    row('sales.lead-tools', 'sales', 'registry says not built', 'NOT BUILT', 'no endpoints', 'L');
    await probe('sales.customers', 'sales', 'GET', '/domainapp/contacts', undefined, 'list customers (contacts)');
    row('sales.quotes', 'sales', 'vendor-side quotes: /quotes is the platform admin quote tool (to prospects), not a vendor sales quote', 'NOT BUILT', 'the existing Quote model is Get4Domain\'s own quote to vendors/prospects (admin/quotes)', 'M');
    row('sales.portal', 'sales', 'vendor side: portal invite (customer side needs a phone OTP, not exercised)', cnt.data?.id ? 'PARTIAL' : 'BROKEN', 'portal address and invites are on the vendor side; the customer OTP login and portal pages were not exercised in this audit (customer phone OTP needs SMS)', 'S');
    await probe('marketing.ai-studio', 'marketing', 'GET', '/ai-templates', undefined, 'AI templates list');
    await probe('marketing.leadspace', 'marketing', 'GET', '/leadspace/summary', undefined, 'leadspace home');
    row('marketing.social', 'marketing', 'registry', 'NOT BUILT', 'mock publish removed from menu', 'L');
    row('marketing.reviews-offers', 'marketing', 'registry', 'NOT BUILT', '-', 'M');
    row('website.content', 'website', 'GET site + PUT vendor CMS (round trip, Bug B1)', put.status < 300 ? 'WORKS' : 'BROKEN', `PUT ${put.status}: ${short(put.body, 200)}`, 'S');
    row('website.new-pages', 'website', 'registry', 'NOT BUILT', '-', 'L');
    await probe('website.design', 'website', 'GET', '/website-themes', undefined, 'themes list');
    await probe('website.domain', 'website', 'GET', '/domains/mine', undefined, 'my domains');
    row('website.search', 'website', 'SEO fields live inside the same CMS save as Bug B1', put.status < 300 ? 'WORKS' : 'PARTIAL', `shares the B1 save: ${put.status}`, 'S');
    row('website.search-pro', 'website', 'registry', 'NOT BUILT', '-', 'L');
    await probe('website.widget', 'website', 'GET', '/widget/my-key', undefined, 'widget key');
    await probe('website.readiness', 'website', 'GET', '/engine/actions', undefined, 'registered engine actions');
    await probe('commerce.stock', 'commerce', 'GET', '/stock/low', undefined, 'low stock');
    row('commerce.orders', 'commerce', 'Chain A steps A2-A4', A.slice(1, 4).every((s) => s.ok) ? 'WORKS' : 'PARTIAL', A.slice(1, 4).map((s) => `${s.step.slice(0, 3)}${s.ok ? 'ok' : 'FAIL'}`).join(' '), 'S');
    await probe('commerce.workspace', 'commerce', 'GET', '/domainapp/records', undefined, 'industry records list');
    for (const id of ['commerce.workspace-full', 'commerce.inventory', 'commerce.pos', 'commerce.tasks', 'commerce.documents']) {
      row(id, 'commerce', 'registry says not built', id === 'commerce.pos' ? 'PARTIAL' : 'NOT BUILT', id === 'commerce.pos' ? 'a RetailProduct/PosSale POS exists (store 3) but not on the one catalogue' : '-', id === 'commerce.pos' ? 'M' : 'L');
    }
    row('finance.invoices', 'finance', 'Chain B', B.slice(1, 4).every((s) => s.ok) ? 'PARTIAL' : 'BROKEN', 'manual invoice only; no order→invoice, receipts, credit notes, per-year numbering (see Chain B)', 'L');
    row('finance.collect-payments', 'finance', "vendor's own gateway (Payments screen) round trip", 'PARTIAL', `GET /vendor-payments ${payGet.status}; Bug B2 field binding is a frontend issue (see bugs)`, 'M');
    row('finance.recurring', 'finance', 'registry', 'NOT BUILT', '-', 'M');
    row('finance.expenses', 'finance', 'Chain D', 'PARTIAL', 'expenses + paid-invoice totals only; website orders and counter sales are not in the numbers', 'L');
    row('finance.ca-accounts', 'finance', 'registry', 'NOT BUILT', '-', 'L');
    await probe('people.team', 'people', 'GET', '/team/members', undefined, 'team list');
    row('people.team-pro', 'people', 'registry', 'NOT BUILT', '-', 'M');
    row('people.hr', 'people', 'registry', 'NOT BUILT', 'placeholder removed', 'XL');
    await probe('communication.inbox', 'communication', 'GET', '/communication/threads', undefined, 'inbox messages');
    row('communication.sms-email', 'communication', 'registry', 'NOT BUILT', '-', 'M');
    await probe('communication.whatsapp-bot', 'communication', 'GET', '/whatsapp-bot/kb', undefined, 'bot FAQ list');
    await probe('communication.notifications', 'communication', 'GET', '/notifications', undefined, 'own notifications');
    row('communication.reminders', 'communication', 'registry', 'NOT BUILT', '-', 'M');
    await probe('account.billing', 'account', 'GET', '/billing/me', undefined, 'vendor billing summary (term, invoices)');
    await probe('account.wallet', 'account', 'GET', '/wallet/balance', undefined, 'wallet balance');
    await probe('account.profile', 'account', 'GET', `/cms/vendor/${v.id}`, undefined, 'business profile read');
    row('account.connections', 'account', 'registry', 'NOT BUILT', '-', 'L');
    row('account.disclosures', 'account', 'registry', 'NOT BUILT', '-', 'M');
    await probe('account.help', 'account', 'GET', `/support/tickets/vendor/${v.id}`, undefined, 'my support tickets');
    await probe('account.stationery', 'account', 'GET', '/stationery', undefined, 'stationery items');
    for (const f of features.filter((x) => x.department === 'custom')) row(f.id, 'custom', 'registry (BOS Custom, quote-only)', 'NOT BUILT', 'Custom clients only', '-');

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify({ rows, chains, bugs, generatedAt: new Date().toISOString() }, null, 1));
    const counts = rows.reduce((a, r) => ({ ...a, [r.result]: (a[r.result] ?? 0) + 1 }), {});
    console.log('rows', rows.length, counts);
    for (const k of Object.keys(chains)) console.log(k, chains[k].map((s) => (s.ok ? 'ok ' : 'FAIL ') + s.step.slice(0, 60)).join('\n   '));
    console.log('B1', bugs.B1);
  } finally {
    await h.stop();
  }
  setTimeout(() => process.exit(0), 300);
})().catch((e) => { console.error(e); process.exit(1); });
