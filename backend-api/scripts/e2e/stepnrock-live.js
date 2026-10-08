// STEPNROCK LIVE-EDIT + ORDER PROOF (Task 2/3/4) — full stack, isolated, nothing touches production.
//   real NestJS app over HTTP  ←→  real Postgres (PGlite, in-memory, current schema)  ←→  the BUILT stepnrock storefront (next start)
// The "dashboard" edits are made through the same services the dashboard's API calls (CmsService / StockService), then we time
// how long until the public storefront HTML shows them.
//
// Run:   node scripts/e2e/stepnrock-live.js
// Needs: backend built (npx nest build); stepnrock built with  NEXT_PUBLIC_API_URL=http://127.0.0.1:3099 SITE_URL=http://127.0.0.1:3016
//        npm --prefix ../stepnrock run build ;  PGlite under G4D_PGLITE_DIR (default <tmp>/pgtest).
// Safety: DATABASE_URL is forced to the local PGlite socket and the script REFUSES to run otherwise. Outbound senders are unset.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const BE = path.join(__dirname, '..', '..');
const FE = path.join(BE, '..', 'stepnrock');
const pgDir = process.env.G4D_PGLITE_DIR || path.join(os.tmpdir(), 'pgtest');
const API_PORT = 3099; const WEB_PORT = 3016; const PG_PORT = 54329;
const API = `http://127.0.0.1:${API_PORT}`; const WEB = `http://127.0.0.1:${WEB_PORT}`;
const MAX_SECONDS = 60;

