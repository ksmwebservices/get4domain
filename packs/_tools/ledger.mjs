// node packs/_tools/ledger.mjs <queue-number> <pack> <type> <status> <commit> "<lint>" "<notes>" "<start YYYY-MM-DD HH:MM>"
// Updates the queue row and appends the ledger row. The push time is the clock time of this call, which runs immediately before `git push`.
import fs from 'node:fs';
const [n, pack, type, status, commit, lint, notes, start] = process.argv.slice(2);
const q = 'docs/v3/THEME_QUEUE.md';
const rows = fs.readFileSync(q, 'utf8').split('
').map((l) => (l.startsWith(`| ${n} |`) ? l.replace(/\| (QUEUED|IN PROGRESS|DONE|BLOCKED) \|$/, `| ${status} |`) : l));
fs.writeFileSync(q, rows.join('
'));
const d = new Date();
const pad = (x) => String(x).padStart(2, '0');
const pushed = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
fs.appendFileSync('docs/v3/THEME_FACTORY_LEDGER.md', `| ${pack} | ${type} | ${status} | ${lint} | ${commit} | ${pushed.slice(0, 10)} | ${notes} | ${start ?? 'n/a'} | ${pushed.slice(11)} |
`);
