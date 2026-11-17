// Smoke checks of the dispatch G3 pages (marketing, product, guides, partners, industry and category pages, directory viewing, vendor viewing).
// Called from smoke.mjs with its helpers; runs against the same real built servers. No database, no backend, no network beyond localhost.
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function createG3Smoke(h) {
  const { ok, getHost, get, ports, M, D, visible, ldBlocks, h1s, titleOf, descOf, internalLinks, BANNED, a11yChecks, root } = h;
  const routes = readFileSync(path.join(root, 'src', 'lib', 'v3-public', 'site-routes.ts'), 'utf8');
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
    const canon = p === "/" ? `https://${host}` : `https://${host}${p}`; // Next writes the root canonical without the slash
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
    ok(navLinks.includes('/register') && navLinks.includes('/pricing'), 'g3: home links to /register and /pricing');

    // unknown slugs are real 404s; the internal addresses are not reachable; the directory host does not serve them
    for (const p of ['/product/nothing', '/guides/nothing', '/product/website/extra', '/guides/nothing/more']) ok((await H(p)).status === 404, `g3: ${p} is a real 404`);
    for (const p of ['/v3-site/product', '/v3-site/guides', '/v3-site/partners', '/v3-site/product/website']) ok((await H(p)).status === 404, `g3: internal ${p} is a 404`);
    for (const p of ['/product', '/product/website', '/guides', '/partners']) ok((await getHost(ports.HOST, D, p)).status === 404, `g3: the directory host does not serve ${p}`);
    ok((await H('/products')).status === 308 || (await H('/products')).status === 307, 'g3: the live /products redirect is untouched');

    // the sitemap and robots
    const sm = await H('/sitemap-industries.xml');
    for (const p of ['/product', '/partners', '/guides', ...PRODUCT.map((s) => `/product/${s}`), ...GUIDES.map((s) => `/guides/${s}`)]) ok(sm.text.includes(`<loc>https://${M}${p}</loc>`), `g3: the sitemap lists ${p}`);
    ok(!sm.text.includes('/v3-site'), 'g3: the sitemap names no internal address');
    const robots = (await H('/robots.txt')).text;
    ok(!/Disallow: \/(product|guides|partners)/.test(robots), 'g3: robots.txt does not block the new pages');
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
    ok(seen.size > 30, `g3 crawl: the crawl reached the site (${seen.size} addresses)`);
  }

  // flag off with the host names set: nothing new exists, and the live pages are untouched
  async function flagOff() {
    const O = (p) => getHost(ports.OFF, M, p);
    const unknown = await O('/zzz-not-a-page-zzz');
    for (const p of ['/product', '/product/website', '/partners', '/guides', '/guides/choosing-your-site-address', '/industries/food-service/restaurant']) {
      const r = await O(p);
      ok(r.status === unknown.status && !/Start with a free trial site|Partner programme|Product pages/.test(r.text), `g3 flag off: ${p} behaves as an unknown address (${r.status})`);
    }
    for (const p of ['/v3-site/product', '/v3-site/guides', '/v3-site/partners', '/v3-site/industries/food-service/restaurant']) ok((await O(p)).status === 404, `g3 flag off: internal ${p} is a 404`);
    ok((await O('/sitemap-industries.xml')).status === 404, 'g3 flag off: no flag-on sitemap');
    const sm = (await O('/sitemap.xml')).text;
    ok(!/\/(product|guides|partners)\b/.test(sm), 'g3 flag off: sitemap.xml lists none of the new pages');
  }

  // flag on, host names not set: nothing is routed on the main host, as for every commercial page
  async function noHosts() {
    for (const p of ['/product', '/product/website', '/partners', '/guides']) {
      const r = await get(ports.ON, p);
      ok(r.status === 404 && !/Start with a free trial site/.test(r.text), `g3 no hosts: ${p} is not routed (${r.status})`);
    }
    ok((await get(ports.ON, '/v3-site/product')).status === (await get(ports.ON, '/v3-site/pricing')).status, 'g3 no hosts: the internal product page is reachable exactly as the other commercial pages are');
  }

  return { marketing, crawl, flagOff, noHosts, PRODUCT, GUIDES, pageQuality, okStatus, types };
}
