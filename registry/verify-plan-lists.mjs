#!/usr/bin/env node
// Bug B4 guard: the vendor-facing plan list is generated from registry state and can only say what the product does.   node registry/verify-plan-lists.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read, loadRegistry } from './lib.mjs';
import { createRequire } from 'node:module';

const require = createRequire(path.join(ROOT, 'get4domain_mvp', 'package.json'));
const ts = require('typescript');
let pass = 0; let fail = 0;
const ok = (n, c, d) => { if (c) { pass += 1; console.log(`  PASS  ${n}`); } else { fail += 1; console.log(`  FAIL  ${n}${d ? ` -> ${d}` : ''}`); } };

// compile lib/plan-features.ts against the generated registry module
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-planlists-'));
const gen = ts.transpileModule(read('get4domain_mvp/src/lib/nav.generated.ts'), { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 } }).outputText;
fs.writeFileSync(path.join(tmp, 'nav.generated.mjs'), gen);
const pf = ts.transpileModule(read('get4domain_mvp/src/lib/plan-features.ts').replace("'@/lib/nav.generated'", "'./nav.generated.mjs'"), { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 } }).outputText;
fs.writeFileSync(path.join(tmp, 'plan-features.mjs'), pf);
const { planFeatureLines, planGains } = await import(pathToFileURL(path.join(tmp, 'plan-features.mjs')).href);
const reg = await loadRegistry();
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\n== [feat:plan.honest-list] plan lists are generated from registry state');
for (const plan of ['WORKSPACE', 'BOS']) {
  const lines = planFeatureLines(plan);
  const byId = new Map(reg.FEATURES.map((f) => [f.id, f]));
  const included = lines.filter((l) => l.state === 'INCLUDED' && byId.has(l.id));
  ok(`${plan}: everything listed as included is built and verified (WORKING or LIMITED)`, included.every((l) => ['WORKING', 'LIMITED'].includes(byId.get(l.id).status)), included.filter((l) => !['WORKING', 'LIMITED'].includes(byId.get(l.id).status)).map((l) => l.id).join(','));
  const soon = lines.filter((l) => l.state === 'COMING_SOON');
  ok(`${plan}: every feature that is not built is shown as Coming soon, none as included`, soon.every((l) => !['WORKING', 'LIMITED'].includes(byId.get(l.id)?.status)));
  ok(`${plan}: no hidden or Custom-only feature is listed`, lines.every((l) => !byId.get(l.id) || (!byId.get(l.id).hidden && byId.get(l.id).department !== 'custom')));
}
const ws = planFeatureLines('WORKSPACE'); const bos = planFeatureLines('BOS');
ok('the higher plan contains every line of the lower plan', ws.every((l) => bos.some((b) => b.id === l.id)));
ok('Pro gains something real over Essentials (purchases, books, CA pack are built)', planGains('WORKSPACE', 'BOS').some((l) => l.id === 'bos.books' && l.state === 'INCLUDED'));
const text = JSON.stringify([...ws, ...bos]).toLowerCase();
for (const claim of ['social media', 'backlink', 'search console', 'mobile app']) ok(`no unproven claim "${claim}" appears in a plan list`, !text.includes(claim));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
