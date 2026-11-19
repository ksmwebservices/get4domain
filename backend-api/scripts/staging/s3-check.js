#!/usr/bin/env node
'use strict';
/**
 * S3 staging check (STAGING ONLY). The real plan service gives a fixture Free vendor and a fixture Pro vendor their plans; the real CmsService answers what GET /cms/site/:subdomain answers.
 * Fixtures are tagged (business name V3TEST..., e-mail @v3test.invalid) and removed at the end. Nothing is sent: no provider key is present and e-mail is in capture mode.
 *
 *   node scripts/staging/s3-check.js
 */
const path = require('path');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
require('reflect-metadata');
const { loadStagingEnv } = require('./guard');
const BACKEND = path.resolve(__dirname, '..', '..');
const src = (p) => require(path.join(BACKEND, 'src', p));

(async () => {
  const conn = loadStagingEnv();
  process.env.DATABASE_URL = conn.DATABASE_URL; process.env.DIRECT_URL = conn.DIRECT_URL;
  require(path.join(BACKEND, 'scripts', 'live', 'retry-site-provision-lib')).makeProvidersInert(process.env);
  process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = process.env.JWT_SECRET || 's3-check-not-a-real-secret-0123456789';
  const { Test } = require(path.join(BACKEND, 'node_modules/@nestjs/testing'));
  const mods = [['prisma/prisma.module', 'PrismaModule'], ['plans/plans.module', 'PlansModule'], ['v3-activity/activity.module', 'V3ActivityModule']].map(([p, n]) => src(p)[n]);
  const mod = await Test.createTestingModule({ imports: mods }).compile();
  const app = mod.createNestApplication(); await app.init();
  const prisma = app.get(src('prisma/prisma.service').PrismaService);
  const subs = app.get(src('plans/subscriptions/subscriptions.service').SubscriptionsService);
  const cms = new (src('cms/cms.service').CmsService)(prisma);
  let failed = 0; const check = (name, ok, extra = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`); };
  const tag = () => `zz-s3-${Math.random().toString(36).slice(2, 8)}`;
  const mk = async () => { const t = tag(); return prisma.vendor.create({ data: { name: 'V3TEST S3', email: `${t}@v3test.invalid`, password: 'not-a-real-hash', businessName: `V3TEST S3 ${t}`, phone: '9840012345', industry: 'plumber', subdomain: t } }); };
  const actor = { type: 'SYSTEM', id: null, ip: null };
  try {
    const free = await mk(); await subs.provisionFreeSubscription(free.id, 'handyman', 'REGISTRATION');
    const pro = await mk(); await subs.assignPlan({ vendorId: pro.id, planKey: 'handyman_pro', termMonths: 12, source: 'STAFF', actor, reason: 'v3test s3 check', now: new Date() });
    const none = await mk();
    const expired = await mk(); await subs.assignPlan({ vendorId: expired.id, planKey: 'handyman_pro', termMonths: 3, source: 'STAFF', actor, reason: 'v3test s3 check', now: new Date() });
    await prisma.v3PlanSubscription.updateMany({ where: { vendorId: expired.id }, data: { status: 'EXPIRED', currentVendorId: null } });

    const f = await cms.getSiteBySubdomain(free.subdomain); const p = await cms.getSiteBySubdomain(pro.subdomain);
    const n = await cms.getSiteBySubdomain(none.subdomain); const x = await cms.getSiteBySubdomain(expired.subdomain);
    check('a Free vendor gets plan FREE', f.plan === 'FREE', String(f.plan));
    check('a Pro vendor gets plan PRO', p.plan === 'PRO', String(p.plan));
    check('a vendor with no held plan has no plan field', !('plan' in n));
    check('a vendor whose plan is no longer current has no plan field (only the CURRENT plan counts)', !('plan' in x));
    const text = JSON.stringify([f, p]);
    check('no e-mail, phone, subscription id, plan id, plan key or price is in the answers', !text.includes('v3test.invalid') && !text.includes('9840012345') && !/handyman_(free|pro)|amountPaise|priceSnapshot|currentVendorId/i.test(text));
    check('the answers have the same keys as before plus plan', JSON.stringify(Object.keys(f).sort()) === JSON.stringify([...Object.keys(n), 'plan'].sort()));
  } catch (e) {
    failed += 1; console.log(`FAIL  unexpected error: ${conn.mask(String((e && e.stack) || e)).split('\n').slice(0, 4).join(' | ')}`);
  } finally {
    const { cleanupTestTenants } = require('./test-tenant-cleanup');
    const c = await cleanupTestTenants(prisma, {}); console.log(`cleanup: ${c.vendors} fixture vendors removed`);
    const left = await prisma.vendor.count({ where: { email: { endsWith: '@v3test.invalid' } } });
    check('no fixture vendor is left on staging', left === 0, `${left} left`);
    await app.close();
  }
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(String((e && e.stack) || e).slice(0, 800)); process.exit(1); });
