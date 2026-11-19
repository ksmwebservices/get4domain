#!/usr/bin/env node
'use strict';
/**
 * B6.4: re-runs the trial-site build for ONE named vendor whose site is recorded as failed. It calls the same service the vendor's own "Create my site" route uses
 * (RegistrationHook.createMySite), so it is idempotent: the plan, the draft site and the address are reused, and a site already published is not published twice.
 *
 *   node scripts/live/retry-site-provision.js --email <address>          dry run (the default): reads, prints what would happen, writes nothing
 *   node scripts/live/retry-site-provision.js --id <vendor id> --apply   writes, after you type LIVE
 *   add --staging to run against the staging database (for rehearsal; --apply still asks for LIVE)
 *
 * It refuses any database that is not the live one (a staging, test or local database, or a placeholder) unless --staging is given. It sends nothing: every provider key is removed before
 * the services start. It never prints a phone number, an e-mail address or a connection string. Needs `npm run build` first. Run scripts/live/diagnose-vendor.js first to see the state.
 */
const path = require('path');
const { liveSeedEnv, applyConfirmed } = require('./live-env-lib');
const { parseArgs, collect } = require('./diagnose-vendor-lib');
const { makeProvidersInert, decide, dryLines, run, bootSiteApp } = require('./retry-site-provision-lib');

const BACKEND = path.resolve(__dirname, '..', '..');

(async () => {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const args = parseArgs(argv.filter((a) => a !== '--apply'));
  if (!args.ok) { console.error(`RETRY REFUSED: ${args.problem}.`); process.exitCode = 2; return; }
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  let conn;
  if (args.staging) conn = require(path.join(__dirname, '..', 'staging', 'guard')).loadStagingEnv();
  else {
    const live = liveSeedEnv(process.env, dist('common/startup-check').checkDatabaseUrls);
    if (!live.ok) { console.error(`RETRY REFUSED: ${live.problems.join('; ')}.`); process.exitCode = 3; return; }
    conn = live;
  }
  process.env.DATABASE_URL = conn.DATABASE_URL; process.env.DIRECT_URL = conn.DIRECT_URL || conn.DATABASE_URL;
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  const mask = (t) => (conn.mask ? conn.mask(String(t)) : String(t));
  let app = null;
  try {
    const { shapePlanOptions } = dist('plans/me/plan-options.core');
    const { selectTaxRate } = dist('plans/pricing/price-quote');
    const { DEFAULT_SITE_BASE } = dist('site-publish/publish/site-config');
    let categoryProbe = null;
    try {
      const { loadKit } = dist('site-publish/renderer/renderer-loader');
      const { categoryFor, categoryForTrack } = dist('site-publish/content/content-adapter');
      const kit = loadKit();
      categoryProbe = (industry, track) => { const doc = { vendor: { industry: industry || null }, cms: null }; return categoryFor(doc, kit, kit.categoryMap()) ? 'own' : categoryForTrack(doc, kit, kit.categoryMap(), track) ? 'track-default' : 'none'; };
    } catch { /* not checked */ }
    const facts = await collect(prisma, args, { shapePlanOptions, selectTaxRate, baseDomain: process.env.SITE_BASE_DOMAIN || DEFAULT_SITE_BASE, categoryProbe });
    const verdict = decide(facts && { ...facts.v });
    if (!verdict.ok) { console.error(`RETRY REFUSED: ${verdict.problem}.`); process.exitCode = 1; return; }
    console.log(`Site retry, ${args.staging ? 'staging' : 'LIVE'}, ${apply ? 'APPLY' : 'dry run'}`);
    console.log(dryLines(facts.v, facts.category).join('\n'));
    if (!apply) { console.log('\nDRY RUN: nothing was written. Add --apply to run it.'); return; }
    const { ask } = require('./prompt');
    if (!applyConfirmed(await ask(`\nThis WRITES to the ${args.staging ? 'STAGING' : 'LIVE'} database (the vendor's site). Type LIVE to continue: `))) { console.error('not confirmed; nothing was written.'); process.exitCode = 2; return; }
    makeProvidersInert(process.env);
    const booted = await bootSiteApp((p) => require(path.join(BACKEND, 'dist/src', p)), (p) => require(path.join(BACKEND, 'node_modules', p)));
    app = booted.app;
    const r = await run({ hook: booted.hook, prisma: booted.prisma, vendorId: facts.v.id });
    console.log(`\nResult: ${r.status}${r.published ? ' (published)' : ''}; siteProvisionStatus ${r.siteProvisionStatus ?? '(cleared)'}, siteProvisionCode ${r.siteProvisionCode ?? '(cleared)'}`);
    if (r.status !== 'LIVE') process.exitCode = 1;
  } catch (e) {
    console.error('ERROR:', mask(e && e.message).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { if (app) await app.close(); await prisma.$disconnect(); }
})();
