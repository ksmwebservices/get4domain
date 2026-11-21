#!/usr/bin/env node
'use strict';
/**
 * READ-ONLY check of the SEO settings on STAGING: is directoryPagesIndexable OFF (as it must be until counsel approves), and are the templates, crawler list and modifiers as they were. STAGING ONLY:
 * the connection comes from the staging guard. It only SELECTs from g4d_plan_settings; it never writes, and it prints no connection string.
 *
 *   node scripts/seo-staging-check.js
 *
 * Exit code 0 = directoryPagesIndexable is OFF (stored false, or never stored: the default is OFF). Exit code 1 = it is ON, or the check could not run.
 * A setting that was never stored is reported as "default" (the code's default applies); "stored" means a row exists.
 */
const path = require('path');
const { loadStagingEnv } = require('./staging/guard');

const KEYS = ['directoryPagesIndexable', 'directoryThinPageMinBusinesses', 'seoPageTemplates', 'seoCrawlerAgents', 'seoKeywordModifiers'];

(async () => {
  const env = loadStagingEnv();
  const { PrismaClient } = require(path.resolve(__dirname, '..', 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
  try {
    const rows = await prisma.v3PlanSetting.findMany({ where: { key: { in: KEYS } }, select: { key: true, valueJson: true, updatedAt: true } });
    const by = new Map(rows.map((r) => [r.key, r]));
    const idx = by.get('directoryPagesIndexable');
    const on = idx ? idx.valueJson === true : false;
    console.log(`directoryPagesIndexable: ${on ? 'ON  <-- must be OFF until counsel approves' : 'OFF'} (${idx ? `stored ${JSON.stringify(idx.valueJson)}, updated ${idx.updatedAt.toISOString()}` : 'default, never stored'})`);
    const thin = by.get('directoryThinPageMinBusinesses');
    console.log(`directoryThinPageMinBusinesses: ${thin ? `stored ${JSON.stringify(thin.valueJson)}` : 'default (3)'}`);
    for (const k of ['seoPageTemplates', 'seoCrawlerAgents', 'seoKeywordModifiers']) {
      const r = by.get(k);
      console.log(`${k}: ${r ? `stored (${Array.isArray(r.valueJson) ? `${r.valueJson.length} entries` : `${Object.keys(r.valueJson || {}).length} keys`}), updated ${r.updatedAt.toISOString()}` : 'default (never stored)'}`);
    }
    process.exitCode = on ? 1 : 0;
  } catch (e) {
    console.error('ERROR:', env.mask(String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
