#!/usr/bin/env node
'use strict';
/**
 * Load the V3 plans seed (prisma/seed/v3-plans.seed.json) into the STAGING database. STAGING ONLY: the connection comes from the staging guard,
 * which refuses anything that is not the allow-listed staging project. A DRY RUN by default; nothing is written without --apply. Safe to run twice.
 *
 *   node scripts/seed-v3-plans.js            dry run: prints what would be created / updated
 *   node scripts/seed-v3-plans.js --apply    write it
 *
 * Needs `npx nest build` first (it uses the compiled seed loader). Prices are generated from the base rates and TERM discount rules in the file;
 * a price an admin has already APPROVED is never overwritten. Output never contains a connection string.
 */
const fs = require('fs');
const path = require('path');
const { loadStagingEnv } = require('./staging/guard');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const BACKEND = path.resolve(__dirname, '..');
const SEED = path.join(BACKEND, 'prisma/seed/v3-plans.seed.json');

(async () => {
  const env = loadStagingEnv();
  const dist = (p) => require(path.join(BACKEND, 'dist/src/plans', p));
  const { expandSeed, validateSeedFile } = dist('seed/seed-file');
  const { applySeed } = dist('seed/seed-applier');
  const { PrismaSeedStore } = dist('seed/prisma-seed-store');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));

  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  const errors = validateSeedFile(seed);
  if (errors.length) { console.error('The seed file is not valid:\n - ' + errors.join('\n - ')); process.exit(2); }

  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    const report = await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: APPLY });
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    for (const [entity, c] of Object.entries(report.byEntity)) console.log(`  ${entity.padEnd(14)} created ${c.created}  updated ${c.updated}  unchanged ${c.unchanged}`);
    console.log(`  total          created ${report.created}  updated ${report.updated}  unchanged ${report.unchanged}`);
    if (report.skippedApproved.length) console.log(`  kept (already APPROVED, not overwritten): ${report.skippedApproved.join(', ')}`);
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
