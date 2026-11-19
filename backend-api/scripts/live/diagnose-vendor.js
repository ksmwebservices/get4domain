#!/usr/bin/env node
'use strict';
/**
 * B6.3: READ-ONLY diagnosis of one vendor: track, plan, site row, publications, siteProvisionStatus and code, who owns the address, the duplicate-review hold, and the plans and terms
 * the plan chooser would offer. It writes nothing, sends nothing, and never prints a phone number or an e-mail address (the vendor is named by id). Dry by design: there is no apply flag,
 * so no typed LIVE confirmation is needed. It refuses any database that is not the live one (a staging, test or local database, or a placeholder), like the other live scripts.
 *
 *   node scripts/live/diagnose-vendor.js --email <address>      live (export .env.live first)
 *   node scripts/live/diagnose-vendor.js --id <vendor id>
 *   node scripts/live/diagnose-vendor.js --id <vendor id> --staging     the same against the staging database (for rehearsal)
 *
 * Needs `npm run build` first. Output never contains a connection string.
 */
const path = require('path');
const { liveSeedEnv } = require('./live-env-lib');
const { parseArgs, collect, render } = require('./diagnose-vendor-lib');

const BACKEND = path.resolve(__dirname, '..', '..');

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) { console.error(`DIAGNOSE REFUSED: ${args.problem}.`); process.exitCode = 2; return; }
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  let conn;
  if (args.staging) conn = require(path.join(__dirname, '..', 'staging', 'guard')).loadStagingEnv();
  else {
    const live = liveSeedEnv(process.env, dist('common/startup-check').checkDatabaseUrls);
    if (!live.ok) { console.error(`DIAGNOSE REFUSED: ${live.problems.join('; ')}.`); process.exitCode = 3; return; }
    conn = live;
  }
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  try {
    const { shapePlanOptions } = dist('plans/me/plan-options.core');
    const { selectTaxRate } = dist('plans/pricing/price-quote');
    const { DEFAULT_SITE_BASE } = dist('site-publish/publish/site-config');
    let categoryProbe = null;
    try {
      const { loadKit } = dist('site-publish/renderer/renderer-loader');
      const { categoryFor, categoryForTrack } = dist('site-publish/content/content-adapter');
      const kit = loadKit();
      categoryProbe = (industry, track) => {
        const doc = { vendor: { industry: industry || null }, cms: null };
        if (categoryFor(doc, kit, kit.categoryMap())) return 'own';
        return categoryForTrack(doc, kit, kit.categoryMap(), track) ? 'track-default' : 'none';
      };
    } catch { /* the kit is a nicety here: the line says it could not be checked */ }
    const facts = await collect(prisma, args, { shapePlanOptions, selectTaxRate, baseDomain: process.env.SITE_BASE_DOMAIN || DEFAULT_SITE_BASE, categoryProbe });
    if (!facts) { console.log('No vendor matches that e-mail or id.'); process.exitCode = 1; return; }
    console.log(`Vendor diagnosis, ${args.staging ? 'staging' : 'LIVE'}`);
    console.log(render(facts).join('\n'));
  } catch (e) {
    console.error('ERROR:', (conn.mask ? conn.mask(String(e.message)) : String(e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
