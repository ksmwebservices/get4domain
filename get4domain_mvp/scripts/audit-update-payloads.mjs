#!/usr/bin/env node
// Bug B1 class audit + permanent guard.   node scripts/audit-update-payloads.mjs [--list]
//
// B1 was: the Website Manager loaded a record, changed a field and sent the WHOLE record back (id, vendorId, createdAt, updatedAt, businessHours)
// to an API that refuses unknown properties. The class is: an edit call whose payload is not made only of editable fields.
//
// The script finds every call of an edit helper from lib/api.ts (one whose body uses PUT or PATCH with a JSON body) in the app code and classifies its payload:
//   literal      an object literal, or a variable built from one in the same file, or form state that is only ever set from literals   -> safe
//   picked       editable(x, [...]) / Object.fromEntries(...)                                                                         -> safe
//   loaded       form state that is set from a loaded record (setX(record))                                                            -> RISK
//   other/spread a bare variable we cannot trace, or an object that spreads another                                                    -> RISK
// It FAILS on any RISK that is not in REVIEWED (each entry needs a reason a person wrote).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const LIST = process.argv.includes('--list');

// file (relative to src) -> { payload text: reason it is safe }
const REVIEWED = {
  'app/admin/telecrm/page.tsx': { data: 'typed by the page as the same narrow shape the helper declares ({ status?, notes?, assignedTo?, followUpDate? }); the form state holds only those fields' },
  'app/dashboard/telecrm/page.tsx': { data: 'typed as the narrow shape the helper declares; built from the form fields, never from a loaded lead' },
};

const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(p, acc); } else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
};
const files = walk(ROOT).filter((f) => !/generated\.ts$/.test(f));

// 1. the edit helpers: one chunk of lib/api.ts per helper
const apiSrc = fs.readFileSync(path.join(ROOT, 'lib', 'api.ts'), 'utf8');
const editFns = new Set();
const starts = [...apiSrc.matchAll(/^ {2}([A-Za-z0-9_]+):/gm)];
starts.forEach((m, i) => {
  const chunk = apiSrc.slice(m.index, starts[i + 1]?.index ?? apiSrc.length);
  // only helpers that forward the caller's object as the whole body can leak extra keys; `JSON.stringify({ status })` wraps a scalar and is safe
  if (/method:\s*'(PUT|PATCH)'/.test(chunk) && /JSON\.stringify\(\s*[A-Za-z_$][\w$]*\s*\)/.test(chunk)) editFns.add(m[1]);
});

function splitArgs(s) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of s) {
    if ('({['.includes(ch)) depth += 1;
    if (')}]'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const isIdent = (p) => /^[A-Za-z_$][\w$]*$/.test(p);

/** What a bare identifier holds, judged from the file that uses it. */
function resolve(name, src) {
  const decl = new RegExp('(?:const|let)\\s+' + name + '(?:\\s*:[^=\\n]+)?\\s*=\\s*([^\\n]{0,40})').exec(src);
  if (decl) {
    const rhs = decl[1].trim();
    if (rhs.startsWith('{')) {
      // find the object body to see whether it spreads another object
      const at = src.indexOf(decl[0]) + decl[0].indexOf('{');
      let depth = 0; let end = at;
      for (let i = at; i < src.length; i += 1) { if (src[i] === '{') depth += 1; if (src[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } } }
      const body = src.slice(at, end + 1);
      return /(^|[,{\s])\.\.\.[A-Za-z_$]/.test(body) ? 'spread' : 'literal';
    }
    if (/^(Object\.fromEntries|editable|pickEditable)\(/.test(rhs)) return 'picked';
    return 'other';
  }
  const state = new RegExp('const\\s*\\[\\s*' + name + '\\s*,\\s*(set\\w+)\\s*\\]\\s*=\\s*useState').exec(src);
  if (state) {
    const setter = state[1];
    const calls = [...src.matchAll(new RegExp('\\b' + setter + '\\(([^;\\n]*?)\\)(?:;|\\s*\\)|\\s*,|\\s*$|\\s*\\})', 'g'))].map((m) => m[1].trim());
    const spreadsLoaded = (a) => a.startsWith('{') && [...a.matchAll(/\.\.\.\s*([A-Za-z_$][\w$.]*)/g)].some((m) => !/^(p|prev|f|s|state|old|cur|current|EMPTY\w*|INITIAL\w*|BLANK\w*|DEFAULT\w*|empty\w*|blank\w*|initial\w*)$/.test(m[1]));
    const bad = calls.filter((a) => a && (spreadsLoaded(a) || !a.startsWith('{')) && !/^\(?[\w\s,]*\)?\s*=>/.test(a) && !/^['"`\d]/.test(a) && !/^(null|undefined|false|true|EMPTY\w*|INITIAL\w*|BLANK\w*|DEFAULT\w*|empty\w*|blank\w*|initial\w*)$/.test(a));
    return bad.length === 0 ? 'literal' : `loaded (${setter}(${bad[0].slice(0, 40)}))`;
  }
  return 'other';
}

function classify(payload, src) {
  if (!payload) return 'none';
  if (/^\{[\s\S]*\}$/.test(payload)) return /(^|[,{\s])\.\.\.[A-Za-z_$]/.test(payload) ? 'spread' : 'literal';
  if (/^(pickEditable|editable|Object\.fromEntries)\(/.test(payload)) return 'picked';
  if (/^['"`\d]/.test(payload) || /^(true|false|null|undefined)$/.test(payload)) return 'literal';
  if (isIdent(payload)) return resolve(payload, src);
  return 'other';
}

const rows = [];
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  if (rel === 'lib/api.ts') continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bapi\.([A-Za-z0-9_]+)\(/g)) {
    if (!editFns.has(m[1])) continue;
    let depth = 1; let i = m.index + m[0].length;
    const startArgs = i;
    for (; i < src.length && depth > 0; i += 1) { if (src[i] === '(') depth += 1; if (src[i] === ')') depth -= 1; }
    const args = splitArgs(src.slice(startArgs, i - 1));
    const payload = (args[args.length - 1] ?? '').trim();
    rows.push({ rel, line: src.slice(0, m.index).split('\n').length, fn: m[1], payload, kind: classify(payload, src), nargs: args.length });
  }
}

const bucket = (k) => rows.filter((r) => (k === 'risk' ? !/^(literal|picked|none)$/.test(r.kind) : r.kind === k)).length;
const risky = rows.filter((r) => !/^(literal|picked|none)$/.test(r.kind) && !REVIEWED[r.rel]?.[r.payload]);
console.log(`edit calls found: ${rows.length}  (safe literal ${bucket('literal')}, picked ${bucket('picked')}, no payload ${bucket('none')}, RISK ${bucket('risk')})`);
for (const r of LIST ? rows : risky) console.log(`  ${r.kind.slice(0, 24).padEnd(24)} ${r.rel}:${r.line}  api.${r.fn}(… ${r.payload.slice(0, 60)})`);
if (risky.length) { console.error(`\nFAIL: ${risky.length} edit call(s) may send read-only fields. Send an object literal of the editable fields, or editable(x, [...]) from '@/lib/editable'.`); process.exit(1); }
console.log('PASS: every edit call sends a literal or picked payload.');
