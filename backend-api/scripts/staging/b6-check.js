#!/usr/bin/env node
'use strict';
/**
 * B6 staging check (STAGING ONLY). Runs the real registration hook, trial site, build and publish services, the vendor plan chooser and the two live scripts' shared code against the staging database.
 * Every fixture is tagged (business name V3TEST..., e-mail @v3test.invalid, one tagged category pack) and removed at the end. Nothing is sent: no provider key is present and e-mail is in capture mode.
 *
 *   node scripts/staging/b6-check.js
 */
const path = require('path');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
require('reflect-metadata');
const { loadStagingEnv } = require('./guard');
const BACKEND = path.resolve(__dirname, '..', '..');
const src = (p) => require(path.join(BACKEND, 'src', p));
const live = (p) => require(path.join(BACKEND, 'scripts', 'live', p));

(async () => {
  const conn = loadStagingEnv();
  process.env.DATABASE_URL = conn.DATABASE_URL; process.env.DIRECT_URL = conn.DIRECT_URL;
  const { makeProvidersInert } = live('retry-site-provision-lib');
  makeProvidersInert(process.env); process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = process.env.JWT_SECRET || 'b6-check-not-a-real-secret-0123456789';
  const { Test } = require(path.join(BACKEND, 'node_modules/@nestjs/testing'));
  const mods = [['prisma/prisma.module', 'PrismaModule'], ['plans/plans.module', 'PlansModule'], ['v3-trial/trial.module', 'V3TrialModule'], ['provisioning/provisioning.module', 'ProvisioningModule'], ['site-publish/site-publish.module', 'SitePublishModule'],
    ['b3-settings/b3-settings.module', 'B3SettingsModule'], ['v3-duplicates/duplicate-check.module', 'DuplicateCheckModule'], ['terms/terms.module', 'TermsModule'], ['v3-trust/trust.module', 'V3TrustModule'], ['v3-storage/storage.module', 'V3StorageModule'],
    ['seo-directory/seo-vendor-facts.module', 'SeoVendorFactsModule'], ['v3-mail/mail.module', 'V3MailModule'], ['v3-firm/firm.module', 'V3FirmModule'], ['v3-activity/activity.module', 'V3ActivityModule'], ['v3-admin-actions/admin-actions.module', 'V3AdminActionsModule'],
    ['v3-referrals/referrals.module', 'V3ReferralsModule'], ['messaging/messaging.module', 'MessagingModule'], ['v3-wallet/wallet.module', 'V3WalletModule'], ['plan-billing/payments-open.module', 'PaymentsOpenModule']].map(([p, n]) => src(p)[n]);
  const mod = await Test.createTestingModule({ imports: mods }).compile();
  const app = mod.createNestApplication(); await app.init();
  const prisma = app.get(src('prisma/prisma.service').PrismaService); const hook = app.get(src('plans/registration/registration.hook').RegistrationHook);
  const mePlans = app.get(src('plans/me/me-plans.service').MePlansService);
  let failed = 0; const check = (name, ok, extra = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); };
  const tag = () => `zz-b6-${Math.random().toString(36).slice(2, 8)}`;
  const mk = async (industry, over = {}) => { const t = tag(); return prisma.vendor.create({ data: { name: 'V3TEST B6', email: `${t}@v3test.invalid`, password: 'not-a-real-hash', businessName: `V3TEST B6 ${t}`, phone: '9840012345', industry, subdomain: t, ...over } }); };
  const packKeys = [];
  try {
    // B6.1: the reported shape: a Free handyman signup whose category the kit cannot place, with and without starter content, registered then retried
    const { starterDesignPacks } = src('site-doc/industry-seeds');
    const real = starterDesignPacks()[0]; const packKey = `zz-b6-${Math.random().toString(36).slice(2, 7)}`;
    await prisma.categoryPack.create({ data: { key: packKey, name: 'V3TEST B6 pack', config: real.config } }); packKeys.push(packKey);
    for (const [label, industry] of [['no starter content', 'handyman'], ['starter content', packKey], ['catalogue-style key', 'services']]) {
      const v = await mk(industry);
      const first = await hook.createMySite(v.id); const cms1 = await prisma.vendorCMS.findMany({ where: { vendorId: v.id }, select: { id: true } }); const pubs1 = await prisma.v3SitePublication.count({ where: { vendorId: v.id } });
      const second = await hook.createMySite(v.id); const cms2 = await prisma.vendorCMS.findMany({ where: { vendorId: v.id }, select: { id: true } }); const pubs2 = await prisma.v3SitePublication.count({ where: { vendorId: v.id } });
      const row = await prisma.vendor.findUnique({ where: { id: v.id }, select: { siteProvisionStatus: true, siteProvisionCode: true, subdomain: true } });
      check(`B6.1 ${label}: the answer is LIVE and no failure is recorded`, first.status === 'LIVE' && row.siteProvisionStatus === null && row.siteProvisionCode === null, first.status);
      check(`B6.1 ${label}: the retry is idempotent (same one site row, same publications, still LIVE)`, second.status === 'LIVE' && cms1.length === 1 && cms2[0].id === cms1[0].id && pubs1 === pubs2, `publications ${pubs1} -> ${pubs2}`);
      check(`B6.1 ${label}: the address stays the vendor's own`, row.subdomain === v.subdomain);
    }

    // B6.3 and B6.4: a failed vendor (the failure recorded as the old build rule would have) is diagnosed without personal data, then repaired through the same service the retry route uses
    const bad = await mk('hr', { siteProvisionStatus: 'FAILED', siteProvisionCode: 'PUBLISH_BLOCKED', siteProvisionFailedAt: new Date() });
    const { collect, render } = live('diagnose-vendor-lib'); const { decide, run, dryLines } = live('retry-site-provision-lib');
    const deps = { shapePlanOptions: src('plans/me/plan-options.core').shapePlanOptions, selectTaxRate: src('plans/pricing/price-quote').selectTaxRate, baseDomain: process.env.SITE_BASE_DOMAIN || src('site-publish/publish/site-config').DEFAULT_SITE_BASE, categoryProbe: () => 'track-default' };
    const before = render(await collect(prisma, { by: 'email', value: bad.email }, deps)).join('\n');
    check('B6.3 diagnosis prints the failure code and never the e-mail or phone', before.includes('PUBLISH_BLOCKED') && !before.includes(bad.email) && !before.includes('9840012345'));
    const facts = await collect(prisma, { by: 'id', value: bad.id }, deps);
    check('B6.3 diagnosis also finds the vendor by id', facts !== null);
    check('B6.4 a failed vendor may be retried; the dry run text names the code', decide({ ...facts.v }).ok && dryLines(facts.v, 'track-default').join('\n').includes('PUBLISH_BLOCKED'));
    const r = await run({ hook, prisma, vendorId: bad.id });
    check('B6.4 the retry builds and publishes the site and clears the recorded failure', r.status === 'LIVE' && r.siteProvisionStatus === null && r.siteProvisionCode === null, JSON.stringify(r));
    check('B6.4 a vendor with no recorded failure is refused', !decide({ ...(await collect(prisma, { by: 'id', value: bad.id }, deps)).v }).ok);

    // an address owned by a DIFFERENT vendor is shown as a real conflict
    const a = await mk('handyman'); const b = await mk('handyman');
    const host = `${a.subdomain}.${deps.baseDomain}`;
    await prisma.v3Domain.create({ data: { vendorId: b.id, hostname: host, kind: 'SUBDOMAIN', status: 'ACTIVE', createdByType: 'SYSTEM' } });
    const conflictText = render(await collect(prisma, { by: 'id', value: a.id }, deps)).join('\n');
    check('B6.3 an address owned by another vendor is reported as a real conflict', conflictText.includes('ANOTHER vendor'));
    await prisma.v3Domain.deleteMany({ where: { hostname: host } });

    // B6.2: the chooser through the real service: only the vendor's track, only terms with an approved price in force
    const hp = await prisma.v3Plan.findFirst({ where: { key: 'handyman_pro' } });
    const approved = (await prisma.v3PlanPrice.findMany({ where: { planId: hp.id, status: 'APPROVED', currency: 'INR', effectiveFrom: { lte: new Date() } } })).map((p) => p.termMonths);
    const opts = await mePlans.planOptions(bad.id);
    const terms = (opts.plans[0]?.terms ?? []).map((t) => t.termMonths).sort((x, y) => x - y);
    const expected = [...new Set(approved)].filter((t) => [3, 6, 12].includes(t)).sort((x, y) => x - y);
    check('B6.2 a Free handyman vendor sees the handyman plan and exactly the terms with an approved price in force', opts.track === 'handyman' && opts.plans.length >= 1 && opts.plans.every((p) => p.track === 'handyman') && JSON.stringify(terms) === JSON.stringify(expected), `track ${opts.track}, terms ${terms.join('/')}`);
    const noPlan = await mk('ac-appliance-repair');
    const o2 = await mePlans.planOptions(noPlan.id);
    check('B6.2 a vendor with no plan and no site gets the track of the category chosen at registration', o2.track === 'handyman' && o2.trackSource === 'CATEGORY' && o2.plans.length >= 1, `source ${o2.trackSource}`);
    const lost = await mk('zz-not-a-category');
    const o3 = await mePlans.planOptions(lost.id);
    check('B6.2 a track that cannot be resolved says so plainly and shows no plan', o3.track === null && o3.plans.length === 0 && o3.reason === 'TRACK_UNKNOWN' && typeof o3.message === 'string' && o3.message.length > 20);
  } catch (e) {
    failed += 1; console.log(`FAIL  unexpected error: ${conn.mask(String((e && e.stack) || e)).split('\n').slice(0, 4).join(' | ')}`);
  } finally {
    const { cleanupTestTenants } = require('./test-tenant-cleanup');
    for (const k of packKeys) await prisma.categoryPack.deleteMany({ where: { key: k } });
    const c = await cleanupTestTenants(prisma, {}); console.log(`cleanup: ${c.vendors} fixture vendors removed, ${packKeys.length} tagged pack removed`);
    const left = await prisma.vendor.count({ where: { email: { endsWith: '@v3test.invalid' } } });
    check('no fixture vendor is left on staging', left === 0, `${left} left`);
    await app.close();
  }
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(String((e && e.stack) || e).slice(0, 800)); process.exit(1); });
