#!/usr/bin/env node
'use strict';
/**
 * Build the keyword RESEARCH list for Google Keyword Planner from the STAGING database. STAGING ONLY: the connection comes from the staging guard. It READS the directory and writes NOTHING to the
 * database; the only thing --apply writes is two local CSV files. A DRY RUN by default: it prints counts only.
 *
 *   node scripts/seo-keyword-research.js                      dry run: counts per kind
 *   node scripts/seo-keyword-research.js --apply [--out dir]  also write keyword-research.csv (keyword, page path, kind) and keyword-planner-upload.csv (one keyword per row)
 *
 * The keywords come from our own data only (category words and staff synonyms x city, locality and pincode; the research modifiers from the settings; service x city; business name x place),
 * and only for pages that exist and are not thin. Upload keyword-planner-upload.csv to Keyword Planner, export the result as CSV and import it with
 * POST /v3/admin/seo-directory/keyword-targets/import-volumes. Needs `npm run build` first. Output never contains a connection string.
 */
const fs = require('fs');
const path = require('path');
const { loadStagingEnv } = require('./staging/guard');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const BACKEND = path.resolve(__dirname, '..');
const outArg = args.indexOf('--out') >= 0 ? args[args.indexOf('--out') + 1] : null;
const OUT = path.resolve(outArg || path.join(BACKEND, 'seo-research-out'));

(async () => {
  const env = loadStagingEnv();
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    const { PrismaSeoDirectoryData } = dist('seo-directory/pages/seo-directory.data');
    const { PrismaDirectoryRepository } = dist('directory/prisma-directory.repository');
    const { DirectorySettingsService } = dist('directory/settings/directory-settings.service');
    const { PrismaSeoKeywordStore } = dist('seo-directory/keywords/seo-keyword.store');
    const { PrismaSeoKeywordTargetStore } = dist('seo-directory/keywords/seo-keyword-target.store');
    const { SeoSettingsService } = dist('seo-directory/settings/seo-settings.service');
    const { SeoSitemapService } = dist('seo-directory/sitemaps/seo-sitemap.service');
    const { SeoKeywordResearchService } = dist('seo-directory/keywords/seo-keyword-research.service');
    const audit = { record: async () => undefined };   // this script writes no database row, so there is nothing to audit
    const data = new PrismaSeoDirectoryData(prisma); const repo = new PrismaDirectoryRepository(prisma); const directory = new DirectorySettingsService(prisma);
    const keywords = new PrismaSeoKeywordStore(prisma); const seo = new SeoSettingsService(prisma, audit);
    const sitemaps = new SeoSitemapService(data, repo, keywords, directory, seo);
    const service = new SeoKeywordResearchService(data, repo, keywords, sitemaps, seo, directory, new PrismaSeoKeywordTargetStore(prisma), audit);
    const plan = await service.plan();
    console.log(APPLY ? 'FILES WRITTEN (nothing is written to the database).' : 'DRY RUN (counts only, nothing written). Add --apply to write the two CSV files.');
    for (const [kind, n] of Object.entries(plan.counts)) console.log(`  ${kind.padEnd(8)} ${n}`);
    console.log(`  total    ${plan.total}${plan.truncated ? '  (TRUNCATED at the cap)' : ''}`);
    if (APPLY) {
      const { researchToCsv, plannerCsv } = dist('seo-directory/core/keyword-research');
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, 'keyword-research.csv'), researchToCsv(plan.rows), 'utf8');
      fs.writeFileSync(path.join(OUT, 'keyword-planner-upload.csv'), plannerCsv(plan.rows), 'utf8');
      console.log(`  wrote ${path.join(OUT, 'keyword-research.csv')}\n  wrote ${path.join(OUT, 'keyword-planner-upload.csv')}`);
    }
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
