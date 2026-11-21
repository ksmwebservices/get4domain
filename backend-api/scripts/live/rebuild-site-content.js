#!/usr/bin/env node
'use strict';
/**
 * S1.4: rebuilds the home content of ONE vendor's Free site and republishes it. It calls the same service the vendor's own "Create my site" route uses (RegistrationHook.createMySite): the plan is kept,
 * the draft site and address are reused, EMPTY home fields are filled from the registration details (never the vendor's own words), the site is built (a new version only when something changed), published,
 * and the legacy site row is brought to LIVE so the public site app stops answering 404.
 *
 *   node scripts/live/rebuild-site-content.js --id <vendor id>             dry run (the default): reads, prints what would be filled, writes nothing
 *   node scripts/live/rebuild-site-content.js --id <vendor id> --apply     writes, after you type LIVE
 *   add --staging to run against the staging database (for rehearsal; --apply still asks for LIVE)
 *
 * It names the vendor by id only. It refuses any database that is not the live one (a staging, test or local database, or a placeholder) unless --staging is given. It sends nothing: every provider key is
 * removed before the services start. It never prints a phone number, an e-mail address or a connection string. Needs `npm run build` first.
 */
const path = require('path');
const { liveSeedEnv, applyConfirmed } = require('./live-env-lib');
const { makeProvidersInert, bootSiteApp } = require('./retry-site-provision-lib');
const { parseIdArgs, decideRebuild, dryRebuildLines, resultLines } = require('./rebuild-site-content-lib');

const BACKEND = path.resolve(__dirname, '..', '..');

(async () => {
  const args = parseIdArgs(process.argv.slice(2));
  if (!args.ok) { console.error(`REBUILD REFUSED: ${args.problem}.`); process.exitCode = 2; return; }
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  let conn;
  if (args.staging) conn = require(path.join(__dirname, '..', 'staging', 'guard')).loadStagingEnv();
  else {
    const live = liveSeedEnv(process.env, dist('common/startup-check').checkDatabaseUrls);
    if (!live.ok) { console.error(`REBUILD REFUSED: ${live.problems.join('; ')}.`); process.exitCode = 3; return; }
    conn = live;
  }
  process.env.DATABASE_URL = conn.DATABASE_URL; process.env.DIRECT_URL = conn.DIRECT_URL || conn.DATABASE_URL;
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  const mask = (t) => (conn.mask ? conn.mask(String(t)) : String(t));
  let app = null;
  try {
    const v = await prisma.vendor.findUnique({ where: { id: args.id }, select: { id: true, role: true, status: true, industry: true, subdomain: true } });
    const state = v ? {
      cms: await prisma.vendorCMS.findUnique({ where: { vendorId: v.id }, select: { siteStatus: true, tagline: true, about: true, address: true } }),
      products: await prisma.vendorProduct.count({ where: { vendorId: v.id } }),
      published: await prisma.v3SitePublication.findFirst({ where: { vendorId: v.id, status: 'PUBLISHED' }, select: { version: true } }),
      sub: await prisma.v3PlanSubscription.findFirst({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' }, select: { plan: { select: { key: true, track: true, level: true } } } }),
    } : null;
    const verdict = decideRebuild(v, state);
    if (!verdict.ok) { console.error(`REBUILD REFUSED: ${verdict.problem}.`); process.exitCode = 1; return; }
    console.log(`Site content rebuild, ${args.staging ? 'staging' : 'LIVE'}, ${args.apply ? 'APPLY' : 'dry run'}`);
    console.log(dryRebuildLines(v, state).join('\n'));
    if (!args.apply) { console.log('\nDRY RUN: nothing was written. Add --apply to run it.'); return; }
    const { ask } = require('./prompt');
    if (!applyConfirmed(await ask(`\nThis WRITES to the ${args.staging ? 'STAGING' : 'LIVE'} database (the vendor's site content). Type LIVE to continue: `))) { console.error('not confirmed; nothing was written.'); process.exitCode = 2; return; }
    makeProvidersInert(process.env);
    const booted = await bootSiteApp((p) => require(path.join(BACKEND, 'dist/src', p)), (p) => require(path.join(BACKEND, 'node_modules', p)));
    app = booted.app;
    const answer = await booted.hook.createMySite(v.id);
    const after = {
      cms: await booted.prisma.vendorCMS.findUnique({ where: { vendorId: v.id }, select: { siteStatus: true, tagline: true, about: true, address: true } }),
      products: await booted.prisma.vendorProduct.count({ where: { vendorId: v.id } }),
      published: await booted.prisma.v3SitePublication.findFirst({ where: { vendorId: v.id, status: 'PUBLISHED' }, orderBy: { version: 'desc' }, select: { version: true } }),
    };
    console.log(`\n${resultLines(answer, after).join('\n')}`);
    if (answer.status !== 'LIVE') process.exitCode = 1;
  } catch (e) {
    console.error('ERROR:', mask(e && e.message).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { if (app) await app.close(); await prisma.$disconnect(); }
})();
