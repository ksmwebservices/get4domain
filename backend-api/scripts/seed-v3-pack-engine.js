#!/usr/bin/env node
'use strict';
/**
 * Load the pack engine data (Amendment 13 Part A, A2): the 16 packs and their tabs, the capabilities, the tier to capability matrix (the PROPOSED rules), the add-on packs (prices PENDING),
 * and the 196-category master (CATEGORY_MASTER_V3). The sheets and the settings file are in prisma/seed/pack-engine.
 * A DRY RUN by default; nothing is written without --apply. Safe to run twice: a row that exists is never touched (an edit made by staff is never overwritten), a row that differs from the sheet is
 * only named. Nothing is ever deleted. An apply is refused while the sheets have a problem.
 *
 *   node scripts/seed-v3-pack-engine.js --offline   dry run against an EMPTY database: counts what a first load creates. No database, no environment needed.
 *   node scripts/seed-v3-pack-engine.js             dry run against STAGING (the staging guard refuses anything else)
 *   node scripts/seed-v3-pack-engine.js --apply     write the missing rows to STAGING
 *
 * Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const OFFLINE = args.includes('--offline');
const BACKEND = path.resolve(__dirname, '..');

const line = (name, r) => console.log(`  ${name.padEnd(13)} total ${String(r.total).padStart(4)}   to create ${String(r.toCreate).padStart(4)}   already there ${String(r.existing).padStart(4)}   differ from sheet ${String(r.differs.length).padStart(3)}${APPLY ? `   created ${r.created}` : ''}`);

(async () => {
  if (OFFLINE && APPLY) { console.error('ERROR: --offline never writes; use --apply on its own for staging.'); process.exitCode = 1; return; }
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const { buildSeed, loadPackEngine, emptyStoreForDryRun } = dist('v3-packs/seed/pack-seed');
  const { readSeedSources } = dist('v3-packs/seed/seed-files');
  const seed = buildSeed(readSeedSources());
  let prisma = null;
  let store;
  if (OFFLINE) store = emptyStoreForDryRun();
  else {
    const { loadStagingEnv } = require('./staging/guard');
    const env = loadStagingEnv();
    const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
    prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
    const { PrismaPackReferenceStore } = dist('v3-packs/prisma-pack-engine.store');
    store = new PrismaPackReferenceStore(prisma);
  }
  try {
    const r = await loadPackEngine(store, seed, { apply: APPLY });
    console.log(OFFLINE ? 'DRY RUN, OFFLINE (empty database assumed, nothing read or written).' : APPLY ? (r.refused ? 'REFUSED: fix the problems below, nothing was written.' : 'APPLIED to staging.') : 'DRY RUN (nothing written). Add --apply to write.');
    line('capabilities', r.capabilities); line('matrix cells', r.matrix); line('packs', r.packs); line('tabs', r.tabs); line('add-on packs', r.addons); line('categories', r.categories);
    console.log(`  categories needing a blueprint wave (no starter services yet): ${r.needsBlueprint}`);
    console.log(`  words rewritten by the copy rule ("leads" to "enquiries"): ${r.rewrites}`);
    console.log(`  problems in the sheets: ${r.problems.length}`);
    for (const p of r.problems.slice(0, 40)) console.log(`    - ${p}`);
    for (const k of ['capabilities', 'matrix', 'packs', 'tabs', 'addons', 'categories']) if (r[k].differs.length) console.log(`  ${k} that differ from the sheet (left as they are): ${r[k].differs.slice(0, 10).join(', ')}${r[k].differs.length > 10 ? ' ...' : ''}`);
    if (r.refused) process.exitCode = 1;
  } catch (e) {
    console.error('ERROR:', String(e.message).split('\n').slice(-2).join(' | ').replace(/postgres(ql)?:\/\/\S+/gi, '[hidden]'));
    process.exitCode = 1;
  } finally { if (prisma) await prisma.$disconnect(); }
})();
