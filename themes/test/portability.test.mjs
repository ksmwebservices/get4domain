// C2.1 portability: the kit must run with zero npm dependencies on Node 18+, with no external programs and no Windows-only code.
// Everything runs in a subprocess with a clean environment and an empty node_modules (Bolt's situation).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'cli.mjs');

// A clean environment: only what Node itself needs to start. No PATH tools, no HOME config, no APPDATA, no PLAYWRIGHT_*.
const cleanEnv = (tmp) => {
  const env = { TEMP: tmp, TMP: tmp, TMPDIR: tmp, HOME: tmp, USERPROFILE: tmp };
  for (const k of ['SystemRoot', 'SYSTEMROOT', 'PATH', 'Path']) if (process.env[k]) env[k] = k.toLowerCase() === 'path' ? path.dirname(process.execPath) : process.env[k];
  return env;
};

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-port-'));
fs.mkdirSync(path.join(work, 'node_modules'));
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: work, env: cleanEnv(work), encoding: 'utf8', timeout: 240000 });

const sources = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? sources(path.join(dir, d.name)) : /\.mjs$/.test(d.name) ? [path.join(dir, d.name)] : []));
const kitFiles = [CLI, ...sources(path.join(ROOT, 'lib')), ...sources(path.join(ROOT, 'commands'))];

test('no package.json in the kit declares a dependency', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) assert.equal(pkg[k], undefined, k);
  assert.match(pkg.engines.node, />=\s*18/);
});

test('the kit imports only node: built-ins and its own files (no npm packages)', () => {
  for (const f of kitFiles) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\b[^'"\n]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]/gm)) {
      const spec = m[1] ?? m[2] ?? m[3];
      assert.ok(spec.startsWith('node:') || spec.startsWith('.'), `${path.relative(ROOT, f)} imports "${spec}"`);
    }
  }
});

test('the kit never starts an external program', () => {
  for (const f of kitFiles) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /child_process|worker_threads|\bspawnSync?\s*\(|\bexecSync\s*\(|\bexecFileSync?\s*\(/, path.relative(ROOT, f));
  }
});

test('no native modules and no Windows-only code in the commands and the lint (the optional browser lookup is the one allowed place)', () => {
  for (const f of kitFiles) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /\.node['"]|process\.dlopen|node-gyp/, rel);
    if (rel === 'lib/browser.mjs') continue;
    assert.doesNotMatch(src, /process\.platform|win32|LOCALAPPDATA|APPDATA|\.exe\b|[A-Za-z]:\\\\/, rel);
  }
});

test('Node 18 APIs only (no toSorted, findLast, Object.groupBy, import.meta.dirname, fs.glob, ...)', () => {
  const banned = /\.toSorted\(|\.toReversed\(|\.toSpliced\(|\.findLast(Index)?\(|Object\.groupBy|Map\.groupBy|import\.meta\.(dirname|filename)|Array\.fromAsync|\bfs\.(glob|globSync)\(|Promise\.withResolvers|\.isWellFormed\(|URL\.canParse|zlib\.crc32/;
  for (const f of kitFiles) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), banned, path.relative(ROOT, f));
});

test('lint of every theme (its own categories) passes with no browser, no deps, clean environment', () => {
  const r = run('lint', '--all');
  assert.equal(r.status, 0, r.stdout.slice(-1500) + r.stderr);
});

test('lint of the starter for all 41 categories passes in the clean environment', () => {
  const r = run('lint', '_starter', '--all-categories');
  assert.equal(r.status, 0, r.stdout.slice(-1500) + r.stderr);
  assert.match(r.stdout, /41 categories/);
});

test('contract-table --check and category-map --check pass in the clean environment', () => {
  for (const c of ['contract-table', 'category-map']) {
    const r = run(c, '--check');
    assert.equal(r.status, 0, `${c}: ${r.stdout.slice(-800)}${r.stderr}`);
  }
});

test('pack builds a zip with forward-slash entry names in the clean environment', () => {
  const r = run('pack', 'free-practice', '--out', path.join(work, 'out'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const zip = fs.readFileSync(path.join(work, 'out', 'free-practice-1.zip'));
  assert.ok(zip.includes('theme.json'));
  assert.ok(!zip.includes(Buffer.from('\\templates')) && !zip.includes(Buffer.from('css\\')), 'a backslash in a zip entry name');
});

test('--browser fails with a clear message (not a stack trace) when Playwright is absent', () => {
  const r = run('lint', 'free-practice', '--browser');
  if (r.status === 0) return; // a browser exists on this machine
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--browser requested but not available: .+/);
  assert.doesNotMatch(r.stderr, /\n\s+at /);
});

test('the preview server starts with no dependencies and answers on 127.0.0.1', async () => {
  const port = 41000 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, [CLI, 'preview', '--port', String(port)], { cwd: work, env: cleanEnv(work), stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const status = await new Promise((resolve, reject) => {
      const deadline = Date.now() + 20000;
      const tryOnce = () => {
        const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => { res.resume(); resolve(res.statusCode); });
        req.on('error', () => (Date.now() > deadline ? reject(new Error('preview did not start')) : setTimeout(tryOnce, 200)));
      };
      tryOnce();
    });
    assert.equal(status, 200);
  } finally { child.kill(); await new Promise((r) => child.once('exit', r)); }
});

test('cleanup', () => { try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* a leftover temp folder is harmless */ } });
