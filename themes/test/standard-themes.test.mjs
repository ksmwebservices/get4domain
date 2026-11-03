import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standardThemeIds, checkBuilt } from '../lib/build-themes.mjs';
import { loadTheme, listVendorThemeIds } from '../lib/theme.mjs';
import { packThemeDir } from '../lib/pack.mjs';
import { lintTheme } from '../lib/lint.mjs';
import { renderPage } from '../lib/render.mjs';
import { validatePreset, paletteFindings } from '../lib/preset.mjs';
import { THEME_TEXT } from '../lib/preset-build.mjs';
import { parse, findAll } from '../lib/html.mjs';
import { CATEGORIES, CATEGORY_IDS, FAMILIES } from '../lib/categories.mjs';
import { APPROVED_FONTS, LIMITS, FREE_LIMITS } from '../lib/vocabulary.mjs';
import { sampleContent, extremeContent, ENTITLEMENTS_ON } from '../fixtures/index.mjs';

// What each Standard theme is for (THEMES-CC-1). A theme is tested as soon as its source exists.
const DEFS = {
  'free-service-pro': { families: ['home-services', 'auto-services'], tracks: ['handyman'], count: 13, extras: [] },
  'free-practice': { families: ['healthcare', 'legal-finance', 'creative-consulting'], tracks: ['professional'], count: 11, extras: ['doctors'] },
  'free-studio': { families: ['education', 'wellness-beauty'], tracks: ['professional'], count: 5, extras: ['courses'] },
  'free-hospitality': { families: ['hospitality-property'], tracks: ['professional'], count: 4, extras: ['menu', 'packages', 'properties'] },
  'free-shop-lite': { families: ['fashion-lifestyle', 'food-grocery', 'electronics-home', 'gifts-books'], tracks: ['ecommerce'], count: 8, extras: [] },
};
const BASE_PAGES = ['home', 'about', 'services', 'gallery', 'contact', 'page', 'item'];
const built = standardThemeIds().filter((id) => DEFS[id]);
const pagesOf = (html) => findAll(parse(html), (n) => 'data-g4d-section' in n.attrs).map((n) => n.attrs['data-g4d-section']);
const inOrder = (seq, want) => { let i = -1; for (const w of want) { const j = seq.indexOf(w, i + 1); if (j < 0) return false; i = j; } return true; };

test('the committed Standard themes are exactly what the sources build', async () => {
  assert.deepEqual(await checkBuilt(), []);
});

