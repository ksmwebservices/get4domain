#!/usr/bin/env node
/**
 * SEO checks for the Get4Domain marketing app (SEO-0, docs/v3/SEO_0_PLAN.md).
 *
 *   node scripts/seo-check.mjs [--base http://127.0.0.1:3100] [--group legacy,demo,canon,robots,links,routes,all] [--verbose]
 *
 * By default it runs only against a LOCAL, FRONTEND-ONLY `next start` (loopback addresses). After a release the owner can add --allow-remote and a
 * public https base URL; the checks that need the source tree or the demo secret are then listed as SKIP.
 * Run it against a LOCAL, FRONTEND-ONLY `next start`. Build and start with the API variables pointed at an unreachable local address so nothing can
 * reach a real backend, e.g.:
 *   NEXT_PUBLIC_API_URL=http://127.0.0.1:9 INTERNAL_API_URL=http://127.0.0.1:9 DEMO_ACCESS_SECRET=local npm run build
 *   (same variables) npx next start -p 3100 -H 127.0.0.1   then   DEMO_ACCESS_SECRET=local npm run seo:check
 * Vendor pages need the API, so vendor-site behaviour is checked through the middleware (Host header) and the pure vendorCanonical() function. It refuses any host that is not loopback: it must never be pointed at the live site. It sends plain GET requests only,
 * never follows redirects (so 301/307 and their headers are visible) and can send a Host header, so the main-host and vendor-host rules are testable.
 *
 * Groups: legacy (titles, descriptions, OG/Twitter, keywords, JSON-LD offers, llms.txt)   demo (/visit-demo, /demo/*, sitemap)
 *         canon (redirects, canonicals, JSON-LD by host)   robots (robots.txt)   links (internal links, metadata helper)
 *         routes (every public route: title and description, canonical, robots, JSON-LD, banned words and prices, one table)
 * Exit code: 0 all pass, 1 at least one failure, 2 refused or could not run.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback; };
const VERBOSE = argv.includes('--verbose');
const GROUPS = (arg('group', 'all')).split(',').map((s) => s.trim());
const BASE = new URL(arg('base', 'http://127.0.0.1:3100'));
const LOOPBACK = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(BASE.hostname);
/** --allow-remote lets the owner point the same checks at the deployed site after a release. Without it the script refuses anything but loopback. */
const REMOTE = !LOOPBACK;
if (REMOTE && !argv.includes('--allow-remote')) {
  console.error(`seo-check refuses to run against ${BASE.hostname}: by default it only talks to a local server. To check a deployed site on purpose, add --allow-remote (read-only GET requests; see docs/v3/SEO0_LOG.md).`);
  process.exit(2);
}
/** Checks that need the source tree, a forged Host header or the demo secret can only run against a local build; a remote run lists them as SKIP. */
const LOCAL_ONLY = /valid pass|every other \/demo|main host: \/site|main host: reserved|vendor host:|vendorCanonical|vendor page metadata|root layout|retired address|createPageMetadata|marketing pages only/;

const SITE = 'get4domain.com';
const TAGLINE = 'Get4Domain — Your Online Visible Partner';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
/** Product and price words of the retired plans. They must not appear in meta, structured data or llms.txt. */
const LEGACY = /Workspace|\bBOS\b|LeadSpace|₹\s?999\b|₹\s?1,?999\b|\b11,?988\b|\b23,?988\b|Identity Partner/i;
const AI_BOTS = ['Amazonbot', 'Applebot-Extended', 'Bytespider', 'CCBot', 'ClaudeBot', 'Claude-SearchBot', 'ChatGPT-User', 'CloudflareBrowserRenderingCrawler', 'Google-Extended', 'GPTBot', 'meta-externalagent', 'PerplexityBot'];
const STATIC_PAGES = ['/', '/leadspace', '/managed-services', '/domain-app', '/pricing', '/industries', '/features', '/how-it-works', '/book-demo', '/portfolio', '/templates', '/contact', '/support', '/about', '/terms', '/privacy-policy', '/refund-policy'];
const INDUSTRIES = ['restaurant', 'travel', 'realestate', 'clinic', 'education', 'construction', 'retail', 'salon', 'gym', 'professional', 'events', 'finance', 'automobile', 'logistics', 'diagnostics', 'hotel', 'photography', 'technology', 'agriculture', 'coaching'];

