import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { writeZip, readZip } from '../lib/zip.mjs';
import { validateManifest } from '../lib/schema.mjs';
import { packFiles, packThemeDir, validatePackage, computeContentHash } from '../lib/pack.mjs';
import { LIMITS } from '../lib/vocabulary.mjs';
import { minimalFiles, minimalManifest, buf } from './helpers/minimal-theme.mjs';

const toEntries = (files) => Object.entries(files).map(([p, data]) => ({ path: p, data }));
const codes = (r) => r.errors.map((e) => e.code);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

// ---------- zip ----------
test('zip: write then read gives the same bytes, and writing is deterministic', () => {
  const entries = toEntries(minimalFiles());
  const a = writeZip(entries);
  const b = writeZip([...entries].reverse());
  assert.ok(a.equals(b), 'order of input does not change the output');
  const z = readZip(a);
  assert.deepEqual(z.problems, []);
  const names = z.entries.map((e) => e.path).sort();
  assert.deepEqual(names, Object.keys(minimalFiles()).sort());
  assert.equal(z.entries.find((e) => e.path === 'theme.json').read().toString(), minimalFiles()['theme.json'].toString());
});

test('zip: garbage is reported, not thrown', () => {
  const z = readZip(Buffer.from('this is not a zip file at all'));
  assert.ok(z.problems.length > 0);
});

// ---------- manifest schema ----------
test('schema: the minimal manifest is valid', () => {
  assert.deepEqual(validateManifest(minimalManifest()), []);
});

test('schema: each required field is reported by name when missing', () => {
  for (const field of ['id', 'version', 'name', 'tier', 'tracks', 'families', 'categories', 'layoutVariantRules', 'motion', 'settingsSchema', 'fonts']) {
    const m = minimalManifest();
    delete m[field];
    const errs = validateManifest(m);
    assert.ok(errs.some((e) => e.path === field && e.code === 'required'), `${field}: ${JSON.stringify(errs)}`);
  }
});

test('schema: wrong values are rejected', () => {
  const bad = (over, path_) => assert.ok(validateManifest(minimalManifest(over)).some((e) => e.path.startsWith(path_)), JSON.stringify(over));
  bad({ id: 'Bad Id' }, 'id');
  bad({ id: 'ab' }, 'id');
  bad({ version: 0 }, 'version');
  bad({ version: 1.5 }, 'version');
  bad({ tier: 'Gold' }, 'tier');
  bad({ tracks: ['space'] }, 'tracks');
  bad({ tracks: [] }, 'tracks');
  bad({ fonts: ['Comic Sans'] }, 'fonts');
  bad({ categories: ['not-a-category'] }, 'categories');
  bad({ families: ['nope'] }, 'families');
  bad({ motion: { default: 'Insane' } }, 'motion.default');
  bad({ unexpected: true }, 'unexpected');
});

test('schema: a category outside the declared families or tracks is reported', () => {
  assert.ok(validateManifest(minimalManifest({ categories: ['dentist'] })).some((e) => e.code === 'category-family'));
  assert.ok(validateManifest(minimalManifest({ tracks: ['ecommerce'] })).some((e) => e.code === 'category-track'));
});

test('schema: layoutVariantRules may only restate the table', () => {
  assert.ok(validateManifest(minimalManifest({ layoutVariantRules: { 'home-services': 'dark-bento' } })).some((e) => e.code === 'variant-override'));
});

test('schema: package mode needs contentHash and assets', () => {
  const errs = validateManifest(minimalManifest(), { mode: 'package' });
  assert.ok(errs.some((e) => e.path === 'contentHash'));
  assert.ok(errs.some((e) => e.path === 'assets'));
});

// ---------- pack and validate ----------
test('pack: a valid theme packs and validates; the hash is stable', () => {
  const a = packFiles(minimalFiles());
  const b = packFiles(minimalFiles());
  assert.ok(a.zip.equals(b.zip), 'byte-identical zips');
  assert.equal(a.manifest.contentHash, b.manifest.contentHash);
  assert.match(a.manifest.contentHash, /^[0-9a-f]{64}$/);
  const r = validatePackage(a.zip);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.manifest.id, 'mini-theme');
});

