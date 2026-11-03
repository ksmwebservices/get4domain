import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, CATEGORY_IDS, FAMILIES, FLOWS, variantFor, categoryById } from '../lib/categories.mjs';
import { BINDINGS, AS_BUILT_REPEATERS, DATA_ATTRIBUTES, SLOT_TAGS, SLOTS, APPROVED_FONTS, APPROVED_TAMIL_FONTS, TRACKS } from '../lib/vocabulary.mjs';
import { renderDoc } from '../lib/contract-doc.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('there are exactly 41 categories with unique ids', () => {
  assert.equal(CATEGORIES.length, 41);
  assert.equal(new Set(CATEGORY_IDS).size, 41);
});

test('track sizes are 13 handyman, 20 professional, 8 ecommerce', () => {
  const n = (t) => CATEGORIES.filter((c) => c.track === t).length;
  assert.deepEqual([n('handyman'), n('professional'), n('ecommerce')], [13, 20, 8]);
  for (const c of CATEGORIES) assert.ok(TRACKS.includes(c.track));
});

test('every category has a known family, flow and extra blocks', () => {
  for (const c of CATEGORIES) {
    assert.ok(FAMILIES[c.family], `${c.id}: family`);
    assert.ok(FLOWS.includes(c.flow), `${c.id}: flow`);
    assert.ok(c.extraBlocks.length >= 2, `${c.id}: extra blocks`);
    assert.equal(variantFor(c.id), FAMILIES[c.family].variant);
  }
  assert.throws(() => categoryById('nope'), RangeError);
});

test('the category table matches the owner brief T0 line by line', () => {
  const brief = read('docs/v3/themes-brief/T0_THEME_KIT_AND_PREVIEW_HARNESS.md').split(/\r?\n/);
  const rows = brief.filter((l) => /^[a-z0-9-]+ \| .+ \| .+ \| .+ \| .+$/.test(l)).map((l) => l.split(' | ').map((s) => s.trim()));
  assert.equal(rows.length, 41, 'the brief lists 41 categories');
  for (const [id, label, schemaType, cta, blocks] of rows) {
    const c = categoryById(id);
    assert.equal(c.label, label, `${id} label`);
    assert.equal(c.schemaType, schemaType.replace(/^schema /, ''), `${id} schema type`);
    assert.equal(c.ctaPrimary, cta, `${id} cta`);
    assert.deepEqual(c.extraBlocks, blocks.split(',').map((s) => s.trim()), `${id} blocks`);
  }
  // family headings in the brief: "<family> family:" before each group
  let family = null;
  for (const l of brief) {
    const m = l.match(/^([a-z-]+) family:$/);
    if (m) { family = m[1]; continue; }
    const r = l.match(/^([a-z0-9-]+) \| .+ \| .+ \| .+ \| .+$/);
    if (r) assert.equal(categoryById(r[1]).family, family, `${r[1]} family`);
  }
});

test('the kit vocabulary is a superset of the as-built backend contract', () => {
  const asBuilt = JSON.parse(read('backend-api/src/themes/core/theme-contract.json'));
  for (const s of asBuilt.slots) assert.ok(BINDINGS.includes(s), `binding ${s}`);
  for (const [name, r] of Object.entries(asBuilt.repeaters)) {
    assert.deepEqual(AS_BUILT_REPEATERS[name], r, `repeater ${name}`);
  }
  for (const a of asBuilt.dataAttributes) assert.ok(DATA_ATTRIBUTES.includes(a), `attribute ${a}`);
  for (const t of asBuilt.tags) assert.ok(SLOT_TAGS.includes(t), `tag ${t}`);
  assert.equal(asBuilt.families.length, 8);
});

test('every slot has a unique tag, and the brief slot names are all present', () => {
  assert.equal(new Set(SLOT_TAGS).size, SLOT_TAGS.length);
  for (const n of ['enquiry-form', 'whatsapp-float', 'map', 'reviews', 'social-links', 'video', 'booking', 'cart', 'product-grid', 'search', 'claim-banner', 'listed-on-badge']) assert.ok(SLOTS[n], n);
  assert.equal(APPROVED_FONTS.length, 12);
  for (const f of ['Noto Sans Tamil', 'Noto Serif Tamil']) assert.ok(APPROVED_FONTS.includes(f), f);
  assert.deepEqual(APPROVED_TAMIL_FONTS, ['Noto Sans Tamil', 'Noto Serif Tamil']);
});

test('CONTRACT.md generated tables are current and list all 41 category ids', () => {
  const doc = read('themes/CONTRACT.md');
  assert.equal(renderDoc(doc), doc, 'run: node themes/cli.mjs contract-table');
  for (const id of CATEGORY_IDS) assert.ok(doc.includes(`\`${id}\``), id);
});
