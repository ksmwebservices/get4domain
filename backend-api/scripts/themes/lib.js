// Shared by the theme suites (industry designs round 2): reporting, the website build, starting the real API (in-memory Postgres) and the real website, and registering the
// reference themes through the SAME admin import route the Theme marketplace screen uses.
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { startHarness, available } = require('../e2e/bos-harness');

const ROOT = path.join(__dirname, '..', '..', '..');
const FE = path.join(ROOT, 'get4domain_mvp');
const API = 'http://127.0.0.1:3097';
const FRONT = 'http://127.0.0.1:3023';
const SECRET = 'theme-test-secret';

const state = { pass: 0, fail: 0, failures: [] };
const ok = (name, cond, detail) => { if (cond) { state.pass += 1; console.log(`  PASS  ${name}`); } else { state.fail += 1; state.failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 500)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u003c/g, '<');

function newestMtime(dir) {
  let m = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    m = Math.max(m, e.isDirectory() ? newestMtime(p) : fs.statSync(p).mtimeMs);
  }
  return m;
}
function ensureBuild() {
  const marker = path.join(FE, '.next', 'g4d-render-test-api');
  const built = fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === API && fs.existsSync(path.join(FE, '.next', 'BUILD_ID'));
  if (built && fs.statSync(marker).mtimeMs > Math.max(newestMtime(path.join(FE, 'src')), newestMtime(path.join(FE, 'public')))) return 'reused';
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'build'], { cwd: FE, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NEXT_PUBLIC_API_URL: API, INTERNAL_API_URL: API } });
  if (r.status !== 0) throw new Error(`frontend build failed: ${(r.stdout + r.stderr).split('\n').filter((l) => /error/i.test(l)).slice(0, 4).join(' | ')}`);
  fs.writeFileSync(marker, API);
  return 'built';
}
const CHROME = [process.env.G4D_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && fs.existsSync(p));

const portFree = (port) => new Promise((r) => { const t = net.createServer(); t.once('error', () => r(false)); t.once('listening', () => t.close(() => r(true))); t.listen(port, '127.0.0.1'); });

/** Boots the API and the website. Returns null when PGlite is not installed. */
async function boot() {
  if (!(await available())) return null;
  process.env.FRONTEND_INTERNAL_URL = FRONT; process.env.REVALIDATE_SECRET = SECRET;
  for (const port of [3023, 3097]) if (!(await portFree(port))) throw new Error(`Port ${port} is busy. Stop whatever uses it and run again.`);
  const build = ensureBuild();
  const h = await startHarness({ port: 3097, pgPort: 54341 });
  const front = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'start', '-p', '3023'], { cwd: FE, shell: true, stdio: 'ignore', env: { ...process.env, NEXT_PUBLIC_API_URL: API, INTERNAL_API_URL: API, REVALIDATE_SECRET: SECRET } });
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`${FRONT}/`); if (r.status < 500) break; } catch { /* starting */ } await sleep(1500); }
  const stop = async () => {
    try { if (process.platform === 'win32' && front.pid) spawnSync('taskkill', ['/pid', String(front.pid), '/T', '/F'], { stdio: 'ignore' }); else front.kill(); } catch { /* gone */ }
    try { await h.stop(); } catch { /* shutting down */ }
  };
  return { h, build, stop };
}

/** GET a page of the website. */
async function get(url) { const t0 = Date.now(); const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } }); const text = await r.text(); return { status: r.status, t: decode(text), raw: text, ms: Date.now() - t0 }; }

/** The reference themes as files (the same folders KSM lints). */
function readTheme(name) {
  const root = path.join(ROOT, 'themes', 'reference', name);
  const out = [];
  const walk = (rel) => { for (const e of fs.readdirSync(path.join(root, rel))) { const p = rel ? `${rel}/${e}` : e; if (fs.statSync(path.join(root, p)).isDirectory()) walk(p); else out.push({ path: p, data: new Uint8Array(fs.readFileSync(path.join(root, p))) }); } };
  walk('');
  return out;
}
const core = () => require(path.join(__dirname, '..', '..', 'dist', 'src', 'themes', 'core'));

/** POST a theme zip to the admin import route (multipart), like the admin screen does. */
async function importZip(adminToken, zip, dryRun = false) {
  const form = new FormData();
  form.append('file', new Blob([zip], { type: 'application/zip' }), 'theme.zip');
  const r = await fetch(`${API}/admin/themes/import${dryRun ? '?dryRun=1' : ''}`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j.data ?? j };
}

const REPLACES = { 'clinic-calm': 'warm', 'restaurant-hearth': 'bold' };
/** Registers both reference themes as live free designs. Returns { 'clinic-calm': id, 'restaurant-hearth': id }. */
async function registerReference(h, adminToken) {
  const ids = {};
  for (const name of ['clinic-calm', 'restaurant-hearth']) {
    const zip = Buffer.from(core().makeZip(readTheme(name)));
    const r = await importZip(adminToken, zip);
    if (!r.body.ok) throw new Error(`import ${name}: ${JSON.stringify(r.body.lines?.filter((l) => l.level === 'error') ?? r.body).slice(0, 300)}`);
    const u = await h.call('PUT', `/admin/themes/${r.body.id}`, { role: 'FREE_DEFAULT', replacesDesign: REPLACES[name], status: 'LIVE' }, adminToken);
    if (!u || u.status >= 300) throw new Error(`publish ${name}: ${JSON.stringify(u).slice(0, 300)}`);
    ids[name] = r.body.id;
  }
  return ids;
}

function finish(label) {
  console.log(`\n${label}: ${state.pass} passed, ${state.fail} failed`);
  if (state.fail) { console.log(`FAIL: ${state.failures.join(' | ')}`); }
  process.exit(state.fail ? 1 : 0);
}

module.exports = { ROOT, FE, API, FRONT, state, ok, section, sleep, decode, ensureBuild, CHROME, portFree, boot, get, readTheme, core, importZip, registerReference, finish, spawn, http };
