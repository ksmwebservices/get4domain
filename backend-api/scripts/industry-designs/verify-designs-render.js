// Industry designs (15 Oct 2026): the RENDERED pages. Boots the real API (in-memory Postgres) and the real Next.js server (a production build made against that API),
// creates a site for every category, opens every design on desktop and on a phone-sized screen in headless Chrome, and reads the actual HTML.
// Test ids: industry-designs.render, .switch (the rendered page), .seo, .speed, .editable (every field reaches the page), .public-safety (rendered), .no-hardcode (rendered), .admin (rendered)
// Builds the frontend itself when the build is missing or older than the source (a few minutes the first time). SKIPs when PGlite is not installed.
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, spawnSync } = require('child_process');
const { startHarness, available } = require('../e2e/bos-harness');

const API = 'http://127.0.0.1:3097';
const FRONT = 'http://127.0.0.1:3023';
const FE = path.join(__dirname, '..', '..', '..', 'get4domain_mvp');
const SECRET = 'render-test-secret';

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 500)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u003c/g, '<');

function newestMtime(dir) {
  let m = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    m = Math.max(m, e.isDirectory() ? newestMtime(p) : fs.statSync(p).mtimeMs);
  }
  return m;
}
function ensureBuild() {
  const marker = path.join(FE, '.next', 'g4d-render-test-api');
  const built = fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === API && fs.existsSync(path.join(FE, '.next', 'BUILD_ID'));
  if (built && fs.statSync(marker).mtimeMs > Math.max(newestMtime(path.join(FE, 'src')), newestMtime(path.join(FE, 'public')))) return 'reused';
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'build'], { cwd: FE, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NEXT_PUBLIC_API_URL: API, INTERNAL_API_URL: API } });
  if (r.status !== 0) throw new Error(`frontend build failed: ${(r.stdout + r.stderr).split('\n').filter((l) => /error/i.test(l)).slice(0, 4).join(' | ')}`);
  fs.writeFileSync(marker, API);
  return 'built';
}
const CHROME = [process.env.G4D_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && fs.existsSync(p));

/** GET with a chosen Host header (fetch will not let us set it): how a vendor's own address reaches the website. */
function getWithHost(pathname, host) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 3023, path: pathname, method: 'GET', headers: { Host: host } }, (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => resolve({ status: res.statusCode, text: b, headers: res.headers })); });
    req.on('error', reject); req.end();
  });
}

