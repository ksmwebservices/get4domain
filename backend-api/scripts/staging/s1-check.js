#!/usr/bin/env node
'use strict';
/**
 * S1 staging check (STAGING ONLY). Runs the real registration hook, trial site, content, build and publish services, the legacy site route the public site app reads, and the V3 by-host lookup, against the
 * staging database. Every fixture is tagged (business name V3TEST..., e-mail @v3test.invalid, one tagged category pack) and removed at the end. Nothing is sent: no provider key is present and e-mail is in capture mode.
 *
 *   node scripts/staging/s1-check.js
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
  live('retry-site-provision-lib').makeProvidersInert(process.env); process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = process.env.JWT_SECRET || 's1-check-not-a-real-secret-0123456789';
  const { Test } = require(path.join(BACKEND, 'node_modules/@nestjs/testing'));
  const mods = [['prisma/prisma.module', 'PrismaModule'], ['plans/plans.module', 'PlansModule'], ['v3-trial/trial.module', 'V3TrialModule'], ['provisioning/provisioning.module', 'ProvisioningModule'], ['site-publish/site-publish.module', 'SitePublishModule'],
    ['b3-settings/b3-settings.module', 'B3SettingsModule'], ['v3-duplicates/duplicate-check.module', 'DuplicateCheckModule'], ['terms/terms.module', 'TermsModule'], ['v3-trust/trust.module', 'V3TrustModule'], ['v3-storage/storage.module', 'V3StorageModule'],
    ['seo-directory/seo-vendor-facts.module', 'SeoVendorFactsModule'], ['v3-mail/mail.module', 'V3MailModule'], ['v3-firm/firm.module', 'V3FirmModule'], ['v3-activity/activity.module', 'V3ActivityModule'], ['v3-admin-actions/admin-actions.module', 'V3AdminActionsModule'],
    ['v3-referrals/referrals.module', 'V3ReferralsModule'], ['messaging/messaging.module', 'MessagingModule'], ['v3-wallet/wallet.module', 'V3WalletModule'], ['plan-billing/payments-open.module', 'PaymentsOpenModule']].map(([p, n]) => src(p)[n]);
  const mod = await Test.createTestingModule({ imports: mods }).compile();
  const app = mod.createNestApplication(); await app.init();
  const prisma = app.get(src('prisma/prisma.service').PrismaService); const hook = app.get(src('plans/registration/registration.hook').RegistrationHook);
  const trial = app.get(src('v3-trial/module-trial-site').ModuleTrialSite);
  const subs = app.get(src('plans/subscriptions/subscriptions.service').SubscriptionsService);
  const repo = app.get(src('site-publish/publish/site.repository').SiteRepository);
  const build = app.get(src('site-publish/publish/site-build.service').SiteBuildService);
  const { CmsService } = src('cms/cms.service');
  const cms = new CmsService(prisma);
  const { SitePublicService } = src('site-publish/publish/site-public.service');
  const { SubdomainHostResolver } = src('site-publish/publish/prisma-site.repository');
  const pub = new SitePublicService(repo, new SubdomainHostResolver(prisma));
  const base = process.env.SITE_BASE_DOMAIN || src('site-publish/publish/site-config').DEFAULT_SITE_BASE;
  let failed = 0; const check = (name, ok, extra = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); };
  const tag = () => `zz-s1-${Math.random().toString(36).slice(2, 8)}`;
  const mk = async (industry) => { const t = tag(); return prisma.vendor.create({ data: { name: 'V3TEST S1', email: `${t}@v3test.invalid`, password: 'not-a-real-hash', businessName: `V3TEST S1 ${t}`, phone: '9840012345', industry, subdomain: t } }); };
  const legacy = async (sub) => cms.getSiteBySubdomain(sub).then((r) => ({ status: 200, r }), (e) => ({ status: e && e.status, r: null }));
  const packKeys = [];
  try {
    const { starterDesignPacks } = src('site-doc/industry-seeds');
    const real = starterDesignPacks()[0]; const packKey = `zz-s1-${Math.random().toString(36).slice(2, 7)}`;
    await prisma.categoryPack.create({ data: { key: packKey, name: 'V3TEST S1 pack', config: real.config } }); packKeys.push(packKey);

    for (const [label, industry, withPlace] of [['category text not in the list', 'Home repair and trades', true], ['category with starter content', packKey, true]]) {
      const v = await mk(industry);
      // the registration path: the plan, then the trial site with the details the form sent
      await subs.provisionFreeSubscription(v.id, 'handyman', 'REGISTRATION');
      const made = await trial.createLiveTrialSite({ vendorId: v.id, track: 'handyman', category: industry, businessName: v.businessName, phone: v.phone, ...(withPlace ? { city: 'Madurai', area: 'Anna Nagar', pincode: '625020' } : {}) });
      const row = await prisma.vendorCMS.findUnique({ where: { vendorId: v.id } });
      const pubRow = await prisma.v3SitePublication.findFirst({ where: { vendorId: v.id, status: 'PUBLISHED' } });
      check(`S1 ${label}: a PUBLISHED V3 site exists and it is not indexable`, made.published === true && !!pubRow && pubRow.indexable === false, pubRow ? `v${pubRow.version}` : 'none');
      const missing = (pubRow ? pubRow.missingFieldsJson : []).map((m) => m.code);
      check(`S1 ${label}: HOME_CONTENT is no longer missing; claim and contact are still outstanding`, !missing.includes('HOME_CONTENT') && missing.includes('CLAIMED') && missing.includes('VERIFIED_CONTACT'), missing.join(','));
      const home = pubRow ? (await repo.pagesOf(pubRow.id)).find((p) => p.path === '/') : null;
      const html = home ? home.html : '';
      check(`S1 ${label}: the page shows the business name, the services of the track and the place`, html.includes(v.businessName) && html.includes('Repairs and maintenance') || industry === packKey, '');
      if (industry !== packKey) check(`S1 ${label}: the category text as typed and the place are on the page`, html.includes('Home repair and trades in Madurai') && html.includes('Anna Nagar, Madurai 625020'));
      check(`S1 ${label}: an information page (no form, button, mailto, tel or WhatsApp link) and never the login e-mail`, !/<form\b|<button\b|href="mailto:|href="tel:|href="https:\/\/wa\.me/i.test(html) && !html.includes(v.email));
      check(`S1 ${label}: the legacy site row is LIVE after the publish`, row.siteStatus === 'LIVE', row.siteStatus);

      // S1.1: the exact condition. The old code left the row DRAFT; the public site app's route then refuses it.
      await prisma.vendorCMS.update({ where: { vendorId: v.id }, data: { siteStatus: 'DRAFT' } });
      const refused = await legacy(v.subdomain);
      check(`S1.1 ${label}: with the row left DRAFT (the old state) GET /cms/site/<subdomain> answers 404, so the site app calls notFound()`, refused.status === 404);
      const byHost = await pub.lookup(`${v.subdomain}.${base}`, '/', 'en');
      check(`S1.1 ${label}: while the V3 by-host lookup serves the published page (200)`, !!byHost && byHost.status === 200 && byHost.html.includes(v.businessName));

      // S1.4 and idempotence: the retry service repairs it, once, and changes nothing the second time
      const a = await hook.createMySite(v.id);   // the repair (the row was put back to DRAFT above, so this may make one new version)
      const prodsBefore = await prisma.vendorProduct.count({ where: { vendorId: v.id } }); const pubsBefore = await prisma.v3SitePublication.count({ where: { vendorId: v.id } });
      const b = await hook.createMySite(v.id); const c2 = await hook.createMySite(v.id);   // two more retries change nothing
      const after = await legacy(v.subdomain);
      check(`S1.4 ${label}: the retry service sets the row LIVE and the legacy route answers 200 with the home text`, a.status === 'LIVE' && b.status === 'LIVE' && c2.status === 'LIVE' && after.status === 200 && !!after.r.cms && String(after.r.cms.about || '').length > 20, `status ${after.status}`);
      check(`S1 ${label}: retry and republish are idempotent (same publications, same catalogue rows)`, (await prisma.v3SitePublication.count({ where: { vendorId: v.id } })) === pubsBefore && (await prisma.vendorProduct.count({ where: { vendorId: v.id } })) === prodsBefore, `publications ${pubsBefore} -> ${await prisma.v3SitePublication.count({ where: { vendorId: v.id } })}, catalogue ${prodsBefore} -> ${await prisma.vendorProduct.count({ where: { vendorId: v.id } })}`);
      check(`S1 ${label}: the legacy answer carries no e-mail of the owner`, !JSON.stringify(after.r).includes(v.email));

      // S1.5: the Free "Build a preview" route (SiteBuildService.build, as POST /v3/me/site/build calls it)
      const built = await build.build(v.id, { actor: { type: 'VENDOR', id: v.id, ip: null } });
      const prev = (await repo.pagesOf(built.publication.id)).find((p) => p.path === '/');
      check(`S1.5 ${label}: Build a preview returns an information page with content, not an empty page`, !!prev && prev.html.includes(v.businessName) && prev.html.length > 3000 && !/<form\b|<button\b/i.test(prev.html), prev ? `${prev.html.length} bytes` : 'no page');
    }

    // the starter-content fixture: the pack's own words are kept (the generic text only fills what is empty)
    const sc = await prisma.vendor.findFirst({ where: { industry: packKey }, select: { id: true } });
    const scRow = await prisma.vendorCMS.findUnique({ where: { vendorId: sc.id } });
    check('S1 starter content: the pack\'s own tagline is kept, the generic text did not replace it', !!scRow && !String(scRow.tagline || '').startsWith('zz-') && (scRow.packKey === packKey));
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
