#!/usr/bin/env node
'use strict';
/**
 * Create the directory category rows for ALL the catalogue categories (the 196 of CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv), so staff can make a seeded listing in any of them (Wave 2 job K1).
 * STAGING ONLY: the connection comes from the staging guard, which refuses anything that is not the allow-listed staging project.
 * A DRY RUN by default; nothing is written without --apply. Safe to run twice. It only CREATES: a category that already has a row (the 41 the theme kit seed made, or one staff edited) is never touched,
 * and nothing is ever deleted. Every row it creates is marked proposed, so the owner can review the new families and categories in the admin.
 *
 *   node scripts/seed-v3-catalogue-categories.js --offline   dry run against an EMPTY tree: counts what a first load creates. No database, no environment needed.
 *   node scripts/seed-v3-catalogue-categories.js             dry run against STAGING
 *   node scripts/seed-v3-catalogue-categories.js --apply     write the missing rows to STAGING
 *
 * Run scripts/seed-v3-directory.js (the 41 kit categories) first. Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const OFFLINE = args.includes('--offline');
const BACKEND = path.resolve(__dirname, '..');

(async () => {
  if (OFFLINE && APPLY) { console.error('ERROR: --offline never writes; use --apply on its own for staging.'); process.exitCode = 1; return; }
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const { CATALOGUE_CATEGORIES } = dist('directory/core/catalogue-categories');
  const { loadCatalogueCategories } = dist('directory/seed/catalogue-category-loader');
  const { loadKit } = dist('site-publish/renderer/renderer-loader');
  const kitIds = loadKit().CATEGORIES.map((c) => c.id);
  let prisma = null; let store; let env = null;
  if (OFFLINE) store = { listCategories: async () => [], createCategory: async () => { throw new Error('offline never writes'); } };
  else {
    env = require('./staging/guard').loadStagingEnv();
    const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
    prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
    const { PrismaCatalogueCategoryStore } = dist('directory/seed/prisma-catalogue-category-store');
    store = new PrismaCatalogueCategoryStore(prisma);
  }
  try {
    const r = await loadCatalogueCategories(store, CATALOGUE_CATEGORIES, { apply: APPLY, kitIds });
    console.log(OFFLINE ? 'DRY RUN, OFFLINE (an empty tree is assumed, nothing read or written).' : APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    console.log(`  families    total ${String(r.families.total).padStart(4)}   created ${String(r.families.created).padStart(4)}   already there ${String(r.families.existing).padStart(4)}`);
    console.log(`  categories  total ${String(r.categories.total).padStart(4)}   created ${String(r.categories.created).padStart(4)}   already there ${String(r.categories.existing).padStart(4)}`);
    if (r.createdKeys.length) console.log(`  ${APPLY ? 'created' : 'to create'}: ${r.createdKeys.slice(0, 12).join(', ')}${r.createdKeys.length > 12 ? `, and ${r.createdKeys.length - 12} more` : ''}`);
  } catch (e) {
    console.error('ERROR:', (env ? env.mask(String(e.message)) : String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { if (prisma) await prisma.$disconnect(); }
})();