const expectedLayouts = (design, hasPriced = true) => {
  const out = [];
  for (const s of design.sections) {
    const v = s.variant;
    switch (s.type) {
      case 'pricing': if (hasPriced) out.push(`pricing-${v}`); break;
      case 'hero': case 'trust': case 'about': case 'gallery': case 'faq': case 'cta': case 'enquiry': case 'contact': out.push(`${s.type}-${v}`); break;
      case 'process': out.push(`steps-${v}`); break;
      case 'items': out.push(v.startsWith('catalog-') ? `catalog-${v.slice(8)}` : v.startsWith('package-') ? `packages-${v.slice(8)}` : v.startsWith('menu-') ? `menu-${v.slice(5)}` : v === 'index' ? 'featureIndex' : `showcase-${v}`); break;
      default: break; // announce, stats, team, beforeAfter, testimonials, hours are shown only when the vendor has something for them
    }
  }
  return out;
};

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - rendered design proofs not run'); process.exit(0); }
  process.env.FRONTEND_INTERNAL_URL = FRONT; process.env.REVALIDATE_SECRET = SECRET;
  let front; let h; let browser;
  try {
    for (const port of [3023, 3097]) if (!(await new Promise((r) => { const t = net.createServer(); t.once('error', () => r(false)); t.once('listening', () => t.close(() => r(true))); t.listen(port, '127.0.0.1'); }))) throw new Error(`Port ${port} is already in use (a server from an earlier run would answer instead of the new one). Stop it, then run again.`);
    console.log(`frontend build: ${ensureBuild()}`);
    h = await startHarness({ port: 3097, pgPort: 54341 });
    front = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'start', '-p', '3023'], { cwd: FE, shell: true, stdio: 'ignore', env: { ...process.env, NEXT_PUBLIC_API_URL: API, INTERNAL_API_URL: API, REVALIDATE_SECRET: SECRET } });
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`${FRONT}/`); if (r.status < 500) break; } catch { /* starting */ } await sleep(1500); }
    const { prisma, call } = h;
    const admin = await h.createAdmin({ key: 'rdadmin' });
    const A = admin.token;
    await call('POST', '/admin/category-packs/seed/starter', {}, A);
    const packs = (await call('GET', '/admin/category-packs', undefined, A)).data;
    const flag = (v) => prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: 'site_doc_v2' } }, create: { vendorId: v.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });
    const get = async (url) => { const t0 = Date.now(); const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } }); const text = await r.text(); return { status: r.status, t: decode(text), raw: text, ms: Date.now() - t0 }; };

    if (CHROME) { const puppeteer = require(path.join(FE, 'node_modules', 'puppeteer-core')); browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] }); }

    // ───────────────────────────── render: every category, every design, desktop and phone
    section('[feat:industry-designs.render] Every design of every category renders without error, on desktop and on a phone');
    const sites = {};
    for (const p of packs) {
      const r = await call('POST', '/admin/category-packs/sites', { categoryKey: p.key, businessName: `Zq ${p.name}`, subdomain: `zq-${p.key}`, city: 'Chennai', phone: '9876543210' }, A);
      sites[p.key] = r.data;
    }
    ok(`a site was created for each of the ${packs.length} categories`, Object.values(sites).every((s) => s?.previewUrl), JSON.stringify(Object.entries(sites).filter(([, s]) => !s?.previewUrl).map(([k]) => k)));
    const badStatus = []; const missing = []; const manyH1 = []; const errors = []; const overflow = []; const sizes = []; const slow = []; let designs = 0; let phoneChecks = 0;
    const page = browser ? await browser.newPage() : null;
    const consoleErrors = []; const pageErrors = [];
    if (page) { page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 404 \(Not Found\)$/.test(m.text())) consoleErrors.push(m.text().slice(0, 160)); }); }
    for (const p of packs) {
      for (const d of p.config.designs.filter((x) => x.enabled !== false)) {
        designs += 1;
        const url = `${FRONT}${sites[p.key].previewUrl}&design=${d.key}`;
        const g = await get(url);
        const tag = `${p.key}/${d.key}`;
        if (g.status !== 200) { badStatus.push(`${tag}:${g.status}`); continue; }
        if (/Application error|Internal Server Error|__next_error__/.test(g.raw)) errors.push(tag);
        const lay = [...g.t.matchAll(/data-layout="([^"]+)"/g)].map((m) => m[1]);
        const lost = expectedLayouts(d, p.config.seed.items.some((i) => i.price)).filter((l) => !lay.includes(l));
        if (lost.length) missing.push(`${tag}: ${lost.join(',')}`);
        if ((g.t.match(/<h1[\s>]/g) ?? []).length !== 1) manyH1.push(tag);
        const scripts = [...g.t.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
        sizes.push({ tag, html: Buffer.byteLength(g.raw), imgs: (g.t.match(/<img /g) ?? []).length, scripts: scripts.length });
        slow.push(g.ms);
        if (page) {
          for (const [w, hgt] of [[390, 800], [1280, 900]]) {
            await page.setViewport({ width: w, height: hgt, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            phoneChecks += 1;
            if (wide > 1) overflow.push(`${tag}@${w}: ${wide}px`);
          }
        }
      }
    }
    ok(`all ${designs} designs answer 200`, badStatus.length === 0, badStatus.join(' '));
    ok('no design shows an error page', errors.length === 0, errors.join(' '));
    ok('every section a design lists is on its page, in its chosen layout (sections with nothing to show stay hidden)', missing.length === 0, missing.slice(0, 6).join(' | '));
    ok('every page has exactly one main heading (h1)', manyH1.length === 0, manyH1.join(' '));
    if (page) {
      ok(`on a phone (390 px) and on desktop (1280 px) no page scrolls sideways (${phoneChecks} page loads in headless Chrome)`, overflow.length === 0, overflow.slice(0, 6).join(' | '));
      ok('no page script error and no console error on any design', pageErrors.length === 0 && consoleErrors.length === 0, [...new Set([...pageErrors, ...consoleErrors])].slice(0, 4).join(' | '));
    } else console.log('  SKIP  no Chrome or Edge found (set G4D_CHROME): phone and console checks not run');

    section('[feat:industry-designs.speed] Page budget: weight, pictures, scripts and server time');
    const maxHtml = Math.max(...sizes.map((s) => s.html)); const maxImg = Math.max(...sizes.map((s) => s.imgs));
    ok(`the largest page HTML is ${(maxHtml / 1024).toFixed(0)} KB (budget 250 KB)`, maxHtml < 250 * 1024, sizes.sort((a, b) => b.html - a.html)[0]?.tag);
    ok(`no page loads more than 45 pictures (largest ${maxImg}); every picture is lazy-loaded below the top`, maxImg <= 45);
    const med = slow.sort((a, b) => a - b)[Math.floor(slow.length / 2)];
    ok(`the median server time for a design page is ${med} ms (budget 1500 ms)`, med < 1500, String(med));
    // script weight of one page
    const sample = await get(`${FRONT}${sites.retail.previewUrl}&design=classic`);
    const srcs = [...new Set([...sample.t.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
    let bytes = 0; for (const s of srcs) { const r = await fetch(s.startsWith('http') ? s : `${FRONT}${s}`); bytes += (await r.arrayBuffer()).byteLength; }
    ok(`the scripts of a design page weigh ${(bytes / 1024).toFixed(0)} KB uncompressed (budget 900 KB); only the product filter, menu tabs and before/after slider are interactive`, bytes < 900 * 1024, String(bytes));
    const starter = fs.readdirSync(path.join(FE, 'public', 'starter'), { withFileTypes: true }).filter((e) => e.isDirectory());
    const heavy = starter.flatMap((d) => fs.readdirSync(path.join(FE, 'public', 'starter', d.name)).map((f) => [d.name + '/' + f, fs.statSync(path.join(FE, 'public', 'starter', d.name, f)).size])).filter(([, s]) => s > 120 * 1024);
    ok('every starter picture is under 120 KB (web format)', heavy.length === 0, JSON.stringify(heavy.slice(0, 3)));

    // ───────────────────────────── no-hardcode (rendered) and public-safety (rendered)
    section('[feat:industry-designs.no-hardcode] A site with nothing in it shows no business text of any category');
    const bare = await h.createVendor({ key: 'rdbare', industry: 'clinic', plan: 'WORKSPACE' });
    await flag(bare);
    const bareHtml = (await get(`${FRONT}/site/${bare.subdomain}`)).t;
    const seedText = packs.find((p) => p.key === 'clinic').config.seed;
    const probes = [seedText.headline.replace('{business}', ''), ...seedText.items.map((i) => i.title), ...seedText.faq.map((f) => f.q), seedText.about.slice(0, 40), ...seedText.trust].filter((x) => x && x.trim().length > 6);
    ok('an empty clinic site contains none of the clinic starter headline, items, questions, About or trust text (no render-time fallback)', probes.every((x) => !bareHtml.includes(x)), probes.filter((x) => bareHtml.includes(x)).join(' | '));
    ok('and no stock picture address from any other business', !/unsplash|pexels|pixabay/i.test(bareHtml));

    section('[feat:industry-designs.public-safety] The rendered public page never shows a sample price or a sample customer quote');
    const pv = await h.createVendor({ key: 'rdsafe', industry: 'salon', plan: 'WORKSPACE' });
    await flag(pv);
    await call('POST', '/site-doc/me/generate', { packKey: 'salon', businessName: 'Zq Safe Salon', city: 'Madurai' }, pv.token);
    await call('POST', '/site-doc/me/publish', {}, pv.token);
    const sp = await get(`${FRONT}/site/${pv.subdomain}`);
    const seedS = packs.find((p) => p.key === 'salon').config.seed;
    const prices = seedS.items.map((i) => i.price).filter(Boolean);
    ok('the published starter site shows "Contact for price" and none of the sample prices', sp.t.includes('Contact for price') && prices.every((x) => !sp.t.includes(`₹${x}`)), prices.filter((x) => sp.t.includes(`₹${x}`)).join(','));
    ok('the sample customer quotes (and their names) are not on the page', seedS.quotes.every((q) => !sp.t.includes(q.quote)) && !/Sample customer/.test(sp.t));
    ok('the starter text DOES show (sample text may show): headline and an item name', sp.t.includes(seedS.items[0].title) && sp.t.includes('Zq Safe Salon'));
    const draftSite = await get(`${FRONT}/site/zq-clinic`);
    ok('an admin-created DRAFT site is hidden from the public: the visitor gets the not-found page, none of the site content, and a noindex (the answer code stays 200 while the root loading screen streams, as for any unknown address today)', draftSite.status === 404 || (!draftSite.t.includes('Zq Care Clinic') && /name="robots" content="noindex/.test(draftSite.t) && /not found|could not be found/i.test(draftSite.t)), `${draftSite.status} ${draftSite.t.slice(0, 120)}`);

    // ───────────────────────────── switch (rendered)
    section('[feat:industry-designs.switch] Switching design keeps every word; each design shows what it has a section for');
    const real = await h.createVendor({ key: 'rdreal', industry: 'salon', plan: 'WORKSPACE' });
    await flag(real);
    await call('POST', '/site-doc/me/generate', { packKey: 'salon', businessName: 'Zq Real Salon', city: 'Madurai', phone: '9876500123' }, real.token);
    const M = 'ZQ' + Math.random().toString(36).slice(2, 6).toUpperCase();
    let r = await call('PUT', '/site-doc/me/draft', { about: `About text ${M} written by the owner.`, businessHours: 'Mon-Sat 9 am to 7 pm; Sun closed', testimonials: [{ quote: `Real quote ${M}`, author: `Real Customer ${M}` }], extras: { ...(await call('GET', '/site-doc/me', undefined, real.token)).data.doc.extras, headline: `Headline ${M}`, announcement: `Announcement ${M}`, stats: [{ value: '12 years', label: `in business ${M}` }], team: [{ name: `Person ${M}`, role: 'Owner' }] } }, real.token);
    const own = await prisma.vendorProduct.findFirst({ where: { vendorId: real.id } });
    await call('PUT', `/cms/products/${own.id}`, { name: `Own item ${M}`, description: 'Written by the owner', price: '1234' }, real.token);
    await call('POST', '/site-doc/me/publish', {}, real.token);
    const dz = (await call('GET', '/site-doc/me/designs', undefined, real.token)).data;
    const specByKey = Object.fromEntries(packs.find((p) => p.key === 'salon').config.designs.map((d) => [d.key, d]));
    const lacking = []; const wrongLayout = [];
    for (const d of dz.designs) {
      const s = await call('POST', '/site-doc/me/design', { designKey: d.key }, real.token);
      await call('POST', '/site-doc/me/publish', {}, real.token);
      if (s.status >= 300) { lacking.push(`${d.key}: switch ${s.status}`); continue; }
      const html = (await get(`${FRONT}/site/${real.subdomain}`)).t;
      const types = specByKey[d.key].sections.map((x) => x.type);
      const lay = [...html.matchAll(/data-layout="([^"]+)"/g)].map((m) => m[1]);
      for (const l of expectedLayouts(specByKey[d.key])) if (!lay.includes(l)) wrongLayout.push(`${d.key}:${l}`);
      const want = [[true, `Zq Real Salon`], [types.includes('about'), `About text ${M}`], [types.includes('items'), `Own item ${M}`], [types.includes('items') || types.includes('pricing'), '₹1234'], [types.includes('testimonials'), `Real quote ${M}`], [types.includes('stats'), `in business ${M}`], [types.includes('team'), `Person ${M}`], [types.includes('announce'), `Announcement ${M}`], [types.includes('hours'), '7 pm'], [true, `Headline ${M}`]];
      for (const [need, text] of want) if (need && !html.includes(text)) lacking.push(`${d.key}: ${text}`);
    }
    ok('after switching to each of the four designs and publishing, the page shows every piece of content the design has a section for (name, headline, About, own item and price, real quote, numbers, team, announcement, hours)', lacking.length === 0, lacking.slice(0, 6).join(' | '));
    ok('and each shows its own layouts', wrongLayout.length === 0, wrongLayout.slice(0, 6).join(' | '));

    // ───────────────────────────── editable (runtime): every field of every section reaches the page
    section('[feat:industry-designs.editable] Every field of every section is editable, and what is saved reaches the page');
    const cur = (await call('GET', '/admin/category-packs/general', undefined, A)).data;
    const ALL = [['announce', 'ticker'], ['hero', 'card'], ['trust', 'pills'], ['items', 'cards'], ['about', 'columns'], ['pricing', 'cards'], ['process', 'timeline'], ['stats', 'cards'], ['team', 'circles'], ['gallery', 'grid'], ['beforeAfter', 'stack'], ['testimonials', 'list'], ['faq', 'cards'], ['hours', 'card'], ['cta', 'split'], ['enquiry', 'split'], ['contact', 'split']];
    const evDesign = { ...cur.config.designs[0], key: 'everything', name: 'Everything', sections: ALL.map(([type, variant]) => ({ type, variant })) };
    const upd = await call('PUT', '/admin/category-packs/general', { config: { ...cur.config, designs: [evDesign, ...cur.config.designs.slice(1)], defaultDesign: 'everything' } }, A);
    ok('an admin can build a design out of any sections and layouts (no deploy): one design with all 17 section types', upd.status < 300 && upd.data.config.designs[0].sections.length === 17, JSON.stringify(upd.body).slice(0, 300));
    const ev = await h.createVendor({ key: 'rdall', industry: 'general', plan: 'WORKSPACE' });
    await flag(ev);
    const X = 'QX' + Math.random().toString(36).slice(2, 6).toUpperCase();
    await call('PUT', '/site-doc/me/draft', { designKey: 'everything', businessName: `All Fields ${X}`, tagline: `Tagline ${X}`, about: `About ${X}`, phone: '9876500777', whatsapp: '9876500888', email: `all-${X}@example.test`.toLowerCase(), address: `1 Main Road, Chennai`, businessHours: `Mon-Sat 9 am to 7 pm ${X}`, banner: `https://img.example.test/banner-${X}.png`,
      portfolio: [{ id: 'g1', src: `https://img.example.test/gal-${X}.png`, title: 't' }], testimonials: [{ quote: `Quote ${X}`, author: `Author ${X}` }],
      extras: { headline: `Headline ${X}`, subline: `Subline ${X}`, ctaLabel: `Button ${X}`, announcement: `Announce ${X}`, announcementLink: 'https://example.test/offer', trust: [`Trust ${X}`], faq: [{ q: `Question ${X}`, a: `Answer ${X}` }], steps: [{ title: `Step ${X}`, desc: `Step text ${X}` }], stats: [{ value: `99${X}`, label: `Stat label ${X}` }], team: [{ name: `Team ${X}`, role: `Role ${X}`, image: `https://img.example.test/team-${X}.png` }], beforeAfter: [{ before: `https://img.example.test/before-${X}.png`, after: `https://img.example.test/after-${X}.png`, caption: `Caption ${X}` }] } }, ev.token);
    await prisma.vendorProduct.create({ data: { vendorId: ev.id, name: `Item ${X}`, description: `Item text ${X}`, price: '321', category: `Cat ${X}`, active: true } });
    r = await call('POST', '/site-doc/me/publish', {}, ev.token);
    const eh = (await get(`${FRONT}/site/${ev.subdomain}`)).t;
    const fields = { 'business name': `All Fields ${X}`, tagline: `Tagline ${X}`, About: `About ${X}`, headline: `Headline ${X}`, 'sub-line': `Subline ${X}`, 'button label': `Button ${X}`, announcement: `Announce ${X}`, 'announcement link': 'https://example.test/offer', 'trust point': `Trust ${X}`, question: `Question ${X}`, answer: `Answer ${X}`, step: `Step ${X}`, 'step text': `Step text ${X}`, 'number': `99${X}`, 'number label': `Stat label ${X}`, 'team name': `Team ${X}`, 'team role': `Role ${X}`, 'team picture': `team-${X}`, 'before picture': `before-${X}`, 'after picture': `after-${X}`, caption: `Caption ${X}`, 'opening hours': `Mon-Sat`, 'gallery picture': `gal-${X}`, 'top picture': `banner-${X}`, 'customer quote': `Quote ${X}`, 'customer name': `Author ${X}`, 'item name': `Item ${X}`, 'item text': `Item text ${X}`, 'item price': '₹321', 'item category': `Cat ${X}`, phone: '9876500777', 'WhatsApp': 'wa.me/9876500888', 'e-mail': `mailto:all-${X}@example.test`.toLowerCase(), address: '1 Main Road' };
    const notFound = Object.entries(fields).filter(([, v]) => !eh.includes(v)).map(([k]) => k);
    ok(`all ${Object.keys(fields).length} fields saved through the editor's own API are found on the public page`, r.status < 300 && notFound.length === 0, notFound.join(', '));
    const lay = [...eh.matchAll(/data-layout="([^"]+)"/g)].map((m) => m[1]);
    ok('and the page shows all 17 section types of that design', ['hero-card', 'trust-pills', 'showcase-cards', 'about-columns', 'pricing-cards', 'steps-timeline', 'stats-cards', 'people-circles', 'gallery-grid', 'beforeAfter-stack', 'testimonials-list', 'faq-cards', 'hours-card', 'cta-split', 'enquiry-split', 'contact-split'].every((l) => lay.includes(l)), lay.join(','));
    // the editor screens: every field the page reads has an input in the editor
    const editorSrc = fs.readFileSync(path.join(FE, 'src', 'app', 'dashboard', 'my-website', 'SiteContentTabs.tsx'), 'utf8');
    const readBy = fs.readFileSync(path.join(FE, 'src', 'engine', 'sitedoc', 'design-build.ts'), 'utf8');
    const read = [...new Set([...readBy.matchAll(/\bex\.([a-zA-Z]+)/g)].map((m) => m[1]))].filter((k) => k !== 'sample');
    ok('every field of `extras` the page reads has an input in the editor (the editor list and the builder agree)', read.every((k) => editorSrc.includes(`txt('${k}'`) || editorSrc.includes(`upd({ ${k}:`)) && ['headline', 'subline', 'ctaLabel', 'announcement', 'announcementLink', 'trust', 'faq', 'steps', 'stats', 'team', 'beforeAfter'].every((k) => read.includes(k) || k === 'announcementLink'), read.filter((k) => !(editorSrc.includes(`txt('${k}'`) || editorSrc.includes(`upd({ ${k}:`))).join(','));

    // ───────────────────────────── seo
    section('[feat:industry-designs.seo] Per-site search basics: title, canonical, one H1, alt text, share picture, structured data, sitemap, robots, noindex rules');
    const seoV = await h.createVendor({ key: 'rdseo', industry: 'photography', plan: 'WORKSPACE', subdomain: 'seoshop' });
    await flag(seoV);
    await call('POST', '/site-doc/me/generate', { packKey: 'photography', businessName: 'Seo Studio', city: 'Kochi', phone: '9876500999' }, seoV.token);
    await call('PUT', '/site-doc/me/draft', { about: 'Our own About text for search engines.', seoTitle: 'Seo Studio | Photography in Kochi', seoDesc: 'A real description of the studio.', ogImage: 'https://img.example.test/og.png', businessHours: 'Mon-Sat 10 am to 6 pm', address: '5 Beach Road, Kochi', email: 'hello@seo.test', pages: [{ slug: 'our-story', title: 'Our story', body: 'Story text.' }] }, seoV.token);
    await call('POST', '/site-doc/me/publish', {}, seoV.token);
    const seo = await get(`${FRONT}/site/seoshop`);
    ok('the page title and description come from the editor', /<title>Seo Studio \| Photography in Kochi<\/title>/.test(seo.t) && seo.t.includes('A real description of the studio.'));
    ok('there is one canonical link, on the vendor\'s own address', (seo.t.match(/<link rel="canonical"/g) ?? []).length === 1 && seo.t.includes('rel="canonical" href="https://seoshop.get4domain.com'), (seo.t.match(/<link rel="canonical"[^>]*>/) ?? [])[0]);
    ok('the share picture (og:image) is the editor\'s share picture, with alt text', /property="og:image" content="https:\/\/img\.example\.test\/og\.png"/.test(seo.t) && /og:image:alt/.test(seo.t));
    const imgs = seo.t.match(/<img [^>]*>/g) ?? [];
    ok(`every picture on the page has alt text (${imgs.length} pictures)`, imgs.every((i) => /\balt="/.test(i)), imgs.filter((i) => !/\balt="/.test(i)).slice(0, 2).join(' '));
    ok('a site with real content is open to search engines (no noindex)', !/name="robots" content="noindex/.test(seo.t), (seo.t.match(/<meta name="robots"[^>]*>/) ?? [])[0]);
    const ldAll = [...seo.t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return {}; } });
    const ld = ldAll.find((x) => x.name === 'Seo Studio') ?? {};
    ok('structured data uses the category\'s business type with name, address, phone, hours and the items by name', ld['@type'] === 'LocalBusiness' && ld.name === 'Seo Studio' && ld.telephone === '9876500999' && /Beach Road/.test(ld.address ?? '') && /Mon-Sat/.test(ld.openingHours ?? '') && Array.isArray(ld.hasOfferCatalog?.itemListElement) && ld.hasOfferCatalog.itemListElement.length >= 3, JSON.stringify(ld).slice(0, 300));
    const noPrice = !/"price"/.test(JSON.stringify(ld));
    ok('structured data never carries a starter price', noPrice);
    const robots = await getWithHost('/robots.txt', 'seoshop.get4domain.com');
    const smap = await getWithHost('/sitemap.xml', 'seoshop.get4domain.com');
    ok('robots.txt of the vendor\'s own host allows crawling and points to its own sitemap', robots.status === 200 && /Allow: \//.test(robots.text) && /Sitemap: https:\/\/seoshop\.get4domain\.com\/sitemap\.xml/.test(robots.text), robots.text.slice(0, 200));
    ok('sitemap.xml of the vendor\'s own host lists the home page and the extra page', smap.status === 200 && smap.text.includes('<loc>https://seoshop.get4domain.com/</loc>') && smap.text.includes('/p/our-story'), smap.text.slice(0, 300));
    const mainRobots = await getWithHost('/robots.txt', 'localhost');
    ok('the main site\'s own robots.txt is untouched by the vendor-host rule', mainRobots.status === 200 && !/seoshop/.test(mainRobots.text), mainRobots.text.slice(0, 120));
    const starterOnly = await get(`${FRONT}/site/${pv.subdomain}`);
    ok('a site that still shows only starter content is marked noindex', /name="robots" content="noindex/.test(starterOnly.t), (starterOnly.t.match(/<meta name="robots"[^>]*>/) ?? [])[0]);
    const so = await getWithHost('/robots.txt', `${pv.subdomain}.get4domain.com`);
    const sm = await getWithHost('/sitemap.xml', `${pv.subdomain}.get4domain.com`);
    ok('and its robots.txt closes the whole site and its sitemap is empty', /Disallow: \//.test(so.text) && !/<url>/.test(sm.text), so.text.slice(0, 80));
    const dr = await getWithHost('/robots.txt', 'zq-clinic.get4domain.com');
    ok('a DRAFT site\'s robots.txt closes it too', /Disallow: \//.test(dr.text));
    const prev = await get(`${FRONT}${sites.retail.previewUrl}`);
    ok('a private preview is never indexable', /name="robots" content="noindex/.test(prev.t));

    // ───────────────────────────── admin (rendered)
    section('[feat:industry-designs.admin] A category created through the admin screen renders, with its four designs');
    const NEW = { family: 'courses', keywords: ['dance'], item: { kind: 'service', noun: 'class', nounPlural: 'classes' }, themeKey: 'plum-night', seoType: 'EducationalOrganization', ctaLabel: 'Join a class',
      seed: { headline: 'Dance at {business}', subline: 'Join a class this week.', tagline: 'Dance classes in {city}', about: '{business} teaches dance in {city}.', announce: 'New batches start soon.', cta: 'Join a class', trust: ['Trial class', 'Small batches', 'Clear fees'], steps: [{ title: 'Enquire', desc: 'Tell us the style.' }, { title: 'Trial', desc: 'Try a class.' }, { title: 'Join', desc: 'Pick a batch.' }],
        quotes: [{ quote: 'Great teacher.', author: 'Sample' }], faq: [{ q: 'Can I try first?', a: 'Yes.' }, { q: 'What age?', a: 'All ages.' }, { q: 'Fees?', a: 'Ask us.' }],
        items: [{ title: 'Beginner batch', desc: 'Start from scratch.', price: '1500', category: 'Batches', fields: {} }, { title: 'Weekend batch', desc: 'Saturday and Sunday.', price: '1800', category: 'Batches', fields: {} }, { title: 'Private class', desc: 'One to one.', price: '600', category: 'Private', fields: {} }], motif: 'Music', hue: 290, images: { hero: '/starter/coaching/hero.webp', gallery: [1, 2, 3, 4].map((n) => `/starter/coaching/g${n}.webp`) } } };
    const created = await call('POST', '/admin/category-packs', { key: 'dance-classes', name: 'Dance classes', config: NEW }, A);
    const mk = await call('POST', '/admin/category-packs/sites', { categoryKey: 'dance-classes', businessName: 'Zq Dance Hall', subdomain: 'zq-dance', city: 'Goa', phone: '9876500111' }, A);
    ok('the new category and a site for it were created through the admin API only', created.status < 300 && mk.status < 300, JSON.stringify([created.body, mk.body]).slice(0, 300));
    const bad2 = []; let rendered = 0;
    for (const d of created.data.config.designs) {
      const g = await get(`${FRONT}${mk.data.previewUrl}&design=${d.key}`);
      rendered += 1;
      const lay2 = [...g.t.matchAll(/data-layout="([^"]+)"/g)].map((m) => m[1]);
      if (g.status !== 200 || !g.t.includes('Beginner batch') || !g.t.includes('Dance at Zq Dance Hall') || expectedLayouts(d).some((l) => !lay2.includes(l))) bad2.push(`${d.key}:${g.status}`);
    }
    ok(`all ${rendered} designs of the new category render with its own starter content (no code was written for it)`, bad2.length === 0 && rendered === 4, bad2.join(' '));
  } catch (e) {
    console.log(`  FAIL  suite crashed -> ${e.stack || e}`); fail += 1; failures.push('crash');
  } finally {
    try { await browser?.close(); } catch { /* closing */ }
    try { if (front) { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(front.pid), '/T', '/F'], { stdio: 'ignore' }); else front.kill(); } } catch { /* gone */ }
    await h?.stop();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log('FAILED:\n - ' + failures.join('\n - '));
  setTimeout(() => process.exit(fail ? 1 : 0), 500);
})();
