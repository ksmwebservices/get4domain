// Migration guard (Full BOS phase 9).  node scripts/verify-migrations-additive.js
// "Every migration is additive": nothing is dropped, no column type is narrowed, no NOT NULL is added without a default, nothing is renamed.
// Checked on every migration from FIRST_GUARDED on (older ones were applied long ago and are reported, not failed).
// A migration that must break the rule needs an entry in ALLOW below with the reason, so the exception is written down and reviewed.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'prisma', 'migrations');
const FIRST_GUARDED = '20261001000000';
const ALLOW = {
  // 'folder_name': 'why this one may break the rule (and who approved it)'
};

const RULES = [
  [/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
  [/\bDROP\s+COLUMN\b/i, 'DROP COLUMN'],
  [/\bDROP\s+TYPE\b/i, 'DROP TYPE'],
  [/\bDROP\s+INDEX\b/i, 'DROP INDEX (an index that code relies on)'],
  [/\bDROP\s+CONSTRAINT\b/i, 'DROP CONSTRAINT'],
  [/\bTRUNCATE\b/i, 'TRUNCATE'],
  [/\bDELETE\s+FROM\b/i, 'DELETE FROM'],
  [/\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i, 'column type change (could narrow)'],
  [/\bALTER\s+COLUMN\b[^;]*\bSET\s+NOT\s+NULL\b/i, 'SET NOT NULL'],
  [/\bRENAME\s+(COLUMN|TO)\b/i, 'RENAME'],
];

let failed = 0; let checked = 0; const notes = [];
for (const dir of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  const sql = fs.readFileSync(path.join(root, dir, 'migration.sql'), 'utf8').split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
  const problems = [];
  for (const [re, label] of RULES) if (re.test(sql)) problems.push(label);
  // ADD COLUMN ... NOT NULL without DEFAULT (existing rows would make Postgres refuse it)
  for (const m of sql.matchAll(/ADD\s+COLUMN\s+("[^"]+"|\w+)\s+([^,;]*?)(?=,\s*ADD\s|;)/gis)) {
    if (/NOT\s+NULL/i.test(m[2]) && !/DEFAULT/i.test(m[2])) problems.push(`ADD COLUMN ${m[1]} NOT NULL without a default`);
  }
  if (dir < FIRST_GUARDED) { if (problems.length) notes.push(`${dir}: ${problems.join(', ')} (older than the guard)`); continue; }
  checked += 1;
  if (problems.length && !ALLOW[dir]) { failed += 1; console.log(`  FAIL  ${dir}: ${[...new Set(problems)].join(', ')}`); } else console.log(`  PASS  ${dir}${problems.length ? ` (allowed: ${ALLOW[dir]})` : ''}`);
}
for (const n of notes) console.log(`  note  ${n}`);
console.log(`\n${checked - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
