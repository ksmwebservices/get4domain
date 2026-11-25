// node packs/_tools/ledger.mjs <queue-number> <pack> <type> <status> <commit> "<lint>" "<notes>"   updates the queue row and appends the ledger row
import fs from 'node:fs';
const [n, pack, type, status, commit, lint, notes] = process.argv.slice(2);
const q = 'docs/v3/THEME_QUEUE.md';
const rows = fs.readFileSync(q, 'utf8').split('\n').map((l) => (l.startsWith(`| ${n} |`) ? l.replace(/\| (QUEUED|IN PROGRESS|DONE|BLOCKED) \|$/, `| ${status} |`) : l));
fs.writeFileSync(q, rows.join('\n'));
fs.appendFileSync('docs/v3/THEME_FACTORY_LEDGER.md', `| ${pack} | ${type} | ${status} | ${lint} | ${commit} | ${new Date().toISOString().slice(0, 10)} | ${notes} |\n`);
