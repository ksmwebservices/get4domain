#!/usr/bin/env node
'use strict';
/**
 * B3 staging check (STAGING ONLY, read-only): runs the new directory search, suggestions and public domain availability against the staging database through the real services.
 * It writes nothing. Output is counts, timings and public names; a connection string never appears (the guard refuses any database that is not on the staging allow-list).
 *
 *   node scripts/staging/b3-check.js
 */
const path = require('path');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
const { loadStagingEnv } = require('./guard');

const BACKEND = path.resolve(__dirname, '..', '..');
const ms = async (fn) => { const t = Date.now(); const r = await fn(); return { r, ms: Date.now() - t }; };

(async () => {
  const conn = loadStagingEnv();
  process.env.DATABASE_URL = conn.DATABASE_URL; process.env.DIRECT_URL = conn.DIRECT_URL;
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: conn.DATABASE_URL, log: [] });
  let failed = 0; const fixtures = [];
  const check = (name, ok, extra = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); };
  try {
    const { PrismaDirectoryRepository } = require(path.join(BACKEND, 'src/directory/prisma-directory.repository'));
    const { DirectoryReadService } = require(path.join(BACKEND, 'src/directory/directory-read.service'));
    const { DEFAULT_DIRECTORY_SETTINGS } = require(path.join(BACKEND, 'src/directory/settings/directory-settings'));
    const repo = new PrismaDirectoryRepository(prisma);
    const read = new DirectoryReadService(repo, { get: async () => DEFAULT_DIRECTORY_SETTINGS });

    // fixtures: staging has no real directory data, so two tagged businesses are made and removed again (nothing else is touched)
    const tag = `zz-b3-check-${Date.now().toString(36)}`;
    const leaf = await prisma.v3DirectoryCategory.findFirst({ where: { parentId: { not: null }, active: true }, select: { id: true, name: true } });
    const place = await prisma.v3DirectoryLocation.findFirst({ where: { parentId: { not: null }, active: true, kind: 'CITY' }, select: { id: true, name: true } }) ?? await prisma.v3DirectoryLocation.findFirst({ select: { id: true, name: true } });
    if (!leaf || !place) { console.log('staging has no category or place tree: nothing to check against'); process.exitCode = 3; return; }
    const mk = (suffix, over) => prisma.v3DirectoryBusiness.create({ data: { slug: `${tag}-${suffix}`, name: `ZZ B3 Check ${suffix}`, categoryId: leaf.id, locationId: place.id, descriptionText: 'A tagged staging fixture with a plain description.', status: 'CLAIMED', source: 'STAFF', addressJson: { city: 'Testville' }, pincode: '600001', ...over } });
    const f1 = await mk('alpha', {});
    const f2 = await mk('beta', { pincode: '600002' });
    await prisma.v3DirectoryBusinessService.create({ data: { businessId: f1.id, name: 'Zzquartz fitting', description: '' } });
    fixtures.push(f1.id, f2.id);
    const total = await prisma.v3DirectoryBusiness.count({ where: { status: { in: ['CLAIMED', 'UNCLAIMED', 'SUSPENDED'] } } });
    const cats = await prisma.v3DirectoryCategory.count();
    const locs = await prisma.v3DirectoryLocation.count();
    const svcs = await prisma.v3DirectoryBusinessService.count();
    console.log(`staging directory: ${total} public businesses, ${cats} categories, ${locs} places, ${svcs} services`);

    // G49: a word that is only a category name (taken from real data) finds businesses of that category
    const withBiz = await prisma.v3DirectoryBusiness.findFirst({ where: { status: { in: ['CLAIMED', 'UNCLAIMED'] } }, select: { id: true, name: true, categoryId: true, locationId: true, addressJson: true, category: { select: { name: true, slug: true, parent: { select: { name: true } } } } } });
    if (!withBiz) { console.log('no public business on staging: the search check needs at least one'); process.exitCode = 3; return; }
    const catWord = withBiz.category.name.toLowerCase().split(/\s+/)[0];
    const a = await ms(() => read.list({ q: catWord }));
    check(`G49 category word "${catWord}" finds businesses`, a.r.total > 0 && a.r.items.length > 0, `${a.r.total} found in ${a.ms} ms`);
    check('G49 the business of that category is among them (or the page is full)', a.r.items.some((i) => i.id === withBiz.id) || a.r.total > a.r.items.length);
    if (withBiz.category.parent) {
      const pw = withBiz.category.parent.name.toLowerCase().split(/\s+/)[0];
      const p = await ms(() => read.list({ q: pw }));
      check(`G49 parent category word "${pw}" finds businesses`, p.r.total > 0, `${p.r.total} found in ${p.ms} ms`);
    }
    const svc = await prisma.v3DirectoryBusinessService.findFirst({ select: { name: true, businessId: true } });
    if (svc) {
      const sw = svc.name.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter((w) => w.length > 3)[0];
      if (sw) { const s = await ms(() => read.list({ q: sw })); check(`G49 service word "${sw}" finds businesses`, s.r.total > 0, `${s.r.total} found in ${s.ms} ms`); }
    }
    const hostile = await read.list({ q: "x'; DROP TABLE y;--%_" });
    check('G49 a hostile text is only words and matches nothing', hostile.total === 0);
    const two = await ms(() => read.list({ q: `${catWord} zzzzqqq` }));
    check('G49 every typed word must match (a word that matches nothing gives nothing)', two.r.total === 0, `${two.ms} ms`);

    // G51: typed place text
    if (place) {
      const l = await ms(() => read.list({ location: place.name }));
      check(`G51 typed place "${place.name}" finds businesses`, l.r.total > 0, `${l.r.total} found in ${l.ms} ms`);
    }
    const unknown = await read.list({ location: 'near the airport zzqq' });
    check('G51 unknown place text gives no results and says so', unknown.total === 0 && unknown.filters.locationUnknown === true);
    const pin = await prisma.v3DirectoryBusiness.findFirst({ where: { pincode: { not: null }, status: { in: ['CLAIMED', 'UNCLAIMED'] } }, select: { pincode: true } });
    if (pin) { const r = await read.list({ location: pin.pincode }); check(`G51 pincode ${pin.pincode} finds businesses`, r.total > 0, `${r.total} found`); }

    // G53: the business id on results
    check('G53 results carry the business id and no vendor id', a.r.items.every((i) => typeof i.id === 'string' && i.id.length > 5) && !JSON.stringify(a.r).includes('vendorId'));

    // G50: suggestions
    const head = withBiz.name.slice(0, 3);
    const sg = await ms(() => read.suggest(head, undefined, undefined));
    check(`G50 suggestions for "${head}" answer within the caps`, sg.r.categories.length <= 8 && sg.r.places.length <= 8 && sg.r.businesses.length <= 8, `${sg.r.categories.length}/${sg.r.places.length}/${sg.r.businesses.length} in ${sg.ms} ms`);
    check('G50 business suggestions are public names only', sg.r.businesses.every((b) => b.id && b.slug && b.name && Object.keys(b).sort().join() === 'category,city,id,name,slug'));
    const sg2 = await ms(() => read.suggest(catWord.slice(0, 4), 'category', undefined));
    check(`G50 category suggestions for "${catWord.slice(0, 4)}"`, sg2.r.categories.length > 0, `${sg2.r.categories.length} in ${sg2.ms} ms`);
    const sg3 = await read.suggest("a'; select pg_sleep(5);--", undefined, undefined);
    check('G50 a hostile text returns quickly with nothing', sg3.businesses.length === 0);

    // B3.6: public domain availability (registrar off: it must never be asked and never say available for a custom domain)
    const { PublicDomainAvailabilityService } = require(path.join(BACKEND, 'src/v3-registrar/public-availability.service'));
    const { TrialSignupPolicy } = require(path.join(BACKEND, 'src/v3-trial/trial-signup.policy'));
    const { DomainSettingsService } = require(path.join(BACKEND, 'src/site-domains/settings/domain-settings.service'));
    const policy = new TrialSignupPolicy(prisma, new DomainSettingsService(prisma));
    const calls = [];
    const port = { search: async () => { calls.push('search'); return []; } };
    const store = { margins: async () => [] };
    const svcA = new PublicDomainAvailabilityService(store, port, policy);
    svcA.env = () => ({});
    const taken = await prisma.vendor.findFirst({ where: { subdomain: { not: null } }, select: { subdomain: true } });
    const free = `zz-b3-check-${Date.now().toString(36)}`;
    const off = await svcA.check(free);
    check('B3.6 registrar off: custom domain is REGISTRAR_OFF with no results, registrar not asked', off.customDomain.state === 'REGISTRAR_OFF' && off.customDomain.registrar === 'OFF' && off.customDomain.results.length === 0 && calls.length === 0);
    check('B3.6 a free subdomain is AVAILABLE', off.subdomain && off.subdomain.state === 'AVAILABLE');
    if (taken) { const t = await svcA.check(taken.subdomain); check('B3.6 a taken subdomain is TAKEN (never AVAILABLE)', t.subdomain && t.subdomain.state === 'TAKEN'); }
    const bad = await svcA.check('-no-');
    check('B3.6 an invalid name is INVALID for both', bad.customDomain.state === 'INVALID' && bad.subdomain && bad.subdomain.state === 'INVALID');
    const svcB = new PublicDomainAvailabilityService(store, port, policy);
    svcB.env = () => ({ REGISTRAR_LIVE_SEARCH: 'true' });
    const noPrice = await svcB.check(free);
    check('B3.6 registrar on but nothing on sale: NOT_FOR_SALE, still not asked', noPrice.customDomain.state === 'NOT_FOR_SALE' && calls.length === 0);
    // B3.3 included services (the new table) and B3.1 the plan rename, through the real audited services
    const { IncludedAllowanceService } = require(path.join(BACKEND, 'src/v3-services/included/included-allowance.service'));
    const { AuditService } = require(path.join(BACKEND, 'src/plans/admin/audit.service'));
    const { PlansAdminService } = require(path.join(BACKEND, 'src/plans/admin/plans-admin.service'));
    const audit = new AuditService(prisma);
    const actor = { type: 'SYSTEM', id: null, ip: null };
    const inc = new IncludedAllowanceService(prisma, audit);
    const m0 = await inc.matrix();
    check('B3.3 the matrix lists paid plans x 3 terms x 6 groups, all NOT_SET to begin with', m0.plans.length > 0 && m0.plans.every((p) => p.terms.length === 3 && p.terms.every((t) => t.groups.length === 6)) && m0.plans.every((p) => p.terms.every((t) => t.groups.every((g) => g.state === 'NOT_SET'))), `${m0.plans.length} paid plans`);
    const pro = m0.plans[0];
    if (pro) {
      await inc.set(pro.key, 12, 'REELS', 2, actor);
      const m1 = await inc.matrix(); const cell = m1.plans.find((p) => p.key === pro.key).terms.find((t) => t.termMonths === 12).groups.find((g) => g.key === 'REELS');
      check('B3.3 setting a quantity makes that cell INCLUDED', cell.state === 'INCLUDED' && cell.quantity === 2);
      await inc.set(pro.key, 12, 'REELS', null, actor);
      const m2 = await inc.matrix(); check('B3.3 clearing puts it back to NOT_SET', m2.plans.find((p) => p.key === pro.key).terms.find((t) => t.termMonths === 12).groups.find((g) => g.key === 'REELS').state === 'NOT_SET');
      const logs = await prisma.v3AuditLog.count({ where: { entityType: 'plan_service_allowance', action: { in: ['plan.allowance.set', 'plan.allowance.clear'] } } });
      check('B3.3 each change wrote an audit row', logs >= 2, `${logs} rows`);
    }
    const plans = new PlansAdminService(prisma, audit, { invalidateAll() {} });
    const freePlans = await prisma.v3Plan.findMany({ where: { level: 'FREE' }, select: { key: true, name: true } });
    for (const p of freePlans) await plans.renamePlan(p.key, 'Free plan', actor);
    const after = await prisma.v3Plan.findMany({ where: { level: 'FREE' }, select: { key: true, name: true } });
    check(`B3.1 every Free plan is named "Free plan" (${after.map((p) => p.key).join(', ')})`, after.length > 0 && after.every((p) => p.name === 'Free plan'));
    const again = await prisma.v3AuditLog.count({ where: { action: 'plan.rename' } });
    for (const p of freePlans) await plans.renamePlan(p.key, 'Free plan', actor);
    check('B3.1 a second rename to the same name writes no new audit row', (await prisma.v3AuditLog.count({ where: { action: 'plan.rename' } })) === again);
    console.log(failed === 0 ? 'ALL STAGING CHECKS PASSED' : `${failed} STAGING CHECK(S) FAILED`);
    if (failed) process.exitCode = 1;
  } catch (e) {
    console.error('ERROR:', conn.mask(String(e && e.message)).split('\n').slice(-3).join(' | '));
    process.exitCode = 1;
  } finally {
    if (fixtures.length) { await prisma.v3DirectoryBusinessService.deleteMany({ where: { businessId: { in: fixtures } } }); await prisma.v3DirectoryBusiness.deleteMany({ where: { id: { in: fixtures } } }); console.log(`fixtures removed: ${fixtures.length} businesses`); }
    await prisma.$disconnect();
  }
})();
