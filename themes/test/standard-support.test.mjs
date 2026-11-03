import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderPage } from '../lib/render.mjs';
import { parse, findAll, textOf } from '../lib/html.mjs';
import { BINDINGS } from '../lib/vocabulary.mjs';
import { CATEGORIES } from '../lib/categories.mjs';
import { sampleContent } from '../fixtures/index.mjs';
import { minimalManifest } from './helpers/minimal-theme.mjs';
import { buildTheme, buildThemeFiles, standardThemeIds, checkBuilt, SOURCE_ROOT } from '../lib/build-themes.mjs';
import { makePalette } from '../lib/preset-build.mjs';
import { derivePalette, paletteFindings } from '../lib/preset.mjs';

const theme = (tpl, over = {}) => ({ manifest: { ...minimalManifest({ categories: ['plumber', 'jewellery'], families: ['home-services', 'fashion-lifestyle'], tracks: ['handyman', 'ecommerce'], layoutVariantRules: { 'home-services': 'bold-split', 'fashion-lifestyle': 'product-first' } }), ...over }, templates: { home: tpl }, css: {} });
const render = (t, content, extra = {}) => renderPage({ theme: t, page: { slug: 'home' }, content, settings: {}, vendor: { id: 'v' }, host: { siteUrl: 'https://x.get4domain.com' }, ...extra });

// ---------------------------------------------------------------- platform wording used by the Standard themes
test('every ui.* binding has wording in English and Tamil, and the two differ', () => {
  const ui = BINDINGS.filter((b) => b.startsWith('ui.'));
  assert.ok(ui.length >= 18, `ui bindings: ${ui.length}`);
  for (const lang of ['en', 'ta']) {
    const out = {};
    for (const b of ui) {
      const html = render(theme(`<p>{{${b}}}</p>`), sampleContent('plumber', { lang })).html;
      out[b] = textOf(parse(html)).trim();
      assert.ok(out[b].length > 1, `${b} (${lang}) is empty`);
    }
    if (lang === 'en') var en = out; else for (const b of ui) assert.notEqual(out[b], en[b], `${b}: Tamil wording must differ from English`);
  }
  for (const k of ['ui.why', 'ui.hours', 'ui.orderOnWhatsApp', 'ui.shippingNote']) assert.ok(BINDINGS.includes(k), k);
});

// ---------------------------------------------------------------- hero badge
test('hero.badge is set for categories with an emergency or same-day service and empty for the rest', () => {
  for (const c of CATEGORIES) {
    const has = c.extraBlocks.includes('emergency24x7') || c.extraBlocks.includes('sameDay');
    for (const lang of ['en', 'ta']) {
      const b = sampleContent(c.id, { lang }).hero.badge;
      if (has) assert.ok(typeof b === 'string' && b.length > 3, `${c.id}/${lang} badge`);
      else assert.equal(b, '', `${c.id}/${lang} has no badge`);
    }
  }
  assert.match(sampleContent('plumber').hero.badge, /24x7/);
  assert.match(sampleContent('ac-appliance-repair').hero.badge, /same-day/i);
  const t = theme('<p class="b" data-g4d-if="hero.badge">{{hero.badge}}</p>');
  assert.equal(findAll(parse(render(t, sampleContent('plumber')).html), (n) => n.attrs.class === 'b').length, 1);
  assert.equal(findAll(parse(render(t, sampleContent('dentist')).html), (n) => n.attrs.class === 'b').length, 0);
});

// ---------------------------------------------------------------- product grid: small catalogue
test('product-grid: limit="12" caps the catalogue, falls back to items when there are no products, and never exceeds 24', () => {
  const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, price: '1', image: '', description: '' }));
  const t = (limit) => theme(`<g4d-product-grid${limit === undefined ? '' : ` limit="${limit}"`}></g4d-product-grid>`);
  const count = (html) => findAll(parse(html), (n) => n.attrs.class === 'g4d-product').length;
  const jew = { ...sampleContent('jewellery'), products: many(20) };
  assert.equal(count(render(t(12), jew).html), 12);
  assert.equal(count(render(t(undefined), jew).html), 20);
  assert.equal(count(render(t(99), { ...jew, products: many(40) }).html), 24);
  assert.equal(count(render(t('abc'), { ...jew, products: many(40) }).html), 24);
  assert.equal(count(render(t(0), jew).html), 20, 'zero is not a limit');
  const fromItems = { ...sampleContent('jewellery'), products: [] };
  assert.equal(count(render(t(12), fromItems).html), 6, 'products empty: the items are the catalogue');
  assert.equal(count(render(t(12), { ...sampleContent('plumber'), products: [] }).html), 0, 'a non-shop category has no catalogue');
});

