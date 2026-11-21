#!/usr/bin/env node
'use strict';
/**
 * Load the three mail lanes and the PROPOSED mailbox prices (Amendment 12 Q3 and Q4) into the STAGING database. The prices are loaded as PENDING: they become usable only when SUPER_ADMIN confirms
 * the real cost. Sending is off on every lane. STAGING ONLY (the staging guard refuses anything else). A DRY RUN by default; nothing is written without --apply. Safe to run twice: a row that exists is never touched.
 *
 *   node scripts/seed-v3-mail-rules.js            dry run: prints what would be created
 *   node scripts/seed-v3-mail-rules.js --apply    write it
 *
 * Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');
const { loadStagingEnv } = require('./staging/guard');

const APPLY = process.argv.slice(2).includes('--apply');
const BACKEND = path.resolve(__dirname, '..');

(async () => {
  const env = loadStagingEnv();
  const { MailRulesService } = require(path.join(BACKEND, 'dist/src/v3-mail/mail-rules/mail-rules.service'));
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    const r = await new MailRulesService(prisma, null).loadSeed(APPLY);
    console.log(APPLY ? 'APPLIED to staging.' : 'DRY RUN (nothing written). Add --apply to write.');
    console.log(APPLY ? '  created lanes:' : '  would create lanes:', r.lanes.join(', ') || '(none, all exist)');
    console.log(APPLY ? '  created prices (PENDING):' : '  would create prices (PENDING):', r.prices.join(', ') || '(none, all exist)');
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
