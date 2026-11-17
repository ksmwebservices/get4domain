/* Staging smoke probe: signs in each throwaway role from C:\Get4Domain\smoke\users.json and calls the GET routes the vendor, admin, partner and public apps use, against the LOCAL API
 * (scripts/staging/smoke-api.js). It checks, per route and role, that an allowed role is let in and a refused role is refused, and prints a compact table.
 *
 *   node scripts/staging/smoke-probe.js [--api http://localhost:3008] [--out ..\docs\v3\SMOKE_RESULTS_A3.md] [--only <text>]
 *
 * Uses node's own fetch (no dependency). Only GET requests. Never prints or writes a token or a password. Refuses any API that is not on localhost.
 * Needs: the API running, the seed run, and `npm run build` (the role matrix is read from dist/).
 */
const fs = require('fs');
const path = require('path');
const lib = require('./smoke-probe-lib');

const BACKEND = path.resolve(__dirname, '../..');
const USERS_FILE = process.env.SMOKE_USERS_FILE || 'C:\\Get4Domain\\smoke\\users.json';
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };

async function call(base, p, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(base + p, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    let code = null;
    const ct = res.headers.get('content-type') || '';
    if (res.status >= 400 && ct.includes('json')) { try { const b = await res.json(); code = (b && (b.code || (b.error && b.error.code))) || null; } catch { /* no body */ } } else { await res.arrayBuffer().catch(() => {}); }
    return { status: res.status, code };
  } catch (e) { return { status: 0, code: e && e.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK' }; }
}

async function login(base, u) {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password }), signal: AbortSignal.timeout(30000) });
  if (!res.ok) return { error: `login ${res.status}` };
  const b = await res.json();
  const token = b && b.data && b.data.accessToken;
  return token ? { token } : { error: 'no token in the answer' };
}

async function pool(items, size, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i); } }));
  return out;
}

async function main() {
  const base = (flag('--api', 'http://localhost:3008')).replace(/\/+$/, '');
  if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) { console.error('SMOKE PROBE REFUSED: the API must be on localhost'); process.exit(2); }
  if (!fs.existsSync(USERS_FILE)) { console.error('SMOKE PROBE: users file not found; run the seed first'); process.exit(2); }
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')).users;
  const matrix = require(path.join(BACKEND, 'dist/src/auth/guards/admin-role-matrix.js'));
  const baseline = require(path.join(BACKEND, 'test/baselines/route-classification.json'));
  const ids = { vendor: users.vendorFree && users.vendorFree.id, referralCode: JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')).referralCode };

  const principals = [{ key: 'anon' }, ...lib.PRINCIPALS.map((p) => ({ key: p }))];
  const tokens = {};
  for (const p of lib.PRINCIPALS) {
    if (!users[p]) { console.error(`SMOKE PROBE: ${p} missing in the users file`); process.exit(2); }
    const r = await login(base, users[p]);
    if (r.error) { console.error(`SMOKE PROBE: sign-in failed for ${p} (${r.error})`); process.exit(1); }
    tokens[p] = r.token;
  }
  const secrets = [...Object.values(tokens), ...Object.values(users).map((u) => u.password)];

  const plan = lib.planRoutes(baseline.routes, matrix, ids);
  if (flag('--only')) plan.routes = plan.routes.filter((r) => r.path.includes(flag('--only')));
  console.log(`probing ${plan.routes.length} routes x ${principals.length} principals (${plan.skipped.length} routes skipped: need an id or a provider)`);
  const jobs = [];
  for (const r of plan.routes) for (const p of principals) jobs.push({ r, p: p.key });
  const got = await pool(jobs, 4, async ({ r, p }) => ({ r, p, ...(await call(base, r.path, p === 'anon' ? null : tokens[p])) }));
  const rows = lib.collect(plan.routes, got);
  const md = lib.renderMarkdown(rows, plan, { api: base });
  const redacted = lib.redactAll(md, secrets);
  const out = flag('--out');
  if (out) fs.writeFileSync(path.resolve(out), redacted);
  const bad = rows.filter((x) => x.verdict === 'FAIL');
  console.log(lib.renderConsole(rows));
  console.log(`${rows.filter((x) => x.verdict === 'PASS').length} pass, ${rows.filter((x) => x.verdict === 'REACH').length} reached (needs input), ${bad.length} FAIL${out ? `; table written to ${out}` : ''}`);
  if (bad.length) process.exitCode = 1;
}

if (require.main === module) main().catch((e) => { console.error('SMOKE PROBE ERROR:', String(e && e.message ? e.message : e).slice(0, 200)); process.exit(1); });