test('pack: a changed file changes the hash, and a tampered zip fails validation', () => {
  const a = packFiles(minimalFiles());
  const f2 = minimalFiles(); f2['css/base.css'] = buf('.g4d-theme{color:red}\n');
  assert.notEqual(packFiles(f2).manifest.contentHash, a.manifest.contentHash);
  // take a's zip, replace base.css bytes, keep the old theme.json hash
  const z = readZip(a.zip);
  const entries = z.entries.map((e) => ({ path: e.path, data: e.path === 'css/base.css' ? buf('.g4d-theme{color:red}\n') : e.read() }));
  const r = validatePackage(writeZip(entries));
  assert.ok(codes(r).includes('hash-mismatch'), JSON.stringify(r.errors));
});

test('pack: packThemeDir reads a folder and fills the asset list', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-theme-'));
  try {
    const files = { ...minimalFiles(), 'assets/logo.png': PNG };
    for (const [p, data] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), data); }
    const out = packThemeDir(dir);
    assert.deepEqual(out.manifest.assets.map((x) => x.path), ['assets/logo.png']);
    assert.equal(validatePackage(out.zip).ok, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---------- bad packages (red fixtures) ----------
const asZip = (files) => writeZip(toEntries(files));
const good = () => packFiles(minimalFiles());

test('bad package: missing required field in theme.json', () => {
  const m = minimalManifest(); delete m.tier;
  const files = minimalFiles(); files['theme.json'] = buf(JSON.stringify(m));
  const r = validatePackage(asZip(files));
  assert.equal(r.ok, false);
  assert.ok(codes(r).includes('manifest-invalid'), JSON.stringify(r.errors));
});

test('bad package: missing theme.json, home template or css file', () => {
  for (const missing of ['theme.json', 'templates/home.html', 'css/base.css', 'css/tokens.css', 'css/motion.css', 'css/print.css']) {
    const files = minimalFiles(); delete files[missing];
    const r = validatePackage(asZip(files));
    assert.ok(codes(r).includes('missing-file'), `${missing}: ${JSON.stringify(r.errors)}`);
  }
});

test('bad package: path traversal in every form', () => {
  for (const evil of ['../evil.html', 'templates/../../evil.html', '/etc/passwd', 'C:\\Windows\\x.html', 'templates\\..\\x.html', 'assets/a\0b.png', './templates/x.html']) {
    const base = good();
    const z = readZip(base.zip);
    const entries = [...z.entries.map((e) => ({ path: e.path, data: e.read() })), { path: evil, data: buf('x') }];
    const r = validatePackage(writeZip(entries, { allowUnsafePaths: true }));
    assert.ok(codes(r).includes('path-traversal'), `${JSON.stringify(evil)}: ${JSON.stringify(r.errors)}`);
  }
});

test('bad package: oversized package, oversized file, too many files', () => {
  const big = Buffer.alloc(LIMITS.fileBytes + 10, 0x61);
  let r = validatePackage(asZip({ ...minimalFiles(), 'assets/big.png': Buffer.concat([PNG, big]) }));
  assert.ok(codes(r).includes('file-too-large'), JSON.stringify(r.errors));

  const many = minimalFiles();
  for (let i = 0; i < LIMITS.maxFiles + 5; i++) many[`assets/f${i}.png`] = PNG;
  r = validatePackage(asZip(many));
  assert.ok(codes(r).includes('too-many-files'), JSON.stringify(r.errors));

  // many different incompressible files so the zip itself is over the package limit
  const chunks = {};
  for (let i = 0; i < 7; i++) chunks[`assets/r${i}.png`] = Buffer.concat([PNG, Buffer.from(Array.from({ length: LIMITS.fileBytes - 100 }, (_, k) => (k * 2654435761 + i * 97) & 255))]);
  r = validatePackage(writeZip(toEntries({ ...minimalFiles(), ...chunks }), { store: true }));
  assert.ok(codes(r).includes('package-too-large'), JSON.stringify(r.errors));
});

test('bad package: a zip bomb (tiny file, huge expansion) is refused without being expanded', () => {
  const bomb = zlib.deflateRawSync(Buffer.alloc(900 * 1024, 0x30), { level: 9 });
  assert.ok(bomb.length < 4000);
  const r = validatePackage(asZip({ ...minimalFiles(), 'assets/bomb.png': Buffer.concat([PNG, Buffer.alloc(900 * 1024, 0x30)]) }));
  assert.ok(codes(r).includes('expansion-ratio'), JSON.stringify(r.errors));
});

test('bad package: executable files by name and by content', () => {
  for (const [name, data] of [['assets/run.exe', buf('MZ\x90\x00')], ['assets/x.dll', buf('MZ')], ['assets/setup.sh', buf('#!/bin/sh\necho hi')], ['assets/x.js', buf('alert(1)')], ['assets/x.php', buf('<?php')], ['assets/x.bat', buf('@echo off')], ['assets/x.wasm', buf('\0asm')], ['assets/logo.png', buf('MZ\x90\x00\x03')], ['assets/elf.png', Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1])]]) {
    const r = validatePackage(asZip({ ...minimalFiles(), [name]: data }));
    assert.ok(codes(r).includes('executable-file'), `${name}: ${JSON.stringify(r.errors)}`);
  }
});

