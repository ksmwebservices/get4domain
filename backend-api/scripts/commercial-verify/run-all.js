// Runs every Commercial Engine v1 verification script against the compiled dist/ (run `npx nest build` first).
//   node scripts/commercial-verify/run-all.js        (or: npm run verify:commercial)
const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  ['raw-SQL guard (no void-function SELECT through $queryRaw*)', '../verify-raw-sql.js'],
  ['migration SQL hygiene (no CLI banners or junk in migration.sql)', '../verify-migrations.js'],
  ['pure logic (money math, rules, tokens, UPI)', 'verify-pure.js'],
  ['end-to-end flows (deals, pay, confirm, promos, renewal, lapse, plan change, authz)', 'verify-flows.js'],
  ['stock, availability, movement ledger, order requests (fake DB)', 'verify-stock.js'],
  ['Deal-builder guard, vendor audit trail, stepnrock term-fix plan', 'verify-term-guard.js'],
  ['image upload (formats, content check, size, served URL, headers, unwritable volume)', 'verify-uploads.js'],
  ['custom-domain CORS (open default, strict + CORS_EXTRA_ORIGINS)', 'verify-cors.js'],
  ['stock + migration on REAL Postgres (PGlite; SKIPs if G4D_PGLITE_DIR is not set up)', 'verify-stock-pg.js'],
];
// The admin nav lives in the Next.js app; run its check from here too when the monorepo sibling is present.
const navScript = path.join(__dirname, '..', '..', '..', 'get4domain_mvp', 'scripts', 'verify-admin-nav.mjs');
if (require('fs').existsSync(navScript)) suites.push(['admin nav config (MARKETING never sees Commerce)', navScript, path.dirname(path.dirname(navScript))]);
let failed = 0;
const summary = [];
for (const [label, file, cwd] of suites) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(process.execPath, [path.isAbsolute(file) ? file : path.join(__dirname, file)], { cwd: cwd ?? process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n');
  console.log(lines.filter((l) => /FAIL|passed,|Error:/.test(l)).join('\n') || '(no output)');
  const ok = r.status === 0;
  if (!ok) failed += 1;
  summary.push(`${ok ? 'PASS' : 'FAIL'}  ${label}  — ${(lines.find((l) => /passed,/.test(l)) || '').trim()}`);
}
console.log('\n================ SUMMARY');
summary.forEach((s) => console.log(s));
process.exit(failed ? 1 : 0);
