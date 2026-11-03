import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintTheme, lintThemeBrowser, RULE_IDS } from '../lib/lint.mjs';
import { loadTheme } from '../lib/theme.mjs';
import { renderPage } from '../lib/render.mjs';
import { CATEGORY_IDS } from '../lib/categories.mjs';
import { suggestAccent, ratio } from '../lib/contrast.mjs';
import { parseRules } from '../lib/css.mjs';
import { openBrowser } from '../lib/browser.mjs';

const starter = () => loadTheme('_starter');
const clone = (t, over = {}) => ({ ...t, manifest: { ...t.manifest, ...(over.manifest ?? {}) }, templates: { ...t.templates, ...(over.templates ?? {}) }, css: { ...t.css, ...(over.css ?? {}) }, assets: t.assets });
const SMALL = ['plumber', 'dentist', 'restaurant-cafe', 'jewellery'];
const ruleSet = (r) => new Set(r.findings.map((f) => f.rule));
const lint = (t, opts = {}) => lintTheme(t, { categories: SMALL, ...opts });

// ---------- green: the reference theme passes everything, for every category ----------
test('the _starter theme passes every rule for all 41 categories (English, Tamil and the extreme fixtures)', () => {
  const r = lintTheme(starter(), { categories: CATEGORY_IDS });
  assert.deepEqual(r.findings.map((f) => `${f.rule} @ ${f.where}: ${f.message}`), []);
  assert.equal(r.ok, true);
  assert.equal(r.categories.length, 41);
  for (const id of RULE_IDS.filter((x) => x !== 'responsive-browser')) assert.ok(r.rulesChecked.includes(id), `${id} was checked`);
});

test('the _starter theme is marked internal and is not a design', () => {
  const t = starter();
  assert.equal(t.manifest.internal, true);
  assert.match(t.manifest.name, /internal/i);
});

