#!/usr/bin/env node
'use strict';
/**
 * Load the service catalogue into the STAGING database (slice 5.16b, extended 5 November 2026): the services in plain words, the owner's decided prices (source OWNER_DECISION_2026_11_05,
 * whole paise excluding GST, status PROPOSED with no date: this loader never approves a price, a SUPER_ADMIN does with an effective date) and the plan-allowance features with no values.
 * STAGING ONLY (the staging guard refuses anything else). A DRY RUN by default; nothing is written without --apply.
 * Safe to run twice: a service, price or feature that already exists is left exactly as it is. Nothing is ever deleted or changed.
 *
 *   node scripts/seed-v3-services.js            dry run: prints what would be created
 *   node scripts/seed-v3-services.js --apply    write it
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
  const { seedServices, OWNER_PRICE_SOURCE } = dist('v3-services/seed/services-seed');
  const { PrismaServicesStore } = dist('v3-services/prisma-services.store');
  const { AuditService } = dist('plans/admin/audit.service');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));

  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  const features = {
    existingKeys: async (keys) => (await prisma.v3Feature.findMany({ where: { key: { in: keys } }, select: { key: true } })).map((f) => f.key),
    create: async (rows) => { await prisma.v3Feature.createMany({ data: rows, skipDuplicates: true }); },
  };
  try {
    // the loader only writes through store.unit (catalogue) and the feature rows above; the wallet store is not needed here
    const store = new PrismaServicesStore(prisma, new AuditService(prisma), null);
    const r = await seedServices(store, features, { apply: APPLY });
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    console.log('  services already present:', r.existingServices.join(', ') || '(none)');
    console.log(APPLY ? '  services created:' : '  services that would be created:', (APPLY ? r.createdServices : r.missingServices).join(', ') || '(none)');
    const rows = APPLY ? r.priceRowsWritten : r.pricesToWrite;
    console.log(APPLY ? `  owner price rows written (source ${OWNER_PRICE_SOURCE}, paise, excluding GST, PROPOSED, NOT approved: a SUPER_ADMIN approves each with an effective date):` : `  owner price rows that would be proposed (source ${OWNER_PRICE_SOURCE}, paise, excluding GST; a service that already has a price row is skipped):`);
    for (const o of rows) console.log(`    ${o.serviceKey}: ${o.amountPaise}`);
    if (!rows.length) console.log('    (none: every priced service already has a price row, left as it is)');
    console.log('  plan-allowance features already present:', r.existingFeatures.join(', ') || '(none)');
    console.log(APPLY ? '  plan-allowance features created (no plan has a value; staff set them):' : '  plan-allowance features that would be created (no plan has a value):', (APPLY ? r.createdFeatures : r.missingFeatures).join(', ') || '(none)');
    console.log('  price rows written with status APPROVED: 0 (this loader never approves a price)');
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
