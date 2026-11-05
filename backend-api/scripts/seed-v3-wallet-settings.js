#!/usr/bin/env node
'use strict';
/**
 * Load the owner's wallet setting into the STAGING database (5 November 2026): the refill minimum, walletTopupMinPaise = 99900 (Rs 999, excluding GST). ONE value. The refill maximum, Get4Domain's
 * GST state code, the revision limit, auto-approval days, plan allowances, pack validity and the term discount percentages stay unset: the wallet and the services refuse to run until staff set them.
 * STAGING ONLY (the staging guard refuses anything else). A DRY RUN by default; nothing is written without --apply. Safe to run twice; a value staff already set is never overwritten.
 *
 *   node scripts/seed-v3-wallet-settings.js            dry run: prints what would be set
 *   node scripts/seed-v3-wallet-settings.js --apply    write it (with an audit row)
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
  const { loadWalletSettings, OWNER_WALLET_SETTINGS, OWNER_WALLET_SETTINGS_SOURCE } = dist('v3-wallet/settings/wallet-settings-seed');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));

  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  const port = {
    existing: async (keys) => (await prisma.v3PlanSetting.findMany({ where: { key: { in: keys } }, select: { key: true } })).map((r) => r.key),
    // the row and its audit row commit together, exactly as the staff API does it (entity 'plan_setting', action 'setting.create'); an existing row is never touched
    create: async (rows) => {
      await prisma.$transaction(async (tx) => {
        for (const r of rows) {
          const made = await tx.v3PlanSetting.createMany({ data: [{ key: r.key, valueJson: r.value, description: r.description }], skipDuplicates: true });
          if (made.count === 1) await tx.v3AuditLog.create({ data: { actorType: 'SYSTEM', actorId: null, action: 'setting.create', entityType: 'plan_setting', entityId: r.key, afterJson: { key: r.key, value: r.value, source: OWNER_WALLET_SETTINGS_SOURCE }, ip: null } });
        }
      });
    },
  };
  try {
    const r = await loadWalletSettings(port, { apply: APPLY });
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    console.log(`  source: ${OWNER_WALLET_SETTINGS_SOURCE}`);
    console.log(APPLY ? '  created:' : '  would set:', (APPLY ? r.created : r.toSet).map((k) => `${k} = ${OWNER_WALLET_SETTINGS[k]}`).join(', ') || '(none)');
    console.log('  already set (left as staff set them):', r.alreadySet.join(', ') || '(none)');
    console.log('  NOT set, on purpose (staff set them before the feature turns on): walletTopupMaxPaise, walletSellerStateCode, serviceMaxRevisions, serviceAutoApproveAfterDays, plan allowances, pack validity, term discount percentages');
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
