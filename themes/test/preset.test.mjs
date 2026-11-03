import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPresetSchema } from '../lib/preset-schema.mjs';
import { validatePreset, derivePalette, paletteFindings, PRESET_PATTERNS, FREE_LIMITS, presetStyle } from '../lib/preset.mjs';
import { validateManifest } from '../lib/schema.mjs';
import { packFiles, validatePackage } from '../lib/pack.mjs';
import { themeFromFiles, loadTheme } from '../lib/theme.mjs';
import { renderPage } from '../lib/render.mjs';
import { lintTheme } from '../lib/lint.mjs';
import { parse, findAll } from '../lib/html.mjs';
import { ratio } from '../lib/contrast.mjs';
import { categoryById, CATEGORY_IDS } from '../lib/categories.mjs';
import { sampleContent } from '../fixtures/index.mjs';
import { minimalFiles, minimalManifest, buf } from './helpers/minimal-theme.mjs';
import { goodPreset, allPresets, PRESET_FONTS } from './helpers/preset.mjs';

const FONTS_MANIFEST = { categories: ['plumber'], families: ['home-services'], tracks: ['handyman'], layoutVariantRules: { 'home-services': 'bold-split' }, fonts: PRESET_FONTS.slice(0, 4) };
const codes = (errs) => errs.map((e) => e.code);
const TOKENS = { text: '#14211e', muted: '#4a5a56', textDark: '#e8f0ee', mutedDark: '#a9bab6' };