// ---------- red fixtures: every rule must fail on a deliberately bad theme ----------
const bad = (t) => ({
  'manifest-valid': { theme: clone(t, { manifest: { tier: 'Gold' } }) },
  'no-script-tag': { theme: clone(t, { templates: { home: `${t.templates.home}<script>alert(1)</script>` } }) },
  'no-inline-handler': { theme: clone(t, { templates: { home: t.templates.home.replace('<main id="main">', '<main id="main" onclick="x()">') } }) },
  'no-forbidden-element': { theme: clone(t, { templates: { home: `${t.templates.home}<iframe src="/x"></iframe><form></form><input name="q">` } }) },
  'no-seo-output': { theme: clone(t, { templates: { home: `<title>x</title><meta name="description" content="x">${t.templates.home}` } }) },
  'no-external-request': { theme: clone(t, { templates: { home: `${t.templates.home}<img src="https://cdn.example/x.png" alt="x" width="1" height="1">` } }) },
  'iframe-hosts': { theme: t, opts: { render: (i) => { const r = renderPage(i); return { ...r, html: r.html.replace('</div>', '<iframe src="https://evil.example/e" title="x"></iframe></div>') }; } } },
  'css-hygiene': { theme: clone(t, { css: { base: `${t.css.base}\n.g4d-theme .x { color: red !important; }\n@import 'x.css';` } }) },
  'css-scoped': { theme: clone(t, { css: { base: `${t.css.base}\nbody { margin: 0; }` } }) },
  'approved-fonts': { theme: clone(t, { css: { tokens: t.css.tokens.replace("'Inter'", "'Comic Sans MS'") } }) },
  'tamil-fonts': { theme: clone(t, { css: { tokens: t.css.tokens.replace(/'Noto Sans Tamil', 'Nirmala UI', 'Latha', /g, '') } }) },
  'tokens-defined': { theme: clone(t, { css: { tokens: t.css.tokens.replace('--g4d-border: #d3dcd9;', '') } }) },
  'contrast-tokens': { theme: clone(t, { css: { tokens: t.css.tokens.replace('--g4d-muted: #4a5a56;', '--g4d-muted: #bbbbbb;') } }) },
  'contrast-accent': { theme: t, opts: { vendorAccent: '#ffff00' } },
  'one-h1': { theme: clone(t, { templates: { home: t.templates.home.replace('<h1>{{hero.title}}</h1>', '<h1>{{hero.title}}</h1><h1>second</h1>') } }) },
  landmarks: { theme: clone(t, { templates: { home: t.templates.home.replace('<main id="main">', '<div id="main">').replace('</main>', '</div>') } }) },
  'skip-link': { theme: clone(t, { templates: { home: t.templates.home.replace(/<a class="skip-link"[^>]*>[^<]*<\/a>/, '') } }) },
  'language-attr': { theme: clone(t, { templates: { home: `${t.templates.home}<p lang="en">x</p>` } }) },
  'alt-text': { theme: clone(t, { templates: { home: t.templates.home.replace('alt="{{hero.imageAlt}}" ', '') } }) },
  'form-labels': { theme: t, opts: { render: (i) => { const r = renderPage(i); return { ...r, html: r.html.replace('</div>', '<input name="q" type="text"></div>') }; } } },
  'touch-targets': { theme: clone(t, { css: { base: t.css.base.replace('.g4d-theme :is(a, button, summary) { min-height: var(--g4d-touch); }', '.g4d-theme :is(a, button, summary) { color: inherit; }') } }) },
  'responsive-static': { theme: clone(t, { css: { base: `${t.css.base}\n.g4d-theme .x { width: 800px; }` } }) },
  'text-stretch': { theme: clone(t, { css: { base: t.css.base.replace(' overflow-wrap: anywhere;', '') } }) },
  'css-budget-layout': { theme: clone(t, { css: { base: `${t.css.base}\n/* ${'x'.repeat(41000)} */` } }) },
  'css-budget-motion': { theme: clone(t, { css: { motion: `${t.css.motion}\n/* ${'x'.repeat(7000)} */` } }) },
  'html-budget': { theme: clone(t, { templates: { about: `${t.templates.about}<!-- ${'x'.repeat(103000)} -->` } }) },
  'reduced-motion': { theme: clone(t, { css: { motion: t.css.motion.replace(/@media \(prefers-reduced-motion:reduce\)[\s\S]*$/, '') } }) },
  'hero-visible': { theme: clone(t, { css: { base: `${t.css.base}\n.g4d-theme .hero { opacity: 0; }` } }) },
  'motion-properties': { theme: clone(t, { css: { motion: `${t.css.motion}\n@keyframes bad{from{width:0}to{width:100%}}\n.g4d-theme .g4d-lift{transition:height .3s}` } }) },
  'motion-count': { theme: clone(t, { templates: { home: t.templates.home.replace('</main>', `<section data-g4d-section="extra" data-g4d-optional="true">${'<div class="g4d-float"></div>'.repeat(13)}</section></main>`) } }) },
  'slots-required': { theme: clone(t, { templates: { home: t.templates.home.replace('<g4d-reviews></g4d-reviews>', '') } }) },
  'slots-reserve-space': { theme: clone(t, { css: { base: t.css.base.replace(/\.g4d-theme \.g4d-slot--map \{[^}]*\}/, '') } }) },
  'bindings-known': { theme: clone(t, { templates: { home: `${t.templates.home}<p>{{foo.bar}}</p><g4d-teleporter></g4d-teleporter>` } }) },
  'entitlements-render': { theme: clone(t, { templates: { home: t.templates.home.replace('</main>', '<section data-g4d-section="vid" data-g4d-optional="true"><div class="wrap"><g4d-video></g4d-video></div></section></main>') } }) },
  'print-stylesheet': { theme: clone(t, { css: { print: '' } }) },
  'category-renders': { theme: clone(t, { templates: { home: t.templates.home.replace('data-block="{{block.key}}"', 'data-x="{{block.key}}"') } }) },
  'category-fit-order': { theme: t, opts: { render: (i) => renderPage({ ...i, content: { ...i.content, blocks: [...(i.content.blocks ?? [])].reverse() } }) } },
});

test('every lint rule has a red fixture that fails it, and the good theme does not', () => {
  const t = starter();
  const fixtures = bad(t);
  const missing = RULE_IDS.filter((id) => !fixtures[id] && id !== 'responsive-browser');
  assert.deepEqual(missing, [], 'rules without a red fixture');
  for (const [id, f] of Object.entries(fixtures)) {
    assert.ok(RULE_IDS.includes(id), `${id} is a real rule id`);
    const r = lint(f.theme, f.opts ?? {});
    assert.equal(r.ok, false, `${id}: the bad theme must fail`);
    assert.ok(ruleSet(r).has(id), `${id}: expected a finding for this rule, got ${[...ruleSet(r)].join(', ')}`);
  }
});

test('the tier is a price class only: no slot rule depends on it', () => {
  const t = starter();
  for (const tier of ['Standard', 'Premium']) {
    const r = lint(clone(t, { manifest: { tier } }));
    assert.deepEqual(r.findings.map((f) => `${f.rule}:${f.message}`), [], tier);
  }
  const noGated = clone(t, { templates: Object.fromEntries(Object.entries(t.templates).map(([k, v]) => [k, v.replace(/<g4d-(video|cart|booking)><\/g4d-\1>/g, '')])) });
  assert.deepEqual(lint(clone(noGated, { manifest: { tier: 'Premium' } })).findings.filter((f) => f.rule === 'slots-required'), [], 'a Premium theme need not place video');
});

