#!/usr/bin/env node
'use strict';
/**
 * One-time edit (slice 5.25): adds the entitlement features industry.<module> (HIDDEN on every plan) to prisma/seed/v3-plans.seed.json, after the store.manage line, in the file's own one-line style.
 * Idempotent: a second run changes nothing. It edits text only; the seed loader (dry run by default) is what puts the rows on staging.
 */
const fs = require('fs');
const path = require('path');

const MODULES = ['agriculture', 'automobile', 'clinic', 'coaching', 'construction', 'diagnostics', 'education', 'events', 'finance', 'gym', 'hotel', 'logistics', 'photography', 'professional', 'realestate', 'restaurant', 'retail', 'salon', 'stationery', 'technology', 'travel'];
const file = path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json');
let text = fs.readFileSync(file, 'utf8');
if (text.includes('"industry.agriculture"')) { console.log('already added'); process.exit(0); }
const nl = text.includes('\r\n') ? '\r\n' : '\n';
const anchor = text.split(/\r?\n/).find((l) => l.includes('"key": "store.manage"'));
if (!anchor) { console.error('anchor line not found'); process.exit(1); }
const lines = MODULES.map((m) => `    { "key": "industry.${m}", "name": "Version 2 ${m} module", "group": "Retired modules", "kind": "BOOLEAN", "description": "A module of the earlier product, hidden for every plan. Staff can switch it back on for one business with an override.", "free": { "state": "HIDDEN" }, "pro": { "state": "HIDDEN" } }`);
const replacement = `${anchor.replace(/\s+$/, '')},${nl}${lines.join(`,${nl}`)}`;
if (anchor.trimEnd().endsWith(',')) { console.error('store.manage is not the last feature; edit by hand'); process.exit(1); }
text = text.replace(anchor, replacement);
JSON.parse(text);
fs.writeFileSync(file, text);
console.log(`added ${MODULES.length} features`);
