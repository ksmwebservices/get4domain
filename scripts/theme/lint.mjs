#!/usr/bin/env node
// Theme lint (industry designs round 2). Checks a theme folder or zip against the same rules the admin upload applies, in plain sentences, with no server and no build step.
//
//   node scripts/theme/lint.mjs <folder|theme.zip> [--fix] [--out <path>] [--json]
//
//   (nothing)  read and report. Exit 0 = no problems (warnings may remain), 1 = at least one problem, 2 = could not read the input.
//   --fix      apply the safe automatic fixes (index.html -> home.html, a first theme.json, scripts and handlers removed, stylesheet scoped, tiny pictures inlined),
//              write the result next to the input (or to --out), then lint the fixed copy. It never changes a picture or a page's text.
//   --json     print the report as JSON instead of text.
//
// The rules live once, in backend-api/src/themes/core; this command loads that TypeScript with the TypeScript compiler that backend-api already has.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { core } from './lib-core.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const optIdx = args.indexOf('--out');
const outPath = optIdx >= 0 ? args[optIdx + 1] : null;
const input = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
if (!input) { console.error('Usage: node scripts/theme/lint.mjs <folder|theme.zip> [--fix] [--out <path>] [--json]'); process.exit(2); }
if (!existsSync(input)) { console.error(`I could not find "${input}".`); process.exit(2); }

const SKIP = new Set(['node_modules', '.git', '.DS_Store', 'Thumbs.db', '__MACOSX']);
function readDir(root, rel = '') {
  const out = [];
  for (const name of readdirSync(join(root, rel))) {
    if (SKIP.has(name)) continue;
    const p = rel ? `${rel}/${name}` : name;
    const full = join(root, p);
    if (statSync(full).isDirectory()) out.push(...readDir(root, p)); else out.push({ path: p, data: new Uint8Array(readFileSync(full)) });
  }
  return out;
}

const isZip = statSync(input).isFile();
let files;
if (isZip) {
  const z = core.readZip(new Uint8Array(readFileSync(input)));
  if (z.error) { console.error(z.error); process.exit(2); }
  files = z.files;
} else files = core.unwrapFolder(readDir(input));

const folderName = basename(input).replace(/\.zip$/i, '');
let notes = [];
if (flag('--fix')) {
  const fixed = core.fixPackage(files, folderName);
  files = fixed.files; notes = fixed.notes;
  const target = outPath ? resolve(outPath) : isZip ? resolve(dirname(input), `${folderName}-fixed.zip`) : resolve(`${input}-fixed`);
  if (isZip || /\.zip$/i.test(target)) writeFileSync(target, core.makeZip(files));
  else { for (const f of files) { const dest = join(target, f.path); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, f.data); } }
  notes.push(`Wrote the fixed copy to ${target}. Your original was not changed.`);
}

const report = core.lintPackage(files);
if (flag('--json')) {
  console.log(JSON.stringify({ ok: report.ok, errors: report.errors, warnings: report.warnings, lines: report.lines, contrast: report.contrast, fixes: notes }, null, 2));
} else {
  if (notes.length) { console.log('FIXES'); for (const n of notes) console.log(`  ${n}`); console.log(''); }
  console.log(core.formatReport(report));
  console.log('');
  console.log(report.ok ? `Result: no problems${report.warnings ? `, ${report.warnings} warning(s)` : ''}. This theme can be imported.` : `Result: ${report.errors} problem(s) to fix before this theme can be imported${report.warnings ? `, and ${report.warnings} warning(s)` : ''}.`);
}
process.exit(report.ok ? 0 : 1);
