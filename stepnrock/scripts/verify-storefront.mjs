// Stepnrock storefront guards — run with:  npm run verify
// Loads the real TypeScript data layer (transpiled in memory) and checks the behaviours the handover depends on, plus source
// guards for the things that used to be wrong (fake stock, dollar copy, other-domain URLs, showcase resurrection).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0; let fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);

const tmp = fs.mkdtempSync(path.join(root, '.verify-'));
async function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
    .replace(/from '\.\/products'/g, "from './products.mjs'");
  const file = path.join(tmp, path.basename(rel).replace(/\.tsx?$/, '.mjs'));
  fs.writeFileSync(file, out);
  return import(`${pathToFileURL(file).href}?${Date.now()}`);
}
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const walk = (d, acc = []) => { for (const f of fs.readdirSync(path.join(root, d), { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) { if (!['node_modules', '.next', 'ui'].includes(f.name)) walk(p, acc); } else if (/\.(ts|tsx)$/.test(f.name)) acc.push(p); } return acc; };

try {
  await load('lib/products.ts');
  const sd = await load('lib/site-data.ts');

  section('Product adapter: availability, purchase cap, colours, price');
  const base = { id: 'p1', name: 'Aero Sneaker', description: 'd', price: '₹1,299', image: 'https://x/i.jpg', category: 'Sneakers', customFields: null };
  const inStock = sd.adaptLiveProduct({ ...base, availability: 'in', maxQty: 10 });
  const low = sd.adaptLiveProduct({ ...base, availability: 'low', maxQty: 2 });
  const out = sd.adaptLiveProduct({ ...base, availability: 'out', maxQty: 7 });
  ok('availability comes straight from the API', inStock.availability === 'in' && low.availability === 'low' && out.availability === 'out');
  ok('the purchase cap follows the API (≤10) and is 0 when out of stock — even if the API sent a number', inStock.maxQty === 10 && low.maxQty === 2 && out.maxQty === 0);
  ok('NO invented unit count: the product has no "stock" number at all (was: made-up 10)', !('stock' in inStock) && !('stock' in out));
  ok('a missing availability (older API) is treated as in-stock with a cap of 10, never as "10 left"', (() => { const p = sd.adaptLiveProduct(base); return p.availability === 'in' && p.maxQty === 10; })());
  ok('an absurd cap from the API is clamped to 10', sd.adaptLiveProduct({ ...base, availability: 'in', maxQty: 9999 }).maxQty === 10);
  ok('price: priceAmount wins, else the display string is parsed (₹1,299 → 1299)', sd.adaptLiveProduct({ ...base, priceAmount: 650 }).price === 650 && inStock.price === 1299);
  const cols = sd.adaptLiveProduct({ ...base, customFields: { colors: ['Black', 'Red', 'Teal'] } }).colors;
  ok('colours typed in the dashboard (plain strings) are used — was: silently replaced by "Default"', cols.length === 3 && cols[0].name === 'Black' && cols[0].hex === '#1a1a1a' && cols[1].hex === '#dc2626' && /^#[0-9a-f]{6}$/i.test(cols[2].hex));
  ok('seeded {name, hex} colours still work', sd.adaptLiveProduct({ ...base, customFields: { colors: [{ name: 'Blue', hex: '#2563eb' }] } }).colors[0].hex === '#2563eb');
  ok('a product with no colours/sizes still gets safe single options (components index [0] unguarded)', (() => { const p = sd.adaptLiveProduct(base); return p.colors.length === 1 && p.sizes.length === 1; })());
  ok('the dashboard\'s hidden internal keys cannot turn into a stock number (customFields.stockQty is ignored)', !('stock' in sd.adaptLiveProduct({ ...base, customFields: { stockQty: 12 } })) && sd.adaptLiveProduct({ ...base, customFields: { stockQty: 0, stock: 'Out of Stock' } }).availability === 'in');

  section('Catalogue resolution: no showcase resurrection');
  const site = (products) => ({ vendor: { id: 'v', businessName: 'x', industry: 'retail', subdomain: 'stepnrock' }, cms: null, products });
  ok('a reachable shop with products shows exactly those', sd.resolveProducts(site([base, { ...base, id: 'p2' }])).length === 2);
  ok('a reachable shop with ZERO products shows zero — deleting everything must not bring back the fake showcase', sd.resolveProducts(site([])).length === 0);
  ok('an unreachable shop (null) shows nothing and lets the UI say "couldn\'t load" — never dollar-priced showcase items', sd.resolveProducts(null).length === 0);

  section('Live-edit freshness');
  ok(`server-rendered pages refresh within ${sd.LIVE_REFRESH_SECONDS}s (dispatch asks ≤ 60)`, sd.LIVE_REFRESH_SECONDS > 0 && sd.LIVE_REFRESH_SECONDS <= 60);
  const siteSrc = read('lib/site-data.ts');
  ok('browser fetches are never cached (cache: "no-store")', /cache: 'no-store'/.test(siteSrc));
  ok('every server fetch uses the LIVE_REFRESH_SECONDS revalidate (no stray revalidate: 3600)', !/revalidate:\s*(?!LIVE_REFRESH_SECONDS)\d+/.test(siteSrc));
  ok('the home page has a page-level revalidate too (a failed build-time fetch cannot freeze it)', /export const revalidate = 30;/.test(read('app/page.tsx')));
  ok('the sitemap is revalidated at the same cadence', /export const revalidate = 30;/.test(read('app/sitemap.ts')));

  section('SITE_URL: no hard-coded host');
  const urlMod = await load('lib/site-url.ts');
  ok('default origin is the platform subdomain, not another domain', urlMod.SITE_URL === 'https://stepnrock.get4domain.com' && urlMod.absUrl('/about') === 'https://stepnrock.get4domain.com/about');
  process.env.SITE_URL = 'https://www.stepnrock.in/';
  const urlMod2 = await load('lib/site-url.ts');
  ok('SITE_URL overrides it and a trailing slash is removed', urlMod2.SITE_URL === 'https://www.stepnrock.in' && urlMod2.absUrl('cart') === 'https://www.stepnrock.in/cart');
  delete process.env.SITE_URL;
  const files = [...walk('app'), ...walk('lib'), ...walk('components')];
  const withHost = files.filter((f) => /https:\/\/stepnrock\.com/.test(read(f)));
  ok('no source file hard-codes https://stepnrock.com any more', withHost.length === 0, withHost.join());
  ok('sitemap.xml and robots.txt exist and are driven by SITE_URL', /absUrl/.test(read('app/sitemap.ts')) && /absUrl/.test(read('app/robots.ts')));
  ok('Docker build + compose pass SITE_URL', /ARG SITE_URL/.test(read('Dockerfile')) && /SITE_URL/.test(read('docker-compose.yml')));

  section('Copy / behaviour guards');
  const everything = files.map((f) => [f, read(f)]);
  ok('no "$75" free-shipping claim anywhere (an INR shop)', everything.every(([, s]) => !/\$75/.test(s)), everything.filter(([, s]) => /\$75/.test(s)).map(([f]) => f).join());
  ok('no UI shows "N left" from a made-up number', everything.every(([, s]) => !/product\.stock\b/.test(s)));
  ok('no page or hook falls back to the static showcase catalogue', everything.every(([f, s]) => f === 'lib/products.ts' || !/fallbackProducts/.test(s)));
  const cart = read('components/cart/CartView.tsx');
  ok('order request carries an address and a persisted idempotency key', /engine\.checkout\.request/.test(cart) && /idempotencyKey/.test(cart) && /sessionStorage/.test(cart) && /address/.test(cart));
  ok('the cart sends the product id (not just a name) so the server reserves the right row', /productId: l\.productId/.test(cart));
  ok('the fake STEP10 coupon and client-side shipping fee are gone (the server never applied them)', !/STEP10/.test(cart) && !/SHIPPING_COST/.test(cart));
  ok('the scripted demo chat widget (false address / PayPal / newsletter answers) is not mounted', !/<ChatWidget/.test(read('app/layout.tsx')));
  ok('the home page carries no invented stats or testimonials', !/50K+|Happy Customers|Verified Buyer|Countries Served/.test(read('app/page.tsx')));
  const navSrc = read('components/layout/Header.tsx') + read('components/layout/Footer.tsx');
  ok('header and footer category links come from the shop\'s own categories (no fixed Sneakers / Running / Formal / Sandals / Women / Apparel links)', !/\/shop\/(sneakers|running|formal|sandals|women|apparel)['"]/.test(navSrc) && /useCategories/.test(read('components/layout/Header.tsx')) && /useCategories/.test(read('components/layout/Footer.tsx')));
  ok('no invented shop policy on the product page (30-day returns, 2-year warranty)', !/30-Day Returns|2-Year Warranty/.test(read('app/product/[slug]/page.tsx')) && !/30-Day Returns|2-Year Warranty/.test(read('app/page.tsx')));
  ok('a synchronous double-tap guard exists on submit', /submitting\.current/.test(cart));
  ok('the price slider no longer caps at a hard-coded 200 / dollars', !/max=\{200\}/.test(read('app/shop/page.tsx')) && !/\$\{priceRange/.test(read('app/shop/page.tsx')));
  ok('category pages are not limited to six hard-coded slugs', !/validSlugs/.test(read('app/shop/[category]/page.tsx')));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
