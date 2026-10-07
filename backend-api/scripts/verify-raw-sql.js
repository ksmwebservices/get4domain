// Build guard: no query-returning raw SQL call may select a void-returning Postgres function.
//   node scripts/verify-raw-sql.js        (npm run verify:raw-sql; also run by verify:commercial and the security suite)
//
// Why: Prisma cannot deserialise a `void` result column, so `$queryRaw`/`$queryRawUnsafe` of pg_advisory_xact_lock(),
// pg_advisory_lock(), pg_advisory_unlock_all(), pg_notify() or pg_sleep() throws "Failed to deserialize column of type
// 'void'" at runtime (live incident 2026-10-07, Deal builder). Take locks with `advisoryXactLock()` from
// src/common/db-lock.ts ($executeRaw) instead. Boolean functions (pg_try_advisory_xact_lock) are fine in $queryRaw.
//
// Checks, for every .ts/.js file under src/ and scripts/ (the in-memory fakes under scripts/commercial-verify and
// this file and verify-db-lock.js are exempt — they mention the names on purpose):
//   1. the argument text of each $queryRaw / $queryRawUnsafe call (the SQL, however it is quoted);
//   2. indirect use: a file that calls $queryRaw* AND holds a code string/template mentioning a void function
//      outside every $executeRaw* call and comment (e.g. `const sql = 'SELECT pg_sleep(1)'; prisma.$queryRaw...(sql)`).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const VOID = /\bpg_(?:advisory_(?:xact_)?lock(?:_shared)?|advisory_unlock_all|notify|sleep(?:_for|_until)?)\b/i;
// verify-db-lock.js deliberately runs the OLD (broken) form once against the real database to show the bug reproduces.
const EXEMPT = [path.join('scripts', 'commercial-verify') + path.sep, path.join('scripts', 'verify-raw-sql.js'), path.join('scripts', 'verify-db-lock.js')];

function listFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out);
    else if (/\.(ts|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Replace comments with spaces (same length) so offsets stay valid; leaves strings/templates intact. */
function blankComments(src) {
  let out = '';
  for (let i = 0; i < src.length;) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i += 1; } continue; }
    if (c === '/' && n === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i += 1; } out += '  '; i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') { // copy a string/template literal verbatim
      const q = c; out += c; i += 1;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; } out += src[i]; i += 1; }
      out += src[i] ?? ''; i += 1; continue;
    }
    out += c; i += 1;
  }
  return out;
}

/** Index just past the ')' (or end of a tagged template) that closes the call starting at `start` (the name's end). */
function callEnd(src, start) {
  let i = start;
  while (/\s/.test(src[i] ?? '')) i += 1;
  if (src[i] === '<') { // generic args: $queryRawUnsafe<Row[]>(
    let depth = 0;
    for (; i < src.length; i += 1) { if (src[i] === '<') depth += 1; else if (src[i] === '>') { depth -= 1; if (depth === 0) { i += 1; break; } } }
    while (/\s/.test(src[i] ?? '')) i += 1;
  }
  if (src[i] === '`') { let j = i + 1; while (j < src.length && src[j] !== '`') j += src[j] === '\\' ? 2 : 1; return j + 1; } // tagged template
  if (src[i] !== '(') return start;
  let depth = 0;
  for (; i < src.length; i += 1) {
    const c = src[i];
    if (c === '\'' || c === '"' || c === '`') { const q = c; i += 1; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i += 1; i += 1; } continue; }
    if (c === '(') depth += 1;
    else if (c === ')') { depth -= 1; if (depth === 0) return i + 1; }
  }
  return src.length;
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;
const problems = [];
let scanned = 0;
let calls = 0;

for (const dir of ['src', 'scripts']) {
  for (const file of listFiles(path.join(root, dir))) {
    const rel = path.relative(root, file);
    if (EXEMPT.some((e) => rel === e || rel.startsWith(e))) continue;
    scanned += 1;
    const src = blankComments(fs.readFileSync(file, 'utf8'));
    const queryCalls = [...src.matchAll(/\$queryRaw(?:Unsafe)?\b/g)];
    calls += queryCalls.length;
    for (const m of queryCalls) {
      const end = callEnd(src, m.index + m[0].length);
      const text = src.slice(m.index, end);
      const hit = text.match(VOID);
      if (hit) problems.push(`${rel}:${lineOf(src, m.index)}  ${m[0]}(…) selects void function ${hit[0]}() — use advisoryXactLock() ($executeRaw) from src/common/db-lock.ts`);
    }
    if (queryCalls.length) {
      // Indirect: strip every $executeRaw* call, then look for a void function name left in code.
      let rest = src;
      for (const m of [...src.matchAll(/\$executeRaw(?:Unsafe)?\b/g)].reverse()) rest = rest.slice(0, m.index) + ' '.repeat(callEnd(rest, m.index + m[0].length) - m.index) + rest.slice(callEnd(rest, m.index + m[0].length));
      const direct = new Set(problems.filter((p) => p.startsWith(`${rel}:`)));
      const m = rest.match(VOID);
      if (m && direct.size === 0) problems.push(`${rel}:${lineOf(rest, m.index)}  file calls $queryRaw* and mentions void function ${m[0]}() outside $executeRaw — if it feeds a $queryRaw* call, use advisoryXactLock()`);
    }
  }
}

if (problems.length) {
  console.log('FAIL  void-returning Postgres function selected through a query-returning raw call:');
  problems.forEach((p) => console.log(`  ${p}`));
  console.log(`\n0 passed, ${problems.length} failed (${scanned} files, ${calls} $queryRaw* calls scanned)`);
  process.exit(1);
}
console.log(`ok    ${calls} $queryRaw/$queryRawUnsafe call(s) in ${scanned} files: none selects pg_advisory_lock / pg_advisory_xact_lock / pg_advisory_unlock_all / pg_notify / pg_sleep`);
console.log(`\n${scanned} passed, 0 failed (${scanned} files, ${calls} $queryRaw* calls scanned)`);
