import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateManifest } from '../lib/schema.mjs';
import { packFiles, validatePackage } from '../lib/pack.mjs';
import { LIBRARY_DIR } from '../lib/theme.mjs';
import { minimalFiles, minimalManifest, buf } from './helpers/minimal-theme.mjs';

// The optional `marketplace` block of theme.json (theme package spec v1). The kit checks the SHAPE; the backend checks the names.
const good = () => ({
  packs: ['FIELD_SERVICE'], addons: ['SHOP'], capabilities: ['SERVICES'], tags: ['handyman-plus-shop'], catalogueCategories: ['plumber'],
  previews: [{ path: 'assets/previews/home.png', alt: 'Home page of the theme', page: 'home' }],
  licence: 'Built by the Get4Domain team for the marketplace.', starter: true, sourceVendorId: null,
});
const errs = (marketplace) => validateManifest(minimalManifest({ marketplace })).map((e) => `${e.path}:${e.code}`);

test('a theme with no marketplace block is still valid (the six library themes have none)', () => {
  assert.deepEqual(validateManifest(minimalManifest()), []);
  for (const id of fs.readdirSync(LIBRARY_DIR)) {
    const m = JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, id, 'theme.json'), 'utf8'));
    assert.equal(m.marketplace, undefined);
    assert.deepEqual(validateManifest(m), [], id);
  }
});

test('a complete marketplace block is valid, with a null or a string source vendor', () => {
  assert.deepEqual(errs(good()), []);
  assert.deepEqual(errs({ ...good(), sourceVendorId: 'ckx1abcdef0000' }), []);
  const { sourceVendorId, ...without } = good();
  assert.deepEqual(errs(without), []);   // omitted means null
});

test('packs is required and non-empty; unknown fields are refused', () => {
  const { packs, ...noPacks } = good();
  assert.deepEqual(errs(noPacks), ['marketplace.packs:required']);
  assert.ok(errs({ ...good(), packs: [] }).includes('marketplace.packs:minItems'));
  assert.deepEqual(errs({ ...good(), price: 100 }), ['marketplace.price:additional']);
  assert.deepEqual(errs({ ...good(), popularity: 5 }), ['marketplace.popularity:additional']);
});

test('shapes are enforced: key format, duplicates, limits, preview path and a non-string source vendor', () => {
  assert.ok(errs({ ...good(), packs: ['field-service'] }).includes('marketplace.packs[0]:pattern'));
  assert.ok(errs({ ...good(), packs: ['FIELD_SERVICE', 'FIELD_SERVICE'] }).includes('marketplace.packs:uniqueItems'));
  assert.ok(errs({ ...good(), tags: ['Service Plus Shop'] }).includes('marketplace.tags[0]:pattern'));
  assert.ok(errs({ ...good(), tags: Array.from({ length: 13 }, (_, i) => `tag-${i}`) }).includes('marketplace.tags:maxItems'));
  assert.ok(errs({ ...good(), previews: [{ path: 'assets/home.png', alt: 'Home page' }] }).includes('marketplace.previews[0].path:pattern'));
  assert.ok(errs({ ...good(), previews: [{ path: 'assets/previews/../x.png', alt: 'Home page' }] }).includes('marketplace.previews[0].path:pattern'));
  assert.ok(errs({ ...good(), previews: [{ path: 'assets/previews/home.svg', alt: 'Home page' }] }).includes('marketplace.previews[0].path:pattern'));   // a preview is a raster picture, never an SVG
  assert.ok(errs({ ...good(), previews: [{ path: 'assets/previews/home.png', alt: 'x' }] }).includes('marketplace.previews[0].alt:minLength'));
  assert.ok(errs({ ...good(), sourceVendorId: 12 }).includes('marketplace.sourceVendorId:type'));
  assert.ok(errs({ ...good(), licence: 'ab' }).includes('marketplace.licence:minLength'));
});

test('a package that carries the block packs, validates and keeps the block in theme.json', () => {
  const files = minimalFiles({ marketplace: { packs: ['FIELD_SERVICE'], licence: 'Built by the team.' } });
  const { zip, manifest } = packFiles(files);
  const r = validatePackage(zip);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(manifest.marketplace.packs, ['FIELD_SERVICE']);
});

test('a bad block makes the package invalid and the error names theme.json and the field', () => {
  const files = minimalFiles({ marketplace: { packs: ['field-service'] } });
  const { zip } = packFiles(files);
  const r = validatePackage(zip);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'manifest-invalid' && e.path.startsWith('theme.json:marketplace.packs')), JSON.stringify(r.errors));
  void buf;
});
