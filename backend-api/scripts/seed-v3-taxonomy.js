#!/usr/bin/env node
'use strict';
/**
 * Lane E1: load the 45-family taxonomy (families, categories, family-category links, the related-families map) and map the existing registration categories into it.
 * Data: backend-api/data/category-master-45.json (+ -aliases.json, -related.json). A DRY RUN by default; nothing is written without --apply.
 * IDEMPOTENT: a row that exists is never changed (one that differs from the file is only named). Nothing is ever deleted; the existing categories (g4d_pack_categories) are only read.
 *
 *   node scripts/seed-v3-taxonomy.js --offline   dry run against an EMPTY taxonomy: counts what a first load creates. The existing categories come from the pack engine sheet. No database needed.
 *   node scripts/seed-v3-taxonomy.js             dry run against STAGING (the staging guard refuses anything else)
 *   node scripts/seed-v3-taxonomy.js --apply     write the missing rows to STAGING after you type STAGING in a terminal
 *   node scripts/live/seed-live.js seed-v3-taxonomy.js [--apply]   the same against LIVE (that runner asks you to type LIVE)
 *
 * Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');
const readline = require('readline');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const OFFLINE = args.includes('--offline');
const BACKEND = path.resolve(__dirname, '..');
const ask = (q) => new Promise((resolve) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); resolve(a); }); });
const line = (name, r) => console.log(`  ${name.padEnd(22)} total ${String(r.total).padStart(5)}   to create ${String(r.toCreate).padStart(5)}   already there ${String(r.existing).padStart(5)}${APPLY ? `   created ${r.created}` : ''}`);

(async () => {
  if (OFFLINE && APPLY) { console.error('ERROR: --offline never writes; use --apply on its own for staging.'); process.exitCode = 1; return; }
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const { loadTaxonomy, MemoryTaxonomyStore } = dist('v3-taxonomy/taxonomy-loader');
  const { readTaxonomyFiles } = dist('v3-taxonomy/taxonomy-files');
  const files = readTaxonomyFiles();
  let prisma = null;
  let store;
  if (OFFLINE) {
    const { buildSeed } = dist('v3-packs/seed/pack-seed');
    const { readSeedSources } = dist('v3-packs/seed/seed-files');
    store = new MemoryTaxonomyStore(buildSeed(readSeedSources()).categories.map((c) => ({ categoryKey: c.categoryKey, name: c.name })));
  } else {
    const { loadStagingEnv } = require('./staging/guard');
    const env = loadStagingEnv();
    if (APPLY) {
      if (process.env.G4D_SEED_CONFIRMED !== '1') {   // seed-live.js has already asked for LIVE
        if (!process.stdin.isTTY) { console.error('ERROR: --apply needs a terminal, so a person types the confirmation.'); process.exitCode = 1; return; }
        if ((await ask('This WRITES the taxonomy to STAGING. Type STAGING to continue: ')).trim() !== 'STAGING') { console.error('not confirmed; nothing was written.'); process.exitCode = 1; return; }
      }
    }
    const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
    prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
    const { PrismaTaxonomyStore } = dist('v3-taxonomy/prisma-taxonomy.store');
    store = new PrismaTaxonomyStore(prisma);
  }
  try {
    const r = await loadTaxonomy(store, files, { apply: APPLY });
    console.log(OFFLINE ? 'DRY RUN, OFFLINE (empty taxonomy assumed, nothing read or written).' : APPLY ? (r.refused ? 'REFUSED: fix the problems below, nothing was written.' : 'APPLIED.') : 'DRY RUN (nothing written). Add --apply to write.');
    line('families', r.families); line('categories', r.categories); line('family-category links', r.links); line('related-family pairs', r.related); line('existing categories mapped', r.legacy);
    console.log(`  existing categories: ${r.legacyTotal}   mapped by exact name: ${r.legacyExact}   by reviewed alias: ${r.legacyAlias}   unmatched: ${r.unmatched.length}   (already mapped before this run: ${r.legacyAlreadyMapped})`);
    console.log(`  problems in the data files: ${r.problems.length}`);
    for (const p of r.problems.slice(0, 40)) console.log(`    - ${p}`);
    if (r.differs.length) console.log(`  rows that differ from the file (left as they are): ${r.differs.slice(0, 10).join(', ')}${r.differs.length > 10 ? ' ...' : ''}`);
    if (r.unmatched.length) {
      console.log(`  UNMATCHED existing categories (owner decides; none is changed or deleted): ${r.unmatched.length}`);
      for (const u of r.unmatched) console.log(`    ${u.categoryKey}  |  ${u.name}`);
    }
    if (r.needsOwnerReview.aliasTable) console.log('  NEEDS OWNER REVIEW: data/category-master-45-aliases.json');
    if (r.needsOwnerReview.relatedMap) console.log('  NEEDS OWNER REVIEW: data/category-master-45-related.json');
    if (r.refused) process.exitCode = 1;
  } catch (e) {
    console.error('ERROR:', String(e.message).split('\n').slice(-2).join(' | ').replace(/postgres(ql)?:\/\/\S+/gi, '[hidden]'));
    process.exitCode = 1;
  } finally { if (prisma) await prisma.$disconnect(); }
})();