// ── tiny HTTP client: no redirects followed, optional Host header ─────────────────────────────────────────────────────────────────────────────────
function get(p, { host, ua = BROWSER, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const client = BASE.protocol === 'https:' ? https : http;
    const req = client.request({
      hostname: BASE.hostname === '[::1]' ? '::1' : BASE.hostname, port: BASE.port || (BASE.protocol === 'https:' ? 443 : 80), path: p, method: 'GET',
      headers: { host: REMOTE ? BASE.host : (host ?? `${BASE.hostname}:${BASE.port}`), 'user-agent': ua, ...(cookie ? { cookie } : {}) },
    }, (res) => {
      let body = ''; res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(90_000, () => req.destroy(new Error(`timeout fetching ${p}`)));
    req.end();
  });
}

// ── HTML helpers (regex over the raw server HTML; no JavaScript is run, like a first-pass crawler) ──────────────────────────────────────────────
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function attrs(tag) {
  const out = {}; const re = /([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? '');
  return out;
}
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => attrs(m[0]));
const metaNamed = (html, key) => tags(html, 'meta').find((a) => (a.name ?? a.property)?.toLowerCase() === key.toLowerCase())?.content;
const title = (html) => { const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html); return m ? decode(m[1]).trim() : undefined; };
const canonical = (html) => tags(html, 'link').find((a) => a.rel === 'canonical')?.href;
const jsonLd = (html) => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => { try { return JSON.parse(decode(m[1])); } catch { return { __unparsable: m[1] }; } });
const ldTypes = (blocks) => blocks.flatMap((b) => (Array.isArray(b) ? b : [b])).map((b) => b['@type']);
/** every user-visible metadata string of a page, for the legacy-word scan */
const metaStrings = (html) => [title(html), ...tags(html, 'meta').flatMap((a) => (a.content && !/^(viewport|theme-color)$/i.test(a.name ?? '') ? [`${a.name ?? a.property}: ${a.content}`] : [])), ...jsonLd(html).map((b) => JSON.stringify(b))].filter(Boolean);
const xrobots = (res) => String(res.headers['x-robots-tag'] ?? '');
const noindex = (v) => /noindex/i.test(v);
const sameLocation = (loc, wanted) => { const n = (u) => (u ?? '').replace(/\/+$/, ''); return n(loc) === n(wanted); };
const pathOf = (loc) => { try { const u = new URL(loc, 'http://x'); return u.pathname + u.search; } catch { return loc; } };

// ── check registry ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const checks = [];
const check = (group, name, fn) => checks.push({ group, name, fn });
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

// ─────────────────────────────────── legacy ───────────────────────────────────────────────────────────────────────────────────────────────────
const ROOT_DEFAULT_PROBE = '/login';   // a page with no metadata of its own: it shows exactly what the root layout provides
check('legacy', 'root default title/description/OG/Twitter carry the V3 tagline and no legacy word or price', async () => {
  const r = await get(ROOT_DEFAULT_PROBE); ok(r.status === 200, `${ROOT_DEFAULT_PROBE} answered ${r.status}`);
  ok(title(r.body) === TAGLINE, `title is "${title(r.body)}", wanted "${TAGLINE}"`);
  const bad = metaStrings(r.body).filter((s) => LEGACY.test(s)); ok(!bad.length, `legacy text in root metadata: ${bad.join(' | ').slice(0, 300)}`);
  for (const k of ['description', 'og:title', 'og:description', 'twitter:title', 'twitter:description']) ok(metaNamed(r.body, k), `missing ${k}`);
});
check('legacy', 'home page: exact title (≤ 60 chars), own description (≤ 160), no legacy word or price in any metadata', async () => {
  const r = await get('/'); ok(r.status === 200, `/ answered ${r.status}`);
  const t = title(r.body); ok(t === TAGLINE, `home title is "${t}"`); ok(t.length <= 60, `home title is ${t.length} chars`);
  const d = metaNamed(r.body, 'description') ?? ''; ok(d.length >= 80 && d.length <= 160, `home description is ${d.length} chars`);
  const bad = metaStrings(r.body).filter((s) => LEGACY.test(s)); ok(!bad.length, `legacy text in home metadata: ${bad.join(' | ').slice(0, 300)}`);
});
check('legacy', 'no <meta name="keywords"> on the root default, the home page and pricing', async () => {
  for (const p of [ROOT_DEFAULT_PROBE, '/', '/pricing']) { const r = await get(p); ok(metaNamed(r.body, 'keywords') === undefined, `${p} still has a keywords meta`); }
});
check('legacy', 'no SoftwareApplication offers and no price anywhere in structured data', async () => {
  for (const p of ['/', '/industries/clinic', '/industries/travel']) {
    const r = await get(p); const text = JSON.stringify(jsonLd(r.body));
    ok(!/"offers"|"Offer"|"price"|"priceCurrency"/.test(text), `${p} structured data still has offers/price`);
  }
});
check('legacy', 'industry pages: no legacy word or price in any metadata or structured data', async () => {
  for (const id of ['clinic', 'travel', 'restaurant']) {
    const r = await get(`/industries/${id}`); ok(r.status === 200, `/industries/${id} answered ${r.status}`);
    const bad = metaStrings(r.body).filter((s) => LEGACY.test(s)); ok(!bad.length, `/industries/${id}: ${bad.join(' | ').slice(0, 240)}`);
  }
});
check('legacy', 'og:image:alt has no price', async () => {
  const r = await get('/'); const alt = metaNamed(r.body, 'og:image:alt') ?? ''; ok(!/₹|\bfrom\s+\d/i.test(alt), `og:image:alt = "${alt.slice(0, 200)}"`);
});
check('legacy', '/llms.txt has the tagline and no legacy word or price', async () => {
  const r = await get('/llms.txt'); ok(r.status === 200, `/llms.txt answered ${r.status}`);
  ok(/Online Visible Partner/i.test(r.body), 'llms.txt does not use the tagline');
  const hit = r.body.split('\n').filter((l) => LEGACY.test(l)); ok(!hit.length, `llms.txt still says: ${hit.slice(0, 3).join(' | ').slice(0, 300)}`);
});

