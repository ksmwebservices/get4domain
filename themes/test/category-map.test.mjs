import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCategoryMap } from '../lib/category-map.mjs';
import { CATEGORIES, FAMILIES, FLOWS } from '../lib/categories.mjs';

const onDisk = () => JSON.parse(fs.readFileSync(new URL('../data/category-map.json', import.meta.url), 'utf8'));

test('themes/data/category-map.json equals the map built from categories.mjs (run: node themes/cli.mjs category-map)', () => {
  assert.deepEqual(onDisk(), buildCategoryMap());
});

test('the map covers all 41 categories with track, V3 family, flow family and as-built pack', () => {
  const m = onDisk();
  assert.equal(Object.keys(m.categories).length, 41);
  for (const c of CATEGORIES) {
    const row = m.categories[c.id];
    assert.deepEqual(Object.keys(row).sort(), ['ctaPrimary', 'family', 'flow', 'packKey', 'schemaType', 'track']);
    assert.equal(row.family, c.family); assert.equal(row.flow, c.flow); assert.equal(row.packKey, c.packKey); assert.equal(row.track, c.track);
    assert.ok(FLOWS.includes(row.flow));
  }
});

test('the map says it is an inference, lists flows, families with their variant, and the packs the categories fall into', () => {
  const m = onDisk();
  assert.equal(m.status, 'inference');
  assert.match(m.note, /inference/i);
  assert.deepEqual(m.flows, FLOWS);
  assert.deepEqual(Object.keys(m.families).sort(), Object.keys(FAMILIES).sort());
  for (const [id, f] of Object.entries(m.families)) { assert.equal(f.track, FAMILIES[id].track); assert.equal(f.variant, FAMILIES[id].variant.id); }
  const inPacks = Object.values(m.packs).flat().sort();
  assert.deepEqual(inPacks, CATEGORIES.map((c) => c.id).sort(), 'every category is in exactly one pack');
});

test('the map is stable JSON (sorted keys, no dates, no machine paths)', () => {
  const text = fs.readFileSync(new URL('../data/category-map.json', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /[A-Z]:\\|\/Users\/|20\d\d-\d\d-\d\dT/);
  assert.ok(text.endsWith('\n'));
});
