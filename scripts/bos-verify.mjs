#!/usr/bin/env node
// One command that proves the Full BOS holds together:   npm run bos:verify   (from the repo root)
//   node scripts/bos-verify.mjs [--build]      --build also compiles the API first (the suites run against backend-api/dist)
// Prints PASS / FAIL for every guard and ends with the proof that every Open feature has a passing test id.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BE = path.join(ROOT, 'backend-api');
const FE = path.join(ROOT, 'get4domain_mvp');
const node = process.execPath;
const LOG = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-bos-verify-')), 'suites.log');
fs.writeFileSync(LOG, '');
const env = { ...process.env, G4D_SUITE_LOG: LOG };

const steps = [
  ['registry guard (routes, ids, evidence, generated files current)', ROOT, [node, 'registry/check.mjs']],
  ['registry rules, menus per plan, redirects (retired routes redirect, query kept)', ROOT, [node, 'registry/verify-registry.mjs']],
  ['vendor plan lists are generated from registry state (Bug B4)', ROOT, [node, 'registry/verify-plan-lists.mjs']],
  ['migration guard: every new migration is additive', BE, [node, 'scripts/verify-migrations-additive.js']],
  ['migration SQL hygiene', BE, [node, 'scripts/verify-migrations.js']],
  ['update DTOs accept every editable column of their table (Bug B1, server side)', BE, [node, 'scripts/audit/dto-echo.js', '--strict']],
  ['forms and API agree on edits; no edit sends a loaded record (Bug B1, client side)', FE, [node, 'scripts/verify-payload-contract.mjs']],
  ['every credential-like input decides its autocomplete (Bug B2)', FE, [node, 'scripts/audit-credential-fields.mjs']],
  ['no typed price or plan name in vendor dashboard code (Bug B3)', FE, [node, 'scripts/audit-hardcoded-prices.mjs']],
  ['security suites that need no database (never boots the app against a real database)', BE, [node, 'scripts/security-verify/run-offline.js']],
  ['all backend suites: rule book, real-Postgres chains A-D, stock ledger property + concurrency, upgrade/downgrade, order bridge, backfill, commercial engine', BE, [node, 'scripts/commercial-verify/run-all.js']],
];

const results = [];
if (process.argv.includes('--build')) {
  const r = spawnSync('npx', ['nest', 'build'], { cwd: BE, shell: true, encoding: 'utf8' });
  results.push({ name: 'API compiles (nest build)', ok: r.status === 0 && !/error/i.test(r.stdout + r.stderr), note: (r.stdout + r.stderr).split('\n').filter((l) => /error/i.test(l)).slice(0, 3).join(' | ') });
}
if (!fs.existsSync(path.join(BE, 'dist', 'src', 'main.js'))) { console.error('backend-api/dist is missing: run `npm run bos:verify -- --build` (or `npx nest build` in backend-api) first.'); process.exit(2); }

for (const [name, cwd, cmd] of steps) {
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  fs.appendFileSync(LOG, `\n##### ${name}\n${out}\n`);
  const last = out.split('\n').filter((l) => /passed|PASS:|FAIL|guard: OK|SUMMARY/.test(l)).slice(-1)[0]?.trim() ?? '';
  results.push({ name, ok: r.status === 0, note: r.status === 0 ? last : out.split('\n').filter((l) => /FAIL|✗|Error/.test(l)).slice(0, 4).join(' | ') });
}

// every Open feature that names a test id must have a PASSING tagged assertion in what just ran
const log = fs.readFileSync(LOG, 'utf8').split('\n');
const tags = new Map(); // id -> { pass, fail }
let scope = null;
for (const line of log) {
  const head = /^==\s.*\[feat:([\w.\-]+)\]/.exec(line);
  if (/^==/.test(line)) { scope = head ? head[1] : null; if (head && !tags.has(scope)) tags.set(scope, { pass: 0, fail: 0 }); continue; }
  const m = /^\s*(PASS|FAIL)\s/.exec(line);
  const inline = /\[feat:([\w.\-]+)\]/.exec(line);
  const id = inline ? inline[1] : scope;
  if (m && id) { const t = tags.get(id) ?? { pass: 0, fail: 0 }; t[m[1] === 'PASS' ? 'pass' : 'fail'] += 1; tags.set(id, t); }
}
const reg = await (await import(pathToFileURL(path.join(ROOT, 'registry', 'lib.mjs')).href)).loadRegistry();
const open = reg.FEATURES.filter((f) => (f.status === 'WORKING' || f.status === 'LIMITED') && f.testId);
// verified by an end-to-end suite that needs a built storefront and is run on its own
const EXTERNAL = { 'site.live-edit': 'backend-api/scripts/e2e/stepnrock-live.js' };
const missing = open.filter((f) => { if (EXTERNAL[f.testId]) return false; const t = tags.get(f.testId); return !t || t.fail > 0 || t.pass === 0; });
results.push({ name: `every Open feature with a test id has a passing test (${open.length - missing.length} of ${open.length}${Object.keys(EXTERNAL).length ? `, incl. ${Object.keys(EXTERNAL).length} run as a separate end-to-end suite` : ''}; features without a test id are verified by a recorded manual check)`, ok: missing.length === 0, note: missing.map((f) => `${f.id}[${f.testId}]`).join(', ') });

console.log('\n================ bos:verify');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `\n        ${r.note}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} guards passed${failed ? `, ${failed} FAILED` : ''}.`);
process.exit(failed ? 1 : 0);