// ─────────────────────────────────── demo ─────────────────────────────────────────────────────────────────────────────────────────────────────
const DEMO_SECRET = process.env.DEMO_ACCESS_SECRET || 'g4d-demo-access-v1';
const b64url = (b) => Buffer.from(b).toString('base64url');
const demoPass = (category) => { const payload = b64url(JSON.stringify({ c: category, e: Date.now() + 600_000 })); return `${payload}.${crypto.createHmac('sha256', DEMO_SECRET).update(payload).digest('base64url')}`; };
const VISIT_VARIANTS = ['/visit-demo', '/visit-demo?to=/demo/clinic', '/visit-demo?to=%2Fdemo%2Fclinic%2Fdental&x=1', '/visit-demo?to=/x&y=1'];
check('demo', '/visit-demo (every query variant): noindex meta in the HTML and X-Robots-Tag noindex header', async () => {
  for (const p of VISIT_VARIANTS) {
    const r = await get(p); ok(r.status === 200, `${p} answered ${r.status}`);
    ok(/noindex/i.test(metaNamed(r.body, 'robots') ?? ''), `${p}: robots meta is "${metaNamed(r.body, 'robots')}"`);
    ok(noindex(xrobots(r)), `${p}: X-Robots-Tag is "${xrobots(r)}"`);
  }
});
check('demo', '/visit-demo: server-rendered heading and text (not just "Loading…"), no JavaScript needed', async () => {
  const r = await get('/visit-demo?to=/demo/clinic'); const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(r.body);
  ok(h1, 'no <h1> in the raw HTML'); ok(/Verify to view the demo/i.test(h1[1].replace(/<[^>]+>/g, '')), `h1 is "${h1[1].replace(/<[^>]+>/g, '').slice(0, 80)}"`);
  ok(/quick mobile verification/i.test(r.body), 'the explanatory text is not in the raw HTML');
});
check('demo', '/visit-demo has its own title and description, different from the home page, no legacy text', async () => {
  const v = await get('/visit-demo'); const h = await get('/');
  ok(title(v.body) === 'Verify to view a demo | Get4Domain', `title is "${title(v.body)}"`);
  const d = metaNamed(v.body, 'description') ?? ''; ok(d.length > 20 && d !== metaNamed(h.body, 'description'), 'description missing or equal to the home page');
  const bad = metaStrings(v.body).filter((s) => LEGACY.test(s)); ok(!bad.length, `legacy text: ${bad.join(' | ').slice(0, 200)}`);
});
check('demo', '/demo/<category> without a pass: 307 to /visit-demo with X-Robots-Tag noindex (Googlebot and a browser)', async () => {
  for (const ua of [GOOGLEBOT, BROWSER]) {
    const r = await get('/demo/clinic', { ua }); ok(r.status === 307, `answered ${r.status}`);
    ok(pathOf(r.headers.location) === '/visit-demo?to=%2Fdemo%2Fclinic', `Location is ${r.headers.location}`);
    ok(noindex(xrobots(r)), `X-Robots-Tag is "${xrobots(r)}"`);
  }
});
check('demo', '/demo/<keyword> canonicalising redirect carries X-Robots-Tag noindex', async () => {
  const r = await get('/demo/dental', { ua: GOOGLEBOT }); ok(r.status === 307, `answered ${r.status}`);
  ok(pathOf(r.headers.location ?? '').startsWith('/demo/'), `Location is ${r.headers.location}`); ok(noindex(xrobots(r)), `X-Robots-Tag is "${xrobots(r)}"`);
});
check('demo', '/demo/<category> served with a valid pass is also noindex, and is not redirected', async () => {
  const r = await get('/demo/clinic', { cookie: `g4d_demo_pass=${demoPass('clinic')}` });
  ok(r.status !== 307 && r.status !== 308, `answered ${r.status} (redirected although the pass is valid)`); ok(noindex(xrobots(r)), `X-Robots-Tag is "${xrobots(r)}"`);
});
check('demo', '/demo/* pages served with a valid pass say noindex in the HTML (robots meta) as well as in the header, and carry no keywords meta', async () => {
  for (const p of ['/demo/clinic', '/demo/clinic/dental']) {
    const r = await get(p, { cookie: `g4d_demo_pass=${demoPass('clinic')}` }); ok(r.status === 200, `${p} answered ${r.status}`);
    ok(noindex(xrobots(r)), `${p}: X-Robots-Tag is "${xrobots(r)}"`);
    ok(/noindex/i.test(metaNamed(r.body, 'robots') ?? ''), `${p}: robots meta is "${metaNamed(r.body, 'robots')}" (the header says noindex, the HTML must agree)`);
    ok(metaNamed(r.body, 'keywords') === undefined, `${p}: still has a keywords meta`);
    const bad = metaStrings(r.body).filter((s) => LEGACY.test(s)); ok(!bad.length, `${p}: legacy text in metadata: ${bad.join(' | ').slice(0, 200)}`);
  }
});
check('demo', 'every other /demo address (bare /demo, unknown name, with or without a pass) also sends X-Robots-Tag noindex', async () => {
  for (const p of ['/demo', '/demo/zz-not-a-category']) for (const cookie of [undefined, `g4d_demo_pass=${demoPass('clinic')}`]) {
    const r = await get(p, { cookie }); ok(noindex(xrobots(r)), `${p} (status ${r.status}, ${cookie ? 'with' : 'without'} a pass): X-Robots-Tag is "${xrobots(r)}"`);
  }
});
check('demo', 'sitemap.xml has no /demo/ URL, no /visit-demo and no private/dev URL; the 17 pages and 20 industries are there', async () => {
  const r = await get('/sitemap.xml'); ok(r.status === 200, `answered ${r.status}`);
  const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
  const bad = locs.filter((u) => /\/demo(\/|$)|\/visit-demo|\/dashboard|\/admin|\/login|\/register|\/api\/|\/theme-preview|\/theme-local-test|\/localhost|127\.0\.0\.1/.test(u)); ok(!bad.length, `sitemap lists: ${bad.slice(0, 4).join(', ')}`);
  ok(locs.length === 37, `sitemap has ${locs.length} URLs, expected 37 (17 pages + 20 industries)`);
  ok(locs.every((u) => u.startsWith(`https://${SITE}`)), 'a sitemap URL is not on https://get4domain.com');
});

