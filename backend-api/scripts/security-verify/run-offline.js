// The security suites that need NO database and NO .env.local (everything faked or in memory). Unlike run-all.js, this never boots the real app
// against the configured database, so it is safe to run anywhere:   node scripts/security-verify/run-offline.js
const { spawnSync } = require('child_process');
const path = require('path');

const suites = ['verify-payments', 'verify-wallet-golive-theme', 'verify-checkout', 'verify-secrets-http', 'verify-throttle-global'];
let bad = 0;
for (const f of suites) {
  const r = spawnSync(process.execPath, [path.join(__dirname, `${f}.js`)], { cwd: path.join(__dirname, '..', '..'), encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgresql://offline:offline@127.0.0.1:1/none', DIRECT_URL: 'postgresql://offline:offline@127.0.0.1:1/none' } });
  const out = `${r.stdout || ''}${r.stderr || ''}`.split('\n').filter((l) => !/\[Nest\]|UV_HANDLE_CLOSING/.test(l)).join('\n');
  process.stdout.write(`\n##### ${f}\n${out}\n`);
  if (r.status !== 0) { bad += 1; console.log(`FAIL  ${f}`); }
}
console.log(`\n${suites.length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
