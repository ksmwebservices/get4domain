// Theme pages, the engine shell and the popup on the REAL website (a production build) over the REAL API (in-memory Postgres), read in headless Chrome.
// Test ids: theme.render, theme.multipage, theme.switch (rendered), industry-designs.shell, .popup, .footer-social, .editable, .seo, .speed, .no-hardcode, .dynamic.
// Builds the frontend itself when the build is missing or older than the source (a few minutes the first time). SKIPs when PGlite is not installed.
const fs = require('fs');
const path = require('path');
const http = require('http');
const L = require('./lib');
const { ok, section, FRONT, API, FE, CHROME, get, sleep } = L;

const J = (x) => JSON.stringify(x);
const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<template[^>]*><\/template>/g, '');
const count = (s, re) => (s.match(re) ?? []).length;

/** GET with a chosen Host header: how a vendor's own address reaches the website. */
function getWithHost(pathname, host) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 3023, path: pathname, method: 'GET', headers: { Host: host } }, (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => resolve({ status: res.statusCode, text: b })); });
    req.on('error', reject); req.end();
  });
}

(async () => {
  const s = await L.boot();
  if (!s) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - rendered theme proofs not run'); process.exit(0); }
  const { h } = s;
  const { prisma, call } = h;
  let browser;
  try {
    console.log(`frontend build: ${s.build}`);
    const admin = await h.createAdmin({ key: 'rtadmin' });
    const A = admin.token;
    await call('POST', '/admin/category-packs/seed/starter', {}, A);
    const packs = (await call('GET', '/admin/category-packs', undefined, A)).data;
    const ids = await L.registerReference(h, A);
    const flag = (v) => prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: 'site_doc_v2' } }, create: { vendorId: v.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });
    if (CHROME) { const puppeteer = require(path.join(FE, 'node_modules', 'puppeteer-core')); browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] }); }

    /** A vendor with real content in every field the editor has. */
    const realSite = async (key, industry, plan, packKey, name, designKey, over = {}) => {
      const v = await h.createVendor({ key, industry, plan });
      await flag(v);
      await call('POST', '/site-doc/me/generate', { packKey, businessName: name, city: 'Chennai', phone: '9876543210' }, v.token);
      await prisma.vendorProduct.deleteMany({ where: { vendorId: v.id } });
      const items = over.items ?? [['Real Alpha Service', '799', 'Group One'], ['Real Beta Service', '1,299', 'Group One'], ['Real Gamma Service', '450', 'Group Two']];
      for (const [n, price, cat] of items) await prisma.vendorProduct.create({ data: { vendorId: v.id, name: n, description: `${n} described in the vendor's own words.`, price, category: cat, image: `/starter/${packKey === 'diagnostics' ? 'clinic' : packKey}/g1.webp`, customFields: { duration: '30 minutes' } } });
      const draft = {
        businessName: name, tagline: `${name} real tagline`, about: `${name} was started by a real person. This is the real about text.`, phone: '9876543210', whatsapp: '9876543210', email: `${key}@example.org`, address: '12 Real Street, Anna Nagar, Chennai',
        businessHours: 'Mon-Sat 9 am to 7 pm; Sun closed', facebook: 'https://facebook.com/realpage', instagram: 'https://instagram.com/realpage', youtube: 'https://youtube.com/@realpage', linkedin: 'https://linkedin.com/company/realpage', googleMaps: 'https://maps.google.com/?q=Chennai',
        banner: `/starter/${packKey === 'diagnostics' ? 'clinic' : packKey}/hero.webp`, portfolio: [1, 2, 3].map((n) => ({ id: `p${n}`, src: `/starter/${packKey === 'diagnostics' ? 'clinic' : packKey}/g${n}.webp`, title: `Real picture ${n}` })),
        testimonials: [{ quote: 'A real quote from a real customer.', author: 'Real Customer Name' }],
        pages: [{ slug: 'offers', title: 'Real Offers', body: 'Real offers page body text.' }],
        extras: { headline: `${name} real headline`, subline: 'Real subline under the headline.', ctaLabel: 'Real Button', trust: ['Real trust point'], faq: [{ q: 'Real question?', a: 'Real answer.' }], steps: [{ title: 'Real step', desc: 'Real step text.' }], stats: [{ value: '10', label: 'real years' }], team: [{ name: 'Real Person One', role: 'Real Role', note: 'Real note.' }, { name: 'Real Person Two', role: 'Real Role' }], ...(over.extras ?? {}) },
        ...(over.draft ?? {}),
      };
      const r = await call('PUT', '/site-doc/me/draft', draft, v.token);
      if (r.status >= 300) throw new Error(`draft ${key}: ${J(r.body).slice(0, 300)}`);
      if (designKey) { const d = await call('POST', '/site-doc/me/design', { designKey }, v.token); if (d.status >= 300) throw new Error(`design ${key}: ${J(d.body).slice(0, 300)}`); }
      const p = await call('POST', '/site-doc/me/publish', {}, v.token);
      if (p.status >= 300) throw new Error(`publish ${key}: ${J(p.body).slice(0, 300)}`);
      return { ...v, url: `${FRONT}/site/${v.subdomain}`, name };
    };
    const clinic = await realSite('rtclinic', 'clinic', 'BOS', 'clinic', 'Rt Calm Clinic', 't:clinic-calm');
    const diag = await realSite('rtdiag', 'diagnostics', 'BOS', 'diagnostics', 'Rt Diagnostics Lab', 't:clinic-calm');
    const resto = await realSite('rtresto', 'restaurant', 'BOS', 'restaurant', 'Rt Hearth Kitchen', 't:restaurant-hearth', { items: [['Real Butter Naan', '60', 'Breads'], ['Real Paneer Tikka', '240', 'Starters'], ['Real Dal Fry', '180', 'Mains']] });
    const small = await realSite('rtsmall', 'clinic', 'WORKSPACE', 'clinic', 'Rt Small Plan Clinic', 't:clinic-calm');

    const page = browser ? await browser.newPage() : null;
    const consoleErrors = []; const pageErrors = [];
    if (page) {
      await page.setRequestInterception(true);
      page.on('request', (rq) => { if (/fonts\.(googleapis|gstatic)\.com/.test(rq.url())) rq.respond({ status: 200, contentType: 'text/css', body: '' }); else rq.continue(); });
      page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
      page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) consoleErrors.push(m.text().slice(0, 160)); });
    }

    // ───────────────────────────── render
    section('[feat:theme.render] Both reference themes render for every declared category with the vendor\'s data, on desktop and on a phone');
    const sites = [[clinic, 'clinic-calm', 'clinic'], [diag, 'clinic-calm', 'diagnostics'], [resto, 'restaurant-hearth', 'restaurant']];
    for (const [v, themeKey, cat] of sites) {
      const g = await get(v.url);
      const t = strip(g.t);
      ok(`${cat}: the home page answers 200 in the ${themeKey} theme`, g.status === 200 && t.includes(`g4d-theme-${themeKey}`), `${g.status}`);
      const isMenu = cat === 'restaurant';
      const mp = isMenu ? strip((await get(`${v.url}/menu`)).t) : '';
      const wants = isMenu
        ? [[t, v.name], [t, `${v.name} real tagline`], [t, `${v.name} real headline`], [t, '9876543210'], [t, '12 Real Street'], [t, 'Breads'], [t, 'Starters'], [t, 'Real Customer Name'], [mp, 'Real Butter Naan'], [mp, 'Real Paneer Tikka'], [mp, 'Real Dal Fry']]
        : [[t, v.name], [t, `${v.name} real tagline`], [t, `${v.name} real headline`], [t, '9876543210'], [t, '12 Real Street'], [t, 'Real Alpha Service'], [t, 'Real Person One'], [t, 'Real Customer Name'], [t, 'Real question?']];
      const lost = wants.filter(([src, x]) => !src.includes(x)).map(([, x]) => x);
      ok(`${cat}: the vendor's name, tagline, headline, phone, address, ${isMenu ? 'menu groups, dishes and review' : 'items, team, review and question'} are all on the page`, lost.length === 0, lost.join(' | '));
      ok(`${cat}: the real price shows with a rupee sign (the vendor's own, not a sample)`, /₹\s?(799|60)\b/.test(isMenu ? mp : t), ((isMenu ? mp : t).match(/₹[^<]{0,12}/g) ?? []).slice(0, 4).join(' '));
      ok(`${cat}: exactly one main heading, every picture has alt text`, count(t, /<h1[\s>]/g) === 1 && !/<img(?![^>]*\balt=)[^>]*>/.test(t));
      ok(`${cat}: no theme script and no event handler reaches the page`, !/\sonclick=|\sonerror=|javascript:/i.test(t));
      if (page) {
        for (const [w, hgt] of [[390, 800], [1280, 900]]) {
          await page.setViewport({ width: w, height: hgt, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
          const resp = await page.goto(v.url, { waitUntil: 'networkidle2', timeout: 60000 });
          const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          const st = await page.evaluate(() => { const b = document.querySelector('.site-header'); const bg = getComputedStyle(document.querySelector('[class*="g4d-theme-"]') ?? document.body).backgroundColor; return { header: !!b, bg }; });
          ok(`${cat} @${w}px: loads (${resp.status()}), no sideways scrolling, theme header drawn, theme colours applied (${st.bg})`, resp.status() === 200 && wide <= 1 && st.header && st.bg !== 'rgba(0, 0, 0, 0)', `${wide}px ${J(st)}`);
        }
      }
    }
    if (page) ok('no page script error and no console error on any rendered theme page', pageErrors.length === 0 && consoleErrors.length === 0, [...new Set([...pageErrors, ...consoleErrors])].slice(0, 4).join(' | '));
    // sample content stays hidden
    const starter = await h.createVendor({ key: 'rtstarter', industry: 'clinic', plan: 'WORKSPACE' });
    await flag(starter);
    await call('POST', '/site-doc/me/generate', { packKey: 'clinic', businessName: 'Rt Starter Clinic', city: 'Chennai' }, starter.token);
    await call('POST', '/site-doc/me/design', { designKey: 't:clinic-calm' }, starter.token);
    await call('POST', '/site-doc/me/publish', {}, starter.token);
    const sg = strip((await get(`${FRONT}/site/${starter.subdomain}`)).t);
    const seed = packs.find((p) => p.key === 'clinic').config.seed;
    ok('a starter-only site shows "Contact for price" and none of the sample prices', sg.includes('Contact for price') && seed.items.map((i) => i.price).filter(Boolean).every((p) => !sg.includes(`₹${p}`)), seed.items.map((i) => i.price).filter((p) => p && sg.includes(`₹${p}`)).join(','));
    ok('a starter-only site shows none of the sample customer quotes', seed.quotes.every((q) => !sg.includes(q.quote)) && !/Sample customer/i.test(sg));
    ok('the starter words DO show (sample text may show): an item name and the business name', sg.includes(seed.items[0].title) && sg.includes('Rt Starter Clinic'));

    // ───────────────────────────── multipage
    section('[feat:theme.multipage] Every page template renders at its own URL with its own title and description; items, vendor pages, sitemap, plan limits and shared chrome');
    const pagesOf = { 'clinic-calm': ['services', 'doctors', 'about', 'gallery', 'contact'], 'restaurant-hearth': ['menu', 'about', 'gallery', 'contact'] };
    const titleOf = (raw) => decodeURIComponent((/<title>([^<]*)<\/title>/.exec(raw) ?? [])[1] ?? '').replace(/&amp;/g, '&');
    const metaOf = (raw, name) => (new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(raw) ?? [])[1] ?? '';
    const flat = (x) => x.split('; ').join(';').split(': ').join(':').split(';"').join('"');
    const domChrome = async (url) => { await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 }); return page.evaluate(() => ({ nav: document.querySelector('.g4d-header-nav')?.outerHTML ?? '', footer: (document.querySelector('[data-g4d-footer]')?.outerHTML ?? '').replace(/style="[^"]*"/g, '').replace(/<!-- -->/g, '').replace(/© \d{4}/, ''), bottom: [...document.querySelectorAll('nav[aria-label="Main"].fixed')].map((n) => [...n.querySelectorAll('a,button')].map((a) => (a.getAttribute('href') ?? '') + '|' + a.textContent).join(';')).join('||') })); };
    const chrome = (t) => ({ nav: (/<nav class="g4d-header-nav[^>]*>([\s\S]*?)<\/nav>/.exec(t) ?? [])[1] ?? '', footer: (/<footer[^>]*data-g4d-footer[\s\S]*?<\/footer>/.exec(t) ?? [])[0] ?? '', bottom: count(t, /<nav aria-label="Main" class="fixed/g) });
    for (const [v, themeKey] of [[clinic, 'clinic-calm'], [resto, 'restaurant-hearth']]) {
      const seen = []; const titles = new Set(); const descs = new Set(); const bad = [];
      const home = await get(v.url); const homeChrome = page ? await domChrome(v.url) : chrome(strip(home.t));
      titles.add(titleOf(home.raw)); descs.add(metaOf(home.raw, 'description'));
      for (const p of pagesOf[themeKey]) {
        const g = await get(`${v.url}/${p}`); const t = strip(g.t);
        seen.push(`${p}:${g.status}`);
        if (g.status !== 200 || !t.includes(`g4d-theme-${themeKey}`) || count(t, /<h1[\s>]/g) !== 1) bad.push(`${p}: status ${g.status} h1 ${count(t, /<h1[\s>]/g)}`);
        const ti = titleOf(g.raw); const de = metaOf(g.raw, 'description');
        if (!ti.includes(v.name) || titles.has(ti)) bad.push(`${p}: title "${ti}"`);
        if (!de || descs.has(de)) bad.push(`${p}: description "${de.slice(0, 40)}"`);
        titles.add(ti); descs.add(de);
        if (!new RegExp(`<link rel="canonical" href="https://${v.subdomain}\\.get4domain\\.com/${p}"`).test(g.raw)) bad.push(`${p}: canonical`);
        const c = page ? await domChrome(`${v.url}/${p}`) : chrome(t);
        const norm = (x) => String(x).split(' aria-current="page"').join('');
        const diffs = [c.nav !== homeChrome.nav && 'menu', c.footer !== homeChrome.footer && 'footer', norm(c.bottom) !== norm(homeChrome.bottom) && 'phone bar'].filter(Boolean);
        if (!c.nav || !c.footer || diffs.length) { bad.push(`${p}: header, footer or bottom bar differ from the home page (${diffs.join(', ') || 'missing'})`); if (diffs.includes('footer')) { let i = 0; while (i < c.footer.length && c.footer[i] === homeChrome.footer[i]) i++; console.log('        dbg footer diff:', J(homeChrome.footer.slice(Math.max(0, i - 80), i + 120)), 'VS', J(c.footer.slice(Math.max(0, i - 80), i + 120))); } }
      }
      ok(`${themeKey}: every page template answers 200 at its own address with exactly one H1 (${seen.join(' ')})`, bad.filter((b) => !/title|description|canonical|differ/.test(b)).length === 0, bad.join(' | '));
      ok(`${themeKey}: each page has its own title (with the business name) and its own description`, !bad.some((b) => /title|description/.test(b)), bad.filter((b) => /title|description/.test(b)).join(' | '));
      ok(`${themeKey}: each page has a canonical address on the vendor's own host`, !bad.some((b) => /canonical/.test(b)), bad.filter((b) => /canonical/.test(b)).join(' | '));
      ok(`${themeKey}: the header menu, the footer and the phone bar are the same on every page`, !bad.some((b) => /differ/.test(b)), bad.filter((b) => /differ/.test(b)).join(' | '));
    }
    const items = await prisma.vendorProduct.findMany({ where: { vendorId: clinic.id }, orderBy: { createdAt: 'asc' } });
    const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let itemsOk = true; const itemBad = [];
    for (const it of items) { const g = await get(`${clinic.url}/services/${slug(it.name)}`); const t = strip(g.t); if (g.status !== 200 || !t.includes(it.name) || !titleOf(g.raw).includes(it.name) || !/"@type":"Service"/.test(g.raw)) { itemsOk = false; itemBad.push(`${it.name}:${g.status}`); } }
    ok('every service has its own page with its own title and Service structured data', itemsOk && items.length === 3, itemBad.join(' '));
    const off = await get(`${clinic.url}/p/offers`); const offT = strip(off.t);
    ok('a page the vendor added uses page.html: its title as the heading and its text in the body, inside the same theme', off.status === 200 && /<h1[^>]*>Real Offers<\/h1>/.test(offT) && offT.includes('Real offers page body text.') && offT.includes('g4d-theme-clinic-calm'));
    const nf = await get(`${clinic.url}/nothing-here`);
    ok('an address that is not a page shows the not-found page, never a half-filled theme', !strip(nf.t).includes('g4d-theme-clinic-calm') && /not found|404|can.t find|doesn.t exist/i.test(nf.t), `${nf.status}`);
    const sm = await getWithHost('/sitemap.xml', `${clinic.subdomain}.get4domain.com`);
    const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const wantLocs = ['', ...pagesOf['clinic-calm'].map((p) => `/${p}`), '/p/offers', ...items.map((i) => `/services/${slug(i.name)}`)].map((p) => `https://${clinic.subdomain}.get4domain.com${p || '/'}`);
    ok('the sitemap of the vendor\'s own host lists the home page, every theme page, the vendor page and every item page', wantLocs.every((l) => locs.includes(l)), wantLocs.filter((l) => !locs.includes(l)).join(' | ').slice(0, 300));
    ok('the sitemap leaves out the form pages and the legal pages', !locs.some((l) => /\/(book|enquire|order|legal)/.test(l)));
    const sg2 = await get(`${small.url}/gallery`);
    const smallSm = await getWithHost('/sitemap.xml', `${small.subdomain}.get4domain.com`);
    const smallLocs = [...smallSm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    ok('plan limits are enforced: a 5-page plan serves the home page and four theme pages (contact and the list page are kept first); the others answer not found', !strip(sg2.t).includes('g4d-theme-clinic-calm') && smallLocs.filter((l) => !/\/p\//.test(l) && l.split('/').length === 4 && l.split('/')[3] !== '' && !/services\//.test(l)).length <= 4, J(smallLocs).slice(0, 300));
    ok('the smaller plan still has its contact page and its list page', (await get(`${small.url}/contact`)).status === 200 && strip((await get(`${small.url}/contact`)).t).includes('g4d-theme-clinic-calm') && strip((await get(`${small.url}/services`)).t).includes('g4d-theme-clinic-calm'));

    // the vendor hides and reorders the theme's own pages
    await call('PUT', '/site-doc/me/draft', { extras: { pagePlan: { hidden: ['gallery'], order: ['contact', 'about', 'services', 'doctors'] } } }, clinic.token);
    await call('POST', '/site-doc/me/publish', {}, clinic.token);
    const hid = await get(`${clinic.url}/gallery`);
    const hidHtml = (await get(clinic.url)).t; const hs = hidHtml.indexOf('<nav class="g4d-header-nav'); const hidNav = hs < 0 ? '' : hidHtml.slice(hs, hidHtml.indexOf('</nav>', hs));
    const order = ['Contact', 'About', 'Treatments', 'Doctors'].map((w) => hidNav.indexOf('>' + w + '<'));
    ok('a page the vendor hides answers not found, and the menu follows the order the vendor chose', !strip(hid.t).includes('g4d-theme-clinic-calm') && !/gallery/i.test(hidNav) && order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), J({ order, hidNav: hidNav.slice(0, 200) }));
    await call('PUT', '/site-doc/me/draft', { extras: { pagePlan: { hidden: [], order: [] } } }, clinic.token);
    await call('POST', '/site-doc/me/publish', {}, clinic.token);
    ok('putting the page back brings it back', strip((await get(`${clinic.url}/gallery`)).t).includes('g4d-theme-clinic-calm'));
    const dz = (await call('GET', '/site-doc/me/designs', undefined, clinic.token)).data;
    ok('the editor is told the pages of the theme in use (so it can offer hide and reorder)', Array.isArray(dz.themePages) && dz.themePages.map((p) => p.slug).join(',') === 'services,doctors,about,gallery,contact', J(dz.themePages));

    // ───────────────────────────── switch (rendered)
    section('[feat:theme.switch] The same words, items and pictures show in every built-in design and in the imported theme');
    const sw = await realSite('rtswitch', 'clinic', 'BOS', 'clinic', 'Rt Switch Clinic', 'classic');
    const dsw = (await call('GET', '/site-doc/me/designs', undefined, sw.token)).data.designs;
    const designsOfSw = dsw.map((d) => d.key);
    const must = ['Rt Switch Clinic', '9876543210', 'Real Alpha Service', 'Real Beta Service'];
    const lostBy = {};
    for (const k of [...designsOfSw, 't:clinic-calm']) {
      await call('POST', '/site-doc/me/design', { designKey: k }, sw.token);
      await call('POST', '/site-doc/me/publish', {}, sw.token);
      const t = strip((await get(sw.url)).t);
      const spec = dsw.find((d) => d.key === k); const secs = (spec?.sections ?? []).map((x) => x.split(':')[0]);
      lostBy[k] = [...must, ...(k.startsWith('t:') || secs.includes('faq') ? ['Real question?'] : []), ...(k.startsWith('t:') || secs.includes('testimonials') ? ['Real Customer Name'] : [])].filter((x) => !t.includes(x));
      if (k.startsWith('t:')) lostBy[`${k}#theme`] = t.includes('g4d-theme-clinic-calm') ? [] : ['not themed'];
    }
    ok(`switching through ${Object.keys(lostBy).length - 1} designs (four built-in, one imported free, one paid with a licence) keeps every field on the page (a design shows the sections it lists; the theme shows all)`, Object.values(lostBy).every((l) => l.length === 0), J(lostBy));

    L.state.__ = { clinic, diag, resto, small, sw, ids, packs, flag, realSite, strip, count, titleOf, metaOf, getWithHost };
    await require('./verify-themes-render-2')(L, { h, A, browser, page, consoleErrors, pageErrors, ctx: L.state.__ });
  } catch (e) {
    L.state.fail += 1; L.state.failures.push('suite crashed'); console.log(`  FAIL  suite crashed -> ${e.stack || e}`);
  } finally {
    try { if (browser) await browser.close(); } catch { /* closing */ }
    await s.stop();
  }
  console.log(`\nTheme render suite: ${L.state.pass} passed, ${L.state.fail} failed`);
  if (L.state.fail) console.log(`FAIL: ${L.state.failures.join(' | ')}`);
  process.exit(L.state.fail ? 1 : 0);
})();