// ---------------------------------------------------------------- palette generation (used to build the presets)
test('makePalette makes a contrast-safe light and dark palette from a hue, the same way every time', () => {
  const tokens = { text: '#14211e', muted: '#4a5a56', textDark: '#e8f0ee', mutedDark: '#a9bab6' };
  for (const h of [0, 24, 48, 90, 140, 175, 200, 230, 262, 290, 320, 345]) for (const s of [0.45, 0.7, 0.9]) {
    const p = makePalette({ h, s, accentShift: 35 });
    assert.deepEqual(paletteFindings(p, tokens), [], `hue ${h} sat ${s}`);
    assert.deepEqual(makePalette({ h, s, accentShift: 35 }), p);
    for (const m of ['light', 'dark']) for (const k of ['primary', 'accent', 'background']) assert.match(p[m][k], /^#[0-9a-f]{6}$/);
  }
  assert.notDeepEqual(makePalette({ h: 24, s: 0.7, accentShift: 35 }), makePalette({ h: 200, s: 0.7, accentShift: 35 }));
  assert.ok(derivePalette('light', makePalette({ h: 24, s: 0.7, accentShift: 35 }).light).surface);
});

// ---------------------------------------------------------------- the build step (shared sources copied into each self-contained package)
function makeSource() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-src-'));
  const put = (p, s) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), s); };
  put('shared/css/core.css', '.g4d-theme { color: red; }\n');
  put('shared/css/motion.css', '@media (prefers-reduced-motion: reduce) { .g4d-theme * { animation: none; } }\n');
  put('shared/css/print.css', '@media print { .g4d-theme nav { display: none; } }\n');
  put('shared/templates/_a.html', 'A[{{> b}}]');
  put('shared/templates/_b.html', 'B');
  put('shared/templates/home.html', '{{> a}}-{{> c}}|{{hero.title}}');
  put('shared/templates/about.html', 'about-shared');
  put('alpha/theme.mjs', `export default { id: 'alpha', name: 'Alpha', description: 'Test theme', tracks: ['handyman'], families: ['home-services'], palette: { light: { primary: '#7a3300', accent: '#8a3b00', background: '#fff8f1' }, dark: { primary: '#ff9d57', accent: '#ffb27d', background: '#17100b' } }, fonts: { heading: 'Montserrat', body: 'Work Sans' }, radius: '8px' };`);
  put('alpha/theme.css', '.g4d-theme .alpha { color: blue; }\n');
  put('alpha/templates/_c.html', 'C-alpha');
  put('alpha/templates/about.html', 'about-alpha');
  put('alpha/templates/menu.html', 'menu-alpha');
  put('beta/theme.mjs', `export default { id: 'beta', name: 'Beta', description: 'Second test theme', tracks: ['handyman'], families: ['auto-services'], palette: { light: { primary: '#003b7a', accent: '#00508a', background: '#f1f8ff' }, dark: { primary: '#579dff', accent: '#7db2ff', background: '#0b1017' } }, fonts: { heading: 'Inter', body: 'Inter' } };`);
  put('beta/theme.css', '.g4d-theme .beta { color: green; }\n');
  put('beta/templates/_c.html', 'C-beta');
  return root;
}

