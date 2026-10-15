// Industry designs (15 Oct 2026) on REAL Postgres (PGlite) through the REAL NestJS API:
//   categories, starter content (seed), public safety, admin creation of a new category, and design switching.
// Test ids: industry-designs.categories, .seed, .public-safety, .admin, .switch (data level; the rendered page is proved in verify-designs-render.js).
const { startHarness, available } = require('../e2e/bos-harness');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

const SAMPLE_KEYS = ['tagline', 'about', 'banner', 'gallery', 'headline', 'subline', 'ctaLabel', 'announcement', 'trust', 'faq', 'steps'];

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - industry design proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3094, pgPort: 54336 });
  const { prisma, call } = h;
  let code = 0;
  try {
    const admin = await h.createAdmin({ key: 'designadmin' });
    const A = admin.token;
    const { validatePack } = h.dist('site-doc/pack.types');
    const { FAMILIES, VOCAB } = h.dist('site-doc/families');
    const flag = (v) => prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: 'site_doc_v2' } }, create: { vendorId: v.id, addonKey: 'site_doc_v2', enabled: true }, update: { enabled: true } });

    const seeded = await call('POST', '/admin/category-packs/seed/starter', {}, A);
    const packs = (await call('GET', '/admin/category-packs', undefined, A)).data;

    // ───────────────────────────── categories
    section('[feat:industry-designs.categories] Every category has a flow family and exactly four enabled designs');
    ok('the starter set is created in one click (24 categories)', seeded.status < 300 && seeded.data.created.length === 24, J(seeded.body).slice(0, 200));
    ok('there are at least 20 categories', packs.length >= 20, String(packs.length));
    ok('every category has a flow family from the list of eight', packs.every((p) => VOCAB.families.includes(p.config.family)), packs.filter((p) => !VOCAB.families.includes(p.config.family)).map((p) => p.key).join(','));
    ok('every one of the eight families is used by at least one category', VOCAB.families.every((f) => packs.some((p) => p.config.family === f)));
    ok('every category has exactly 4 designs switched on', packs.every((p) => p.config.designs.filter((d) => d.enabled !== false).length === 4), packs.filter((p) => p.config.designs.filter((d) => d.enabled !== false).length !== 4).map((p) => p.key).join(','));
    ok('every category has a default design that is one of its four', packs.every((p) => p.config.designs.some((d) => d.key === p.config.defaultDesign && d.enabled !== false)));
    const total = packs.reduce((n, p) => n + p.config.designs.length, 0);
    ok(`there are at least 80 designs (${total})`, total >= 80, String(total));
    ok('every pack, designs and starter content included, passes the checks a hand-made pack must pass', packs.every((p) => validatePack(p.config).length === 0), packs.filter((p) => validatePack(p.config).length).map((p) => `${p.key}: ${validatePack(p.config)[0]}`).join(' | '));
    const sig = (d) => d.sections.map((s) => `${s.type}:${s.variant}`);
    const distinctLayouts = packs.every((p) => {
      const ds = p.config.designs;
      const sigs = ds.map((d) => `${sig(d).join(' ')}|${d.nav}|${d.footer}|${d.actionBar}|${d.button}`);
      if (new Set(sigs).size !== ds.length) return false;
      for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
        const a = new Set(sig(ds[i])); const b = new Set(sig(ds[j]));
        const only = [...a].filter((x) => !b.has(x)).length + [...b].filter((x) => !a.has(x)).length;
        if (only < 6) return false; // the two differ in at least 6 section layouts, not just in colour
      }
      return new Set(ds.map((d) => d.sections.find((s) => s.type === 'hero').variant)).size >= 3;
    });
    ok('the four designs of a category differ in layout (sections, layouts, navigation, footer, action bar and at least 3 hero layouts), not only in colour', distinctLayouts);
    ok('the four designs of a category use four different themes', packs.every((p) => new Set(p.config.designs.map((d) => d.themeKey)).size === 4));
    ok('every design has a top section and the enquiry section, and only item layouts that suit its family', packs.every((p) => p.config.designs.every((d) => d.sections.some((s) => s.type === 'hero') && d.sections.some((s) => s.type === 'enquiry') && d.sections.filter((s) => s.type === 'items').every((s) => FAMILIES[p.config.family].itemVariants.includes(s.variant)))));
    const byKey = Object.fromEntries(packs.map((p) => [p.key, p]));
    ok('the live categories exist: travel (Allwin Tours), retail (Step N Rock), photography (Deebi), and IT and web services (KSM)', ['travel', 'retail', 'photography', 'technology'].every((k) => byKey[k]) && byKey.technology.name === 'IT and web services', J(Object.keys(byKey)));
    const resolve = h.dist('site-doc/pack-resolve').resolvePack;
    const via = async (ind) => (await resolve(prisma, null, ind))?.key;
    ok('the older names still find their category (shop-retail, salon-beauty, tutor, startup, builders-interiors, real-estate, restaurant-food, photography-events)', (await Promise.all(['shop-retail', 'salon-beauty', 'tutor', 'startup', 'builders-interiors', 'real-estate', 'restaurant-food', 'photography-events'].map(via))).join(',') === 'retail,salon,coaching,technology,construction,realestate,restaurant,photography');
    ok('the signup list industries each have a category (20 of 20)', ['travel', 'restaurant', 'clinic', 'hotel', 'salon', 'gym', 'realestate', 'education', 'retail', 'construction', 'events', 'finance', 'automobile', 'logistics', 'diagnostics', 'photography', 'professional', 'agriculture', 'coaching', 'technology'].every((k) => byKey[k]));

    // ───────────────────────────── seed
    section('[feat:industry-designs.seed] Starter content is seeded into the vendor\'s own site, marked sample, and never overwrites an edit');
    const created = await call('POST', '/admin/category-packs/sites', { categoryKey: 'clinic', businessName: 'Zq Care Clinic', subdomain: 'zq-care', city: 'Chennai', phone: '9876543210' }, A);
    ok('an admin creates one site from a category and business details', created.status < 300 && created.data.status === 'DRAFT' && created.data.itemsCreated >= 6 && created.data.itemsCreated <= 8 && /preview=/.test(created.data.previewUrl), J(created.body).slice(0, 300));
    const vid = created.data.vendorId;
    const row = await prisma.vendorCMS.findUnique({ where: { vendorId: vid } });
    const ex = row.extras ?? {};
    ok('the site row starts as DRAFT with the category, the default design and the theme chosen', row.siteStatus === 'DRAFT' && row.packKey === 'clinic' && row.designKey === byKey.clinic.config.defaultDesign && row.layout?.themeKey === byKey.clinic.config.designs[0].themeKey, J({ s: row.siteStatus, k: row.packKey, d: row.designKey, l: row.layout }));
    ok('headline, sub-line, About, tagline, button label and announcement are present', ['headline', 'subline', 'ctaLabel', 'announcement'].every((k) => typeof ex[k] === 'string' && ex[k].length > 3) && row.about.length > 60 && row.tagline.length > 5);
    ok('the business name and city are filled into the text (no {braces} left)', row.about.includes('Zq Care Clinic') && !/\{(business|city|phone)\}/.test(JSON.stringify([row, ex])), row.about.slice(0, 120));
    ok('a top picture and four gallery pictures are set (our own artwork, from the website\'s own storage)', row.banner === '/starter/clinic/hero.webp' && Array.isArray(row.portfolio) && row.portfolio.length === 4 && row.portfolio.every((p) => p.src.startsWith('/starter/clinic/')));
    ok('three questions, a trust strip and four steps are present', ex.faq.length === 3 && ex.trust.length >= 3 && ex.steps.length === 4);
    ok('two or three sample customer quotes are present, each marked sample', row.testimonials.length >= 2 && row.testimonials.length <= 3 && row.testimonials.every((t) => t.sample === true));
    ok('every starter field is marked sample', SAMPLE_KEYS.every((k) => ex.sample?.[k] === true), J(ex.sample));
    const items = await prisma.vendorProduct.findMany({ where: { vendorId: vid } });
    ok('6 to 8 starter items exist, each marked sample, and every sample price is marked', items.length >= 6 && items.length <= 8 && items.every((i) => i.customFields?.sample === 'true') && items.filter((i) => i.price).every((i) => i.customFields?.samplePrice === 'true'), J(items.map((i) => i.customFields)).slice(0, 200));
    ok('item pictures are the same starter artwork and the descriptions are written', items.every((i) => i.image && i.image.startsWith('/starter/clinic/') && i.description && i.description.length > 10));
    const rep = await call('POST', '/admin/category-packs/sites', { categoryKey: 'clinic', businessName: 'Dup', subdomain: 'zq-care' }, A);
    ok('a second site on the same address is refused in plain words', rep.status === 409 && /already used/.test(J(rep.body)), J(rep.body));
    const bad = await call('POST', '/admin/category-packs/sites', { categoryKey: 'clinic', businessName: 'X Y', subdomain: 'www' }, A);
    ok('a reserved address is refused', bad.status === 400 && /reserved/.test(J(bad.body)), J(bad.body));

    // a vendor: starter on top of what they already have
    const v1 = await h.createVendor({ key: 'dsgn1', industry: 'salon', plan: null });
    await flag(v1);
    await call('PUT', '/site-doc/me/draft', { tagline: 'My own tagline' }, v1.token);
    let r = await call('POST', '/site-doc/me/generate', { packKey: 'salon', businessName: 'Zq Salon', city: 'Madurai', phone: '9876500000' }, v1.token);
    let view = r.data;
    ok('generating a site from a category fills the draft with starter content (a draft: nothing is live yet)', r.status < 300 && view.doc.extras?.headline && view.doc.designKey === byKey.salon.config.defaultDesign && view.dirty === true && view.live.about == null, J(r.body).slice(0, 300));
    ok('their own words win: a tagline they already wrote is kept', view.doc.tagline === 'My own tagline' && view.doc.extras.sample.tagline !== true, J(view.doc.tagline));
    ok('the Sample content summary lists what is still starter text, the starter items and the starter quotes', view.sample.fields.includes('about') && view.sample.fields.includes('faq') && !view.sample.fields.includes('tagline') && view.sample.items >= 6 && view.sample.quotes >= 2, J(view.sample));
    r = await call('PUT', '/site-doc/me/draft', { about: 'We are a family salon in Madurai. Our own words.' }, v1.token);
    ok('changing the About text takes it off the sample list at once (the server decides)', r.status < 300 && !r.data.sample.fields.includes('about') && r.data.sample.fields.includes('faq'), J(r.body).slice(0, 200));
    const ex2 = { ...r.data.doc.extras, headline: 'Our own headline' };
    r = await call('PUT', '/site-doc/me/draft', { extras: ex2 }, v1.token);
    ok('changing the headline takes it off the list too', r.status < 300 && !r.data.sample.fields.includes('headline') && r.data.sample.fields.includes('steps'), J(r.body).slice(0, 200));
    r = await call('PUT', '/site-doc/me/draft', { extras: { ...r.data.doc.extras, sample: {} } }, v1.token);
    ok('a browser cannot clear the sample marks itself: the server keeps them', r.status < 300 && r.data.sample.fields.includes('faq') && r.data.sample.fields.includes('steps'), J(r.body).slice(0, 200));
    r = await call('POST', '/site-doc/me/reset-starter', {}, v1.token);
    ok('"Reset to starter" does not touch what they wrote: About, headline and tagline stay', r.status < 300 && r.data.view.doc.about.startsWith('We are a family salon') && r.data.view.doc.extras.headline === 'Our own headline' && r.data.view.doc.tagline === 'My own tagline', J(r.body).slice(0, 300));
    const before = await prisma.vendorProduct.count({ where: { vendorId: v1.id } });
    ok('and it does not add items twice (the vendor already has items)', before >= 6 && r.data.result.itemsCreated === 0, J(r.data.result));
    const v2 = await h.createVendor({ key: 'dsgn2', industry: 'retail', plan: 'WORKSPACE' });
    await flag(v2);
    await prisma.vendorProduct.create({ data: { vendorId: v2.id, name: 'My real product', price: '250', active: true } });
    r = await call('POST', '/site-doc/me/generate', { packKey: 'retail', businessName: 'Real Shop' }, v2.token);
    ok('a vendor who already has an item gets no starter items on top', r.status < 300 && (await prisma.vendorProduct.count({ where: { vendorId: v2.id } })) === 1 && r.data.sample.items === 0, J(r.body).slice(0, 200));

    // ───────────────────────────── public safety
    section('[feat:industry-designs.public-safety] Sample prices and sample customer quotes are never shown to the public');
    await call('POST', '/site-doc/me/publish', {}, v1.token);
    let pub = (await call('GET', `/cms/site/${v1.subdomain}`)).data;
    const priced = pub.products.filter((p) => p.customFields?.samplePrice === 'true');
    ok('the public product list has no price at all for a sample-price item (so none can be shown)', priced.length >= 5 && priced.every((p) => p.price === null && p.priceAmount === null), J(priced.slice(0, 2)));
    ok('sample customer quotes are not in the public site data', (pub.cms.testimonials ?? []).length === 0, J(pub.cms.testimonials));
    ok('the starter content itself (the pack\'s seed, with its sample quotes and prices) never leaves the server', pub.pack && !('seed' in pub.pack.config) && !/Sample customer/.test(J(pub)), J(Object.keys(pub.pack?.config ?? {})));
    const legacy = (await call('GET', `/cms/vendor/${v1.id}`)).data;
    ok('the older public site-settings endpoint hides sample quotes too', (legacy.testimonials ?? []).length === 0, J(legacy.testimonials));
    const v3 = await h.createVendor({ key: 'dsgn3', industry: 'gym', plan: null });
    await flag(v3);
    await call('POST', '/site-doc/me/generate', { packKey: 'gym', businessName: 'Zq Gym', city: 'Salem' }, v3.token);
    const pubd = await call('POST', '/site-doc/me/publish', {}, v3.token);
    const pub3 = (await call('GET', `/cms/site/${v3.subdomain}`)).data;
    ok('with only starter text the site is NOT offered to search engines', pubd.status < 300 && pub3.indexable === false && pub3.docV2 === true, J({ i: pub3.indexable, s: pubd.status }));
    const tok = (await call('POST', '/site-doc/me/preview-link', {}, v1.token)).data.url.split('preview=')[1];
    const pv = (await call('GET', `/cms/site/${v1.subdomain}?preview=${tok}`)).data;
    ok('the private preview follows the same rules (no prices, no sample quotes) and is never indexable', pv.products.filter((p) => p.customFields?.samplePrice === 'true').every((p) => p.price === null) && (pv.cms.testimonials ?? []).length === 0 && pv.indexable === false);
    const target = priced[0];
    r = await call('PUT', `/cms/products/${target.id}`, { price: '777' }, v1.token);
    pub = (await call('GET', `/cms/site/${v1.subdomain}`)).data;
    const tNow = pub.products.find((p) => p.id === target.id);
    ok('when the vendor sets their own price, that price shows (and only for that item)', r.status < 300 && tNow.price === '777' && tNow.customFields.samplePrice !== 'true' && pub.products.filter((p) => p.customFields?.samplePrice === 'true').every((p) => p.price === null), J(tNow));
    ok('that item is still a starter item (its text was not changed) until they edit its words', tNow.customFields.sample === 'true');
    r = await call('PUT', `/cms/products/${target.id}`, { ...{ name: 'My own service', description: 'Described by me', price: '777' }, customFields: { ...tNow.customFields } }, v1.token);
    const row2 = await prisma.vendorProduct.findUnique({ where: { id: target.id } });
    ok('editing the words takes the item off the sample list, even if the browser sends the old marks back', r.status < 300 && row2.customFields.sample === undefined && row2.customFields.samplePrice === undefined, J(row2.customFields));
    const echo = pub.products.find((p) => p.customFields?.samplePrice === 'true');
    r = await call('PUT', `/cms/products/${echo.id}`, { name: echo.name, price: (await prisma.vendorProduct.findUnique({ where: { id: echo.id } })).price, customFields: {} }, v1.token);
    const row3 = await prisma.vendorProduct.findUnique({ where: { id: echo.id } });
    ok('a browser that sends the item back unchanged (and empties the custom fields) cannot make a sample price look real', r.status < 300 && row3.customFields.samplePrice === 'true' && row3.customFields.sample === 'true', J(row3.customFields));
    pub = (await call('GET', `/cms/site/${v1.subdomain}`)).data;
    ok('once the vendor wrote their own About text the site may be indexed (real content now)', pub.indexable === true, J({ i: pub.indexable, cms: pub.cms.extras?.sample }));
    r = await call('PUT', '/site-doc/me/draft', { testimonials: [{ quote: 'Genuinely good work, thank you.', author: 'A real customer' }] }, v1.token);
    await call('POST', '/site-doc/me/publish', {}, v1.token);
    pub = (await call('GET', `/cms/site/${v1.subdomain}`)).data;
    ok('a real customer quote the vendor adds IS shown (the sample ones stay hidden)', pub.cms.testimonials.length === 1 && pub.cms.testimonials[0].author === 'A real customer', J(pub.cms.testimonials));
    const hidden = await call('GET', '/cms/site/zq-care');
    ok('an admin-created DRAFT site is hidden from the public (404), like a site that does not exist', hidden.status === 404, String(hidden.status));
    const viaToken = await call('GET', `/cms/site/zq-care?preview=${created.data.previewUrl.split('preview=')[1]}`);
    ok('but it opens through its private preview link', viaToken.status === 200 && viaToken.data.preview === true && viaToken.data.indexable === false, J(viaToken.body).slice(0, 160));
    ok('a site from before this change (no status column value set by us) stays LIVE', (await prisma.vendorCMS.findUnique({ where: { vendorId: v2.id } }))?.siteStatus !== 'DRAFT');

    // ───────────────────────────── switch (data level)
    section('[feat:industry-designs.switch] Switching design never loses content; a vendor sees only the four designs of their own category');
    r = await call('GET', '/site-doc/me/designs', undefined, v1.token);
    ok('a vendor sees exactly the 4 designs of their category (salon), nothing from other categories', r.status < 300 && r.data.designs.length === 4 && r.data.packKey === 'salon' && J(r.data.designs.map((d) => d.key)) === J(byKey.salon.config.designs.map((d) => d.key)), J(r.body).slice(0, 200));
    const snap = (d) => J({ tagline: d.tagline, about: d.about, extras: d.extras, portfolio: d.portfolio, testimonials: d.testimonials, businessName: d.businessName });
    const doc0 = (await call('GET', '/site-doc/me', undefined, v1.token)).data.doc;
    let allSame = true; let allSet = true; const items0 = J((await prisma.vendorProduct.findMany({ where: { vendorId: v1.id }, orderBy: { id: 'asc' } })).map((i) => [i.id, i.name, i.price, i.customFields]));
    for (const d of r.data.designs) {
      const s = await call('POST', '/site-doc/me/design', { designKey: d.key }, v1.token);
      allSet = allSet && s.status < 300 && s.data.doc.designKey === d.key && s.data.doc.layout?.themeKey === d.themeKey;
      allSame = allSame && snap(s.data.doc) === snap(doc0);
    }
    ok('switching to each of the four designs sets the design and its theme', allSet);
    ok('and every word, question, step, quote, picture and the business name is exactly as it was (sections are matched by type)', allSame);
    ok('the items are exactly as they were too', items0 === J((await prisma.vendorProduct.findMany({ where: { vendorId: v1.id }, orderBy: { id: 'asc' } })).map((i) => [i.id, i.name, i.price, i.customFields])));
    r = await call('POST', '/site-doc/me/design', { designKey: 'no-such-design' }, v1.token);
    ok('a design that is not one of their four is refused in plain words', r.status === 400 && /Choose one of the designs shown for your category/.test(J(r.body)), J(r.body));
    r = await call('PUT', '/site-doc/me/draft', { designKey: 'classic-hotel-only' }, v1.token);
    ok('the same through the ordinary save', r.status === 400, J(r.body));
    ok('the switch is a draft: the public site keeps the old design until Publish', (await call('GET', `/cms/site/${v1.subdomain}`)).data.cms.designKey !== 'warm');
    await call('POST', '/site-doc/me/design', { designKey: 'warm' }, v1.token);
    await call('POST', '/site-doc/me/publish', {}, v1.token);
    ok('after Publish the public site carries the chosen design', (await call('GET', `/cms/site/${v1.subdomain}`)).data.cms.designKey === 'warm');

    // ───────────────────────────── admin: a new category with no code
    section('[feat:industry-designs.admin] A category created through the admin screen only produces a working site with 4 designs');
    const NEW = { family: 'booking', keywords: ['pet care', 'vet', 'pet grooming'], item: { kind: 'service', noun: 'service', nounPlural: 'services' }, themeKey: 'fresh-green', seoType: 'LocalBusiness', ctaLabel: 'Book a visit',
      seed: { headline: 'Happy pets at {business}', subline: 'Book a visit for grooming or a check-up.', tagline: 'Pet care in {city}', about: '{business} looks after pets in {city}. Tell us about yours.', announce: 'Ask about home visits.', cta: 'Book a visit',
        trust: ['Gentle handling', 'Clear prices', 'Booking confirmed by message'], steps: [{ title: 'Tell us about your pet', desc: 'Age, breed and what you need.' }, { title: 'Pick a time', desc: 'We confirm.' }, { title: 'Visit', desc: 'Come at the agreed time.' }],
        quotes: [{ quote: 'My dog was calm and happy.', author: 'Sample customer' }], faq: [{ q: 'Do you do home visits?', a: 'Ask us.' }, { q: 'How do I book?', a: 'Use the form.' }, { q: 'Which pets?', a: 'Dogs and cats mostly.' }],
        items: [{ title: 'Grooming', desc: 'Bath and brush.', price: '800', category: 'Grooming', fields: {} }, { title: 'Check-up', desc: 'A basic health check.', price: '500', category: 'Health', fields: {} }, { title: 'Nail trim', desc: 'Quick and gentle.', price: '200', category: 'Grooming', fields: {} }], motif: 'Dog', hue: 120, images: { hero: '/starter/general/hero.webp', gallery: [1, 2, 3, 4].map((n) => `/starter/general/g${n}.webp`) } } };
    r = await call('POST', '/admin/category-packs', { key: 'pet-care', name: 'Pet care', config: { ...NEW, family: 'zoo' } }, A);
    ok('a wrong flow family is refused in plain words', r.status === 400 && /Choose the kind of business flow/.test(J(r.body)), J(r.body));
    r = await call('POST', '/admin/category-packs', { key: 'pet-care', name: 'Pet care', config: { ...NEW, seed: { ...NEW.seed, items: NEW.seed.items.slice(0, 2) } } }, A);
    ok('starter content with fewer than 3 items is refused', r.status === 400 && /add 3 to 12 items/.test(J(r.body)), J(r.body));
    r = await call('POST', '/admin/category-packs', { key: 'pet-care', name: 'Pet care', config: NEW }, A);
    ok('the new category is created from a family and the starter content only: the server builds the four designs', r.status < 300 && r.data.config.designs.length === 4 && r.data.config.designs.filter((d) => d.enabled).length === 4 && r.data.config.defaultDesign === 'classic' && validatePack(r.data.config).length === 0, J(r.body).slice(0, 300));
    const mk = await call('POST', '/admin/category-packs/sites', { categoryKey: 'pet-care', businessName: 'Paws Corner', subdomain: 'paws-corner', city: 'Pune' }, A);
    ok('an admin creates a site for the new category; it has its own starter items, quotes (hidden) and default design', mk.status < 300 && mk.data.itemsCreated === 3 && mk.data.designKey === 'classic', J(mk.body).slice(0, 200));
    r = await call('PUT', '/admin/category-packs/pet-care', { config: { ...r.data.config, designs: r.data.config.designs.map((d, i) => (i === 3 ? { ...d, enabled: false } : d)) } }, A);
    ok('switching a design off so fewer than four remain is refused', r.status === 400 && /exactly 4 designs/.test(J(r.body)), J(r.body));
    const cur = (await call('GET', '/admin/category-packs/pet-care', undefined, A)).data;
    r = await call('PUT', '/admin/category-packs/pet-care', { config: { ...cur.config, designs: cur.config.designs.map((d, i) => (i === 1 ? { ...d, name: 'Loud', themeKey: 'plum-night' } : d)), defaultDesign: 'bold' } }, A);
    ok('an admin can rename a design, change its theme and change the default (no deploy)', r.status < 300 && r.data.config.designs[1].name === 'Loud' && r.data.config.defaultDesign === 'bold', J(r.body).slice(0, 200));
    const { LeadspaceStaffGuard } = h.dist('leadspace/staff.guard');
    const { CommercialAdminGuard } = h.dist('commercial/foundation.services');
    const ctx = (user) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    const marketing = { role: 'ADMIN', adminRole: 'MARKETING', kind: 'admin', sub: 'm1' };
    let denied = false; try { new CommercialAdminGuard().canActivate(ctx(marketing)); } catch { denied = true; }
    let canSee = false; try { canSee = !!new LeadspaceStaffGuard().canActivate(ctx(marketing)); } catch { canSee = false; }
    ok('MARKETING staff can look at categories but cannot create a category or a site (403)', denied && canSee);

    // ───────────────────────────── existing vendors
    section('[feat:industry-designs.existing-vendors] Existing vendors are untouched; the dry run is read only; a category change changes nothing else');
    const { report } = require('./flagged-vendors-dry-run');
    const { changeCategory } = require('./set-vendor-category');
    const { planStarterSeed } = h.dist('site-doc/industry-seeds');
    const snap2 = async (vid) => J({ v: await prisma.vendor.findUnique({ where: { id: vid } }), c: await prisma.vendorCMS.findUnique({ where: { vendorId: vid } }), p: await prisma.vendorProduct.findMany({ where: { vendorId: vid }, orderBy: { id: 'asc' } }), a: await prisma.vendorAddon.findMany({ where: { vendorId: vid }, orderBy: { addonKey: 'asc' } }) });
    // (a) a vendor that is NOT on the flag, with its own content: nothing about it changes when the categories and designs arrive
    const old = await h.createVendor({ key: 'oldvendor', industry: 'travel', plan: 'WORKSPACE' });
    await prisma.vendorCMS.create({ data: { vendorId: old.id, businessName: 'Old Tours', tagline: 'Old tagline', about: 'Old about', themeId: null } });
    await prisma.vendorProduct.create({ data: { vendorId: old.id, name: 'Old tour', price: '4500', active: true } });
    const oldBefore = await snap2(old.id);
    const pubOldBefore = J((await call('GET', `/cms/site/${old.subdomain}`)).data);
    await call('POST', '/admin/category-packs/seed/starter', {}, A);
    ok('a vendor that is not on the new Website Manager is exactly as it was after the designs arrive (rows and the public page)', (await snap2(old.id)) === oldBefore && J((await call('GET', `/cms/site/${old.subdomain}`)).data) === pubOldBefore);
    ok('and its public page is still the older renderer (no designs, no pack)', (await call('GET', `/cms/site/${old.subdomain}`)).data.docV2 === false && (await call('GET', `/cms/site/${old.subdomain}`)).data.pack === null);
    const again = planStarterSeed(await prisma.categoryPack.findMany({ select: { key: true, config: true } }));
    ok('seeding the starter categories again finds nothing to do', again.create.length === 0 && again.upgrade.length === 0 && again.kept >= 24, J({ c: again.create.length, u: again.upgrade.length, k: again.kept }));
    // (b) a vendor that IS on the flag, with its own content and no design chosen yet
    const fl = await h.createVendor({ key: 'flagged1', industry: 'retail', plan: 'WORKSPACE' });
    await flag(fl);
    await prisma.vendorCMS.create({ data: { vendorId: fl.id, businessName: 'Flagged Shop', tagline: 'Our own words', about: 'Our own about text', banner: 'https://img.example.test/own.png' } });
    await prisma.vendorProduct.create({ data: { vendorId: fl.id, name: 'Our product', price: '250', active: true } });
    const flBefore = await snap2(fl.id);
    const packsNow = await prisma.categoryPack.findMany();
    const rep1 = report({ subdomain: fl.subdomain, businessName: 'Flagged Shop', industry: 'retail' }, await prisma.vendorCMS.findUnique({ where: { vendorId: fl.id } }), await prisma.vendorProduct.findMany({ where: { vendorId: fl.id } }), packsNow);
    ok('the dry run names the category, the default design it would start on, and what Reset to starter would fill (and not what the vendor wrote)', rep1.category === 'retail' && rep1.wouldChange.some((w) => /default design "Classic"/.test(w)) && rep1.wouldChange.some((w) => /would fill: headline, questions/.test(w)) && !rep1.wouldChange.some((w) => /about|tagline|banner|items/.test(w.split('would fill:')[1] ?? '')), J(rep1));
    ok('running the dry run writes nothing', (await snap2(fl.id)) === flBefore);
    ok('the vendor on the flag keeps every word and item; its public page now builds with the category\'s default design and none of the starter text', (await (async () => { const d = (await call('GET', `/cms/site/${fl.subdomain}`)).data; return d.docV2 === true && d.pack.key === 'retail' && d.cms.tagline === 'Our own words' && d.cms.about === 'Our own about text' && d.products.length === 1 && !('seed' in d.pack.config); })()));
    ok('and still nothing was written to its rows', (await snap2(fl.id)) === flBefore);
    // (c) changing a category
    const ksm = await h.createVendor({ key: 'ksmcopy2', industry: 'retail', plan: 'WORKSPACE', subdomain: 'ksm-copy' });
    const kBefore = await snap2(ksm.id);
    const dryRun = await changeCategory(prisma, 'ksm-copy', 'technology', false);
    ok('the category change dry run says what it would do and writes nothing', dryRun.after.industry === 'technology' && dryRun.before.industry === 'retail' && (await snap2(ksm.id)) === kBefore);
    await changeCategory(prisma, 'ksm-copy', 'technology', true);
    const kAfter = JSON.parse(await snap2(ksm.id)); const kOld = JSON.parse(kBefore);
    const changed = Object.keys(kAfter.v).filter((k) => J(kAfter.v[k]) !== J(kOld.v[k]));
    ok('applying it changes the vendor industry and the site category and NOTHING else (no content, items, design, add-on or other column)', J(changed.sort()) === J(['industry', 'updatedAt']) && kAfter.c.packKey === 'technology' && J(kAfter.p) === J(kOld.p) && J(kAfter.a) === J(kOld.a), J(changed));
    let refused = false; try { await changeCategory(prisma, 'ksm-copy', 'no-such-category', false); } catch (e) { refused = /No category/.test(String(e.message)); }
    ok('a category that does not exist is refused in plain words', refused);
    await changeCategory(prisma, 'ksm-copy', 'retail', true);
    ok('and it is undone by running it again with the previous category', (await prisma.vendor.findUnique({ where: { id: ksm.id } })).industry === 'retail');
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
