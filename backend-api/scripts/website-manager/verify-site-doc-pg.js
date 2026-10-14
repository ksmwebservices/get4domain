// Website Manager phases 1 and 2 on REAL Postgres (PGlite) through the REAL NestJS API: the draft never leaks, preview, publish, versions and restore,
// the failure that leaves the old site live, plan limits, the lapsed gate, and the backfill (dry run writes nothing, apply fills only empty fields,
// second run changes nothing, rollback is exact).  Needs `npx nest build` first and PGlite (SKIPs cleanly when it is not installed).
const path = require('path');
const { startHarness, available } = require('../e2e/bos-harness');
const { plan, apply, rollback, MARK } = require('../site-document-backfill-lib');
const seeds = require('./standalone-seeds.json');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - Website Manager proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3095, pgPort: 54337 });
  const { prisma, call } = h;
  let code = 0;
  try {
    const v = await h.createVendor({ key: 'wmdoc', industry: 'clinic', plan: 'WORKSPACE' });
    const V = v.token;
    const pub = async () => (await call('GET', `/cms/site/${v.subdomain}`)).data;
    await prisma.vendorCMS.create({ data: { vendorId: v.id, businessName: 'Old Clinic', tagline: 'Old tagline', about: 'Old about', phone: '9000000001' } });

    section('[feat:website-manager.draft-privacy] The new workflow is off until switched on, and a draft never reaches the public');
    let r = await call('GET', '/site-doc/me', undefined, V);
    ok('before the switch, the editor says the new workflow is off', r.status < 300 && r.data.enabled === false, J(r.body));
    r = await call('PUT', '/site-doc/me/draft', { tagline: 'x' }, V);
    ok('and saving a draft is refused in plain words', r.status === 403 && /not switched on/.test(J(r.body)), J(r.body));
    await prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: 'site_doc_v2' } }, create: { vendorId: v.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });
    r = await call('PUT', '/site-doc/me/draft', { tagline: 'Brand new tagline', about: 'Brand new about', email: 'hello@clinic.test' }, V);
    ok('a draft is saved and marked as waiting to be published', r.status < 300 && r.data.dirty === true && r.data.doc.tagline === 'Brand new tagline' && r.data.live.tagline === 'Old tagline', J(r.body).slice(0, 300));
    let site = await pub();
    ok('the public site still shows the old content', site.cms.tagline === 'Old tagline' && site.cms.about === 'Old about' && site.docV2 === true);
    ok('the public site response never contains the draft', !('draft' in site.cms) && !J(site).includes('Brand new tagline'));
    r = await call('GET', `/cms/vendor/${v.id}`);
    ok('the public vendor endpoint does not return the draft either', r.status < 300 && !('draft' in (r.data ?? {})) && !J(r.body).includes('Brand new tagline'), J(r.body).slice(0, 200));

    section('[feat:website-manager.preview] Preview shows the draft only through the vendor\'s own signed link');
    r = await call('POST', '/site-doc/me/preview-link', {}, V);
    const token = String(r.data.url).split('preview=')[1];
    ok('the vendor gets a private preview link', r.status < 300 && token && r.data.url.startsWith(`/site/${v.subdomain}?preview=`), J(r.body));
    r = await call('GET', `/cms/site/${v.subdomain}?preview=${token}`);
    ok('with the link the site shows the draft and says it is a preview', r.data.preview === true && r.data.cms.tagline === 'Brand new tagline' && !('draft' in r.data.cms), J(r.body).slice(0, 200));
    r = await call('GET', `/cms/site/${v.subdomain}?preview=${token}x`);
    ok('a tampered link shows the live site', r.data.preview === false && r.data.cms.tagline === 'Old tagline');
    const other = await h.createVendor({ key: 'wmother', industry: 'retail', plan: 'WORKSPACE' });
    await prisma.vendorCMS.create({ data: { vendorId: other.id, tagline: 'Other live' } });
    r = await call('GET', `/cms/site/${other.subdomain}?preview=${token}`);
    ok('a preview link for one vendor does nothing for another', r.data.preview === false && r.data.cms.tagline === 'Other live');
    const { makePreviewToken, readPreviewToken } = h.dist('site-doc/preview-token');
    ok('an expired link is refused', readPreviewToken(makePreviewToken(v.id, Date.now() - 31 * 60_000)) === null && readPreviewToken(makePreviewToken(v.id)) === v.id);

    section('[feat:website-manager.publish-refresh] Publish makes it live in one step and the old site stays if it fails');
    r = await call('POST', '/site-doc/me/publish', {}, V);
    ok('publishing succeeds, clears the draft and moves to version 1', r.status < 300 && r.data.view.version === 1 && r.data.view.dirty === false && r.data.view.live.tagline === 'Brand new tagline', J(r.body).slice(0, 300));
    ok('it says how the public pages were refreshed (not set up in this test, so by itself within a minute)', r.data.refreshed === false && /within a minute/.test(r.data.message), J(r.data));
    site = await pub();
    ok('the public site now shows the new content, including the new e-mail', site.cms.tagline === 'Brand new tagline' && site.cms.about === 'Brand new about' && site.cms.email === 'hello@clinic.test');
    r = await call('POST', '/site-doc/me/publish', {}, V);
    ok('publishing again with nothing new is refused in plain words', r.status === 400 && /nothing new to publish/.test(J(r.body)), J(r.body));
    // (1) a rule fails before anything is written: a premium template the vendor has not bought
    const premium = await prisma.websiteTheme.create({ data: { name: 'Premium test theme', price: 999, cssVars: {} } });
    await call('PUT', '/site-doc/me/draft', { tagline: 'Will not go live', themeId: premium.id }, V);
    r = await call('POST', '/site-doc/me/publish', {}, V);
    ok('if a rule stops the publish the vendor is told why in plain words', r.status === 403 && /Unlock this premium template/.test(J(r.body)), J(r.body));
    site = await pub();
    const rowNow = await prisma.vendorCMS.findUnique({ where: { vendorId: v.id } });
    ok('and the old site is still live, with the draft kept for another try', site.cms.tagline === 'Brand new tagline' && rowNow.siteVersion === 1 && rowNow.draft && rowNow.draft.tagline === 'Will not go live');
    // (2) the database transaction itself fails half way: a stand-in database that rejects the transaction (PGlite cannot survive a real aborted transaction)
    const { SiteDocService } = h.dist('site-doc/site-doc.service');
    const fakeRow = { vendorId: v.id, siteVersion: 1, draft: { tagline: 'Half way' }, tagline: 'Live tagline' };
    const fake = { vendorAddon: { findUnique: async () => ({ enabled: true }) }, vendorCMS: { findUnique: async () => fakeRow }, billingTerm: { findFirst: async () => null }, vendor: { findUnique: async () => ({ subdomain: 'x' }) }, $transaction: async () => { throw new Error('connection lost'); } };
    let refreshed = 0;
    const stub = new SiteDocService(fake, { preflightVendorCms: async () => undefined, toColumns: (x) => x }, { refresh: async () => { refreshed++; return { refreshed: true, detail: '' }; } });
    let err = null; try { await stub.publish(v.id, 'tester'); } catch (e) { err = e; }
    ok('a failure inside the database transaction is reported as "your live site has not changed" and nothing is refreshed', err && /live site has not changed/.test(String(err.message || J(err.response))) && refreshed === 0, String(err && (err.message || J(err.response))));
    await call('DELETE', '/site-doc/me/draft', undefined, V);
    await prisma.websiteTheme.delete({ where: { id: premium.id } });

    section('[feat:website-manager.versions] The last 10 versions, and restore');
    for (let i = 2; i <= 12; i++) { await call('PUT', '/site-doc/me/draft', { tagline: `Tagline v${i}` }, V); const p = await call('POST', '/site-doc/me/publish', {}, V); if (p.status >= 300) { ok(`publish ${i}`, false, J(p.body)); break; } }
    r = await call('GET', '/site-doc/me/versions', undefined, V);
    ok('only the newest 10 versions are kept', r.status < 300 && r.data.length === 10 && r.data[0].version === 12 && r.data[9].version === 3 && r.data[0].current === true, J(r.data.map((x) => x.version)));
    r = await call('POST', '/site-doc/me/versions/5/restore', {}, V);
    ok('restoring version 5 puts that content live', r.status < 300 && r.data.view.live.tagline === 'Tagline v5', J(r.body).slice(0, 200));
    ok('and the restore is itself a new version (version 13); nothing is deleted', r.data.view.version === 13 && (await prisma.siteVersion.count({ where: { vendorId: v.id } })) === 10);
    r = await call('POST', '/site-doc/me/versions/1/restore', {}, V);
    ok('a version older than the last ten cannot be restored, in plain words', r.status === 404 && /last ten/.test(J(r.body)), J(r.body));
    ok('a vendor cannot see or restore another vendor\'s versions', (await call('GET', '/site-doc/me/versions', undefined, other.token)).status === 403);

    section('[feat:website-manager.plans] The editor is open on every plan; plans limit pages');
    const free = await h.createVendor({ key: 'wmfree', industry: 'general', plan: null });
    await prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: free.id, addonKey: 'site_doc_v2' } }, create: { vendorId: free.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });
    r = await call('GET', '/site-doc/me', undefined, free.token);
    ok('a free LeadSpace account (no paid plan) gets the editor with 1 page and a small media limit', r.status < 300 && r.data.plan === 'LEADSPACE' && r.data.limits.pages === 1 && r.data.limits.mediaMb === 100, J(r.body).slice(0, 200));
    r = await call('PUT', '/site-doc/me/draft', { pages: [{ slug: 'prices', title: 'Prices', body: 'Our prices' }] }, free.token);
    ok('an extra page on the free tier is refused with the plan message', r.status === 400 && /includes 1 page/.test(J(r.body)) && /upgrade/i.test(J(r.body)), J(r.body));
    r = await call('PUT', '/site-doc/me/draft', { tagline: 'Free tier tagline', layout: { themeKey: 'midnight-gold', hero: 'split' } }, free.token);
    ok('but themes, layouts and the text editor are all open on the free tier', r.status < 300 && r.data.doc.layout.themeKey === 'midnight-gold', J(r.body).slice(0, 200));
    r = await call('POST', '/site-doc/me/publish', {}, free.token);
    ok('and a free account can publish', r.status < 300 && r.data.view.live.tagline === 'Free tier tagline' && r.data.view.live.layout.hero === 'split', J(r.body).slice(0, 200));
    const four = [1, 2, 3, 4].map((i) => ({ slug: `p${i}`, title: `P${i}`, body: 'b' }));
    r = await call('PUT', '/site-doc/me/draft', { pages: four }, V);
    ok('Essentials (5 pages) accepts 4 extra pages', r.status < 300, J(r.body).slice(0, 200));
    r = await call('PUT', '/site-doc/me/draft', { pages: [...four, { slug: 'p5', title: 'P5', body: 'b' }] }, V);
    ok('and refuses a fifth extra page', r.status === 400 && /includes 5 pages/.test(J(r.body)), J(r.body));
    r = await call('PUT', '/site-doc/me/draft', { pages: [{ slug: 'a', title: 'A', body: 'b' }, { slug: 'a', title: 'B', body: 'b' }] }, V);
    ok('two pages with the same address are refused', r.status === 400 && /same|own address/.test(J(r.body)), J(r.body));
    r = await call('PUT', '/site-doc/me/draft', { layout: { themeKey: 'not-a-theme' } }, V);
    ok('an unknown theme is refused', r.status === 400 && /themes shown/.test(J(r.body)), J(r.body));
    r = await call('PUT', '/site-doc/me/draft', { layout: { hero: 'diagonal' } }, V);
    ok('an unknown layout is refused', r.status === 400 && /layouts shown/.test(J(r.body)), J(r.body));
    await call('DELETE', '/site-doc/me/draft', undefined, V);

    section('[feat:website-manager.plans] A lapsed plan can still edit a draft but cannot publish');
    await prisma.billingTerm.updateMany({ where: { vendorId: v.id, isCurrent: true }, data: { status: 'LAPSED' } });
    r = await call('PUT', '/site-doc/me/draft', { tagline: 'While lapsed' }, V);
    ok('the draft is saved while the plan is overdue', r.status < 300, J(r.body));
    r = await call('POST', '/site-doc/me/publish', {}, V);
    ok('publishing is held until the invoice is paid, with the usual plain message', r.status === 403 && /overdue/.test(J(r.body)), J(r.body));
    await prisma.billingTerm.updateMany({ where: { vendorId: v.id, isCurrent: true }, data: { status: 'ACTIVE' } });

    section('[feat:website-manager.migration] The backfill: dry run writes nothing, apply fills only empty fields, rollback is exact');
    const allwin = await h.createVendor({ key: 'allwintours', industry: 'travel', plan: 'WORKSPACE', subdomain: 'allwintours' });
    await prisma.vendorCMS.create({ data: { vendorId: allwin.id, logo: 'https://x.test/logo.jpg', phone: '9999999999' } }); // like production: only a logo, and a phone the vendor typed
    const vend = { id: allwin.id, subdomain: 'allwintours', industry: 'travel' };
    const seed = seeds.allwintours;
    const before = J({ cms: await prisma.vendorCMS.findMany({ where: { vendorId: allwin.id } }), products: await prisma.vendorProduct.count({ where: { vendorId: allwin.id } }), versions: await prisma.siteVersion.count({ where: { vendorId: allwin.id } }) });
    const p1 = await plan(prisma, vend, seed);
    const after = J({ cms: await prisma.vendorCMS.findMany({ where: { vendorId: allwin.id } }), products: await prisma.vendorProduct.count({ where: { vendorId: allwin.id } }), versions: await prisma.siteVersion.count({ where: { vendorId: allwin.id } }) });
    ok('a dry run writes nothing', before === after);
    ok('it would fill the empty fields (name, tagline, about, address, SEO, testimonials) and add the 11 packages and vehicles', ['businessName', 'tagline', 'about', 'address', 'seoTitle', 'seoDesc', 'testimonials'].every((f) => p1.fill.includes(f)) && p1.addProducts === 11, J(p1));
    ok('it keeps what the vendor already has (the typed phone) and says the old site differed', p1.keep.includes('phone') && p1.differs.includes('phone') && !p1.fill.includes('phone'), J(p1));
    const a1 = await apply(prisma, vend, seed, p1);
    const row = await prisma.vendorCMS.findUnique({ where: { vendorId: allwin.id } });
    ok('apply fills the empty fields', row.businessName === 'Allwin Tours & Travels' && row.tagline === 'Your Journey, Our Priority' && Array.isArray(row.testimonials) && row.testimonials.length === 4 && a1.products === 11);
    ok('and never overwrites the vendor\'s own logo or phone', row.logo === 'https://x.test/logo.jpg' && row.phone === '9999999999');
    ok('the products are in two categories and marked, so a rollback removes exactly them', (await prisma.category.count({ where: { vendorId: allwin.id } })) === 2 && (await prisma.vendorProduct.count({ where: { vendorId: allwin.id, customFields: { path: [MARK], equals: true } } })) === 11);
    const p2 = await plan(prisma, vend, seed);
    const a2 = await apply(prisma, vend, seed, p2);
    ok('a second run finds nothing to do and writes nothing', p2.fill.length === 0 && p2.addProducts === 0 && a2.filled.length === 0 && a2.products === 0 && (await prisma.vendorProduct.count({ where: { vendorId: allwin.id } })) === 11);
    // a vendor edits something after the backfill, then the backfill is rolled back
    await prisma.vendorCMS.update({ where: { vendorId: allwin.id }, data: { tagline: 'Edited by the vendor afterwards' } });
    const rb = await rollback(prisma, vend, seed);
    const row2 = await prisma.vendorCMS.findUnique({ where: { vendorId: allwin.id } });
    ok('rollback removes what the backfill added and restores the fields it filled', rb.products === 11 && row2.businessName === null && row2.about === null && row2.testimonials === null && (await prisma.vendorProduct.count({ where: { vendorId: allwin.id } })) === 0, J(rb));
    ok('but leaves what the vendor typed, before or after the backfill', row2.tagline === 'Edited by the vendor afterwards' && row2.logo === 'https://x.test/logo.jpg' && row2.phone === '9999999999');
    ok('and the snapshot is gone, so the vendor starts clean', (await prisma.siteVersion.count({ where: { vendorId: allwin.id } })) === 0);
    const sharedPlan = await plan(prisma, { id: v.id, subdomain: v.subdomain, industry: 'clinic' }, undefined);
    ok('a vendor on the shared renderer has nothing to copy', sharedPlan.fill.length === 0 && sharedPlan.addProducts === 0);
  } catch (e) {
    console.log(`  FAIL  suite crashed -> ${e.stack || e}`); fail += 1; failures.push('crash');
  } finally {
    await h.stop();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log('FAILED:\n - ' + failures.join('\n - '));
  code = fail ? 1 : 0;
  setTimeout(() => process.exit(code), 300);
})();
