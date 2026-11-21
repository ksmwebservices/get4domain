// C2.4 the Bolt kit: node themes/cli.mjs bolt-kit -> get4domain-bolt-kit.zip, a self-contained copy of the kit that runs with no dependencies.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readZip } from '../lib/zip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'cli.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-boltkit-'));
const outDir = path.join(tmp, 'out');
const cleanEnv = () => {
  const env = { TEMP: tmp, TMP: tmp, TMPDIR: tmp, HOME: tmp, USERPROFILE: tmp, PATH: path.dirname(process.execPath) };
  for (const k of ['SystemRoot', 'SYSTEMROOT']) if (process.env[k]) env[k] = process.env[k];
  // npm itself starts a shell to run a script, so the shell must be findable (the kit's own code starts nothing)
  if (process.env.ComSpec) env.ComSpec = process.env.ComSpec;
  if (process.env.SystemRoot) env.PATH = [env.PATH, path.join(process.env.SystemRoot, 'System32')].join(path.delimiter);
  return env;
};

const build = () => spawnSync(process.execPath, [CLI, 'bolt-kit', '--out', outDir], { cwd: tmp, env: cleanEnv(), encoding: 'utf8' });
let zipBuf; let entries;

test('bolt-kit writes get4domain-bolt-kit.zip and reports its path and size', () => {
  const r = build();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const file = path.join(outDir, 'get4domain-bolt-kit.zip');
  assert.ok(fs.existsSync(file));
  assert.match(r.stdout, /get4domain-bolt-kit\.zip/);
  zipBuf = fs.readFileSync(file);
  const z = readZip(zipBuf);
  assert.deepEqual(z.problems, []);
  entries = z.entries;
});

test('the default output folder themes/dist is ignored by git', () => {
  const ig = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(ig, /^dist\/$/m);
});

test('top-level contents: the kit as it is, the package.json, the motion kit, the brief and the themes', () => {
  const top = new Set(entries.map((e) => e.path.split('/')[0]));
  assert.deepEqual([...top].sort(), ['BOLT_BRIEF.md', 'CONTRACT.md', 'MOTION_KIT.md', 'cli.mjs', 'commands', 'data', 'fixtures', 'lib', 'library', 'package.json', 'schema', 'shared'].sort());
  const paths = entries.map((e) => e.path);
  assert.ok(paths.includes('shared/motion-kit.css'));
  for (const bad of ['source/', 'test/', 'dist/', 'node_modules/', '.shots/', '.reports/']) assert.ok(!paths.some((p) => p.startsWith(bad)), bad);
  assert.ok(paths.every((p) => !p.includes('\\') && !p.startsWith('/') && !p.includes('..')));
});

test('library holds _starter and all five Standard themes, each a complete package', () => {
  const ids = [...new Set(entries.filter((e) => e.path.startsWith('library/')).map((e) => e.path.split('/')[1]))].sort();
  assert.deepEqual(ids, ['_starter', 'free-hospitality', 'free-practice', 'free-service-pro', 'free-shop-lite', 'free-studio']);
  for (const id of ids) {
    for (const f of ['theme.json', 'css/base.css', 'css/tokens.css', 'css/motion.css', 'css/print.css', 'templates/home.html']) assert.ok(entries.some((e) => e.path === `library/${id}/${f}`), `${id}/${f}`);
  }
});

test('package.json: type module, exactly the four scripts, no dependencies', () => {
  const pkg = JSON.parse(entries.find((e) => e.path === 'package.json').read().toString('utf8'));
  assert.equal(pkg.type, 'module');
  assert.deepEqual(Object.keys(pkg.scripts).sort(), ['lint', 'lint:all', 'pack', 'preview']);
  for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) assert.equal(pkg[k], undefined, k);
  assert.match(pkg.engines.node, />=\s*18/);
});

