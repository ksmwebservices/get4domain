// Runs every Commercial Engine v1 verification script against the compiled dist/ (run `npx nest build` first).
//   node scripts/commercial-verify/run-all.js        (or: npm run verify:commercial)
const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  ['pure logic (money math, rules, tokens, UPI)', 'verify-pure.js'],
  ['end-to-end flows (deals, pay, confirm, promos, renewal, lapse, plan change, authz)', 'verify-flows.js'],
];
let failed = 0;
const summary = [];
for (const [label, file] of suites) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
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