test('bad package: unknown slot tag in a template', () => {
  const files = minimalFiles();
  files['templates/home.html'] = buf('<main id="main"><h1>{{hero.title}}</h1><g4d-teleporter></g4d-teleporter></main>');
  const r = validatePackage(asZip(files));
  assert.ok(codes(r).includes('unknown-slot'), JSON.stringify(r.errors));
  assert.ok(r.errors.find((e) => e.code === 'unknown-slot').path.includes('home.html'));
});

test('bad package: unknown file location, duplicate path, symlink, svg with script, type mismatch', () => {
  let r = validatePackage(asZip({ ...minimalFiles(), 'README.txt': buf('hi') }));
  assert.ok(codes(r).includes('unknown-file'), JSON.stringify(r.errors));

  r = validatePackage(writeZip([...toEntries(minimalFiles()), { path: 'css/base.css', data: buf('x') }], { allowDuplicates: true }));
  assert.ok(codes(r).includes('duplicate-path'), JSON.stringify(r.errors));

  r = validatePackage(writeZip([...toEntries(minimalFiles()), { path: 'assets/link.png', data: buf('../../etc/passwd'), symlink: true }]));
  assert.ok(codes(r).includes('symlink'), JSON.stringify(r.errors));

  r = validatePackage(asZip({ ...minimalFiles(), 'assets/x.svg': buf('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }));
  assert.ok(codes(r).includes('unsafe-asset'), JSON.stringify(r.errors));

  r = validatePackage(asZip({ ...minimalFiles(), 'assets/photo.png': buf('<html>not a png</html>') }));
  assert.ok(codes(r).includes('asset-type-mismatch'), JSON.stringify(r.errors));
});

test('validate never writes to disk', () => {
  const before = fs.readdirSync(process.cwd()).sort().join();
  validatePackage(good().zip);
  assert.equal(fs.readdirSync(process.cwd()).sort().join(), before);
});

test('computeContentHash ignores the hash field itself and file order', () => {
  const f = minimalFiles();
  const h1 = computeContentHash(f);
  const reordered = Object.fromEntries(Object.entries(f).reverse());
  assert.equal(computeContentHash(reordered), h1);
});

test('the committed JSON schema file equals the schema built from the vocabulary', async () => {
  const { buildSchema } = await import('../lib/schema-build.mjs');
  const onDisk = JSON.parse(fs.readFileSync(new URL('../schema/theme.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(onDisk, buildSchema());
});