test('the motion kit inside the zip is byte for byte the shared file, and every theme carries it', () => {
  const kit = fs.readFileSync(path.join(ROOT, 'shared', 'motion-kit.css'));
  assert.ok(entries.find((e) => e.path === 'shared/motion-kit.css').read().equals(kit));
  for (const e of entries.filter((x) => /^library\/[^/]+\/css\/motion\.css$/.test(x.path))) assert.ok(e.read().toString('utf8').includes(kit.toString('utf8')), e.path);
});

test('the zip is deterministic: a second build is identical', () => {
  const again = path.join(tmp, 'out2');
  const r = spawnSync(process.execPath, [CLI, 'bolt-kit', '--out', again], { cwd: tmp, env: cleanEnv(), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.readFileSync(path.join(again, 'get4domain-bolt-kit.zip')).equals(zipBuf));
});

// ---- unzip OUTSIDE the repo into a temp folder, empty node_modules, clean environment
const extractDir = path.join(tmp, 'kit');
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const runScript = (name) => (fs.existsSync(npmCli)
  ? spawnSync(process.execPath, [npmCli, 'run', name, '--silent'], { cwd: extractDir, env: cleanEnv(), encoding: 'utf8', timeout: 240000 })
  : spawnSync(process.execPath, [CLI.replace(ROOT, extractDir), ...JSON.parse(fs.readFileSync(path.join(extractDir, 'package.json'), 'utf8')).scripts[name].replace(/^node cli\.mjs /, '').split(' ')], { cwd: extractDir, env: cleanEnv(), encoding: 'utf8', timeout: 240000 }));

test('unzipped outside the repo with an empty node_modules, npm run lint:all passes for _starter and the five Standard themes', () => {
  assert.ok(!path.resolve(extractDir).startsWith(ROOT));
  for (const e of entries) { const p = path.join(extractDir, e.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, e.read()); }
  fs.mkdirSync(path.join(extractDir, 'node_modules'), { recursive: true });
  assert.deepEqual(fs.readdirSync(path.join(extractDir, 'node_modules')), []);
  const r = runScript('lint:all');
  assert.equal(r.status, 0, r.stdout.slice(-1500) + r.stderr);
  assert.match(r.stdout, /RESULT: PASS \(6 theme\(s\)\)/);
});

test('npm run lint works for one theme and npm run pack builds a package from the unzipped kit', () => {
  const r = spawnSync(process.execPath, fs.existsSync(npmCli) ? [npmCli, 'run', 'lint', '--silent', '--', 'free-practice'] : ['cli.mjs', 'lint', 'free-practice'], { cwd: extractDir, env: cleanEnv(), encoding: 'utf8', timeout: 240000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const p = spawnSync(process.execPath, fs.existsSync(npmCli) ? [npmCli, 'run', 'pack', '--silent', '--', 'free-practice'] : ['cli.mjs', 'pack', 'free-practice'], { cwd: extractDir, env: cleanEnv(), encoding: 'utf8', timeout: 240000 });
  assert.equal(p.status, 0, p.stdout + p.stderr);
  assert.ok(fs.existsSync(path.join(extractDir, 'dist', 'free-practice-1.zip')));
});

test('the preview server of the unzipped kit starts and shows the themes', async () => {
  const port = 43000 + Math.floor(Math.random() * 900);
  const child = spawn(process.execPath, [path.join(extractDir, 'cli.mjs'), 'preview', '--port', String(port)], { cwd: extractDir, env: cleanEnv(), stdio: 'ignore' });
  try {
    const body = await new Promise((resolve, reject) => {
      const deadline = Date.now() + 20000;
      const go = () => http.get({ host: '127.0.0.1', port, path: '/coverage' }, (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve(b)); }).on('error', () => (Date.now() > deadline ? reject(new Error('no preview')) : setTimeout(go, 200)));
      go();
    });
    assert.match(body, /free-studio/);
    assert.match(body, /41 of 41 categories have a theme/);
  } finally { child.kill(); await new Promise((r) => child.once('exit', r)); }
});

test('cleanup', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* harmless */ } });