// ─────────────────────────────────── canon ────────────────────────────────────────────────────────────────────────────────────────────────────
check('canon', 'main host: /site/<sub>[/rest][?query] answers 301 to https://<sub>.get4domain.com (www too)', async () => {
  for (const host of [SITE, `www.${SITE}`]) {
    let r = await get('/site/acme/about?x=1', { host }); ok(r.status === 301, `${host} /site/acme/about?x=1 answered ${r.status}`);
    ok(sameLocation(r.headers.location, `https://acme.${SITE}/about?x=1`), `Location is ${r.headers.location}`);
    r = await get('/site/acme', { host }); ok(r.status === 301 && sameLocation(r.headers.location, `https://acme.${SITE}`), `${host} /site/acme -> ${r.status} ${r.headers.location}`);
  }
});
check('canon', '/site/<sub> on the address you are checking answers 301 to the vendor subdomain (works on a deployed main host; skipped when the base is not get4domain.com)', async () => {
  if (BASE.hostname !== SITE && BASE.hostname !== `www.${SITE}`) return;
  const r = await get('/site/zz-seo-check/about?x=1'); ok(r.status === 301, `answered ${r.status}`);
  ok(sameLocation(r.headers.location, `https://zz-seo-check.${SITE}/about?x=1`), `Location is ${r.headers.location}`);
});
check('canon', 'main host: reserved or invalid names are not redirected; a local host is untouched', async () => {
  for (const p of ['/site/www/x', '/site/api', '/site/Bad_Name/x']) { const r = await get(p, { host: SITE }); ok(r.status !== 301, `${p} was redirected`); }
  const r = await get('/site/acme', {}); ok(r.status !== 301, 'a local request to /site/acme was redirected');
});
check('canon', 'vendor host: /site/<same-sub>/path answers 301 to /path (no duplicate URL inside the vendor host)', async () => {
  const host = `acme.${SITE}`;
  const r = await get('/site/acme/about?x=1', { host }); ok(r.status === 301, `answered ${r.status}`);
  ok(pathOf(r.headers.location) === '/about?x=1', `Location is ${r.headers.location}`);
  const home = await get('/site/acme', { host }); ok(home.status === 301 && pathOf(home.headers.location) === '/', `home -> ${home.status} ${home.headers.location}`);
});
check('canon', 'vendorCanonical(): one self-canonical per vendor page', async () => {
  const ts = (await import('typescript')).default; const src = fs.readFileSync(path.join(ROOT, 'src/lib/site-canonical.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  const c = (sub, rest) => mod.vendorCanonical(sub, rest, SITE);
  const cases = [[['acme', []], 'https://acme.get4domain.com'], [['acme', ['home']], 'https://acme.get4domain.com'], [['acme', ['about']], 'https://acme.get4domain.com/about'],
    [['acme', ['p', 'terms']], 'https://acme.get4domain.com/p/terms'], [['Acme', ['about', '']], 'https://acme.get4domain.com/about'], [['acme', ['a b']], 'https://acme.get4domain.com/a%20b']];
  for (const [[sub, rest], want] of cases) ok(c(sub, rest) === want, `vendorCanonical(${sub}, [${rest}]) = ${c(sub, rest)}, wanted ${want}`);
});
check('canon', 'vendor page metadata uses vendorCanonical for every renderer (legacy and new, every path)', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/app/site/[subdomain]/[[...rest]]/page.tsx'), 'utf8');
  const meta = src.slice(src.indexOf('export async function generateMetadata'), src.indexOf('export default async function'));
  ok(/vendorCanonical\(/.test(meta), 'generateMetadata does not call vendorCanonical'); ok(!/rest\[0\] === 'p' && rest\[1\]/.test(meta), 'the old home-only canonical expression is still there');
  ok(!/site\.docV2 \? \{ alternates/.test(meta), 'the canonical is still only emitted for docV2 sites');
});
check('canon', 'marketing pages are self-canonical (the 17 pages and the 20 industries)', async () => {
  const bad = [];
  for (const p of [...STATIC_PAGES, ...INDUSTRIES.map((i) => `/industries/${i}`)]) {
    const r = await get(p); if (r.status !== 200) { bad.push(`${p} answered ${r.status}`); continue; }
    const want = `https://${SITE}${p === '/' ? '' : p}`; const c = canonical(r.body);
    if (!c || c.replace(/\/$/, '') !== want) bad.push(`${p}: canonical ${c}`);
  }
  ok(!bad.length, bad.slice(0, 5).join('; '));
});
check('canon', 'Get4Domain Organization, WebSite and SoftwareApplication structured data: once each on the home page, no offers, no SearchAction', async () => {
  const r = await get('/'); const blocks = jsonLd(r.body); const types = ldTypes(blocks);
  for (const t of ['Organization', 'WebSite', 'SoftwareApplication']) ok(types.filter((x) => x === t).length === 1, `${t} appears ${types.filter((x) => x === t).length} times on the home page`);
  ok(!/SearchAction|potentialAction/.test(JSON.stringify(blocks)), 'SearchAction is still present'); ok(!/"sameAs":\[\]/.test(JSON.stringify(blocks)), 'an empty sameAs is still emitted');
});
check('canon', 'Get4Domain structured data is on marketing pages only: none on /login, /visit-demo, a 404, or a vendor host', async () => {
  const probes = [['/login', undefined], ['/visit-demo', undefined], ['/zz-seo-check-not-found', undefined], ['/', `acme.${SITE}`], ['/site/acme', undefined]];
  for (const [p, host] of probes) {
    const r = await get(p, { host }); const text = JSON.stringify(jsonLd(r.body));
    ok(!/Get4Domain|KSM Quantum/.test(text), `${host ?? ''}${p} (status ${r.status}) carries Get4Domain structured data`);
  }
});
check('canon', 'the root layout no longer contains any structured data', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/app/layout.tsx'), 'utf8'); ok(!/application\/ld\+json/.test(src), 'src/app/layout.tsx still has a JSON-LD script');
});

// ─────────────────────────────────── robots ───────────────────────────────────────────────────────────────────────────────────────────────────
function robotsGroups(text) {
  const groups = []; let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(); if (!line) { continue; }
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) continue; const k = m[1].toLowerCase(); const v = m[2].trim();
    if (k === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v); }
    else if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push([k, v]);
  }
  return groups;
}
const robotsOf = async () => robotsGroups((await get('/robots.txt')).body);
check('robots', 'the * group (Googlebot) does not block /_next/ but keeps the private paths blocked', async () => {
  const g = (await robotsOf()).find((x) => x.agents.includes('*')); ok(g, 'no * group');
  const dis = g.rules.filter(([k]) => k === 'disallow').map(([, v]) => v);
  ok(!dis.includes('/_next/'), 'the * group still disallows /_next/ (Googlebot cannot load the CSS and JavaScript it needs to render pages)');
  for (const p of ['/dashboard/', '/admin/', '/customer/', '/api/', '/login', '/register']) ok(dis.includes(p), `the * group lost Disallow ${p}`);
});
check('robots', 'every AI-crawler rule is allowed on the site but disallowed on /admin/, /dashboard/, /app/ and /api/', async () => {
  const groups = await robotsOf(); const bad = [];
  for (const bot of AI_BOTS) {
    const g = groups.find((x) => x.agents.includes(bot)); if (!g) { bad.push(`${bot}: no group`); continue; }
    const dis = g.rules.filter(([k]) => k === 'disallow').map(([, v]) => v);
    for (const p of ['/admin/', '/dashboard/', '/app/', '/api/']) if (!dis.includes(p)) bad.push(`${bot}: no Disallow ${p}`);
    if (!g.rules.some(([k, v]) => k === 'allow' && v === '/')) bad.push(`${bot}: no Allow /`);
  }
  ok(!bad.length, bad.slice(0, 6).join('; '));
});
check('robots', 'robots.txt does not disallow /demo or /visit-demo (a blocked page can never show its noindex)', async () => {
  const dis = (await robotsOf()).flatMap((g) => g.rules.filter(([k]) => k === 'disallow').map(([, v]) => v));
  ok(!dis.some((v) => /^\/(demo|visit-demo)/.test(v)), `robots.txt disallows ${dis.filter((v) => /^\/(demo|visit-demo)/.test(v)).join(', ')}`);
});
check('robots', 'private and transactional pages send X-Robots-Tag noindex (a Disallow alone does not keep a URL out of the index)', async () => {
  const bad = [];
  for (const p of ['/login', '/register', '/dashboard', '/admin', '/customer', '/cart', '/order-success', '/offline', '/theme-local-test', '/admin-team/accept-invite', '/quote/x', '/d/x', '/theme-preview/x']) {
    const r = await get(p); if (!noindex(xrobots(r)) && !/noindex/i.test(metaNamed(r.body, 'robots') ?? '')) bad.push(`${p} (status ${r.status})`);
  }
  ok(!bad.length, `indexable: ${bad.join(', ')}`);
});
check('robots', 'the cart and the order-success page carry a noindex robots meta', async () => {
  for (const p of ['/cart', '/order-success']) { const r = await get(p); ok(/noindex/i.test(metaNamed(r.body, 'robots') ?? ''), `${p}: robots meta is "${metaNamed(r.body, 'robots')}"`); }
});
check('links', 'retired marketing addresses redirect permanently (308), not temporarily (307)', async () => {
  for (const p of ['/products', '/digital-growth']) { const r = await get(p); ok(r.status === 308, `${p} answered ${r.status}`); }
});
check('robots', 'robots.txt lists both sitemaps', async () => {
  const t = (await get('/robots.txt')).body; ok(/Sitemap:\s*https:\/\/get4domain\.com\/sitemap\.xml/i.test(t) && /sitemap-leadspace\.xml/i.test(t), 'a sitemap line is missing');
});

