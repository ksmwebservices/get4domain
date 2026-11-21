#!/usr/bin/env node
'use strict';
/**
 * Load the starting field set of every pack record tab (Wave 2 Part A). The tabs come from the pack engine seed files (prisma/seed/pack-engine), so the two never drift.
 * A DRY RUN by default; nothing is written without --apply. Safe to run twice: a field that exists is never touched (a staff edit is never overwritten) and nothing is deleted.
 * An apply is refused while the seed has a problem.
 *
 *   node scripts/seed-v3-pack-tab-fields.js --offline   dry run against an EMPTY database: counts what a first load creates. No database, no environment needed.
 *   node scripts/seed-v3-pack-tab-fields.js             dry run against STAGING (the staging guard refuses anything else)
 *   node scripts/seed-v3-pack-tab-fields.js --apply     write the missing rows to STAGING
 *
 * Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const OFFLINE = args.includes('--offline');
const BACKEND = path.resolve(__dirname, '..');

(async () => {
  if (OFFLINE && APPLY) { console.error('ERROR: --offline never writes; use --apply on its own for staging.'); process.exitCode = 1; return; }
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const { buildSeed } = dist('v3-packs/seed/pack-seed');
  const { readSeedSources } = dist('v3-packs/seed/seed-files');
  const { loadTabFields, emptyFieldStoreForDryRun } = dist('v3-pack-records/seed/tab-field-loader');
  const tabs = buildSeed(readSeedSources()).tabs;
  let prisma = null;
  let store;
  if (OFFLINE) store = emptyFieldStoreForDryRun();
  else {
    const { loadStagingEnv } = require('./staging/guard');
    const env = loadStagingEnv();
    const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
    prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
    const { PrismaPackTabFieldStore } = dist('v3-pack-records/prisma-pack-records.store');
    store = new PrismaPackTabFieldStore(prisma);
  }
  try {
    const r = await loadTabFields(store, tabs, { apply: APPLY });
    console.log(OFFLINE ? 'DRY RUN, OFFLINE (empty database assumed, nothing read or written).' : APPLY ? (r.refused ? 'REFUSED: fix the problems below, nothing was written.' : 'APPLIED to staging.') : 'DRY RUN against staging (nothing written).');
    console.log(`  tabs with a record store ${r.tabs}   fields ${r.total}   to create ${r.toCreate}   already there ${r.existing}`);
    console.log(`  problems: ${r.problems.length}`);
    for (const p of r.problems.slice(0, 40)) console.log(`    - ${p}`);
    if (r.refused) process.exitCode = 1;
  } catch (e) {
    console.error('ERROR:', String(e.message).split('\n').slice(-2).join(' | ').replace(/postgres(ql)?:\/\/\S+/gi, '[hidden]'));
    process.exitCode = 1;
  } finally { if (prisma) await prisma.$disconnect(); }
})();
