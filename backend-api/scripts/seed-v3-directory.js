#!/usr/bin/env node
'use strict';
/**
 * Load the PROPOSED public-directory seed (prisma/seed/v3-directory.seed.json: Tamil Nadu, its districts, a few major cities, and the theme kit's 12 families and 41 categories)
 * into the STAGING database. STAGING ONLY: the connection comes from the staging guard, which refuses anything that is not the allow-listed staging project.
 * A DRY RUN by default; nothing is written without --apply. Safe to run twice. A row the owner has reviewed (proposed = false) is never overwritten, and nothing is ever deleted.
 *
 *   node scripts/seed-v3-directory.js            dry run: prints what would be created / updated
 *   node scripts/seed-v3-directory.js --apply    write it
 *
 * Needs `npm run build` first (it uses the compiled loader and the built theme kit renderer). Output never contains a connection string.
 */
const fs = require('fs');
const path = require('path');
const { loadStagingEnv } = require('./staging/guard');

const APPLY = process.argv.slice(2).includes('--apply');
const BACKEND = path.resolve(__dirname, '..');
const SEED = path.join(BACKEND, 'prisma/seed/v3-directory.seed.json');

(async () => {
  const env = loadStagingEnv();
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const { validateDirectorySeed } = dist('directory/seed/seed-file');
  const { applyDirectorySeed } = dist('directory/seed/seed-applier');
  const { PrismaDirectorySeedStore } = dist('directory/seed/prisma-seed-store');
  const { loadKit } = dist('site-publish/renderer/renderer-loader');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));

  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  const errors = validateDirectorySeed(seed, loadKit().CATEGORIES.map((c) => c.id));
  if (errors.length) { console.error('The seed file is not valid:\n - ' + errors.join('\n - ')); process.exit(2); }

  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    const report = await applyDirectorySeed(new PrismaDirectorySeedStore(prisma), seed, { apply: APPLY });
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    for (const [entity, c] of Object.entries(report)) console.log(`  ${entity.padEnd(11)} created ${c.created}  updated ${c.updated}  unchanged ${c.unchanged}  kept (reviewed) ${c.keptReviewed}`);
    if (seed.missing && seed.missing.length) console.log('  left out by the author (see the "missing" list in the seed file):\n   - ' + seed.missing.join('\n   - '));
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
