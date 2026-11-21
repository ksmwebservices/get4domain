import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildStarter, catalogueByPack, composeSections, homeSections, homeTemplate, lookSignature, starterRecipes, STARTER_DIR } from '../lib/starter-build.mjs';
import { FLAVOURS } from '../starter/flavours.mjs';
import { lintTheme } from '../lib/lint.mjs';
import { themeFromFiles, listVendorThemeIds } from '../lib/theme.mjs';
import { validatePackage, computeContentHash } from '../lib/pack.mjs';
import { validateManifest } from '../lib/schema.mjs';
import { checkBuilt } from '../lib/build-themes.mjs';
import { hasCategory } from '../lib/categories.mjs';

/** splits a selector list on the commas that are not inside brackets (:is(a, b) is one selector) */
const splitTop = (sel) => { const out = []; let depth = 0; let cur = ''; for (const ch of sel) { if (ch === '(') depth += 1; if (ch === ')') depth -= 1; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };

// Starter themes (TM1 M6): 32 real packages built from data. These tests are about the KIT side (well-formed, distinct, deterministic, lint-clean); which packs, add-ons and tags are real is checked by the backend test.
const recipes = starterRecipes();
const built = new Map();
const get = async (r) => { if (!built.has(r.id)) built.set(r.id, await buildStarter(r)); return built.get(r.id); };

test('there are at least 32 recipes with unique, well-formed ids that do not collide with the library', () => {
  assert.ok(recipes.length >= 32);
  assert.equal(new Set(recipes.map((r) => r.id)).size, recipes.length);
  const library = new Set(listVendorThemeIds());
  for (const r of recipes) { assert.match(r.id, /^[a-z0-9]+(-[a-z0-9]+)*$/); assert.ok(r.id.length >= 3 && r.id.length <= 40, r.id); assert.ok(!library.has(r.id), `${r.id} is a library id`); assert.ok(r.id.startsWith('starter-'), r.id); }
});

test('every recipe names a real base, real flavours, real kit categories of that base and approved fonts', async () => {
  const { APPROVED_FONTS } = await import('../lib/vocabulary.mjs');
  for (const r of recipes) {
    assert.ok(listVendorThemeIds().includes(r.base), `${r.id}: base ${r.base}`);
    assert.ok(r.flavours.length >= 2 && r.flavours.every((f) => FLAVOURS[f]), `${r.id}: flavours`);
    assert.ok(r.categories.length >= 1 && r.categories.every(hasCategory), `${r.id}: categories`);
    assert.ok([r.fonts.heading, r.fonts.body].every((f) => APPROVED_FONTS.includes(f)), `${r.id}: fonts`);
    assert.ok(r.packs.length >= 1 && new Set(r.packs).size === r.packs.length, `${r.id}: packs`);
  }
});

test('no two recipes share a look (base, colour, fonts, corners, flavours and home layout)', () => {
  const seen = new Map();
  for (const r of recipes) { const k = lookSignature(r); assert.ok(!seen.has(k), `${r.id} looks the same as ${seen.get(k)}`); seen.set(k, r.id); }
  // and the colours really differ: at most one recipe per (hue, saturation) on the same base
  const hues = new Set(recipes.map((r) => `${r.base}|${r.palette.h}|${r.palette.s}`)); assert.equal(hues.size, recipes.length);
});

test('every starter builds into a package that passes the kit validator, the manifest schema and the full lint', async () => {
  for (const r of recipes) {
    const b = await get(r);
    const v = validatePackage(b.zip); assert.deepEqual(v.errors, [], `${r.id}: ${JSON.stringify(v.errors.slice(0, 3))}`);
    assert.deepEqual(validateManifest(b.manifest, { mode: 'package' }), [], r.id);
    const l = lintTheme(themeFromFiles(b.files), {}); assert.deepEqual(l.findings.map((f) => `${f.rule}@${f.where}: ${f.message}`), [], r.id);
  }
});

test('a starter says honestly what it is: built by Get4Domain, a starter, a plain licence note, no price, no claim', async () => {
  for (const r of recipes) {
    const m = (await get(r)).manifest;
    assert.equal(m.author, 'Get4Domain'); assert.equal(m.tier, 'Standard'); assert.equal(m.marketplace.starter, true); assert.equal(m.marketplace.sourceVendorId, undefined);
    assert.match(m.description, /^Starter theme built by the Get4Domain team\./); assert.ok(m.description.length <= 400);
    assert.match(m.marketplace.licence, /^Starter theme built by the Get4Domain team\./);
    assert.doesNotMatch(JSON.stringify(m), /\b(best|top|leading|popular|rated|#1|number one|discount|offer|coupon|free trial)\b/i, r.id);
  }
});

test('the build is deterministic: the same recipe gives byte-identical packages', async () => {
  for (const r of [recipes[0], recipes[2], recipes[recipes.length - 1]]) {
    const a = await buildStarter(r); const b = await buildStarter(r);
    assert.ok(a.zip.equals(b.zip), r.id); assert.equal(a.manifest.contentHash, b.manifest.contentHash);
    assert.equal(computeContentHash(a.files), a.manifest.contentHash);
  }
});

test('the tokens, the flavour CSS and the home layout really differ between starters of the same base', async () => {
  const bases = new Map();
  for (const r of recipes) (bases.get(r.base) ?? bases.set(r.base, []).get(r.base)).push(r);
  for (const [base, rs] of bases) {
    assert.ok(rs.length >= 4, `${base} has ${rs.length} starters`);
    const toks = new Set(); const css = new Set();
    for (const r of rs) { const f = (await get(r)).files; toks.add(f['css/tokens.css'].toString()); css.add(f['css/base.css'].toString()); const own = f['css/base.css'].toString().split('/* starter flavours: ')[1]; assert.ok(own, `${r.id}: flavours appended`); assert.doesNotMatch(own, /!important/); }
    assert.equal(toks.size, rs.length, `${base}: tokens are not all different`); assert.equal(css.size, rs.length, `${base}: base.css is not all different`);
  }
});

test('flavour CSS is scoped, token-only and free of scripts and outside addresses', () => {
  for (const [id, f] of Object.entries(FLAVOURS)) {
    const css = f.css; assert.ok(css.length < 700, `${id} is small`);
    for (const sel of css.split('}').map((x) => x.split('{')[0].trim()).filter(Boolean)) assert.ok(splitTop(sel).every((s) => s.trim().startsWith('.g4d-theme')), `${id}: ${sel}`);
    assert.doesNotMatch(css, /!important|@import|url\(|expression|javascript:|#[0-9a-f]{3,8}\b/i, id);   // no colour of its own: the palette's job
  }
});

test('add-on starters draw the product section; the others do not add one', async () => {
  for (const r of recipes) {
    const html = (await get(r)).files['templates/home.html'].toString();
    const shopBase = r.base === 'free-shop-lite';
    const wantsProducts = r.addons.some((a) => ['SHOP', 'ONLINE_ORDERING_DELIVERY', 'PHARMACY_COUNTER'].includes(a));
    if (wantsProducts) assert.match(html, /<g4d-product-grid/, `${r.id} claims an add-on that needs the product grid`);
    if (!wantsProducts && !shopBase) assert.doesNotMatch(html, /<g4d-product-grid/, `${r.id} should not draw a product grid`);
  }
});

test('home layout edits: drop, move and insert keep every other section and never duplicate one', () => {
  const base = homeSections('free-practice');
  const out = composeSections(base, { drop: ['stats'], move: [{ partial: 'reviews', after: 'hero' }], insert: [{ partial: 'products', after: 'services' }] });
  assert.ok(!out.includes('stats')); assert.equal(out.indexOf('reviews'), out.indexOf('hero') + 1); assert.equal(out.indexOf('products'), out.indexOf('services') + 1);
  assert.equal(new Set(out).size, out.length); assert.equal(out.length, base.length - 1 + 1);
  assert.deepEqual(composeSections(base, {}), base); assert.deepEqual(composeSections(base, { insert: [{ partial: 'about', after: 'hero' }] }), base);   // inserting what is there changes nothing
  assert.match(homeTemplate(out), /^\{\{> head\}\}\n<main id="main">\n[\s\S]*\n<\/main>\n\{\{> foot\}\}$/);
});

test('the catalogue data is the 196 categories and its four kit-only ids have catalogue equivalents', () => {
  const c = catalogueByPack(); const ids = Object.values(c.packs).flat();
  assert.equal(ids.length, 196); assert.equal(new Set(ids).size, 196); assert.equal(Object.keys(c.packs).length, 16);
  for (const [kitOnly, eq] of Object.entries(c.kitOnlyEquivalents)) { assert.ok(!ids.includes(kitOnly), `${kitOnly} must not be a catalogue id`); assert.ok(eq.length >= 1 && eq.every((e) => ids.includes(e)), kitOnly); }
});

test('a starter never lists a kit-only id as a catalogue category (the four ids not in the catalogue are fixed)', async () => {
  const c = catalogueByPack(); const kitOnly = Object.keys(c.kitOnlyEquivalents);
  for (const r of recipes) { const m = (await get(r)).manifest.marketplace; for (const id of m.catalogueCategories) assert.ok(!kitOnly.includes(id), `${r.id} lists ${id}`); }
  const wellness = (await get(recipes.find((r) => r.id === 'starter-wellness-sage'))).manifest.marketplace.catalogueCategories;
  assert.ok(wellness.includes('gym-fitness-centre') && wellness.includes('unisex-salon'), 'the wellness starter lists the catalogue ids of gyms and salons');
});

test('the library is untouched by the starter builder', async () => {
  assert.deepEqual(await checkBuilt(), []);
  assert.deepEqual(listVendorThemeIds(), ['free-hospitality', 'free-practice', 'free-service-pro', 'free-shop-lite', 'free-studio']);
  assert.ok(fs.existsSync(path.join(STARTER_DIR, 'recipes.json')));
});
