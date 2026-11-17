// Smoke checks of the dispatch G3 pages (marketing, product, guides, partners, industry and category pages, directory viewing, vendor viewing).
// Called from smoke.mjs with its helpers; runs against the same real built servers. No database, no backend, no network beyond localhost.
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function createG3Smoke(h) {
  const { ok, getHost, get, ports, M, D, visible, ldBlocks, h1s, titleOf, descOf, internalLinks, BANNED, a11yChecks, root } = h;
  const src = (...p) => readFileSync(path.join(root, 'src', 'lib', 'v3-public', ...p), 'utf8');
  const routes = src('site-routes.ts');
  const listOf = (name) => [...new RegExp(`${name}: readonly string\\[\\] = \\[([\\s\\S]*?)\\];`).exec(routes)[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  const PRODUCT = listOf('PRODUCT_SLUGS');
  const GUIDES = listOf('GUIDE_SLUGS');
  const types = (html) => { try { return ldBlocks(html).map((s) => JSON.parse(s)['@type']); } catch { return []; } };
  const okStatus = (s) => s === 200 || s === 301 || s === 302 || s === 307 || s === 308;

  // one marketing page: the quality checks every page of the new lane must pass
  async function pageQuality(tag, host, port, p, opt = {}) {
    const r = await getHost(port, host, p);
    ok(r.status === 200, `${tag}: ${p} answers 200 (${r.status})`);
    if (r.status !== 200) return r;
    ok(h1s(r.text) === 1, `${tag}: ${p} has exactly one h1`);
    ok(/<main[\s>]/.test(r.text) && /<header[\s>]/.test(r.text) && /<footer[\s>]/.test(r.text) && /href="#main"/.test(r.text), `${tag}: ${p} has landmarks and a skip link`);
    const title = titleOf(r.text);
    ok(title.length > 0 && title.length <= 60, `${tag}: ${p} title is at most 60 characters (${title.length})`);
    const d = descOf(r.text);
    ok(d.length >= 50 && d.length <= 175, `${tag}: ${p} has a description of sensible length (${d.length})`);
    // Next writes the root canonical without the slash
    const canon = p === '/' ? `https://${host}` : `https://${host}${p}`;
    ok(r.text.includes(`<link rel="canonical" href="${canon}"`), `${tag}: ${p} canonical is on the main host`);
    ok(/name="robots" content="index, follow"/.test(r.text), `${tag}: ${p} is indexable`);
    const t = types(r.text);
    ok(ldBlocks(r.text).length > 0 && t.length === ldBlocks(r.text).length, `${tag}: ${p} JSON-LD parses`);
    if (p !== '/') ok(t.includes('BreadcrumbList'), `${tag}: ${p} has BreadcrumbList`);
    if (opt.faq) ok(t.includes('FAQPage'), `${tag}: ${p} has FAQPage JSON-LD`);
    ok(!/"price"|"Offer"|aggregateRating|"review"/i.test(ldBlocks(r.text).join('')), `${tag}: ${p} JSON-LD has no price, offer, rating or review markup`);
    const text = visible(r.text);
    for (const [label, re] of BANNED) ok(!re.test(text), `${tag}: ${p} has no ${label}`);
    ok(!/tel:|mailto:|wa\.me/.test(r.text), `${tag}: ${p} has no contact link`);
    ok(!/being built|coming soon|lorem ipsum|placeholder/i.test(text), `${tag}: ${p} is not a placeholder`);
    ok(!/[₹]|\bRs\.?\s*\d/.test(text), `${tag}: ${p} writes no price`);
    a11yChecks(tag, p, r.text);
    return r;
  }

  async function marketing() {
    const H = (p, init) => getHost(ports.HOST, M, p, init);
    const pages = [
      ['/', { faq: true }], ['/how-it-works', { faq: true }], ['/industries', {}], ['/product', { faq: true }], ['/partners', { faq: true }], ['/guides', {}],
      ...PRODUCT.map((s) => [`/product/${s}`, { faq: true }]),
      ...GUIDES.map((s) => [`/guides/${s}`, {}]),
    ];
    ok(PRODUCT.length === 8 && GUIDES.length === 5, 'g3: eight product pages and five guides are defined');
    for (const [p, opt] of pages) await pageQuality('g3', M, ports.HOST, p, opt);

    // navigation: every link in the header and footer of the home page is a real page
    const home = await H('/');
    const nav = [...home.text.matchAll(/<(?:header|footer)[\s\S]*?<\/(?:header|footer)>/g)].map((m) => m[0]).join(' ');
    const navLinks = [...new Set([...nav.matchAll(/<a [^>]*href="(\/[^"#]*)"/g)].map((m) => m[1]))];
    ok(['/product', '/pricing', '/how-it-works', '/industries', '/guides', '/partners', '/register', '/login', '/about', '/contact', ...PRODUCT.map((s) => `/product/${s}`)].every((l) => navLinks.includes(l)), 'g3: the header and footer link to the product pages, guides, partners and the existing pages');
    for (const l of navLinks) { const x = await H(l); ok(okStatus(x.status) && !/being built/i.test(x.text), `g3: navigation link ${l} is a real page (${x.status})`); }
    const homeText = visible(home.text);
    for (const w of ['Who it is for', 'Three business tracks', 'Handyman', 'Professional', 'Ecommerce', 'Partner programme']) ok(homeText.includes(w), `g3: home says "${w}"`);
    ok(internalLinks(home.text).includes('/register') && internalLinks(home.text).includes('/pricing'), 'g3: home links to /register and /pricing');

    // unknown slugs are real 404s; the internal addresses are not reachable; the directory host does not serve them
    for (const p of ['/product/nothing', '/guides/nothing', '/product/website/extra', '/guides/nothing/more']) ok((await H(p)).status === 404, `g3: ${p} is a real 404`);
    for (const p of ['/v3-site/product', '/v3-site/guides', '/v3-site/partners', '/v3-site/product/website']) ok((await H(p)).status === 404, `g3: internal ${p} is a 404`);
    for (const p of ['/product', '/product/website', '/guides', '/partners']) ok((await getHost(ports.HOST, D, p)).status === 404, `g3: the directory host does not serve ${p}`);
    const products = await H('/products');
    ok(products.status === 308 || products.status === 307, 'g3: the live /products redirect is untouched');

    // the sitemap and robots
    const sm = await H('/sitemap-industries.xml');
    for (const p of ['/product', '/partners', '/guides', ...PRODUCT.map((s) => `/product/${s}`), ...GUIDES.map((s) => `/guides/${s}`)]) ok(sm.text.includes(`<loc>https://${M}${p}</loc>`), `g3: the sitemap lists ${p}`);
    ok(!sm.text.includes('/v3-site'), 'g3: the sitemap names no internal address');
    const robots = (await H('/robots.txt')).text;
    ok(!/Disallow: \/(product|guides|partners)/.test(robots), 'g3: robots.txt does not block the new pages');
  }

  // ── S2: industry and category pages ──
  const slugsSrc = src('industries.ts');
  const PACK_SLUG = Object.fromEntries([...(/PACK_SLUGS[^=]*= \{([\s\S]*?)\};/.exec(slugsSrc)[1]).matchAll(/([A-Z0-9_]+): '([a-z0-9-]+)'/g)].map((m) => [m[1], m[2]]));
  const REGULATED_KEYS = ['CLINIC', 'LAB', 'PHARMACY', 'PRACTICE_LEGAL_FINANCE'];
  const CATS = [...src('catalogue-data.ts').matchAll(/^ {2}\['([a-z0-9-]+)', '((?:[^'\\]|\\.)*)', '([A-Z0-9_]+)'/gm)].map((m) => ({ id: m[1], name: m[2], pack: m[3] }));
  const catPath = (c) => `/industries/${PACK_SLUG[c.pack]}/${c.id}`;
  const PUBLISHED_CATS = CATS.filter((c) => !REGULATED_KEYS.includes(c.pack));
  const REGULATED_CATS = CATS.filter((c) => REGULATED_KEYS.includes(c.pack));

  async function categoryPages() {
    const H = (p) => getHost(ports.HOST, M, p);
    ok(CATS.length === 196, `g3 categories: the catalogue has 196 categories (${CATS.length})`);
    const heavyDone = new Set();
    for (const c of PUBLISHED_CATS) {
      const p = catPath(c);
      if (!heavyDone.has(c.pack)) {
        heavyDone.add(c.pack);
        await pageQuality('g3 category', M, ports.HOST, p, { faq: true });
        continue;
      }
      const r = await H(p);
      const title = titleOf(r.text);
      ok(r.status === 200 && h1s(r.text) === 1 && title.length > 0 && title.length <= 60, `g3 category: ${p} answers 200 with one h1 and a short title (${r.status}, ${title.length})`);
      ok(r.text.includes(`<link rel="canonical" href="https://${M}${p}"`) && types(r.text).includes('FAQPage') && types(r.text).includes('BreadcrumbList'), `g3 category: ${p} has its canonical, FAQPage and BreadcrumbList`);
      const t = visible(r.text);
      ok(!BANNED.some(([, re]) => re.test(t)) && !/being built/i.test(t), `g3 category: ${p} keeps the copy rules`);
    }
    // the page links to register with the industry and the category
    const sample = PUBLISHED_CATS.find((c) => c.id === 'restaurant-cafe');
    const sr = await H(catPath(sample));
    ok(internalLinks(sr.text).includes('/register?pack=FOOD_SERVICE&category=restaurant-cafe'), 'g3 category: the call to action preselects the industry and the category');
    ok(/Restaurant cafe/.test(visible(sr.text)) && /Menu/.test(visible(sr.text)), 'g3 category: the page names the category and the working areas of its pack');
    // the pack page and the hub link to the categories
    for (const key of Object.keys(PACK_SLUG).filter((k) => !REGULATED_KEYS.includes(k))) {
      const links = internalLinks((await H(`/industries/${PACK_SLUG[key]}`)).text);
      ok(CATS.filter((c) => c.pack === key).every((c) => links.includes(catPath(c))), `g3 category: the page of ${PACK_SLUG[key]} links every one of its categories`);
    }
    const hub = await H('/industries');
    ok(PUBLISHED_CATS.some((c) => internalLinks(hub.text).includes(catPath(c))) && !REGULATED_CATS.some((c) => hub.text.includes(c.id)), 'g3 category: the hub links to categories and none of the regulated packs');
    // register preselects
    const reg = await H('/register?pack=FOOD_SERVICE&category=restaurant-cafe');
    ok(/<option[^>]*value="restaurant-cafe"[^>]*selected/.test(reg.text) || /<option[^>]*selected[^>]*value="restaurant-cafe"/.test(reg.text), 'g3 category: /register preselects the category');
    const regOnly = await H('/register?category=restaurant-cafe');
    ok(/Showing the categories of Food service/.test(visible(regOnly.text)), 'g3 category: a category alone also chooses its pack');
    const regBad = await H('/register?category=not-a-category');
    ok(regBad.status === 200 && !/<option[^>]*selected/.test(regBad.text), 'g3 category: an unknown category id is ignored on /register');
    // 404s
    for (const p of ['/industries/food-service/nothing', '/industries/retail-and-ecommerce/restaurant-cafe', '/industries/nothing/restaurant-cafe', '/industries/food-service/restaurant-cafe/extra', '/v3-site/industries/food-service/restaurant-cafe']) ok((await H(p)).status === 404, `g3 category: ${p} is a real 404`);
    for (const c of REGULATED_CATS) ok((await H(catPath(c))).status === 404, `g3 category: regulated ${c.id} is a 404 by default`);
    ok((await getHost(ports.HOST, D, catPath(sample))).status === 404, 'g3 category: the directory host does not serve a category page');
    // sitemap
    const sm = (await H('/sitemap-industries.xml')).text;
    ok(PUBLISHED_CATS.every((c) => sm.includes(`<loc>https://${M}${catPath(c)}</loc>`)) && !REGULATED_CATS.some((c) => sm.includes(c.id)), 'g3 category: the sitemap lists every published category and no regulated one');
  }

  async function categoryRegulatedOn() {
    const H = (p) => getHost(ports.REG, M, p);
    for (const c of REGULATED_CATS) {
      const r = await H(catPath(c));
      ok(r.status === 200 && h1s(r.text) === 1 && titleOf(r.text).length <= 60, `g3 category (regulated on): ${c.id} answers 200 with one h1 and a short title (${r.status})`);
    }
    const sm = (await H('/sitemap-industries.xml')).text;
    ok(REGULATED_CATS.every((c) => sm.includes(catPath(c))), 'g3 category (regulated on): the sitemap lists them');
  }

  async function categoryFlagOff() {
    const O = (p) => getHost(ports.OFF, M, p);
    const unknown = await O('/zzz-not-a-page-zzz');
    for (const c of CATS.slice(0, 8)) { const r = await O(catPath(c)); ok(r.status === unknown.status && !/Typical working areas/.test(r.text), `g3 category flag off: ${catPath(c)} is an unknown address (${r.status})`); }
    const reg = await O('/register?category=restaurant-cafe');
    ok(reg.status === 200 && !/Showing the categories of/.test(visible(reg.text)), 'g3 category flag off: the live /register ignores the new parameter');
  }

  // ── S3: the directory pages, viewed on the directory host with the sample set ──
  async function directoryPages() {
    const H = (p) => getHost(ports.HOST, D, p);
    const seen = new Map();
    const queue = ['/'];
    const SKIP = /^\/(claim|account|legal|sitemaps|go|directory-)/;
    while (queue.length) {
      const p = queue.shift();
      if (seen.has(p)) continue;
      const r = await H(p);
      seen.set(p, r);
      if (r.status !== 200) continue;
      for (const l of internalLinks(r.text)) if (!seen.has(l) && !SKIP.test(l)) queue.push(l);
    }
    ok(seen.size >= 25, `g3 directory: the sample directory has many pages to view (${seen.size})`);
    // the breadcrumb home link is the model's /directory address, which the directory host answers with a 308 to / (the model is rendered as given, gap G11)
    const bad = [...seen].filter(([p, r]) => r.status !== 200 && !(p === '/directory' && r.status === 308)).map(([p, r]) => `${p} ${r.status}`);
    ok(bad.length === 0, `g3 directory: every internal link on the directory pages resolves (${bad.join(', ')})`);
    const wanted = ['/', '/chennai', '/coimbatore', '/madurai', '/bengaluru', '/state/tamil-nadu', '/state/karnataka', '/category/plumbers', '/category/salons', '/coimbatore/plumbers', '/bengaluru/restaurants', '/business/kovai-plumbing-works', '/business/spice-route-cafe'];
    for (const p of wanted) ok(seen.has(p), `g3 directory: ${p} is reachable by links from the directory home`);
    for (const [p, r] of seen) {
      if (r.status !== 200) continue;
      const tag = `g3 directory ${p}`;
      ok(h1s(r.text) === 1, `${tag}: exactly one h1`);
      ok(/<main[\s>]/.test(r.text) && /<header[\s>]/.test(r.text) && /<footer[\s>]/.test(r.text) && /href="#main"/.test(r.text), `${tag}: landmarks and a skip link`);
      ok(!/tel:|mailto:|wa\.me/i.test(r.text), `${tag}: no contact link`);
      ok(!/href="#\/|href="\/#\//.test(r.text), `${tag}: no hash address`);
      const blocks = ldBlocks(r.text);
      let parsed = true;
      try { blocks.forEach((b) => JSON.parse(b)); } catch { parsed = false; }
      ok(parsed && blocks.length > 0, `${tag}: JSON-LD parses`);
      ok(/<link rel="canonical" href="https:\/\/directory\.example\.invalid[^"]*"/.test(r.text), `${tag}: canonical comes from the page model`);
      const visits = (r.text.match(/>Visit site</g) ?? []).length;
      const goLinks = (r.text.match(/href="\/go\/b-\d+/g) ?? []).length;
      ok(visits === goLinks, `${tag}: every Visit site link goes through the click-out (${visits}, ${goLinks})`);
      const t = visible(r.text);
      ok(!/\b(best|top rated|number one|guaranteed|\d+ reviews?|rated \d)/i.test(t), `${tag}: no ranking, rating or review claim`);
    }
  }

  // ── S4: the developer-only vendor view is never reachable in a production build (these servers are production builds) ──
  async function devVendorOff() {
    const paths = ['/_vendor/sample-pro', '/_vendor/sample-pro/about', '/_vendor/sample-pro/sitemap.xml', '/_vendor/sample-pro/robots.txt', '/_vendor', '/_vendor/sample-pro/assets/x.css'];
    for (const [name, port] of [['flag off', ports.OFF], ['flag on, no host names', ports.ON], ['flag on with host names', ports.HOST], ['flag on, switch name set', ports.FULL]]) {
      for (const p of paths) {
        const r = await get(port, p);
        ok(r.status === 404 && !/Sample Pro Plumbing/.test(r.text), `g3 dev vendor (${name}): ${p} is a 404 in a production build (${r.status})`);
      }
    }
    const rh = await getHost(ports.FULL, M, '/_vendor/sample-pro');
    ok(rh.status === 404, 'g3 dev vendor: the main host answers 404 as well even with the switch name set');
    const spoof = await get(ports.FULL, '/vendor-site', { headers: { 'x-v3-dev-vendor-host': 'sample-pro.localhost' } });
    ok(spoof.status === 404 && !/Sample Pro Plumbing/.test(spoof.text), 'g3 dev vendor: the internal relay ignores the dev header in a production build');
    const spoof2 = await get(ports.FULL, '/_vendor/sample-pro', { headers: { 'x-v3-dev-vendor-host': 'sample-pro.localhost' } });
    ok(spoof2.status === 404, 'g3 dev vendor: sending the dev header changes nothing');
  }

  // every internal link of the main-host site resolves: a crawl from the home page
  async function crawl() {
    const H = (p) => getHost(ports.HOST, M, p);
    const seen = new Map();
    const queue = ['/'];
    while (queue.length) {
      const p = queue.shift();
      if (seen.has(p)) continue;
      const r = await H(p);
      seen.set(p, r.status);
      if (r.status !== 200 || p.startsWith('/register') || p.startsWith('/login')) continue;
      for (const l of internalLinks(r.text)) if (!seen.has(l) && !l.startsWith('/directory') && !l.startsWith('/go/')) queue.push(l);
    }
    const bad = [...seen].filter(([, s]) => !okStatus(s));
    ok(bad.length === 0, `g3 crawl: every internal link resolves (${seen.size} addresses, bad: ${bad.map(([p, s]) => `${p} ${s}`).join(', ')})`);
    ok(seen.size > 100, `g3 crawl: the crawl reached the site (${seen.size} addresses)`);
  }

  // flag off with the host names set: nothing new exists, and the live pages are untouched
  async function flagOff() {
    const O = (p) => getHost(ports.OFF, M, p);
    const unknown = await O('/zzz-not-a-page-zzz');
    for (const p of ['/product', '/product/website', '/partners', '/guides', '/guides/choosing-your-site-address']) {
      const r = await O(p);
      ok(r.status === unknown.status && !/Start with a free trial site|Partner programme|Product pages/.test(r.text), `g3 flag off: ${p} behaves as an unknown address (${r.status})`);
    }
    for (const p of ['/v3-site/product', '/v3-site/guides', '/v3-site/partners', '/v3-site/industries/food-service/restaurant-cafe']) ok((await O(p)).status === 404, `g3 flag off: internal ${p} is a 404`);
    ok((await O('/sitemap-industries.xml')).status === 404, 'g3 flag off: no flag-on sitemap');
    ok(!/\/(product|guides|partners)\b/.test((await O('/sitemap.xml')).text), 'g3 flag off: sitemap.xml lists none of the new pages');
  }

  // flag on, host names not set: nothing is routed on the main host, as for every commercial page
  async function noHosts() {
    for (const p of ['/product', '/product/website', '/partners', '/guides', '/industries/food-service/restaurant-cafe']) {
      const r = await get(ports.ON, p);
      ok(r.status === 404 && !/Start with a free trial site/.test(r.text), `g3 no hosts: ${p} is not routed (${r.status})`);
    }
    ok((await get(ports.ON, '/v3-site/product')).status === (await get(ports.ON, '/v3-site/pricing')).status, 'g3 no hosts: the internal product page is reachable exactly as the other commercial pages are');
  }

  return { devVendorOff, directoryPages, categoryPages, categoryRegulatedOn, categoryFlagOff, marketing, crawl, flagOff, noHosts, PRODUCT, GUIDES, pageQuality, okStatus, types, CATS, catPath };
}
