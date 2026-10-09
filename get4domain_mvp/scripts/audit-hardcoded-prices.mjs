#!/usr/bin/env node
// Bug B3 class audit + permanent guard.   node scripts/audit-hardcoded-prices.mjs [--list] [--write-baseline]
//
// B3 was: the same AI credit shown as Rs 250 (the vendor's term) and Rs 499 (a typed list), because each screen typed its own number.
// Rule: a price, credit, limit or plan name is never typed into a component. It comes from the pricing config (lib/pricing.ts, the admin's live
// pricing), the registry (planDisplayName, plan features) or the server's own answer.
//   STRICT   vendor dashboard code (app/dashboard, dashboard-v2, bos, components/dashboard, components/vendor, most of lib): zero rupee amounts
//            and zero typed plan names.
//   RATCHET  marketing copy and industry demo content: amounts exist there today; the count per file may only go DOWN (baseline below).
//   CONFIG   lib/pricing.ts, lib/commerce.ts, data/platform-features.ts: the places numbers are allowed to live.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', 'src');
const BASELINE_FILE = path.join(here, 'hardcoded-prices.baseline.json');
const LIST = process.argv.includes('--list');

const CONFIG = [/^lib\/pricing\.ts$/, /^data\/platform-features\.ts$/, /^lib\/nav\.generated\.ts$/, /\.generated\.ts$/];
const STRICT = [/^app\/dashboard\//, /^dashboard-v2\//, /^bos\//, /^components\/dashboard\//, /^components\/vendor\//, /^lib\//, /^app\/d\//];
const AMOUNT = /₹\s?\d/;
const PLAN_NAME = /\b(DomainApp Startup|Essentials|Workspace plan|BOS plan)\b/;

const walk = (d, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(p, acc); } else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p); } return acc; };
const isComment = (line) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);

const counts = {}; const strictHits = [];
for (const f of walk(ROOT)) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  if (CONFIG.some((r) => r.test(rel))) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const strict = STRICT.some((r) => r.test(rel));
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    if (AMOUNT.test(line) || PLAN_NAME.test(line)) {
      if (strict) strictHits.push({ rel, line: i + 1, text: line.trim().slice(0, 110) });
      else counts[rel] = (counts[rel] ?? 0) + 1;
    }
  });
}

if (process.argv.includes('--write-baseline')) { fs.writeFileSync(BASELINE_FILE, JSON.stringify(counts, null, 2) + '\n'); console.log(`baseline written: ${Object.keys(counts).length} marketing files, ${Object.values(counts).reduce((a, b) => a + b, 0)} lines`); process.exit(0); }

const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : {};
const grew = Object.entries(counts).filter(([f, n]) => n > (baseline[f] ?? 0));
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`vendor-dashboard code: ${strictHits.length} typed price/plan-name line(s) (must be 0). Marketing/demo copy: ${total} line(s) in ${Object.keys(counts).length} files (baseline ${Object.values(baseline).reduce((a, b) => a + b, 0)}; may only go down).`);
for (const h of strictHits) console.log(`  STRICT ${h.rel}:${h.line}  ${h.text}`);
for (const [f, n] of grew) console.log(`  GREW   ${f}: ${n} (baseline ${baseline[f] ?? 0})`);
if (LIST) for (const [f, n] of Object.entries(counts)) console.log(`  marketing ${f}: ${n}`);
if (strictHits.length || grew.length) { console.error('\nFAIL: take the number or plan name from lib/pricing.ts / use-plan-terms / planDisplayName, not from the component.'); process.exit(1); }
console.log('PASS: no typed price or plan name in vendor dashboard code; marketing copy did not grow.');
