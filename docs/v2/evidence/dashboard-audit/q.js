// READ-ONLY query runner for the audit. Refuses anything that is not a single SELECT/WITH statement.
// Usage: node q.js "<sql>" [more sql...]   (prints rows as compact JSON; bigint-safe)
const fs = require('fs');
for (const l of fs.readFileSync('C:/Get4Domain/get4domain-site/backend-api/.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const { PrismaClient } = require('C:/Get4Domain/get4domain-site/backend-api/node_modules/@prisma/client');
(async () => {
  const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
  for (const sql of process.argv.slice(2)) {
    const t = sql.trim().replace(/;+\s*$/, '');
    if (!/^(select|with)\b/i.test(t) || /;/.test(t) || /\b(insert|update|delete|drop|alter|create|truncate|grant|copy|call|do)\b/i.test(t.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""'))) {
      console.log('REFUSED (not a plain SELECT):', t.slice(0, 80)); continue;
    }
    try {
      const rows = await p.$queryRawUnsafe(t);
      console.log('> ' + t.replace(/\s+/g, ' ').slice(0, 160));
      console.log(JSON.stringify(rows, (k, v) => (typeof v === 'bigint' ? Number(v) : v)));
    } catch (e) { console.log('> ' + t.slice(0, 100)); console.log('ERR', String(e.message).split('\n').filter(Boolean).pop().slice(0, 200)); }
  }
  await p.$disconnect();
})();
