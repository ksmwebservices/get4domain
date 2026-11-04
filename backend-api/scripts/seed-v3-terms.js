#!/usr/bin/env node
'use strict';
/**
 * Load one DRAFT row per terms document kind into the STAGING database (slice 5.15). The body is "To be supplied by counsel"; nothing here can publish a document, and the API refuses
 * to publish a document whose text is still that placeholder. STAGING ONLY (the staging guard refuses anything else). A DRY RUN by default; nothing is written without --apply.
 * Safe to run twice: a kind that already has any row is left exactly as it is. Nothing is ever deleted or changed.
 *
 *   node scripts/seed-v3-terms.js            dry run: prints which kinds would be created
 *   node scripts/seed-v3-terms.js --apply    write them
 *
 * Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');
const { loadStagingEnv } = require('./staging/guard');

const APPLY = process.argv.slice(2).includes('--apply');
const BACKEND = path.resolve(__dirname, '..');

(async () => {
  const env = loadStagingEnv();
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const { seedTermsDrafts } = dist('terms/seed/terms-seed');
  const { PrismaTermsStore } = dist('terms/prisma-terms.store');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));

  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    // the loader never audits or queues: it only creates missing DRAFT rows, so the audit service is not needed
    const report = await seedTermsDrafts(new PrismaTermsStore(prisma, null), { apply: APPLY });
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    console.log('  already present:', report.existing.join(', ') || '(none)');
    console.log(APPLY ? '  created (DRAFT, placeholder body):' : '  would create (DRAFT, placeholder body):', (APPLY ? report.created : report.missing).join(', ') || '(none)');
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
