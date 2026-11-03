import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTheme, themeFromFiles, listThemeIds, listVendorThemeIds } from '../lib/theme.mjs';
import { packThemeDir, validatePackage } from '../lib/pack.mjs';
import { lintTheme } from '../lib/lint.mjs';
import { CATEGORY_IDS, FAMILIES } from '../lib/categories.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(here, '..', 'cli.mjs');
const dir = path.join(here, '..', 'library', '_starter');

test('the starter is internal and never offered to vendors', () => {
  assert.ok(listThemeIds().includes('_starter'));
  assert.deepEqual(listVendorThemeIds(), [], 'no vendor-facing theme exists yet');
  const t = loadTheme('_starter');
  assert.equal(t.manifest.internal, true);
  assert.match(t.manifest.description, /Not a vendor-facing theme/);
});

test('the starter declares all 41 categories, all 12 families, all 3 tracks and restates every variant', () => {
  const m = loadTheme('_starter').manifest;
  assert.deepEqual([...m.categories].sort(), [...CATEGORY_IDS].sort());
  assert.deepEqual([...m.families].sort(), Object.keys(FAMILIES).sort());
  assert.deepEqual([...m.tracks].sort(), ['ecommerce', 'handyman', 'professional']);
  for (const [f, v] of Object.entries(m.layoutVariantRules)) assert.equal(v, FAMILIES[f].variant.id);
});

test('pipeline: pack -> validate -> load from the zip -> lint passes for all 41 categories', () => {
  const { zip, manifest, validation } = packThemeDir(dir);
  assert.deepEqual(validation.errors, []);
  const again = packThemeDir(dir);
  assert.ok(zip.equals(again.zip), 'the same folder always packs to the same bytes');
  const checked = validatePackage(zip);
  assert.equal(checked.ok, true);
  assert.equal(checked.manifest.contentHash, manifest.contentHash);
  const fromZip = themeFromFiles(checked.files);
  const r = lintTheme(fromZip, { categories: CATEGORY_IDS });
  assert.deepEqual(r.findings.map((f) => `${f.rule}: ${f.message}`), []);
  assert.equal(r.categories.length, 41);
});

test('the packed starter fits the budgets', () => {
  const { zip } = packThemeDir(dir);
  assert.ok(zip.length < 100 * 1024, `zip is ${zip.length} bytes`);
});

test('CLI: pack and validate-package work end to end on the starter', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-pack-'));
  try {
    const p = spawnSync(process.execPath, [CLI, 'pack', '_starter', '--out', out], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.stderr);
    const zipFile = fs.readdirSync(out).find((f) => f.endsWith('.zip'));
    assert.equal(zipFile, 'kit-starter-1.zip');
    assert.ok(fs.existsSync(path.join(out, 'kit-starter-1.manifest.json')));
    const v = spawnSync(process.execPath, [CLI, 'validate-package', path.join(out, zipFile)], { encoding: 'utf8' });
    assert.equal(v.status, 0, v.stderr);
    assert.match(v.stdout, /valid: kit-starter v1/);
    // a damaged zip is refused with a non-zero exit code
    const bad = path.join(out, 'bad.zip');
    fs.writeFileSync(bad, Buffer.from('not a zip'));
    assert.equal(spawnSync(process.execPath, [CLI, 'validate-package', bad], { encoding: 'utf8' }).status, 1);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('CLI: lint exits 0 for the starter and 1 for a broken copy', () => {
  const ok = spawnSync(process.execPath, [CLI, 'lint', '_starter', '--category', 'plumber', '--json', path.join(os.tmpdir(), 'g4d-lint-ok.json')], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-broken-'));
  try {
    fs.cpSync(dir, tmp, { recursive: true });
    fs.appendFileSync(path.join(tmp, 'templates', 'home.html'), '<script>alert(1)</script>');
    const bad = spawnSync(process.execPath, [CLI, 'lint', tmp, '--category', 'plumber', '--json', path.join(tmp, 'r.json')], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /no-script-tag/);
    const report = JSON.parse(fs.readFileSync(path.join(tmp, 'r.json'), 'utf8'));
    assert.equal(report.ok, false);
    assert.ok(report.reports[0].findings.some((f) => f.rule === 'no-script-tag'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
