// Website Manager phase 6 on REAL Postgres (PGlite) through the REAL NestJS API: category packs are data. The acceptance test of the dispatch:
// create a new pack called "Salon" through the admin API only, generate a site for a test vendor, edit it, publish it, and see it live. No code change.
const { startHarness, available } = require('../e2e/bos-harness');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

const SALON = {
  keywords: ['salon', 'beauty parlour', 'hair'], goal: 'APPOINTMENT', ctaLabel: 'Book my slot', sections: ['hero', 'services', 'about', 'gallery', 'testimonials', 'faq', 'contact'],
  item: { kind: 'service', noun: 'service', nounPlural: 'services' },
  defaults: {
    tagline: 'Hair, skin and style in {city}', about: '{business} is a friendly salon in {city}. Walk in or book a slot and we will take care of the rest.',
    headline: 'Look and feel your best at {business}', subline: 'Book a slot in a minute. We confirm on WhatsApp.',
    trust: ['Clean, sanitised tools', 'Trained stylists'], faq: [{ q: 'Do I need to book?', a: 'Walk-ins are welcome. Booking a slot saves you waiting.' }],
  },
  themeKey: 'soft-rose', layouts: { hero: 'split', about: 'centered', services: 'menu', gallery: 'grid', testimonials: 'quote', contact: 'split' }, seoType: 'BeautySalon',
  aiPrompts: { about: 'Write a warm 80-word About text for {business}, a salon in {city}.', tagline: 'A short tagline for {business}, a salon in {city}.', images: 'Three photo ideas for a salon website.' },
};

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - category pack proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3096, pgPort: 54338 });
  const { prisma, call } = h;
  let code = 0;
  try {
    const admin = await h.createAdmin({ key: 'packadmin' });
    const A = admin.token;
    const { LeadspaceStaffGuard } = h.dist('leadspace/staff.guard');
    const { CommercialAdminGuard } = h.dist('commercial/foundation.services');
    const ctx = (user) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    const marketing = { role: 'ADMIN', adminRole: 'MARKETING', kind: 'admin', sub: 'm1' };

    section('[feat:website-manager.packs] Creating a pack is data, through the admin API only');
    let r = await call('GET', '/admin/category-packs', undefined, A);
    ok('there are no packs until staff create or seed them', r.status < 300 && r.data.length === 0, J(r.body));
    r = await call('POST', '/admin/category-packs', { key: 'salon', name: 'Salon', config: { ...SALON, goal: 'MAGIC' } }, A);
    ok('a pack with a wrong value is refused in plain words', r.status === 400 && /Choose what visitors do/.test(J(r.body)), J(r.body));
    r = await call('POST', '/admin/category-packs', { key: 'Salon Pack!', name: 'Salon', config: SALON }, A);
    ok('a bad key is refused', r.status === 400 && /lower-case letters/.test(J(r.body)), J(r.body));
    r = await call('POST', '/admin/category-packs', { key: 'salon', name: 'Salon', config: { ...SALON, sections: ['services', 'about'] } }, A);
    ok('a pack without hero and contact is refused', r.status === 400 && /hero and contact/.test(J(r.body)), J(r.body));
    r = await call('POST', '/admin/category-packs', { key: 'salon', name: 'Salon', config: SALON }, A);
    ok('the Salon pack is created', r.status < 300 && r.data.key === 'salon' && r.data.enabled === true, J(r.body).slice(0, 200));
    r = await call('POST', '/admin/category-packs', { key: 'salon', name: 'Salon again', config: SALON }, A);
    ok('the same key twice is refused with what to do', r.status === 409 && /Choose another key/.test(J(r.body)), J(r.body));
    r = await call('POST', '/admin/category-packs/salon/duplicate', { key: 'salon-premium', name: 'Salon premium' }, A);
    ok('a pack can be duplicated', r.status < 300 && r.data.key === 'salon-premium', J(r.body).slice(0, 200));
    r = await call('PUT', '/admin/category-packs/salon-premium', { enabled: false, config: { ...SALON, themeKey: 'midnight-gold' } }, A);
    ok('a pack can be edited and switched off', r.status < 300 && r.data.enabled === false && r.data.config.themeKey === 'midnight-gold', J(r.body).slice(0, 200));
    r = await call('GET', '/admin/category-packs/salon/preview', undefined, A);
    ok('preview fills the sample company details and writes nothing', r.status < 300 && /Sample Salon/.test(J(r.data.sample)) && !/\{city\}|\{business\}/.test(J(r.data.sample)) && r.data.sample.layout.themeKey === 'soft-rose', J(r.body).slice(0, 300));
    ok('MARKETING staff may read and preview packs', (() => { try { return new LeadspaceStaffGuard().canActivate(ctx(marketing)); } catch { return false; } })());
    ok('but may not create or edit them (403)', (() => { try { new CommercialAdminGuard().canActivate(ctx(marketing)); return false; } catch (e) { return /commerce|Admin/.test(String(e.message)); } })());
    const vend = await h.createVendor({ key: 'packvendor', industry: 'salon', plan: 'WORKSPACE' });
    ok('a vendor cannot create packs', (await call('POST', '/admin/category-packs', { key: 'x1', name: 'X', config: SALON }, vend.token)).status === 403);

    section('[feat:website-manager.packs] Acceptance: generate, edit, publish, live (no code change)');
    await prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: vend.id, addonKey: 'site_doc_v2' } }, create: { vendorId: vend.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });
    r = await call('GET', '/site-doc/me/categories', undefined, vend.token);
    ok('the vendor sees Salon in the category list, and not the switched-off pack', r.status < 300 && r.data.some((c) => c.key === 'salon') && !r.data.some((c) => c.key === 'salon-premium'), J(r.body));
    r = await call('POST', '/site-doc/me/generate', { packKey: 'salon', businessName: 'Glow Salon', city: 'Chennai', phone: '9876500123' }, vend.token);
    ok('generating fills a draft from the pack with the company details (no placeholders left)', r.status < 300 && r.data.doc.tagline === 'Hair, skin and style in Chennai' && /Glow Salon is a friendly salon in Chennai/.test(r.data.doc.about) && r.data.doc.phone === '9876500123' && r.data.dirty === true, J(r.body).slice(0, 400));
    ok('the pack\'s theme and layouts are in the draft', r.data.doc.layout.themeKey === 'soft-rose' && r.data.doc.layout.services === 'menu' && r.data.doc.packKey === 'salon', J(r.data.doc.layout));
    let site = (await call('GET', `/cms/site/${vend.subdomain}`)).data;
    ok('nothing is public yet: the draft is not live', !site.cms || !site.cms.tagline);
    r = await call('PUT', '/site-doc/me/draft', { tagline: 'Glow: hair, skin and style' }, vend.token);
    ok('the vendor edits the generated text', r.status < 300 && r.data.doc.tagline === 'Glow: hair, skin and style');
    r = await call('POST', '/site-doc/me/publish', {}, vend.token);
    ok('and publishes', r.status < 300 && r.data.view.version === 1, J(r.body).slice(0, 200));
    site = (await call('GET', `/cms/site/${vend.subdomain}`)).data;
    ok('the site is live with the vendor\'s text, and the public payload says which pack and layouts to use', site.cms.tagline === 'Glow: hair, skin and style' && site.cms.packKey === 'salon' && site.docV2 === true && site.pack.key === 'salon' && site.pack.config.goal === 'APPOINTMENT' && site.cms.layout.hero === 'split', J(site).slice(0, 400));
    r = await call('POST', '/site-doc/me/generate', { packKey: 'nope', businessName: 'X' }, vend.token);
    ok('an unknown or switched-off category is refused kindly', r.status === 404 && /not available/.test(J(r.body)), J(r.body));

    section('[feat:website-manager.packs] Matching by the vendor\'s industry, and the starter packs');
    const byIndustry = await h.createVendor({ key: 'packind', industry: 'salon', plan: 'WORKSPACE' });
    await prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: byIndustry.id, addonKey: 'site_doc_v2' } }, create: { vendorId: byIndustry.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });
    await prisma.vendorCMS.create({ data: { vendorId: byIndustry.id, tagline: 'x' } });
    site = (await call('GET', `/cms/site/${byIndustry.subdomain}`)).data;
    ok('a vendor with no chosen pack is matched by its industry', site.pack && site.pack.key === 'salon', J(site.pack));
    r = await call('POST', '/admin/category-packs/seed/starter', {}, A);
    ok('seeding adds the 12 LeadSpace trades and the 20 website industries (Salon already existed, so it is kept)', r.status < 300 && r.data.kept === 2 && r.data.created.length >= 30 && r.data.created.includes('shop-retail') && r.data.created.includes('travel') && r.data.created.includes('retail'), J(r.body).slice(0, 300));
    r = await call('POST', '/admin/category-packs/seed/starter', {}, A);
    ok('seeding again changes nothing', r.status < 300 && r.data.created.length === 0, J(r.body).slice(0, 200));
    const all = (await call('GET', '/admin/category-packs', undefined, A)).data;
    const { validatePack } = h.dist('site-doc/pack.types');
    ok('every starter pack passes the same checks a hand-made pack must pass', all.every((p) => validatePack(p.config).length === 0), all.filter((p) => validatePack(p.config).length).map((p) => p.key).join(','));
    ok('every trade and industry in use today has a pack (travel for Allwin, retail for Step N Rock, photography for Deebi)', ['travel', 'retail', 'photography', 'clinic', 'realestate'].every((k) => all.some((p) => p.key === k)));
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
