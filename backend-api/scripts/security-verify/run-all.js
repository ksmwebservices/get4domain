// Runs every security-patch verification script. Usage (from backend-api/): npx nest build && node scripts/security-verify/run-all.js
// The DB-less scripts use in-memory fakes. The live-app step boots dist/src/main.js on a spare port using
// .env.local and sends ONLY non-writing requests (see verify-live-app.js). Pass BASELINE_REV=<git rev> to
// also replay the exploits against the pre-patch code (default: the commit before this patch).
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const BASELINE = process.env.BASELINE_REV || 'f7ad328';
const results = [];

function loadEnv() {
  const env = {};
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

function run(label, script, extraEnv = {}) {
  console.log(`\n################ ${label}`);
  const r = spawnSync('node', [path.join(__dirname, script)], { cwd: root, env: { ...process.env, ...extraEnv }, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out.split('\n').filter((l) => !/\[Nest\]|UV_HANDLE_CLOSING/.test(l)).join('\n'));
  results.push({ label, ok: r.status === 0 });
}

async function runLive(mode, extra) {
  const env = { ...loadEnv(), ...process.env, PORT: '3099', ...extra };
  delete env.THROTTLE_DISABLED;
  if (mode === 'nosecret') delete env.FAST2SMS_WEBHOOK_SECRET;
  const app = spawn('node', ['dist/src/main.js'], { cwd: root, env, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { if ((await fetch('http://localhost:3099/pricing')).ok) break; } catch (_) { /* booting */ }
    }
    run(`LIVE APP (${mode})`, 'verify-live-app.js', { ...env, MODE: mode });
  } finally { app.kill(); await new Promise((r) => setTimeout(r, 800)); }
}

(async () => {
  run('FIX 1/2 — payments: forged/mismatched/replayed verification, server-side amounts', 'verify-payments.js');
  run(`FIX 1 — BEFORE patch (${BASELINE}): the exploit works`, 'verify-baseline-exploit.js', { BASELINE_REV: BASELINE });
  run('FIX 1 — wallet top-up, go-live, theme unlock', 'verify-wallet-golive-theme.js');
  run('FIX 3 — checkout: tampered prices + replay', 'verify-checkout.js');
  run('FIX 4 — secrets in responses (patched)', 'verify-secrets-http.js');
  run(`FIX 4 — BEFORE patch (${BASELINE}): the leak exists`, 'verify-secrets-http.js', { BASELINE_REV: BASELINE });
  run('FIX 6 — global limits, trusted IPs, kill switch', 'verify-throttle-global.js');
  await runLive('nosecret', {});
  await runLive('secret', { FAST2SMS_WEBHOOK_SECRET: 'verify-only-secret-7f3a91c2' });

  console.log('\n================ SUMMARY');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
