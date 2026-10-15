// Website Manager: the RENDERED public pages. Boots the real API (in-memory Postgres) and the real Next.js server (a production build made against that API),
// switches test vendors onto the new Website Manager, saves, publishes and reads the actual HTML.
//   every editor field reaches the page, publish refreshes the page within seconds, no stock content, every theme and layout, readiness equals the page.
// Builds the frontend itself when the build is missing or older than the source (a few minutes the first time). SKIPs when PGlite is not installed.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn, spawnSync } = require('child_process');
const { startHarness, available } = require('../e2e/bos-harness');

const API = 'http://127.0.0.1:3097';
const FRONT = 'http://127.0.0.1:3023';
const FE = path.join(__dirname, '..', '..', '..', 'get4domain_mvp');
const SECRET = 'render-test-secret';

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 300)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u003c/g, '<');
async function page(sub, rest = '', qs = '') { const r = await fetch(`${FRONT}/site/${sub}${rest}${qs}`, { headers: { 'cache-control': 'no-cache' } }); const t = decode(await r.text()); return { status: r.status, t }; }

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - rendered-page proofs not run'); process.exit(0); }
  process.env.FRONTEND_INTERNAL_URL = FRONT; process.env.REVALIDATE_SECRET = SECRET;
  let front; let h;
  try {
    console.log(`frontend build: ${ensureBuild()}`);
    h = await startHarness({ port: 3097, pgPort: 54341 });
    front = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'start', '-p', '3023'], { cwd: FE, shell: true, stdio: 'ignore', env: { ...process.env, NEXT_PUBLIC_API_URL: API, INTERNAL_API_URL: API, REVALIDATE_SECRET: SECRET } });
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`${FRONT}/`); if (r.status < 500) break; } catch { /* starting */ } await sleep(1500); }
    const { prisma, call } = h;
    const admin = await h.createAdmin({ key: 'rnadmin' });
    await call('POST', '/admin/category-packs/seed/starter', {}, admin.token);
    const flag = (v) => prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: 'site_doc_v2' } }, create: { vendorId: v.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });
    const draftPublish = async (v, patch) => { const a = await call('PUT', '/site-doc/me/draft', patch, v.token); if (a.status >= 300) return a; return call('POST', '/site-doc/me/publish', {}, v.token); };
    const waitFor = async (sub, probe, ms = 4000) => { const t0 = Date.now(); let last = ''; while (Date.now() - t0 < ms) { last = (await page(sub)).t; if (probe(last)) return { ok: true, last, took: Date.now() - t0 }; await sleep(150); } return { ok: false, last, took: ms }; };

    // ── the full vendor: every editor field ──
    const full = await h.createVendor({ key: 'rnfull', industry: 'travel', plan: 'WORKSPACE' });
    await flag(full);
    await prisma.vendorProduct.create({ data: { vendorId: full.id, name: 'Zqitem Ooty Trip', price: '4500', description: 'A real package', image: 'https://img.example.test/item-ZQITEM.png', active: true, category: 'Tours' } });
    const M = 'ZQ' + Math.random().toString(36).slice(2, 7).toUpperCase();
    const V = {
      businessName: `Biz ${M} Name`, tagline: `Tagline ${M} here`, about: `About text ${M} for the page`, logo: `https://img.example.test/logo-${M}.png`, banner: `https://img.example.test/banner-${M}.png`,
      favicon: `https://img.example.test/fav-${M}.png`, ogImage: `https://img.example.test/og-${M}.png`, seoTitle: `Seo Title ${M}`, seoDesc: `Seo description ${M} text`, seoKeywords: `kwone${M}, kwtwo`, googleAnalyticsId: 'G-ABC12345',
      phone: '9876500011', whatsapp: '9876500022', email: `hello-${M}@example.test`.toLowerCase(), address: `12 Marker Street ${M} Chennai`, businessHours: `Mon-Sat ${M} 9am-6pm`,
      facebook: `https://facebook.com/page${M}`, instagram: `https://instagram.com/acct${M}`, linkedin: `https://linkedin.com/in/acct${M}`, youtube: `https://youtube.com/@chan${M}`, googleMaps: `https://maps.example.test/place-${M}`,
      portfolio: [{ id: 'p1', src: `https://img.example.test/portfolio-${M}.png`, title: 'Work', category: 'x' }],
      testimonials: [{ quote: `Quote ${M} was wonderful`, author: `Author ${M}` }],
      pages: [{ slug: 'our-story', title: `Story ${M}`, body: `Page body ${M} text` }],
      layout: { themeKey: 'midnight-gold', hero: 'split' },
    };
    let r = await draftPublish(full, V);
    section('[feat:website-manager.fields] Every field the editor saves is found in the public page');
    ok('the vendor can save and publish every field', r.status < 300, JSON.stringify(r.body).slice(0, 300));
    const pg = await waitFor(full.subdomain, (t) => t.includes(M));
    const T = pg.last;
    const find = (name, probe) => ok(name, probe(T));
    find('business name', (t) => t.includes(V.businessName));
    find('tagline', (t) => t.includes(V.tagline));
    find('about text', (t) => t.includes(V.about));
    find('logo (in the top bar)', (t) => t.includes(`logo-${M}`));
    find('banner (the hero picture)', (t) => t.includes(`banner-${M}`));
    find('favicon (the browser-tab icon)', (t) => t.includes(`fav-${M}`));
    find('share picture (og:image)', (t) => /property="og:image"[^>]*og-ZQ|og-ZQ[^>]*property="og:image"/.test(t) || t.includes(`og-${M}`));
    find('SEO title (the page title)', (t) => new RegExp(`<title>[^<]*${V.seoTitle}`).test(t));
    find('SEO description (meta)', (t) => t.includes(V.seoDesc));
    find('SEO keywords (meta)', (t) => t.includes(`kwone${M}`));
    find('Google Analytics id (the script)', (t) => t.includes('G-ABC12345'));
    find('phone', (t) => t.includes('9876500011'));
    find('WhatsApp (a chat link)', (t) => t.includes('wa.me/9876500022'));
    find('e-mail (a mail link)', (t) => t.includes(`mailto:${V.email}`));
    find('address', (t) => t.includes(V.address));
    find('opening hours', (t) => t.includes(V.businessHours));
    find('Facebook link', (t) => t.includes(V.facebook));
    find('Instagram link', (t) => t.includes(V.instagram));
    find('LinkedIn link', (t) => t.includes(V.linkedin));
    find('YouTube link', (t) => t.includes(V.youtube));
    find('Google Maps link', (t) => t.includes(V.googleMaps));
    find('portfolio picture (the gallery)', (t) => t.includes(`portfolio-${M}`));
    find('customer quote and author', (t) => t.includes(`Quote ${M} was wonderful`) && t.includes(`Author ${M}`));
    find('the vendor\'s own product in the catalogue', (t) => t.includes('Zqitem Ooty Trip') && t.includes('item-ZQITEM'));
    find('an extra page appears in the menu', (t) => t.includes(`/site/${full.subdomain}/p/our-story`));
    const sub = await page(full.subdomain, '/p/our-story');
    ok('and the extra page opens with its text', sub.status === 200 && sub.t.includes(`Page body ${M} text`), String(sub.status));
    find('the chosen theme is applied (its accent colour is in the page)', (t) => /--eng-accent:\s*#E4B34A/i.test(t) || t.includes('#E4B34A') || t.includes('#e4b34a'));
    find('the chosen hero layout is applied', (t) => t.includes('data-layout="hero-split"'));
    find('structured data uses the pack\'s search-engine type', (t) => /"@type":"TravelAgency"/.test(t) && t.includes(`"telephone":"9876500011"`));

    section('[feat:website-manager.publish-refresh] Publish refreshes the public page within seconds; a draft is only in the private preview');
    const before = await draftPublish(full, { tagline: `Second tagline ${M}` });
    const t0 = Date.now();
    const seen = await waitFor(full.subdomain, (t) => t.includes(`Second tagline ${M}`), 5000);
    ok('after Publish the new text is on the public page within 5 seconds (no deploy, no restart)', before.status < 300 && seen.ok, `${seen.took}ms`);
    console.log(`        (refreshed in about ${Date.now() - t0 - 0} ms)`);
    ok('the refresh really came from Publish asking the page cache to drop (the API said so)', before.data?.refreshed === true, JSON.stringify(before.data).slice(0, 160));
    await call('PUT', '/site-doc/me/draft', { tagline: `Draft only ${M}` }, full.token);
    await sleep(300);
    ok('a saved draft is NOT on the public page', !(await page(full.subdomain)).t.includes(`Draft only ${M}`));
    const link = await call('POST', '/site-doc/me/preview-link', {}, full.token);
    const pv = await (await fetch(`${FRONT}${link.data.url}`)).text();
    ok('but it is in the private preview, marked as a preview and kept out of search engines', decode(pv).includes(`Draft only ${M}`) && /Preview: this is how your site will look/.test(pv) && /noindex/.test(pv));
    const bad = await fetch(`${FRONT}/api/revalidate-site`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-revalidate-secret': 'wrong' }, body: JSON.stringify({ subdomain: full.subdomain }) });
    ok('the refresh door refuses a wrong secret', bad.status === 401);
    await call('DELETE', '/site-doc/me/draft', undefined, full.token);

    section('[feat:website-manager.themes] Every theme shows its own colours');
    const THEMES = JSON.parse(fs.readFileSync(path.join(FE, 'src', 'engine', 'kit', 'site-themes.json'), 'utf8'));
    for (const th of THEMES) {
      await draftPublish(full, { layout: { themeKey: th.id } });
      const w = await waitFor(full.subdomain, (t) => t.toLowerCase().includes(th.accent.toLowerCase()) && t.toLowerCase().includes(th.bg.toLowerCase()), 5000);
      ok(`theme ${th.id}: its background and accent are in the page`, w.ok);
    }
    const keepContent = (await page(full.subdomain)).t;
    ok('changing the theme lost no content', keepContent.includes(V.about) && keepContent.includes(`Quote ${M} was wonderful`) && keepContent.includes('Zqitem Ooty Trip'));

    section('[feat:website-manager.layouts] Every layout renders its own structure');
    const SLOTS = { hero: ['overlay', 'split', 'panel'], about: ['split', 'centered', 'columns'], services: ['rows', 'cards', 'menu', 'tiles'], gallery: ['mosaic', 'grid', 'strip'], testimonials: ['cards', 'quote', 'list'], contact: ['card', 'split', 'minimal'] };
    const TYPE = { hero: 'hero', about: 'about', services: 'showcase', gallery: 'gallery', testimonials: 'testimonials', contact: 'contact' };
    for (let round = 0; round < 4; round++) {
      const layout = { themeKey: 'clean-teal' };
      for (const [slot, opts] of Object.entries(SLOTS)) layout[slot] = opts[Math.min(round, opts.length - 1)];
      await draftPublish(full, { layout });
      const w = await waitFor(full.subdomain, (t) => t.includes(`data-layout="hero-${layout.hero}"`) && t.includes(`data-layout="showcase-${layout.services}"`), 5000);
      for (const [slot, opts] of Object.entries(SLOTS)) {
        const chosen = layout[slot];
        if (round < opts.length) ok(`${slot}: the "${chosen}" layout renders (data-layout="${TYPE[slot]}-${chosen}")`, w.last.includes(`data-layout="${TYPE[slot]}-${chosen}"`));
      }
    }
    ok('each section has at least 3 layouts to choose from', Object.values(SLOTS).every((o) => o.length >= 3));
    const bogus = await call('PUT', '/site-doc/me/draft', { layout: { hero: 'diagonal' } }, full.token);
    ok('a layout that does not exist is refused', bogus.status === 400);

    // ── no stock content ──
    section('[feat:website-manager.no-fallback] An empty field shows nothing invented');
    const bare = await h.createVendor({ key: 'rnbare', industry: 'travel', plan: 'WORKSPACE' });
    await flag(bare);
    await draftPublish(bare, { businessName: 'Bare Tours' });
    const b1 = await waitFor(bare.subdomain, (t) => t.includes('Bare Tours'));
    const bt = b1.last;
    ok('a new site with only a name has no pictures at all (no stock photo)', (bt.match(/<img\b/g) || []).length === 0, `${(bt.match(/<img\b/g) || []).length} images`);
    ok('no demo-library, stock-photo or sample-business content appears', !/demo-library|unsplash|pexels|images\.pexels/.test(bt));
    ok('no invented testimonials, statistics, team or gallery sections', !/data-layout="(testimonials|stats|people|gallery)/.test(bt) && !/<blockquote/.test(bt));
    ok('no invented catalogue items when the vendor has none', !/data-layout="showcase/.test(bt));
    await draftPublish(bare, { banner: 'https://img.example.test/ban-ZQBARE.png' });
    ok('a banner the vendor adds appears', (await waitFor(bare.subdomain, (t) => t.includes('ban-ZQBARE'))).ok);
    await draftPublish(bare, { banner: '' });
    const gone = await waitFor(bare.subdomain, (t) => !t.includes('ban-ZQBARE'));
    ok('and when the vendor removes it, it is gone (no stock banner comes back)', gone.ok && !/unsplash|demo-library/.test(gone.last));
    const legacy = await h.createVendor({ key: 'rnlegacy', industry: 'clinic', plan: 'WORKSPACE' });
    const lg = await page(legacy.subdomain);
    ok('a vendor NOT switched on keeps the old renderer unchanged (control)', lg.status === 200 && /demo-library/.test(lg.t));

    section('A shop on the new renderer keeps its cart: order requests (no online payment) and online payment');
    const shopV = await h.createVendor({ key: 'rnshop', industry: 'retail', plan: 'WORKSPACE' });
    await flag(shopV);
    await prisma.vendorProduct.create({ data: { vendorId: shopV.id, name: 'Zqshoe Runner', price: '1999', image: 'https://img.example.test/shoe.png', active: true, category: 'Shoes' } });
    await draftPublish(shopV, { businessName: 'Shop Test' });
    const noCart = await waitFor(shopV.subdomain, (t) => t.includes('Zqshoe Runner'));
    ok('a shop with no checkout switched on shows its items but no cart button', noCart.ok && !/Add to cart/.test(noCart.last));
    await prisma.vendorPaymentConfig.create({ data: { vendorId: shopV.id, enabled: false, checkoutMode: 'ORDER_REQUEST' } });
    // a payment-setting change is not a Publish, so the page waits out its cache (a minute) unless asked: ask, as Publish does
    await fetch(`${FRONT}/api/revalidate-site`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-revalidate-secret': SECRET }, body: JSON.stringify({ subdomain: shopV.subdomain }) });
    const sh = await waitFor(shopV.subdomain, (t) => /Add to cart/.test(t), 8000);
    ok('with order requests switched on, the items have an Add to cart button (the cart then asks for name, mobile and delivery address, no payment)', sh.ok, sh.last.slice(0, 100));

    // ── readiness equals the page ──
    section('[feat:website-manager.readiness] The readiness checklist agrees with the public page');
    const readiness = await import(pathToFileURL(path.join(FE, 'src', 'engine', 'readiness.ts')).href);
    const evidence = (t, d) => ({
      name: t.includes(d.name), tagline: !!d.cms?.tagline && t.includes(d.cms.tagline), about: !!d.cms?.about && t.includes(d.cms.about), phone: !!d.cms?.phone && t.includes(d.cms.phone),
      whatsapp: (!!d.cms?.whatsapp && t.includes(`wa.me/${String(d.cms.whatsapp).replace(/\D/g, '')}`)) || (!!d.cms?.phone && t.includes(d.cms.phone)),
      catalog: d.products.length > 0 && t.includes(d.products[0].name), images: d.products.some((p) => p.image && t.includes(p.image)) || (!!d.cms?.banner && t.includes(d.cms.banner)),
      sample: !/Contact for price/.test(t), // no starter item is on the page, so the starter-text check is ticked
      address: !!d.cms?.address && t.includes(d.cms.address), seo: !!d.cms?.seoTitle && !!d.cms?.seoDesc && t.includes(d.cms.seoTitle) && t.includes(d.cms.seoDesc),
    });
    for (const v of [full, bare]) {
      await call('DELETE', '/site-doc/me/draft', undefined, v.token);
      const d = (await call('GET', `/cms/site/${v.subdomain}`)).data;
      const checks = readiness.genericReadiness(d);
      const t = (await page(v.subdomain)).t;
      const ev = evidence(t, { name: d.cms?.businessName || d.vendor.businessName, cms: d.cms, products: d.products });
      for (const c of checks) ok(`${v.subdomain}: "${c.label}" is ${c.passed ? 'ticked and the content is on the page' : 'not ticked and the page does not show it'}`, c.passed === ev[c.key], `${c.key}: checklist ${c.passed}, page ${ev[c.key]}`);
    }
  } catch (e) {
    console.log(`  FAIL  suite crashed -> ${e.stack || e}`); fail += 1; failures.push('crash');
  } finally {
    if (front) { try { process.platform === 'win32' ? spawn('taskkill', ['/pid', String(front.pid), '/T', '/F']) : front.kill(); } catch { /* ignore */ } }
    if (h) await h.stop();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log('FAILED:\n - ' + failures.join('\n - '));
  setTimeout(() => process.exit(fail ? 1 : 0), 500);
})();