// ─────────────────────────────────── links ────────────────────────────────────────────────────────────────────────────────────────────────────
const hrefs = (html) => new Set([...html.matchAll(/<a\b[^>]*\bhref="([^"#?]+)/gi)].map((m) => m[1]));
check('links', 'every marketing page links to /how-it-works, /portfolio and /templates in its server HTML (footer)', async () => {
  const bad = [];
  for (const p of ['/', '/about', '/pricing', '/industries/clinic']) { const h = hrefs((await get(p)).body); for (const need of ['/how-it-works', '/portfolio', '/templates']) if (!h.has(need)) bad.push(`${p} → ${need}`); }
  ok(!bad.length, `missing inbound links: ${bad.join(', ')}`);
});
check('links', 'no orphan: every static page in the sitemap is linked from the home page HTML', async () => {
  const h = hrefs((await get('/')).body); const miss = STATIC_PAGES.filter((p) => p !== '/' && !h.has(p)); ok(!miss.length, `not linked from the home page: ${miss.join(', ')}`);
});
check('links', 'sitemap hygiene: no invented lastmod/priority/changefreq (a request-time date or a flat priority tells a crawler nothing)', async () => {
  const r = await get('/sitemap.xml'); const today = new Date().toISOString().slice(0, 10);
  ok(!/<priority>|<changefreq>/.test(r.body), 'sitemap still has priority/changefreq');
  ok(!r.body.includes('<lastmod>' + today), 'sitemap lastmod is today (the request time), not a real modification date');
});
/** every .ts/.tsx file under src, as [relative path, text] */
function sourceFiles(dir = path.join(ROOT, 'src')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sourceFiles(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [[path.relative(ROOT, path.join(dir, e.name)).replace(/\\/g, '/'), fs.readFileSync(path.join(dir, e.name), 'utf8')]] : []));
}
check('links', 'no internal link points at a retired address (/products, /digital-growth): they only redirect, so a link costs a hop and passes less to the target', async () => {
  const hits = [];
  for (const [file, text] of sourceFiles()) {
    if (file === 'next.config.ts') continue;
    for (const m of text.matchAll(/(?:href\s*[=:]\s*\{?\s*|path:\s*|push\(\s*|to=)["'`](\/(?:products|digital-growth))(?:["'`/?#])/g)) hits.push(file + ' -> ' + m[1]);
  }
  ok(!hits.length, 'links to a retired address: ' + hits.slice(0, 6).join(', '));
});
check('links', 'createPageMetadata requires its path argument (type) and refuses an empty or relative one (runtime)', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/metadata.ts'), 'utf8');
  ok(/\n\s*path: string;/.test(src) && !/path\?:/.test(src), 'path is still optional in PageMetadataOptions'); ok(!/path = ''/.test(src), 'path still defaults to the home page');
  ok(/throw new Error/.test(src) && /startsWith\('\/'\)/.test(src), 'no runtime guard for an empty or non-absolute path');
  ok(!/keywords/.test(src), 'the keywords fallback is still in the metadata helper');
});

// ─────────────────────────────────── routes (every public route, one table) ───────────────────────────────────────────────────────────────────
/** Words and prices that must not be in anything a crawler reads from the head of a page, its structured data, llms.txt or the sitemaps. (Page body copy is outside this task: owner decision, plan section 5.) */
const BANNED = /Workspace|\bBOS\b|LeadSpace|Identity Partner|Online Identity|Business Operating System/i;
const PRICE = /₹\s?\d|\bRs\.?\s?\d|\bINR\s?\d|\b\d[\d,]*\s?\/\s?(?:mo|month|yr|year)\b|"price"|"priceCurrency"|"Offer"|"offers"/i;
const PUBLIC_ROUTES = [...STATIC_PAGES, ...INDUSTRIES.map((i) => `/industries/${i}`)];
const EXPECTED_LD = { '/': ['Organization', 'WebSite', 'SoftwareApplication'] };
const rows = [];
async function auditRoute(p) {
  const r = await get(p); const row = { route: p, status: r.status, title: '-', desc: '-', canon: '-', robots: '-', ld: '-', words: '-', problems: [] };
  rows.push(row);
  if (r.status !== 200) { row.problems.push('status ' + r.status); return row; }
  const titles = [...r.body.matchAll(/<title[^>]*>/gi)].length; const t = title(r.body) ?? '';
  const descs = tags(r.body, 'meta').filter((a) => a.name?.toLowerCase() === 'description');
  const d = descs[0]?.content ?? '';
  row.title = String(t.length); row.desc = String(d.length);
  if (titles !== 1) row.problems.push(titles + ' <title> tags');
  if (!t || t.length > 60) row.problems.push('title length ' + t.length + ' (1..60)');
  if (descs.length !== 1) row.problems.push(descs.length + ' description tags');
  if (d.length < 50 || d.length > 160) row.problems.push('description length ' + d.length + ' (50..160)');
  const want = 'https://' + SITE + (p === '/' ? '' : p); const c = canonical(r.body); row.canon = c && c.replace(/\/$/, '') === want ? 'self' : 'BAD';
  if (row.canon === 'BAD') row.problems.push('canonical ' + c + ' (wanted ' + want + ')');
  const rb = (metaNamed(r.body, 'robots') ?? '') + ' ' + xrobots(r); row.robots = noindex(rb) ? 'NOINDEX' : 'index';
  if (row.robots === 'NOINDEX') row.problems.push('a public page is noindex');
  const ld = jsonLd(r.body); const unparsable = ld.filter((b) => b.__unparsable); const types = ldTypes(ld);
  row.ld = unparsable.length ? 'BAD' : ld.length + ' ok'; if (unparsable.length) row.problems.push('JSON-LD does not parse');
  for (const need of EXPECTED_LD[p] ?? []) if (!types.includes(need)) row.problems.push('JSON-LD lacks ' + need);
  if (p.startsWith('/industries/') && !types.includes('Service')) row.problems.push('JSON-LD lacks Service');
  if (metaNamed(r.body, 'keywords') !== undefined) row.problems.push('has a keywords meta tag');
  const strings = metaStrings(r.body); const hit = strings.filter((x) => BANNED.test(x) || PRICE.test(x)); row.words = hit.length ? 'BAD' : 'clean';
  if (hit.length) row.problems.push('banned word or price in head/JSON-LD: ' + hit.map((h) => h.slice(0, 90)).slice(0, 2).join(' | '));
  return row;
}
for (const p of PUBLIC_ROUTES) check('routes', 'public route ' + p + ': one title and description of sane length, self canonical, indexable, JSON-LD valid, no banned word or price', async () => {
  const row = await auditRoute(p); ok(!row.problems.length, row.problems.join('; '));
});
check('routes', 'llms.txt, sitemap.xml and robots.txt text: no banned word or price', async () => {
  const bad = [];
  for (const f of ['/llms.txt', '/sitemap.xml', '/robots.txt']) { const r = await get(f); const lines = r.body.split('\n').filter((l) => !/^\s*(<loc>|Sitemap:|Allow:|Disallow:)/i.test(l) && (BANNED.test(l) || PRICE.test(l))); if (lines.length) bad.push(f + ': ' + lines[0].slice(0, 100)); }
  ok(!bad.length, bad.join('; '));
});
check('routes', '/talk-to-sales (a post-demo page, not in the sitemap) stays noindex', async () => {
  const r = await get('/talk-to-sales'); ok(r.status === 200 && /noindex/i.test(metaNamed(r.body, 'robots') ?? ''), `status ${r.status}, robots "${metaNamed(r.body, 'robots')}"`);
});
check('routes', 'sitemap lists only indexable URLs: every listed page answers 200 and is not noindex', async () => {
  const r = await get('/sitemap.xml'); const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(decode(m[1])).pathname); const bad = [];
  for (const p of locs) { const x = await get(p); if (x.status !== 200 || noindex(xrobots(x) + ' ' + (metaNamed(x.body, 'robots') ?? ''))) bad.push(p + ' (' + x.status + ')'); }
  ok(!bad.length, 'not indexable: ' + bad.slice(0, 5).join(', '));
});
function printTable() {
  if (!rows.length) return;
  const cols = ['route', 'status', 'title', 'desc', 'canon', 'robots', 'ld', 'words']; const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
  const line = (r) => cols.map((c, i) => String(r[c]).padEnd(w[i])).join('  ');
  console.log('\n' + line(Object.fromEntries(cols.map((c) => [c, c])))); console.log(w.map((n) => '-'.repeat(n)).join('  '));
  for (const r of rows) console.log(line(r) + (r.problems.length ? '   <-- FAIL' : ''));
}

// ─────────────────────────────────── run ──────────────────────────────────────────────────────────────────────────────────────────────────────
const wanted = checks.filter((c) => (GROUPS.includes('all') || GROUPS.includes(c.group)) && !(REMOTE && LOCAL_ONLY.test(c.name)));
const skipped = checks.filter((c) => (GROUPS.includes('all') || GROUPS.includes(c.group)) && REMOTE && LOCAL_ONLY.test(c.name));
if (!wanted.length) { console.error(`no checks for group(s): ${GROUPS.join(',')}`); process.exit(2); }
try { const probe = await get('/robots.txt'); if (!probe.status) throw new Error('no answer'); }
catch (e) { console.error(`cannot reach ${BASE.origin}: ${e.message}. Start the local frontend first (next start).`); process.exit(2); }

let failed = 0;
for (const c of wanted) {
  try { await c.fn(); console.log(`PASS  [${c.group}] ${c.name}`); }
  catch (e) { failed++; console.log(`FAIL  [${c.group}] ${c.name}\n        ${String(e.message).replace(/\n/g, ' ').slice(0, VERBOSE ? 2000 : 420)}`); }
}
printTable();
for (const c of skipped) console.log(`SKIP  [${c.group}] ${c.name}  (needs the source tree, a Host header or the demo secret: local build only)`);
console.log(`\n${wanted.length - failed} passed, ${failed} failed${skipped.length ? `, ${skipped.length} skipped` : ''} (${wanted.length} checks, groups: ${GROUPS.join(',')}) against ${BASE.origin}`);
process.exit(failed ? 1 : 0);