test('any theme may place video, cart and booking; the starter places all three and renders cleanly with entitlements on and off', () => {
  const t = starter();
  const placed = new Set(Object.values(t.templates).flatMap((h) => [...h.matchAll(/<g4d-(video|cart|booking)>/g)].map((m) => m[1])));
  assert.deepEqual([...placed].sort(), ['booking', 'cart', 'video']);
  assert.equal(lint(t, { categories: CATEGORY_IDS }).ok, true);
});

test('a section that only hosts a gated slot leaves a gap when the entitlement is off, and the lint says so', () => {
  const t = starter();
  const gap = clone(t, { templates: { home: t.templates.home.replace('</main>', '<section data-g4d-section="vid" data-g4d-optional="true"><div class="wrap"><g4d-video></g4d-video></div></section></main>') } });
  const r = lint(gap);
  const f = r.findings.find((x) => x.rule === 'entitlements-render');
  assert.ok(f && /entitlement/i.test(f.message) && /vid/.test(f.message), JSON.stringify(f));
});

test('an Ecommerce category needs the product-grid slot', () => {
  const t = starter();
  const noGrid = clone(t, { templates: Object.fromEntries(Object.entries(t.templates).map(([k, v]) => [k, v.replaceAll('<g4d-product-grid></g4d-product-grid>', '')])) });
  assert.ok(ruleSet(lintTheme(noGrid, { categories: ['jewellery'] })).has('slots-required'));
  assert.ok(!ruleSet(lintTheme(noGrid, { categories: ['plumber'] })).has('slots-required'));
});

test('findings say where the problem is and are readable', () => {
  const r = lint(bad(starter())['no-script-tag'].theme);
  const f = r.findings.find((x) => x.rule === 'no-script-tag');
  assert.match(f.where, /templates\/home\.html/);
  assert.ok(f.message.length > 10 && f.level === 'error');
});

// ---------- contrast and the vendor accent ----------
test('suggestAccent returns a colour of the same family that passes AA on every background', () => {
  for (const accent of ['#ffff00', '#00ff00', '#ff9900', '#808080', '#66ccff']) {
    const fix = suggestAccent(accent, ['#ffffff', '#f2f6f5']);
    assert.ok(fix, accent);
    for (const bg of ['#ffffff', '#f2f6f5']) assert.ok(ratio(fix, bg) >= 4.5, `${accent} -> ${fix} on ${bg}`);
  }
  assert.equal(suggestAccent('#0a5f7a', ['#ffffff']), '#0a5f7a', 'a passing colour is returned unchanged');
  const dark = suggestAccent('#222222', ['#0f1615', '#172220']);
  assert.ok(ratio(dark, '#0f1615') >= 4.5);
});

test('a failing vendor accent is reported with a ready-to-use fix, and a passing one is accepted', () => {
  const t = starter();
  const r = lint(t, { vendorAccent: '#ffff00' });
  const f = r.findings.find((x) => x.rule === 'contrast-accent');
  assert.ok(f && /#[0-9a-f]{6}/i.test(f.suggestion), JSON.stringify(f));
  assert.ok(ratio(f.suggestion, '#ffffff') >= 4.5);
  assert.equal(lint(t, { vendorAccent: '#0a5f7a' }).ok, true);
});

// ---------- css reader ----------
test('the css reader handles nesting, strings, comments and url(;) safely', () => {
  const rules = parseRules('/* c */ .a, .b { color: red; background: url("data:image/svg+xml;utf8,<svg/>"); } @media (min-width: 40rem) { .c { width: 10px !important } } @keyframes k { from { opacity: 0 } to { opacity: 1 } } @import "x.css";');
  assert.equal(rules[0].selectors.length, 2);
  assert.equal(rules[0].decls.length, 2);
  assert.equal(rules[1].name, 'media');
  assert.equal(rules[1].rules[0].decls[0].important, true);
  assert.equal(rules[2].name, 'keyframes');
  assert.equal(rules[3].name, 'import');
});

// ---------- browser check (needs the Playwright already on this machine; skipped when absent) ----------
test('responsive-browser: no horizontal scroll at the six widths for the good theme; a wide element is caught', async (t) => {
  const b = await openBrowser();
  if (!b.available) { t.skip(b.reason); return; }
  try {
    const good = await lintThemeBrowser(starter(), { categories: ['plumber'], browser: b.browser, browserWidths: [360, 1280] });
    assert.deepEqual(good.findings.filter((f) => f.rule === 'responsive-browser'), []);
    const wide = clone(starter(), { css: { base: `${starter().css.base}\n.g4d-theme .hero { width: 2000px; }` } });
    const r = await lintThemeBrowser(wide, { categories: ['plumber'], browser: b.browser, browserWidths: [360] });
    assert.ok(ruleSet(r).has('responsive-browser'));
  } finally { await b.close(); }
});
