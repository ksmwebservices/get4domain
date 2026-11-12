#!/usr/bin/env node
'use strict';
/**
 * Prints the Batch 13 routes as a Markdown table, read from the controllers' decorators (method, path, @ApiOperation summary, plan feature). Used to write docs/v3/V3_API_DOCUMENTATION.md so the table
 * cannot drift from the code. Read only: it opens source files and prints.
 *   node scripts/b13-route-table.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../src');
const FILES = ['v3-customers/api/customers.controllers.ts', 'v3-accounts/api/accounts.controllers.ts', 'v3-jobs/api/jobs.controllers.ts', 'v3-appointments/api/appointments.controllers.ts', 'v3-store/api/store.controllers.ts'];

const rows = [];
for (const f of FILES) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8');
  const parts = text.split(/(?=^@ApiTags)/m).slice(1);
  for (const block of parts) {
    const feature = (block.match(/@RequiresFeature\('([^']+)'\)/) || [])[1] || '';
    const base = (block.match(/@Controller\('([^']+)'\)/) || [])[1] || '';
    for (const m of block.matchAll(/@(Get|Post|Put|Delete)\(([^)]*)\)[^\n]*?@ApiOperation\(\{ summary: '((?:[^'\\]|\\.)*)' \}\)/g)) {
      const sub = (m[2].match(/'([^']*)'/) || [])[1] || '';
      rows.push({ method: m[1].toUpperCase(), route: `/${base}${sub ? `/${sub}` : ''}`, summary: m[3].replace(/\\'/g, "'"), feature });
    }
  }
}
console.log('| Route | What it does | Plan feature |\n|---|---|---|');
for (const r of rows) console.log(`| \`${r.method} ${r.route}\` | ${r.summary} | \`${r.feature}\` |`);
console.error(`${rows.length} routes`);