// 1. environment — config from .env.local is only used for non-DB settings; the database is forced local.
if (fs.existsSync(path.join(BE, '.env.local'))) {
  for (const l of fs.readFileSync(path.join(BE, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
const PG_URL = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres?sslmode=disable&connection_limit=1&pool_timeout=60&pgbouncer=true`;
process.env.DATABASE_URL = PG_URL; process.env.DIRECT_URL = PG_URL;
if (!process.env.DATABASE_URL.includes(`127.0.0.1:${PG_PORT}`)) { console.error('REFUSING: DATABASE_URL is not the local PGlite'); process.exit(2); }
process.env.PLATFORM_SETTINGS_KEY = process.env.PLATFORM_SETTINGS_KEY || 'e2e-key-e2e-key-e2e-key-e2e-key-0123';
process.env.THROTTLE_DISABLED = 'true';
process.env.PUBLIC_API_URL = API;
for (const k of ['RESEND_API_KEY', 'FAST2SMS_API_KEY', 'FAST2SMS_WHATSAPP_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k];
process.chdir(BE);
require('reflect-metadata');

const results = []; let failed = 0;
const ok = (name, cond, detail = '') => { if (!cond) failed += 1; results.push({ name, pass: !!cond, detail }); console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  → ${detail}` : ''}`); };
const section = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (url) => new Promise((resolve, reject) => {
  http.get(url, { headers: { 'Cache-Control': 'no-cache' } }, (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve({ status: res.statusCode, body: b })); }).on('error', reject);
});
const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
async function load(mod) {
  const dir = path.join(pgDir, 'node_modules', ...mod.split('/'));
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const entry = (pkg.exports && pkg.exports['.'] && (pkg.exports['.'].import?.default ?? pkg.exports['.'].import ?? pkg.exports['.'].default)) || pkg.module || pkg.main;
  return import(pathToFileURL(path.join(dir, typeof entry === 'string' ? entry : (entry.default ?? entry.import))).href);
}
const prismaSql = (args) => execFileSync(process.execPath, [path.join(BE, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'diff', ...args, '--script'], { cwd: BE, env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true' }, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');

(async () => {
  let pgliteMod; let sockMod;
  try { pgliteMod = await load('@electric-sql/pglite'); sockMod = await load('@electric-sql/pglite-socket'); } catch (e) {
    console.log(`SKIP  PGlite not found under ${pgDir} (set G4D_PGLITE_DIR): ${e.message}`); process.exit(0);
  }
  if (!fs.existsSync(path.join(FE, '.next', 'BUILD_ID'))) { console.log('SKIP  stepnrock is not built (npm --prefix ../stepnrock run build with NEXT_PUBLIC_API_URL=' + API + ')'); process.exit(0); }

  section('boot: PGlite (current schema) + NestJS over HTTP + built storefront');
  const db = new pgliteMod.PGlite();
  await db.exec(prismaSql(['--from-empty', '--to-schema-datamodel', path.join(BE, 'prisma', 'schema.prisma')]));
  const sock = new sockMod.PGLiteSocketServer({ db, port: PG_PORT, host: '127.0.0.1' });
  await sock.start();

  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe } = require('@nestjs/common');
  const dist = (p) => require(path.join(BE, 'dist', 'src', p));
  const { AppModule } = dist('app.module');
  const app = await NestFactory.create(AppModule, { rawBody: true, logger: ['error'] });
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new (dist('common/interceptors/transform.interceptor').TransformInterceptor)());
  app.useGlobalFilters(new (dist('common/filters/http-exception.filter').HttpExceptionFilter)());
  await app.listen(API_PORT, '127.0.0.1');
  const svc = (name, mod) => app.get(dist(mod)[name], { strict: false });
  const prisma = svc('PrismaService', 'prisma/prisma.service');
  const cms = svc('CmsService', 'cms/cms.service');
  const stock = svc('StockService', 'stock/stock.service');
  const checkout = svc('PublicCheckoutService', 'engine/public-checkout.service');

  let web = null;
  const cleanup = async () => {
    if (web) { try { web.kill(); } catch { /* gone */ } }
    await app.close().catch(() => {}); await sock.stop().catch(() => {}); await db.close().catch(() => {});
  };
  try {
    // seed a vendor that looks like stepnrock: subdomain 'stepnrock', retail, order-request checkout
    await prisma.vendor.create({ data: { id: 'vsnr', name: 'Suresh', email: 'suresh@example.test', password: 'x', businessName: 'Step N Rock', industry: 'retail', subdomain: 'stepnrock' } });
    await prisma.vendorPaymentConfig.create({ data: { vendorId: 'vsnr', checkoutMode: 'ORDER_REQUEST' } });
    const aero = await cms.addProduct('vsnr', { name: 'Aero Sneaker', price: '1000', category: 'Sneakers', image: 'https://example.test/a.jpg', trackStock: true, stockQty: 3, reorderLevel: 1, customFields: { sizes: ['8', '9'], colors: ['Black', 'Red'] } }, 'owner');
    const sandal = await cms.addProduct('vsnr', { name: 'Canvas Sandal', price: '650', category: 'Sandals', image: 'https://example.test/s.jpg' }, 'owner');
    const boot = await cms.addProduct('vsnr', { name: 'Trail Boot', price: '2400', category: 'Boots', image: 'https://example.test/b.jpg', trackStock: true, stockQty: 5, reorderLevel: 2 }, 'owner');
    ok('seeded 3 products through the dashboard service', !!aero.id && !!sandal.id && !!boot.id);

    web = spawn(process.execPath, [path.join(FE, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(WEB_PORT), '-H', '127.0.0.1'], { cwd: FE, env: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_API_URL: API, SITE_URL: WEB }, stdio: 'ignore' });
    let up = false;
    for (let i = 0; i < 60 && !up; i += 1) { await sleep(1000); try { up = (await get(`${WEB}/robots.txt`)).status === 200; } catch { /* starting */ } }
    ok('the built storefront is serving', up);
    if (!up) throw new Error('storefront did not start');

    section('public API payload (what the storefront receives)');
    const site = JSON.parse((await get(`${API}/cms/site/stepnrock`)).body);
    const data = site.data ?? site;
    ok('site API returns the vendor with checkoutMode ORDER_REQUEST', data.checkoutMode === 'ORDER_REQUEST', String(data.checkoutMode));
    ok('every public product carries availability + maxQty and NO stockQty / sku / status / trackStock / reorderLevel', data.products.length === 3 && data.products.every((p) => p.availability && typeof p.maxQty === 'number' && !('stockQty' in p) && !('sku' in p) && !('status' in p) && !('trackStock' in p) && !('reorderLevel' in p)));
    ok('raw stock never appears anywhere in the payload', !/"stockQty"|"reorderLevel"|"trackStock"/.test(JSON.stringify(data.products)));

    section('storefront renders the live catalogue (server-rendered pages)');
    // The storefront was built while this API was down, so it starts from a baked-in page; the first requests trigger a refresh.
    // (In production the build can reach the API, and the refresh window is the same.) Wait for it, and report how long it took.
    const w0 = Date.now(); let home0 = '';
    while (Date.now() - w0 < 70000) { home0 = (await get(`${WEB}/`)).body; if (home0.includes('Aero Sneaker') && home0.includes('Canvas Sandal')) break; await sleep(1500); }
    console.log(`      (first refresh after start took ${((Date.now() - w0) / 1000).toFixed(1)}s)`);
    ok('home shows the real products', home0.includes('Aero Sneaker') && home0.includes('Canvas Sandal'));
    ok('home links ONLY to real product ids — none of the old showcase (/product/1 … /product/12)', ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].some((n) => home0.includes(`href="/product/${n}"`)));
    ok('home shows the vendor\'s real categories (Sneakers, Sandals, Boots)', ['Sneakers', 'Sandals', 'Boots'].every((c) => home0.includes(c)));
    ok('no "$75" / "Free Shipping" dollar copy', !home0.includes('$75'));
    let sm = (await get(`${WEB}/sitemap.xml`)).body; for (let i = 0; i < 30 && !sm.includes(`/product/${aero.id}`); i += 1) { await sleep(1500); sm = (await get(`${WEB}/sitemap.xml`)).body; }
    const rb = (await get(`${WEB}/robots.txt`)).body;
    ok('sitemap lists the product pages under SITE_URL (not stepnrock.com)', sm.includes(`${WEB}/product/${aero.id}`) && !sm.includes('stepnrock.com'));
    ok('robots.txt points at the SITE_URL sitemap', rb.includes(`${WEB}/sitemap.xml`));
    const home = (await get(`${WEB}/`)).body;
    ok('canonical / og:url use SITE_URL', home.includes(`rel="canonical" href="${WEB}"`) || home.includes(`href="${WEB}/"`) || home.includes(`content="${WEB}`), '');

    section('ORDER REQUEST through the public HTTP endpoint (what the cart sends)');
    const line = (qty) => ({ productId: aero.id, name: 'Aero Sneaker — 9 / Black', qty });
    const buyer = (key, qty) => ({ items: [line(qty)], name: 'Ravi', phone: '98765 43210', address: '12 Main Street, Vadapalani, Chennai 600026', idempotencyKey: key });
    const o1 = await post(`${API}/engine/public/stepnrock/actions/engine.checkout.request`, buyer('e2e-cart-key-1', 2));
    const d1 = o1.json.data ?? o1.json;
    ok('POST engine.checkout.request → 2xx with an order reference', o1.status < 300 && d1.ok === true && !!d1.orderId, `${o1.status} ${JSON.stringify(d1).slice(0, 120)}`);
    const o1b = await post(`${API}/engine/public/stepnrock/actions/engine.checkout.request`, buyer('e2e-cart-key-1', 2));
    const d1b = o1b.json.data ?? o1b.json;
    ok('double-tap (same key) returns the SAME order, not a second one', d1b.orderId === d1.orderId && d1b.replayed === true);
    const o2 = await post(`${API}/engine/public/stepnrock/actions/engine.checkout.request`, buyer('e2e-cart-key-2', 2));
    ok('a second shopper asking for 2 when only 1 is left gets a clear 400 ("only 1 left")', o2.status === 400 && /only 1 left/i.test(JSON.stringify(o2.json)), `${o2.status} ${JSON.stringify(o2.json).slice(0, 120)}`);
    ok('stock: reserved exactly once (3 → 1) — verified in the database', (await prisma.vendorProduct.findUnique({ where: { id: aero.id } })).stockQty === 1);
    const orders = await checkout.listWebOrders('vsnr');
    ok('the vendor sees ONE order with the customer, phone and delivery address', orders.length === 1 && orders[0].customerName === 'Ravi' && orders[0].customerPhone === '9876543210' && /Vadapalani/.test(orders[0].deliveryAddress) && orders[0].status === 'PENDING_PAYMENT');
    const lowNow = (JSON.parse((await get(`${API}/cms/site/stepnrock`)).body).data ?? {}).products?.find((p) => p.id === aero.id);
    ok('the public API now reports Aero Sneaker as "low" (1 left, alert level 1) with a purchase cap of 1', lowNow?.availability === 'low' && lowNow?.maxQty === 1, JSON.stringify(lowNow && { a: lowNow.availability, m: lowNow.maxQty }));

    section(`LIVE EDIT: dashboard changes reach the storefront within ${MAX_SECONDS}s`);
    const baseline = (await get(`${WEB}/`)).body;
    ok('baseline before editing: the page shows the OLD name and the sandal (so the edit timings below are real)', baseline.includes('Aero Sneaker') && !baseline.includes('Aero Sneaker V2') && baseline.includes('Canvas Sandal'));
    const t0 = Date.now();
    await cms.updateProduct(aero.id, { name: 'Aero Sneaker V2', price: '1250' });
    await cms.updateProduct(sandal.id, { status: 'HIDDEN' });
    await stock.adjust('vsnr', boot.id, { mode: 'set', quantity: 0, reason: 'RECOUNT' }, 'owner');
    const added = await cms.addProduct('vsnr', { name: 'Brand New Slide', price: '499', category: 'Sandals', image: 'https://example.test/n.jpg' }, 'owner');
    const seen = { rename: null, hide: null, out: null, added: null, price: null };
    while (Date.now() - t0 < (MAX_SECONDS + 15) * 1000 && Object.values(seen).some((v) => v === null)) {
      const h = (await get(`${WEB}/`)).body; const secs = (Date.now() - t0) / 1000;
      if (seen.rename === null && h.includes('Aero Sneaker V2')) seen.rename = secs;
      if (seen.price === null && /1,250/.test(h)) seen.price = secs;
      if (seen.hide === null && !h.includes('Canvas Sandal')) seen.hide = secs;
      if (seen.out === null && /Out of stock/.test(h)) seen.out = secs;
      if (seen.added === null && h.includes('Brand New Slide')) seen.added = secs;
      await sleep(1500);
    }
    const f = (v) => (v === null ? 'never' : `${v.toFixed(1)}s`);
    ok(`[feat:site.live-edit] product rename visible on the home page in ≤ ${MAX_SECONDS}s`, seen.rename !== null && seen.rename <= MAX_SECONDS, f(seen.rename));
    ok(`price change visible in ≤ ${MAX_SECONDS}s`, seen.price !== null && seen.price <= MAX_SECONDS, f(seen.price));
    ok(`hiding a product removes it in ≤ ${MAX_SECONDS}s`, seen.hide !== null && seen.hide <= MAX_SECONDS, f(seen.hide));
    ok(`a stock-out shows "Out of stock" in ≤ ${MAX_SECONDS}s`, seen.out !== null && seen.out <= MAX_SECONDS, f(seen.out));
    ok(`a newly added product appears in ≤ ${MAX_SECONDS}s`, seen.added !== null && seen.added <= MAX_SECONDS, f(seen.added));
    let sm2 = (await get(`${WEB}/sitemap.xml`)).body; for (let i = 0; i < 30 && !sm2.includes(`/product/${added.id}`); i += 1) { await sleep(1500); sm2 = (await get(`${WEB}/sitemap.xml`)).body; }
    ok('the sitemap picked up the new product too', sm2.includes(`/product/${added.id}`));
    console.log(`      timings: rename ${f(seen.rename)}, price ${f(seen.price)}, hide ${f(seen.hide)}, stock-out ${f(seen.out)}, new product ${f(seen.added)}`);

    section('cancel restores the stock the shopper sees');
    await checkout.cancelOrder('vsnr', d1.orderId, 'owner');
    ok('cancelling the order gives the units back (1 → 3)', (await prisma.vendorProduct.findUnique({ where: { id: aero.id } })).stockQty === 3);
    const back = (JSON.parse((await get(`${API}/cms/site/stepnrock`)).body).data ?? {}).products?.find((p) => p.id === aero.id);
    ok('…and the public API reports it "in" again with a cap of 3', back?.availability === 'in' && back?.maxQty === 3);
  } catch (e) {
    failed += 1; console.log('  FAIL  unexpected error:', e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e);
  } finally {
    await cleanup();
  }
  console.log(`\n${results.filter((r) => r.pass).length} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