// ---------------------------------------------------------------- schema and validation
test('the committed preset schema equals the schema built from the vocabulary', () => {
  const onDisk = JSON.parse(fs.readFileSync(new URL('../schema/preset.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(onDisk, buildPresetSchema());
});

test('a valid preset has no errors', () => {
  assert.deepEqual(validatePreset(goodPreset('plumber'), { manifest: minimalManifest(FONTS_MANIFEST) }), []);
  for (const id of CATEGORY_IDS) assert.deepEqual(validatePreset(goodPreset(id, { fonts: { heading: 'Poppins', body: 'Inter' } }), { manifest: { ...minimalManifest(FONTS_MANIFEST), categories: [id] } }), [], id);
});

test('every field of a preset is checked', () => {
  const ctx = { manifest: minimalManifest(FONTS_MANIFEST) };
  const bad = (preset, code, label) => assert.ok(codes(validatePreset(preset, ctx)).includes(code), `${label}: ${JSON.stringify(validatePreset(preset, ctx))}`);
  const g = () => goodPreset('plumber');
  bad({ ...g(), extra: 1 }, 'additional', 'unknown field');
  for (const k of ['category', 'palette', 'fonts', 'blocks', 'hero', 'services', 'faqs']) { const p = g(); delete p[k]; bad(p, 'required', `missing ${k}`); }
  bad({ ...g(), palette: { light: { primary: '#7a3300', accent: '#8a3b00' }, dark: g().palette.dark } }, 'required', 'missing background');
  bad({ ...g(), palette: { ...g().palette, light: { primary: 'red', accent: '#8a3b00', background: '#fff8f1' } } }, 'pattern', 'colour must be #rrggbb');
  bad({ ...g(), fonts: { heading: 'Comic Sans', body: 'Inter' } }, 'enum', 'unknown font');
  bad({ ...g(), fonts: { heading: 'Lora', body: 'Inter' } }, 'font-not-in-manifest', 'font not in manifest.fonts');
  const [lead, ...rest] = categoryById('plumber').extraBlocks;
  bad({ ...g(), blocks: rest }, 'blocks-mismatch', 'a block is missing');
  bad({ ...g(), blocks: [...rest, lead] }, 'blocks-lead', 'lead block must come first');
  bad({ ...g(), blocks: [lead, lead, ...rest] }, 'blocks-mismatch', 'duplicate block');
  bad({ ...g(), hero: { pattern: 'photo' } }, 'enum', 'unknown hero pattern');
  bad({ ...g(), services: { ...g().services, en: Array.from({ length: FREE_LIMITS.services + 1 }, (_, i) => ({ name: `S${i}`, description: 'x' })) } }, 'maxItems', 'more than 8 services');
  bad({ ...g(), faqs: { ...g().faqs, en: Array.from({ length: FREE_LIMITS.faqs + 1 }, () => ({ q: 'q?', a: 'a' })) } }, 'maxItems', 'more than 6 FAQs');
  bad({ ...g(), services: { en: g().services.en } }, 'required', 'Tamil services missing');
  bad({ ...g(), faqs: { en: g().faqs.en, ta: [] } }, 'minItems', 'Tamil FAQs empty');
  bad({ ...g(), sections: { hidden: ['hero'] } }, 'section-hero', 'hero cannot be hidden');
  assert.deepEqual(validatePreset(g(), { manifest: minimalManifest(FONTS_MANIFEST), file: 'presets/plumber.json' }), []);
  assert.ok(codes(validatePreset(g(), { manifest: minimalManifest(FONTS_MANIFEST), file: 'presets/dentist.json' })).includes('category-file'), 'file name must match the category');
});

test('the hero patterns are a closed list', () => {
  assert.deepEqual([...PRESET_PATTERNS].sort(), ['blobs', 'chevrons', 'diagonal', 'dots', 'grid', 'rays', 'rings', 'waves']);
  assert.deepEqual(FREE_LIMITS, { pages: 1, services: 8, gallery: 5, faqs: 6 });
});

// ---------------------------------------------------------------- palette
test('derivePalette fills primary-contrast, surface and border in the same way every time', () => {
  const p = goodPreset().palette;
  const a = derivePalette('light', p.light); const b = derivePalette('light', p.light);
  assert.deepEqual(a, b);
  assert.ok(ratio(a.primaryContrast, a.primary) >= 4.5);
  assert.notEqual(a.surface, a.bg); assert.notEqual(a.border, a.bg);
  const d = derivePalette('dark', p.dark);
  assert.ok(ratio(d.primaryContrast, d.primary) >= 4.5);
  assert.match(a.surface, /^#[0-9a-f]{6}$/);
});

test('paletteFindings: AA on the theme text and muted colours, accent text, and the button, in light and dark', () => {
  assert.deepEqual(paletteFindings(goodPreset().palette, TOKENS), []);
  const weak = goodPreset().palette; weak.light.accent = '#f0a070';
  assert.ok(paletteFindings(weak, TOKENS).some((f) => /accent/.test(f) && /light/.test(f)));
  const dim = goodPreset().palette; dim.dark.background = '#d0d0d0';
  assert.ok(paletteFindings(dim, TOKENS).some((f) => /dark/.test(f)));
  const lowBtn = goodPreset().palette; lowBtn.light.primary = '#7a7a7a';
  assert.ok(paletteFindings(lowBtn, TOKENS).some((f) => /button|primary/.test(f)));
});

// ---------------------------------------------------------------- manifest: more fonts are allowed now
test('a theme may list up to twelve approved fonts (presets use different pairs per category)', () => {
  const six = ['Inter', 'Poppins', 'Montserrat', 'Work Sans', 'Lora', 'Noto Sans Tamil'];
  assert.deepEqual(validateManifest(minimalManifest({ fonts: six })), []);
  assert.ok(validateManifest(minimalManifest({ fonts: [...six, 'Nunito', 'Manrope', 'DM Sans', 'Merriweather', 'Playfair Display', 'Noto Serif Tamil', 'Inter'] })).length > 0, 'duplicates and more than twelve are refused');
});

// ---------------------------------------------------------------- package format
const withPreset = (name, data, manifestOver = FONTS_MANIFEST) => ({ ...minimalFiles(manifestOver), [`presets/${name}.json`]: buf(typeof data === 'string' ? data : JSON.stringify(data)) });

test('a package may carry presets/<category>.json; they are validated; the zip stays deterministic', () => {
  const a = packFiles(withPreset('plumber', goodPreset()));
  assert.ok(a.zip.equals(packFiles(withPreset('plumber', goodPreset())).zip));
  const r = validatePackage(a.zip);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('bad presets in a package are refused', () => {
  const code = (files) => validatePackage(packFiles(files).zip).errors.map((e) => e.code);
  assert.ok(code(withPreset('dentist', goodPreset('dentist'))).includes('preset-category'), 'category not in the manifest');
  assert.ok(code(withPreset('plumber', '{not json')).includes('preset-invalid'));
  assert.ok(code(withPreset('plumber', { ...goodPreset(), hero: { pattern: 'photo' } })).includes('preset-invalid'));
  assert.ok(code(withPreset('plumber', goodPreset('plumber', { fonts: { heading: 'Lora', body: 'Inter' } }))).includes('preset-invalid'), 'font not in manifest.fonts');
  assert.ok(code(withPreset('nonsense', goodPreset())).includes('preset-invalid'), 'unknown category id');
  assert.ok(code({ ...minimalFiles(FONTS_MANIFEST), 'presets/notes.txt': buf('x') }).includes('unknown-file'));
  assert.ok(code({ ...minimalFiles(FONTS_MANIFEST), 'presets/sub/plumber.json': buf('{}') }).includes('unknown-file'));
});

test('themeFromFiles loads presets and reports broken ones', () => {
  const t = themeFromFiles(withPreset('plumber', goodPreset()));
  assert.equal(t.presets.plumber.category, 'plumber');
  const broken = themeFromFiles(withPreset('plumber', '{nope'));
  assert.deepEqual(broken.presets, {});
  assert.equal(broken.presetErrors.length, 1);
  assert.deepEqual(themeFromFiles(minimalFiles()).presets, {});
});

// ---------------------------------------------------------------- renderer
const TPL = `<a class="skip-link" href="#main">{{ui.skip}}</a>
<header><g4d-header-nav label="Main"></g4d-header-nav></header>
<main id="main">
<section data-g4d-section="hero" data-g4d-optional="false"><h1>{{hero.title}}</h1></section>
<section data-g4d-section="services" data-g4d-optional="true"><ul><template data-g4d-each="items"><li class="svc">{{item.name}}|{{item.description}}|{{item.price}}</li></template></ul></section>
<section data-g4d-section="highlights" data-g4d-optional="true"><template data-g4d-each="blocks"><div class="blk" data-block="{{block.key}}">{{block.title}}</div></template></section>
<section data-g4d-section="stats" data-g4d-optional="true"><p>stats</p></section>
<section data-g4d-section="faq" data-g4d-optional="true"><template data-g4d-each="faqs"><details class="q"><summary>{{faq.q}}</summary><p>{{faq.a}}</p></details></template></section>
</main><g4d-footer></g4d-footer>`;
const theme = (presets = { plumber: goodPreset() }, over = {}) => ({ manifest: { ...minimalManifest(FONTS_MANIFEST), ...over }, templates: { home: TPL }, css: {}, presets });
const run = (t, content, extra = {}) => renderPage({ theme: t, page: { slug: 'home' }, content, settings: {}, vendor: { id: 'v' }, host: { siteUrl: 'https://x.get4domain.com' }, ...extra });
const wrapper = (html) => parse(html)[0];
const sections = (html) => findAll(parse(html), (n) => 'data-g4d-section' in n.attrs).map((n) => n.attrs['data-g4d-section']);

test('a preset becomes the default look for its category: palette, fonts, hero pattern', () => {
  const w = wrapper(run(theme(), sampleContent('plumber')).html);
  const s = w.attrs.style;
  for (const v of ['--g4d-pal-primary:#7a3300', '--g4d-pal-accent:#8a3b00', '--g4d-pal-bg:#fff8f1', '--g4d-pal-primary-d:#ff9d57', '--g4d-pal-accent-d:#ffb27d', '--g4d-pal-bg-d:#17100b']) assert.ok(s.includes(v), `${v} in ${s}`);
  for (const v of ['--g4d-pal-primary-contrast:', '--g4d-pal-surface:', '--g4d-pal-border:', '--g4d-pal-primary-contrast-d:', '--g4d-pal-surface-d:', '--g4d-pal-border-d:']) assert.ok(s.includes(v), v);
  assert.match(s, /--g4d-font-heading:'Montserrat'/);
  assert.match(s, /--g4d-font-body:'Work Sans'/);
  assert.equal(w.attrs['data-pattern'], 'rays');
});

test('the preset orders the extra blocks; the category lead block is always first', () => {
  const html = run(theme(), sampleContent('plumber')).html;
  const keys = findAll(parse(html), (n) => 'data-block' in n.attrs).map((n) => n.attrs['data-block']);
  const [lead, ...rest] = categoryById('plumber').extraBlocks;
  assert.deepEqual(keys, [lead, ...[...rest].reverse()]);
  assert.equal(keys[0], lead);
});

test('the preset hides sections by default; the vendor setting replaces it', () => {
  assert.ok(!sections(run(theme(), sampleContent('plumber')).html).includes('stats'));
  assert.ok(sections(run(theme(), sampleContent('plumber'), { settings: { hiddenSections: [] } }).html).includes('stats'));
  assert.ok(!sections(run(theme(), sampleContent('plumber'), { settings: { hiddenSections: ['faq'] } }).html).includes('faq'));
});

test('the preset can set the default section order; the vendor order wins', () => {
  const p = goodPreset('plumber', { sections: { order: ['highlights', 'services'], hidden: [] } });
  assert.deepEqual(sections(run(theme({ plumber: p }), sampleContent('plumber')).html), ['hero', 'highlights', 'services', 'stats', 'faq']);
  assert.deepEqual(sections(run(theme({ plumber: p }), sampleContent('plumber'), { settings: { sectionOrder: ['faq', 'services'] } }).html), ['hero', 'faq', 'services', 'highlights', 'stats']);
});

test("the vendor's own settings override the preset", () => {
  const w = wrapper(run(theme(), sampleContent('plumber'), { settings: { accent: '#0a5c3d', accentDark: '#7fe0b5', fontHeading: 'Inter' } }).html);
  assert.ok(w.attrs.style.includes('--g4d-pal-accent:#0a5c3d'));
  assert.ok(w.attrs.style.includes('--g4d-pal-accent-d:#7fe0b5'));
  assert.ok(!w.attrs.style.includes('#8a3b00'), 'the preset accent is replaced');
  assert.match(w.attrs.style, /--g4d-font-heading:'Inter'/);
  assert.match(w.attrs.style, /--g4d-font-body:'Work Sans'/, 'the other preset value stays');
  assert.ok(w.attrs.style.includes('--g4d-pal-primary:#7a3300'));
});

test('with little content the preset supplies generic services and FAQs in the visitor language, and never overrides the vendor', () => {
  const none = { ...sampleContent('plumber'), items: [], faqs: [] };
  const en = run(theme(), none).html;
  assert.equal(findAll(parse(en), (n) => n.attrs.class === 'svc').length, 2);
  assert.match(en, /Tap repair\|Fixed properly/);
  assert.equal(findAll(parse(en), (n) => n.attrs.class === 'q').length, 1);
  const ta = run(theme(), { ...none, lang: 'ta' }).html;
  assert.match(ta, /குழாய் பழுது/);
  assert.match(ta, /முதலில் விலை/);
  const own = run(theme(), sampleContent('plumber')).html;
  assert.equal(findAll(parse(own), (n) => n.attrs.class === 'svc').length, 6);
  assert.doesNotMatch(own, /Tap repair/);
  assert.doesNotMatch(en, /undefined|null/);
});

test('without a preset nothing changes; an unusable preset is ignored with a warning', () => {
  const w = wrapper(run(theme({}), sampleContent('plumber')).html);
  assert.equal(w.attrs.style, undefined);
  assert.equal(w.attrs['data-pattern'], undefined);
  const bad = run(theme({ plumber: goodPreset('plumber', { fonts: { heading: 'Lora', body: 'Inter' } }) }), sampleContent('plumber'));
  assert.ok(bad.warnings.includes('preset-ignored:fonts'));
  assert.doesNotMatch(wrapper(bad.html).attrs.style ?? '', /Lora/);
});

test('presetStyle is pure and deterministic', () => {
  assert.equal(presetStyle(goodPreset()), presetStyle(goodPreset()));
});

// ---------------------------------------------------------------- lint: preset-valid
const starter = () => loadTheme('_starter');
const withPresets = (presets, css = '') => { const t = starter(); return { ...t, presets, css: { ...t.css, base: `${t.css.base}\n${css}` } }; };
const PATTERN_CSS = '.g4d-theme[data-pattern=rays] .hero { background-image: none; }';
const full = (over = {}) => allPresets(over);
const presetFindings = (t, cats = ['plumber', 'dentist']) => lintTheme(t, { categories: cats }).findings.filter((f) => f.rule === 'preset-valid');

test('lint preset-valid: a theme with a complete, valid set of presets passes; a theme without presets is not asked for any', () => {
  assert.deepEqual(presetFindings(starter()), []);
  assert.deepEqual(presetFindings(withPresets(full(), PATTERN_CSS)).map((f) => f.message), []);
});

test('lint preset-valid: red fixtures', () => {
  const all = full();
  const cases = {
    'a category has no preset': (() => { const p = { ...all }; delete p.dentist; return withPresets(p, PATTERN_CSS); })(),
    'palette fails contrast': (() => { const p = { ...all, plumber: goodPreset('plumber', { fonts: { heading: 'Poppins', body: 'Inter' }, palette: { light: { primary: '#7a3300', accent: '#f5c9a0', background: '#fff8f1' }, dark: goodPreset().palette.dark } }) }; return withPresets(p, PATTERN_CSS); })(),
    'font not in the theme': withPresets({ ...all, plumber: goodPreset('plumber', { fonts: { heading: 'Lora', body: 'Inter' } }) }, PATTERN_CSS),
    'lead block not first': withPresets({ ...all, plumber: goodPreset('plumber', { fonts: { heading: 'Poppins', body: 'Inter' }, blocks: [...categoryById('plumber').extraBlocks].reverse() }) }, PATTERN_CSS),
    'pattern has no CSS in the theme': withPresets(all, ''),
    'hidden section does not exist': withPresets({ ...all, plumber: goodPreset('plumber', { fonts: { heading: 'Poppins', body: 'Inter' }, sections: { hidden: ['nonexistent'] } }) }, PATTERN_CSS),
    'the hero cannot be hidden by default': withPresets({ ...all, plumber: goodPreset('plumber', { fonts: { heading: 'Poppins', body: 'Inter' }, sections: { hidden: ['hero'] } }) }, PATTERN_CSS),
    'schema violation': withPresets({ ...all, plumber: { ...goodPreset('plumber', { fonts: { heading: 'Poppins', body: 'Inter' } }), hero: { pattern: 'photo' } } }, PATTERN_CSS),
  };
  for (const [name, t] of Object.entries(cases)) {
    const r = lintTheme(t, { categories: ['plumber', 'dentist'] });
    assert.ok(r.findings.some((f) => f.rule === 'preset-valid'), `${name}: expected a preset-valid finding, got ${[...new Set(r.findings.map((f) => f.rule))].join(', ')}`);
    assert.equal(r.ok, false, name);
  }
});

test('lint category-fit-order follows the preset order, with the lead block first', () => {
  const t = withPresets(full(), PATTERN_CSS);
  const r = lintTheme(t, { categories: ['plumber', 'electrician'] });
  assert.deepEqual(r.findings.filter((f) => f.rule === 'category-fit-order'), []);
});

test('lint preset-valid: a broken preset file is reported', () => {
  const t = withPresets(full(), PATTERN_CSS);
  t.presetErrors = [{ file: 'presets/plumber.json', message: 'not valid JSON' }];
  assert.ok(presetFindings(t).some((f) => /not valid JSON/.test(f.message)));
});
