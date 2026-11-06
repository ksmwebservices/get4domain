#!/usr/bin/env node
'use strict';
/**
 * Load the ten alert rules of the owner's alert table into the STAGING database (slice 5.20). Every rule is created DISABLED with NO numbers: staff set the numbers and switch each rule on in the
 * staff screen. A rule that already exists is never touched. STAGING ONLY (the staging guard refuses anything else). A DRY RUN by default; nothing is written without --apply. Safe to run twice.
 *
 *   node scripts/seed-v3-alert-rules.js            dry run: prints what would be created
 *   node scripts/seed-v3-alert-rules.js --apply    write the missing rules
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
  const { loadAlertRules, ALERT_RULES_SOURCE } = dist('v3-activity/seed/alert-rules-seed');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));

  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  const port = {
    existing: async () => (await prisma.v3AlertRule.findMany({ select: { key: true } })).map((r) => r.key),
    create: async (rows) => {
      await prisma.v3AlertRule.createMany({ data: rows.map((r) => ({ key: r.key, level: r.level, notifyRoles: r.notifyRoles, enabled: false })), skipDuplicates: true });
      return rows.map((r) => r.key);
    },
  };
  try {
    const r = await loadAlertRules(port, { apply: APPLY });
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    console.log(`  source: ${ALERT_RULES_SOURCE}`);
    console.log(APPLY ? '  created (disabled, no numbers):' : '  would create (disabled, no numbers):', (APPLY ? r.created : r.toCreate).join(', ') || '(none)');
    console.log('  already there (left as staff set them):', r.alreadyThere.join(', ') || '(none)');
    console.log('  NOT set, on purpose (staff set them, then enable): CAMPAIGN_SPIKE numbers, PAYMENT_FAILURES count, LARGE_IMPORT rows, and the on switch of every rule.');
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
