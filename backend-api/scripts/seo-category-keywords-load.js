#!/usr/bin/env node
'use strict';
/**
 * Load the keyword set of every category from the catalog sheet into the STAGING database. STAGING ONLY: the connection comes from the staging guard.
 * A DRY RUN by default; nothing is written without --apply. Idempotent. A row staff have edited (source STAFF) is never overwritten, synonyms are never written, nothing is deleted.
 *
 *   node scripts/seo-category-keywords-load.js [--csv <path>]            dry run: prints the counts
 *   node scripts/seo-category-keywords-load.js [--csv <path>] --apply    write it
 *
 * The sheet defaults to docs/v3/catalog/CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv, looked for in this checkout and then in ../get4domain-site (read only).
 * Needs `npm run build` first. Output never contains a connection string.
 */
const fs = require('fs');
const path = require('path');
const { loadStagingEnv } = require('./staging/guard');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const BACKEND = path.resolve(__dirname, '..');
const csvArg = args.indexOf('--csv') >= 0 ? args[args.indexOf('--csv') + 1] : null;
const SHEET = 'docs/v3/catalog/CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv';
const candidates = csvArg ? [path.resolve(csvArg)] : [path.resolve(BACKEND, '..', SHEET), path.resolve(BACKEND, '..', '..', 'get4domain-site', SHEET)];

(async () => {
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) { console.error('The catalog sheet was not found. Pass --csv <path>. Looked in:\n - ' + candidates.join('\n - ')); process.exit(2); }
  const env = loadStagingEnv();
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const { SeoKeywordService } = dist('seo-directory/keywords/seo-keyword.service');
  const { PrismaSeoKeywordStore } = dist('seo-directory/keywords/seo-keyword.store');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    const service = new SeoKeywordService(new PrismaSeoKeywordStore(prisma), { record: async () => undefined });
    const plan = await service.load(fs.readFileSync(file, 'utf8'), { apply: APPLY });
    console.log(APPLY && !plan.problems.length ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    console.log(`  sheet ${path.basename(file)}: ${plan.total} categories`);
    console.log(`  create ${plan.create.length}  update ${plan.update.length}  unchanged ${plan.unchanged}  kept (edited by staff) ${plan.keptStaff}`);
    console.log(`  with specialisations ${[...plan.create, ...plan.update].filter((s) => s.specialisations.length).length} of the ${plan.create.length + plan.update.length} to write; synonyms are left empty for staff`);
    if (plan.problems.length) { console.log('  PROBLEMS (nothing is written while there are any):\n   - ' + plan.problems.join('\n   - ')); process.exitCode = 2; }
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
