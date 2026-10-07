// Fails when a prisma/migrations/*/migration.sql contains non-SQL junk — typically a CLI banner captured while the
// SQL was generated (e.g. the "Update available" box that made Postgres reject 20261007120000 with P3018).
//   node scripts/verify-migrations.js        (npm run verify:migrations)
// Checked: box-drawing characters (U+2500–U+257F), "Update available", "npm i", pris.ly URLs outside `--` comments,
// a UTF-8 BOM, NUL bytes, and an empty file. CRLF line endings are only reported (Postgres accepts them).
// When generating migration SQL set PRISMA_HIDE_UPDATE_MESSAGE=true and write straight to the file — see DEPLOYMENT.md.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'prisma', 'migrations');
const BOX = /[─-╿]/;
let failures = 0;
let files = 0;
const notes = [];

for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const file = path.join(root, dir.name, 'migration.sql');
  if (!fs.existsSync(file)) { console.log(`FAIL  ${dir.name}: no migration.sql`); failures += 1; continue; }
  files += 1;
  const bytes = fs.readFileSync(file);
  const problems = [];
  if (bytes.length === 0) problems.push('file is empty');
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) problems.push('starts with a UTF-8 BOM');
  if (bytes.includes(0)) problems.push('contains NUL bytes');
  const lines = bytes.toString('utf8').split('\n');
  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, '');
    const isComment = line.trimStart().startsWith('--');
    if (BOX.test(line)) problems.push(`line ${i + 1}: box-drawing character`);
    if (/Update available/i.test(line)) problems.push(`line ${i + 1}: "Update available" banner text`);
    if (/\bnpm i\b/.test(line)) problems.push(`line ${i + 1}: "npm i" instruction`);
    if (/pris\.ly/i.test(line) && !isComment) problems.push(`line ${i + 1}: pris.ly URL outside a comment`);
  });
  if (bytes.includes(13)) notes.push(`${dir.name}: CRLF line endings (accepted by Postgres; not a failure)`);
  if (problems.length) {
    failures += 1;
    console.log(`FAIL  ${dir.name}/migration.sql`);
    problems.slice(0, 8).forEach((p) => console.log(`        ${p}`));
  }
}
notes.forEach((n) => console.log(`note  ${n}`));
console.log(`\n${files - failures} passed, ${failures} failed (${files} migration files scanned)`);
process.exit(failures ? 1 : 0);