test('build: includes resolve (a theme partial beats a shared one), page templates can be overridden or added, partials are not emitted', async () => {
  const root = makeSource();
  try {
    const a = (await buildThemeFiles('alpha', { root })).files;
    const text = (p) => a[p].toString('utf8');
    assert.equal(text('templates/home.html').trim(), 'A[B]-C-alpha|{{hero.title}}');
    assert.equal(text('templates/about.html').trim(), 'about-alpha');
    assert.equal(text('templates/menu.html').trim(), 'menu-alpha');
    assert.ok(!Object.keys(a).some((p) => /templates\/_/.test(p)), 'partials are not emitted');
    const b = (await buildThemeFiles('beta', { root })).files;
    assert.equal(b['templates/home.html'].toString().trim(), 'A[B]-C-beta|{{hero.title}}');
    assert.equal(b['templates/about.html'].toString().trim(), 'about-shared');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('build: an unknown partial or a runaway include is an error', async () => {
  const root = makeSource();
  try {
    fs.writeFileSync(path.join(root, 'beta/templates/_c.html'), '{{> nope}}');
    await assert.rejects(() => buildThemeFiles('beta', { root }), /nope/);
    fs.writeFileSync(path.join(root, 'beta/templates/_c.html'), '{{> loop}}');
    fs.writeFileSync(path.join(root, 'beta/templates/_loop.html'), '{{> loop}}');
    await assert.rejects(() => buildThemeFiles('beta', { root }), /too deep|loop/i);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('build: every package is self-contained and carries byte-identical shared files', async () => {
  const root = makeSource();
  try {
    const shared = (n) => fs.readFileSync(path.join(root, 'shared/css', n), 'utf8');
    const out = {};
    for (const id of ['alpha', 'beta']) out[id] = (await buildThemeFiles(id, { root })).files;
    for (const id of ['alpha', 'beta']) {
      assert.equal(out[id]['css/motion.css'].toString(), shared('motion.css'));
      assert.equal(out[id]['css/print.css'].toString(), shared('print.css'));
      assert.ok(out[id]['css/base.css'].toString().startsWith(`/* shared:core:begin */\n${shared('core.css')}/* shared:core:end */\n`), 'base.css starts with the shared core');
      assert.match(out[id]['css/tokens.css'].toString(), /--g4d-accent: var\(--g4d-pal-accent, #[0-9a-f]{6}\)/);
      assert.match(out[id]['css/tokens.css'].toString(), /prefers-color-scheme: dark/);
    }
    assert.ok(out.alpha['css/base.css'].toString().endsWith('.g4d-theme .alpha { color: blue; }\n'));
    assert.ok(out.beta['css/base.css'].toString().endsWith('.g4d-theme .beta { color: green; }\n'));
    assert.equal(out.alpha['css/base.css'].toString().split('/* shared:core:end */')[0], out.beta['css/base.css'].toString().split('/* shared:core:end */')[0]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('build: theme.json is derived from the config, with fonts, variants and categories filled in; the tokens come from the palette', async () => {
  const root = makeSource();
  try {
    const f = (await buildThemeFiles('alpha', { root })).files;
    const m = JSON.parse(f['theme.json'].toString());
    assert.equal(m.id, 'alpha'); assert.equal(m.tier, 'Standard'); assert.equal(m.version, 1);
    assert.deepEqual(m.tracks, ['handyman']); assert.deepEqual(m.families, ['home-services']);
    assert.equal(m.categories.length, 11);
    assert.deepEqual(m.layoutVariantRules, { 'home-services': 'bold-split' });
    assert.deepEqual(m.motion, { default: 'Low', variantDefaults: {} });
    assert.ok(m.fonts.includes('Montserrat') && m.fonts.includes('Work Sans') && m.fonts.includes('Noto Sans Tamil'));
    assert.equal(m.internal, undefined);
    const tokens = f['css/tokens.css'].toString();
    assert.match(tokens, /--g4d-pal-primary, #7a3300/);
    assert.match(tokens, /--g4d-radius: 8px/);
    assert.match(tokens, /'Montserrat', 'Noto Sans Tamil'/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('build: the output equals the committed files (drift check) and a changed file is reported', async () => {
  const root = makeSource();
  const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-lib-'));
  try {
    for (const id of ['alpha', 'beta']) {
      const { files } = await buildThemeFiles(id, { root });
      for (const [p, data] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(lib, id, p)), { recursive: true }); fs.writeFileSync(path.join(lib, id, p), data); }
    }
    assert.deepEqual(await checkBuilt({ root, libraryDir: lib }), []);
    fs.appendFileSync(path.join(lib, 'alpha/css/base.css'), '/* hand edit */');
    fs.writeFileSync(path.join(lib, 'beta/templates/extra.html'), 'x');
    fs.rmSync(path.join(lib, 'beta/css/print.css'));
    const diffs = await checkBuilt({ root, libraryDir: lib });
    assert.ok(diffs.some((d) => /alpha\/css\/base\.css/.test(d) && /differs/.test(d)));
    assert.ok(diffs.some((d) => /beta\/templates\/extra\.html/.test(d) && /not produced/.test(d)));
    assert.ok(diffs.some((d) => /beta\/css\/print\.css/.test(d) && /missing/.test(d)));
  } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(lib, { recursive: true, force: true }); }
});

test('the real source tree: the shared CSS parses cleanly and only the five Standard theme ids are allowed', async () => {
  const { parseRules } = await import('../lib/css.mjs');
  for (const f of ['core', 'motion', 'print']) {
    const text = fs.readFileSync(path.join(SOURCE_ROOT, 'shared/css', `${f}.css`), 'utf8');
    const rules = parseRules(text);
    assert.ok(rules.length >= 1, f);
    assert.ok(!rules.some((r) => r.type === 'rule' && r.nested), `${f}: no nested rules`);
  }
  const allowed = ['free-service-pro', 'free-practice', 'free-studio', 'free-hospitality', 'free-shop-lite'];
  for (const id of standardThemeIds()) assert.ok(allowed.includes(id), id);
  assert.deepEqual(await checkBuilt(), [], 'run: node themes/cli.mjs build-themes');
});
