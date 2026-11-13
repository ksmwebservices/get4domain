#!/usr/bin/env node
'use strict';
/**
 * Load the owner's pay-link setting into the STAGING database (Amendment 09 W4, 11 November 2026): payLinkExpiryHours = 48. ONE value. Staff can change it afterwards in admin settings.
 * STAGING ONLY (the staging guard refuses anything else). A DRY RUN by default; nothing is written without --apply. Safe to run twice; a value staff already set is never overwritten.
 *
 *   node scripts/seed-v3-pay-settings.js            dry run: prints what would be set
 *   node scripts/seed-v3-pay-settings.js --apply    write it (with an audit row)
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
  const { loadPaySettings, OWNER_PAY_SETTINGS, OWNER_PAY_SETTINGS_SOURCE } = dist('v3-payments/settings/pay-settings-seed');
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));

  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  const port = {
    existing: async (keys) => (await prisma.v3PlanSetting.findMany({ where: { key: { in: keys } }, select: { key: true } })).map((r) => r.key),
    // the row and its audit row commit together, exactly as the staff API does it (entity 'plan_setting', action 'setting.create'); an existing row is never touched
    create: async (rows) => {
      await prisma.$transaction(async (tx) => {
        for (const r of rows) {
          const made = await tx.v3PlanSetting.createMany({ data: [{ key: r.key, valueJson: r.value, description: r.description }], skipDuplicates: true });
          if (made.count === 1) await tx.v3AuditLog.create({ data: { actorType: 'SYSTEM', actorId: null, action: 'setting.create', entityType: 'plan_setting', entityId: r.key, afterJson: { key: r.key, value: r.value, source: OWNER_PAY_SETTINGS_SOURCE }, ip: null } });
        }
      });
    },
  };
  try {
    const r = await loadPaySettings(port, { apply: APPLY });
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    console.log(`  source: ${OWNER_PAY_SETTINGS_SOURCE}`);
    console.log(APPLY ? '  created:' : '  would set:', (APPLY ? r.created : r.toSet).map((k) => `${k} = ${OWNER_PAY_SETTINGS[k]}`).join(', ') || '(none)');
    console.log('  already set (left as staff set them):', r.alreadySet.join(', ') || '(none)');
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