for (const id of built) {
  const def = DEFS[id];
  const theme = () => loadTheme(id);

  test(`${id}: a Standard theme for ${def.families.join(', ')} with all ${def.count} of its categories`, () => {
    const t = theme();
    const m = t.manifest;
    assert.equal(m.id, id); assert.equal(m.tier, 'Standard'); assert.ok(!m.internal);
    assert.deepEqual([...m.families].sort(), [...def.families].sort());
    assert.deepEqual(m.tracks, def.tracks);
    assert.equal(m.categories.length, def.count);
    assert.deepEqual([...m.categories].sort(), CATEGORIES.filter((c) => def.families.includes(c.family)).map((c) => c.id).sort());
    assert.ok(m.fonts.length <= 12 && m.fonts.every((f) => APPROVED_FONTS.includes(f)) && m.fonts.includes('Noto Sans Tamil'));
    assert.deepEqual(m.motion, { default: 'Low', variantDefaults: {} }, 'Low motion by default');
    assert.ok(listVendorThemeIds().includes(id));
  });

  test(`${id}: ships the full page set`, () => {
    const t = theme();
    for (const p of [...BASE_PAGES, ...def.extras]) assert.equal(typeof t.templates[p], 'string', `${id} needs the ${p} template`);
  });

  test(`${id}: every category has a valid, contrast-safe preset that looks different from its neighbours`, () => {
    const t = theme();
    const presets = t.presets;
    assert.deepEqual(Object.keys(presets).sort(), [...t.manifest.categories].sort(), 'one preset per category, no others');
    for (const c of t.manifest.categories) {
      assert.deepEqual(validatePreset(presets[c], { manifest: t.manifest, file: `presets/${c}.json` }), [], c);
      assert.deepEqual(paletteFindings(presets[c].palette, THEME_TEXT), [], c);
      assert.ok(presets[c].services.en.length >= 4 && presets[c].services.en.length <= FREE_LIMITS.services, `${c} services`);
      assert.ok(presets[c].faqs.en.length >= 3 && presets[c].faqs.en.length <= FREE_LIMITS.faqs, `${c} faqs`);
      assert.equal(presets[c].services.ta.length, presets[c].services.en.length);
    }
    const distinct = (f) => new Set(Object.values(presets).map(f)).size;
    const n = def.count;
    assert.ok(distinct((p) => p.palette.light.primary) >= n, 'every category has its own primary colour');
    if (n >= 4) {
      assert.ok(distinct((p) => `${p.fonts.heading}/${p.fonts.body}`) >= 2, 'more than one font pairing');
      assert.ok(distinct((p) => p.hero.pattern) >= Math.min(3, n), 'more than two hero patterns');
    }
  });

  test(`${id}: home order, small footprint and a clean package`, () => {
    const t = theme();
    const seq = pagesOf(t.templates.home);
    const middle = def.tracks[0] === 'ecommerce' ? 'products' : 'services';
    assert.ok(inOrder(seq, ['hero', 'about', middle, 'highlights', 'why', 'gallery', 'reviews', 'faq', 'hours', 'contact']), `home order: ${seq.join(' > ')}`);
    const css = (k) => Buffer.byteLength(t.css[k] ?? '');
    assert.ok(css('tokens') + css('base') + css('print') < LIMITS.layoutCssBytes, `layout CSS ${css('tokens') + css('base') + css('print')} bytes`);
    assert.ok(css('motion') < LIMITS.motionCssBytes);
    const { zip, validation } = packThemeDir(t.dir);
    assert.deepEqual(validation.errors, []);
    assert.ok(zip.length < 150 * 1024, `zip ${zip.length} bytes`);
  });

  test(`${id}: passes the whole lint for a sample of its categories, entitlements on and off`, () => {
    const t = theme();
    const cats = [t.manifest.categories[0], t.manifest.categories[Math.floor(t.manifest.categories.length / 2)], t.manifest.categories.at(-1)];
    const r = lintTheme(t, { categories: [...new Set(cats)] });
    assert.deepEqual(r.findings.map((f) => `${f.rule} @ ${f.where}: ${f.message}`), []);
  });

  test(`${id}: looks right with little content: hidden empty sections, preset starter content, one item`, () => {
    const t = theme();
    const cat = t.manifest.categories[0];
    const render = (content) => renderPage({ theme: t, page: { slug: 'home' }, content, settings: {}, vendor: { id: 'v' }, host: { siteUrl: 'https://x.get4domain.com' }, entitlements: ENTITLEMENTS_ON });
    const empty = render(extremeContent(cat, 'empty'));
    const emptySections = pagesOf(empty.html);
    assert.ok(!emptySections.includes('gallery') && !emptySections.includes('stats'), 'gallery and stats hide when empty');
    assert.doesNotMatch(empty.html, /undefined|\[object|NaN/);
    assert.ok(emptySections.includes('faq') || emptySections.includes('services') || emptySections.includes('products'), 'the preset supplies starter content');
    assert.equal(findAll(parse(empty.html), (n) => n.tag === 'h1').length, 1);
    const one = sampleContent(cat);
    one.items = one.items.slice(0, 1); one.faqs = one.faqs.slice(0, 1); one.gallery = one.gallery.slice(0, 1); one.testimonials = one.testimonials.slice(0, 1); one.products = one.products.slice(0, 1);
    const r1 = render(one);
    assert.doesNotMatch(r1.html, /undefined|\[object|NaN/);
    assert.equal(r1.warnings.filter((w) => /^(unknown|element-removed|inline|preset-ignored)/.test(w)).length, 0);
  });

  test(`${id}: uses its variant rules and never hides the hero`, () => {
    const t = theme();
    for (const f of def.families) assert.equal(t.manifest.layoutVariantRules[f], FAMILIES[f].variant.id);
    const home = parse(t.templates.home);
    const hero = findAll(home, (n) => n.attrs['data-g4d-section'] === 'hero')[0];
    assert.equal(hero.attrs['data-g4d-optional'], 'false');
  });
}

test('coverage: the Standard themes that exist partition the 41 categories without overlap', () => {
  const seen = new Map();
  for (const id of built) for (const c of loadTheme(id).manifest.categories) { assert.ok(!seen.has(c), `${c} is in both ${seen.get(c)} and ${id}`); seen.set(c, id); }
  for (const c of seen.keys()) assert.ok(CATEGORY_IDS.includes(c));
  assert.ok(built.length >= 1, 'at least one Standard theme is built');
});

test('all five Standard themes exist and together cover each of the 41 categories exactly once', () => {
  assert.deepEqual([...built].sort(), Object.keys(DEFS).sort(), 'the five Standard themes');
  const owner = new Map();
  for (const id of built) for (const c of loadTheme(id).manifest.categories) owner.set(c, [...(owner.get(c) ?? []), id]);
  assert.equal(owner.size, 41);
  for (const c of CATEGORY_IDS) assert.deepEqual(owner.get(c)?.length, 1, `${c} belongs to exactly one theme: ${owner.get(c)}`);
  for (const c of CATEGORIES) {
    const id = owner.get(c.id)[0];
    assert.ok(DEFS[id].families.includes(c.family), `${c.id} (${c.family}) is in ${id}`);
  }
  const presets = built.reduce((n, id) => n + Object.keys(loadTheme(id).presets).length, 0);
  assert.equal(presets, 41, 'a preset for every category');
});

test('every Standard theme is valid on its own: package, hash, no outside address, no script', () => {
  for (const id of built) {
    const { zip, manifest, validation } = packThemeDir(loadTheme(id).dir);
    assert.equal(validation.ok, true, id);
    assert.match(manifest.contentHash, /^[0-9a-f]{64}$/);
    const text = Object.values(loadTheme(id).templates).join('\n') + Object.values(loadTheme(id).css).join('\n');
    assert.doesNotMatch(text, /<script|javascript:|@import|url\(\s*['"]?https?:/i, id);
    assert.ok(zip.length > 1000);
  }
});

test('the shared files are byte-identical in all five themes', () => {
  const ref = loadTheme(built[0]);
  for (const id of built.slice(1)) {
    const t = loadTheme(id);
    assert.equal(t.css.motion, ref.css.motion, `${id} motion.css`);
    assert.equal(t.css.print, ref.css.print, `${id} print.css`);
    const core = (x) => x.css.base.split('/* shared:core:end */')[0];
    assert.equal(core(t), core(ref), `${id} shared core in base.css`);
  }
});
