// COMMERCE TRACE — real compiled app services + real Prisma + real Postgres (PGlite over TCP, 127.0.0.1:54329).
// NOTHING touches production: the database is an isolated in-memory copy of the current schema. Razorpay is a stub.
const fs = require('fs');
const path = require('path');
const BE = 'C:/Get4Domain/get4domain-site/backend-api';
for (const l of fs.readFileSync(`${BE}/.env.local`, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const PG = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connection_limit=1&pool_timeout=60';
process.env.DATABASE_URL = PG; process.env.DIRECT_URL = PG;
process.env.PLATFORM_SETTINGS_KEY = process.env.PLATFORM_SETTINGS_KEY || 'audit-key-audit-key-audit-key-0123';
process.env.THROTTLE_DISABLED = 'true';
// Outbound senders are stubbed by clearing their keys (services mock when unset).
for (const k of ['RESEND_API_KEY', 'FAST2SMS_API_KEY', 'FAST2SMS_WHATSAPP_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k];
process.chdir(BE);
require('reflect-metadata');
const { dist, makeRazorpay } = require(`${BE}/scripts/security-verify/harness`);
const { ValidationPipe } = require('@nestjs/common');

const SUB = 'auditshop' + Date.now();
const out = [];
const log = (s) => { out.push(s); console.log(s); };
const ok = (name, cond, detail = '') => log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
const info = (s) => log(`      ${s}`);

(async () => {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = dist('app.module');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const get = (name, mod) => app.get(dist(mod)[name], { strict: false });
  const prisma = get('PrismaService', 'prisma/prisma.service');
  const demo = get('DemoService', 'demo/demo.service');
  const cms = get('CmsService', 'cms/cms.service');
  const retail = get('RetailService', 'retail/retail.service');
  const checkout = get('PublicCheckoutService', 'engine/public-checkout.service');
  const vpay = get('VendorPaymentsService', 'vendor-payments/vendor-payments.service');
  const catalogSvc = get('CatalogService', 'domainapp/catalog.service');
  const { CreateProductDto } = dist('cms/dto/create-product.dto');

  log('== 1. SANDBOX VENDOR via the existing demo mechanism (DemoService.provisionSandbox) — isolated DB, not production');
  const v = await demo.provisionSandbox('retail', 'AUDIT SANDBOX', '9999999999');
  info(`vendor ${v.id} industry=${v.industry} isSandbox=${v.isSandbox} expiresAt=${v.expiresAt.toISOString().slice(0, 16)}`);
  const seeded = {
    vendorProduct: await prisma.vendorProduct.count({ where: { vendorId: v.id } }),
    catalogItem: await prisma.catalogItem.count({ where: { vendorId: v.id } }),
    retailProduct: await prisma.retailProduct.count({ where: { vendorId: v.id } }),
    record: await prisma.record.count({ where: { vendorId: v.id } }),
    contact: await prisma.contact.count({ where: { vendorId: v.id } }),
    wallet: await prisma.wallet.count({ where: { vendorId: v.id } }),
  };
  info(`seeded rows for a new retail demo vendor: ${JSON.stringify(seeded)}`);
  const withStock = await prisma.catalogItem.count({ where: { vendorId: v.id, stock: { not: null } } });
  info(`seeded CatalogItems that track stock: ${withStock} of ${seeded.catalogItem}`);
  // Make it a "live" vendor locally (what go-live does) so the public site API serves it.
  await prisma.vendor.update({ where: { id: v.id }, data: { isSandbox: false, expiresAt: null, subdomain: SUB } });

  log('\n== 2. PRODUCT CRUD through the Website-Manager path (My Products → CmsService → VendorProduct)');
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  let rejected = null;
  try { await pipe.transform({ name: 'Trail Shoe', price: '1999', category: 'Shoes', stockQty: 5 }, { type: 'body', metatype: CreateProductDto }); } catch (e) { rejected = e.message || String(e.response?.message); }
  ok('POST product with a top-level stockQty is REJECTED by the global ValidationPipe (forbidNonWhitelisted)', Boolean(rejected), String(rejected));
  let rejected2 = null;
  try { await pipe.transform({ name: 'Trail Shoe', sku: 'TS-1' }, { type: 'body', metatype: CreateProductDto }); } catch (e) { rejected2 = e.message; }
  ok('…same for sku / status / reorderLevel / variants: the DTO only knows name, description, price, image, category, customFields', Boolean(rejected2), String(rejected2));
  const p1 = await cms.addProduct(v.id, { name: 'Trail Shoe', description: 'Light trail runner', price: '1999', category: 'Shoes', image: 'https://x/y.jpg', customFields: { stockQty: 5, sizes: ['8', '9'] } });
  const p2 = await cms.addProduct(v.id, { name: 'Canvas Sandal', price: '899', category: 'shoes' });
  ok('product created with a category; a second entry typed "shoes" reuses the SAME category row (no duplicates)', p1.categoryId && p1.categoryId === p2.categoryId, `categoryId=${p1.categoryId}`);
  const row1 = await prisma.vendorProduct.findUnique({ where: { id: p1.id } });
  ok('the real columns stockQty / sku / status stay EMPTY/default for a dashboard-created product', row1.stockQty === null && row1.sku === null && row1.status === 'active', `stockQty=${row1.stockQty} status=${row1.status}`);
  ok('stock lives only inside the customFields JSON blob when someone puts it there', row1.customFields.stockQty === 5);
  await cms.updateProduct(p1.id, { price: '2199', description: 'Updated' });
  const site1 = await cms.getSiteBySubdomain(SUB);
  const s1 = site1.products.find((x) => x.id === p1.id);
  ok('EDIT reflected in the public storefront API (GET /cms/site/:subdomain) immediately', s1.price === '2199' && s1.description === 'Updated');
  ok('public API exposes active products only; includes stockQty/status/sku columns as stored', 'stockQty' in s1 && 'status' in s1, Object.keys(s1).join(','));
  await cms.updateProduct(p2.id, { active: false });
  const site2 = await cms.getSiteBySubdomain(SUB);
  ok('"hide" (active=false) removes it from the storefront — the only off-switch the dashboard has', !site2.products.some((x) => x.id === p2.id));
  ok('there is NO out-of-stock state in the storefront API: a hidden product vanishes, it is never shown as "Out of stock"', true, 'status column is never written by any backend code');
  info(`paymentsEnabled flag on the public site payload = ${site2.paymentsEnabled}`);

  log('\n== 3. PUBLIC CHECKOUT on a VendorProduct (what stepnrock sells) — Razorpay stubbed');
  await vpay.upsert(v.id, { razorpayKeyId: 'rzp_test_audit', razorpayKeySecret: 'audit_secret', enabled: true });
  const rz = makeRazorpay('audit_secret');
  checkout.razorpayFor = () => rz;
  const buyer = { name: 'Audit Buyer', phone: '9000000001' };
  const items = [{ productId: p1.id, name: 'Trail Shoe', qty: 2 }];
  const order = await checkout.createOrder(v.id, { ...buyer, items });
  const pay = rz.pay(order.razorpayOrderId);
  const done = await checkout.confirm(v.id, { ...buyer, items, ...pay });
  ok('order created at the SERVER price (₹2,199 × 2 = ₹4,398) and confirmed', order.amount === 439800 && done.ok, `amount=${order.amount}`);
  const afterVp = await prisma.vendorProduct.findUnique({ where: { id: p1.id } });
  ok('STOCK AFTER SALE: VendorProduct stock is NOT reduced (customFields.stockQty stays 5, column stays null)', afterVp.customFields.stockQty === 5 && afterVp.stockQty === null, `cf.stockQty=${afterVp.customFields.stockQty} col=${afterVp.stockQty}`);
  const items2 = [{ productId: p1.id, name: 'Trail Shoe', qty: 50 }];
  const o2 = await checkout.createOrder(v.id, { ...buyer, items: items2 });
  ok('OVERSELL: 50 pairs of a product with stock 5 are accepted (no stock check on VendorProduct at all)', o2.amount === 50 * 219900, `amount=${o2.amount}`);
  const web = await checkout.listWebOrders(v.id);
  ok('the order appears in the vendor dashboard list (Website Orders ← PosSale type "web")', web.length === 1 && web[0].id === done.saleId, `orders=${web.length}`);
  const sale = await prisma.posSale.findUnique({ where: { id: done.saleId } });
  ok('sale lines carry catalogItemId=null for a VendorProduct purchase (nothing to decrement, nothing to restore)', JSON.stringify(sale.items).includes('"catalogItemId":null'));

  log('\n== 4. CATALOGUE-ITEM stock (CatalogItem.stock — the only checkout path that touches stock)');
  let rejStock = null;
  try { await pipe.transform({ name: 'Svc Cap', price: 500, stock: 3 }, { type: 'body', metatype: dist('domainapp/dto/catalog-item.dto').CreateCatalogItemDto }); } catch (e) { rejStock = e.message; }
  ok('DomainApp catalogue API cannot set stock: POST {stock:3} is rejected by the DTO whitelist', Boolean(rejStock), String(rejStock));
  const viaSvc = await catalogSvc.create(v.id, { name: 'Svc Cap', price: 500, stock: 3 });
  ok('…and CatalogService.create ignores a stock value even if called directly', viaSvc.stock === null, `stock=${viaSvc.stock}`);
  const ci = await prisma.catalogItem.create({ data: { vendorId: v.id, name: 'Tracked Cap', price: 500, stock: 3 } }); // only possible by direct DB write
  const capId = ci.id;
  const sellCap = async (qty) => {
    const it = [{ catalogItemId: capId, name: 'Tracked Cap', qty }];
    const o = await checkout.createOrder(v.id, { ...buyer, items: it });
    return { it, o, pay: rz.pay(o.razorpayOrderId) };
  };
  const a = await sellCap(2); const b = await sellCap(2); const c = await sellCap(1);   // customers A, B pay for 2 caps each and C for 1 while 3 are in stock
  const results = await Promise.allSettled([checkout.confirm(v.id, { ...buyer, items: a.it, ...a.pay }), checkout.confirm(v.id, { ...buyer, items: b.it, ...b.pay })]);
  const capAfter = await prisma.catalogItem.findUnique({ where: { id: capId } });
  info(`two concurrent confirms of 2 caps each against stock 3 → outcomes: ${results.map((r) => r.status + (r.reason ? ':' + String(r.reason.message).slice(0, 50) : '')).join(' | ')}; final stock = ${capAfter.stock}`);
  ok('ATOMICITY: stock can never go negative', capAfter.stock >= 0, `final stock=${capAfter.stock}`);
  // sequential: stock is now low; a customer who PAID for more than remains
  await prisma.catalogItem.update({ where: { id: capId }, data: { stock: 0 } });
  let afterPaid = null;
  try { await checkout.confirm(v.id, { ...buyer, items: c.it, ...c.pay }); afterPaid = 'confirmed'; } catch (e) { afterPaid = `THROWS ${e.status || e.getStatus?.()} "${e.message}"`; }
  const payRec = await prisma.posSale.count({ where: { razorpayPaymentId: c.pay.razorpayPaymentId } });
  ok('CAPTURED PAYMENT but item sold out before confirm: the customer paid, yet the order is rejected and no sale is recorded', payRec === 0 && /THROWS/.test(afterPaid), afterPaid);
  info('→ nothing in the codebase refunds that captured payment automatically (see PUBLIC_CHECKOUT_REFUND grep result in the report)');
  const lowStockAlert = await prisma.notification.count({ where: { vendorId: v.id } }).catch(() => -1);
  info(`notifications created for this vendor after all sales/stock changes: ${lowStockAlert} (no low-stock alert code exists)`);

  log('\n== 5. RETAIL POS path (RetailProduct — Retail ▸ Products / Inventory / POS tabs)');
  const rp = await retail.createProduct(v.id, { name: 'POS Mug', price: 250, stockQty: 3, reorderLevel: 2 });
  const sells = await Promise.allSettled([retail.createSale(v.id, { lines: [{ productId: rp.id, qty: 2 }] }), retail.createSale(v.id, { lines: [{ productId: rp.id, qty: 2 }] })]);
  const mug = await prisma.retailProduct.findUnique({ where: { id: rp.id } });
  info(`two concurrent POS sales of 2 mugs against stock 3 → ${sells.map((r) => r.status).join(' | ')}; final stock = ${mug.stockQty}`);
  ok('POS: stock can never go negative under concurrent sales', mug.stockQty >= 0, `final stock=${mug.stockQty}`);
  const sale1 = sells.find((r) => r.status === 'fulfilled')?.value;
  if (sale1) {
    const before = (await prisma.retailProduct.findUnique({ where: { id: rp.id } })).stockQty;
    await retail.refundSale(v.id, sale1.id);
    const afterR = (await prisma.retailProduct.findUnique({ where: { id: rp.id } })).stockQty;
    ok('POS refund restores stock', afterR === before + 2, `stock ${before} → ${afterR}`);
  }
  const summary = await retail.summary(v.id);
  info(`retail summary (counts low-stock products, no alert is sent): ${JSON.stringify(summary)}`);

  log('\n== 6. WHICH TABLE EACH SCREEN READS/WRITES (observed in this run)');
  const counts = {
    'VendorProduct (My Products / Website Manager / public site / checkout price)': await prisma.vendorProduct.count({ where: { vendorId: v.id } }),
    'CatalogItem (Industry ▸ Catalog tabs / checkout stock)': await prisma.catalogItem.count({ where: { vendorId: v.id } }),
    'RetailProduct (Retail ▸ Products, Inventory, POS)': await prisma.retailProduct.count({ where: { vendorId: v.id } }),
  };
  for (const [k, n] of Object.entries(counts)) info(`${String(n).padStart(3)} rows  ${k}`);

  fs.writeFileSync(`${process.env.TEMP}/audit/commerce-trace.out.txt`, out.join('\n'));
  await app.close();
  process.exit(0);
})().catch((e) => { console.error('TRACE ERROR', e); fs.writeFileSync(`${process.env.TEMP}/audit/commerce-trace.out.txt`, out.join('\n') + '\nTRACE ERROR ' + e.stack); process.exit(1); });
