// Phase 7: Campaigns and DomainCampaign become LeadSpace, on REAL Postgres (PGlite): an Allwin Tours style vendor with a landing page, campaigns, campaign
// leads and a DomainCampaign billing record. Proves the dry run writes nothing, the apply copies everything and loses nothing, running twice changes nothing,
// the rollback removes only what the import made, and the old addresses and the registry point into LeadSpace.
// Needs `npx nest build` first and PGlite (SKIPs cleanly when it is not installed).
const path = require('path');
const { startHarness, available } = require('../e2e/bos-harness');
const { runMigration } = require('../leadspace-migrate-lib');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - campaign merge proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3091, pgPort: 54337 });
  const { prisma, call } = h;
  let code = 0;
  try {
    const admin = await h.createAdmin({ key: 'madmin' });
    const A = admin.token;

    // — an Allwin Tours style vendor, and one that must stay untouched —
    const allwin = await h.createVendor({ key: 'allwin', industry: 'travel', plan: 'WORKSPACE' });
    const bystander = await h.createVendor({ key: 'bystander', industry: 'retail', plan: 'WORKSPACE' });
    await prisma.vendorProduct.createMany({ data: [{ vendorId: allwin.id, name: 'Goa 3N/4D', priceAmount: 12999, price: '12999', description: 'Flights not included' }, { vendorId: allwin.id, name: 'Munnar 2N/3D', priceAmount: 8999, price: '8999' }] });
    const page1 = await prisma.campaignPage.create({ data: { vendorId: allwin.id, slug: 'goa-diwali', title: 'Goa Diwali', headline: 'Goa for Diwali', subheadline: 'Beach, food and fireworks', benefits: ['Pickup from your door', 'Hotel and breakfast included', 'Local guide'], aboutText: 'Allwin Tours has taken families to Goa for twelve years.', heroImage: 'https://img.example/goa.jpg', photos: ['https://img.example/g1.jpg', 'https://img.example/g2.jpg'], phone: '9840011111', whatsapp: '9840022222', email: 'bookings@allwin.example', address: '4 Anna Salai, T Nagar, Chennai 600017', mapsLink: 'https://maps.example/allwin', testimonials: [{ name: 'Rekha', text: 'Wonderful trip' }], active: true, views: 421 } });
    await prisma.campaignPage.create({ data: { vendorId: allwin.id, slug: 'munnar-monsoon', title: 'Munnar', headline: 'Munnar in the rain', benefits: [], phone: '9840011111', whatsapp: '9840022222', active: false, views: 12, updatedAt: new Date(Date.now() - 90 * 86_400_000) } });
    const camp1 = await prisma.campaign.create({ data: { vendorId: allwin.id, name: 'Diwali Goa offer', description: 'Festive package', status: 'completed', channels: ['whatsapp', 'facebook'], content: { whatsapp: 'Goa 3N/4D, book now', facebook: { caption: 'Goa for Diwali: families travel together' } }, walletCost: 300, startDate: new Date('2026-09-20'), endDate: new Date('2026-10-05'), analytics: { sent: 120, replies: 14 } } });
    const camp2 = await prisma.campaign.create({ data: { vendorId: allwin.id, name: 'Monsoon Munnar', description: 'Draft idea', status: 'draft', channels: ['instagram'], content: {} } });
    const lead = (name, phone, status, message) => prisma.campaignLead.create({ data: { vendorId: allwin.id, campaignPageId: page1.id, name, phone, status, message, source: 'campaign-page', createdAt: new Date('2026-09-25T10:00:00Z') } });
    const l1 = await lead('Suresh', '9876500001', 'new', 'Need 4 seats for Goa'); const l2 = await lead('Anita', '+91 98765 00002', 'contacted', null); const l3 = await lead('Bad Number', '12345', 'won', 'booked');
    const rec = await prisma.domainCampaignRecord.create({ data: { vendorId: allwin.id, month: '2026-09', adSpendPaise: 1000000, feePaise: 200000, notes: 'September boost' } });
    const originals = async () => J({
      pages: await prisma.campaignPage.findMany({ orderBy: { id: 'asc' } }), campaigns: await prisma.campaign.findMany({ orderBy: { id: 'asc' } }),
      leads: await prisma.campaignLead.findMany({ orderBy: { id: 'asc' } }), records: await prisma.domainCampaignRecord.findMany({ orderBy: { id: 'asc' } }),
    });
    const before = await originals();
    const lines = []; const log = (l) => lines.push(l);

    section('[feat:leadspace.campaign-merge] Dry run writes nothing and tells KSM what would happen');
    let res = await runMigration(prisma, { apply: false }, log);
    ok('the dry run looks at the vendors that have campaign data and only those', res.vendors === 1 && res.results[0].vendorId === allwin.id, J(res));
    ok('it writes nothing at all', (await prisma.leadspaceProfile.count()) === 0 && (await prisma.postJob.count()) === 0 && (await prisma.leadEvent.count()) === 0 && (await prisma.promotionPlan.count()) === 0);
    ok('the dry run says what it would do: the page, the campaigns, the leads, and that DomainCampaign is left alone', lines.some((l) => /will be made as a DRAFT LeadSpace page at \/ls\/goa-diwali/.test(l)) && lines.some((l) => /Campaigns: 2 of 2 to copy/.test(l)) && lines.some((l) => /Campaign leads: 3 of 3 to copy/.test(l)) && lines.some((l) => /DomainCampaign billing records: 1, left exactly where they are/.test(l)), lines.join('\n'));
    ok('the other landing page is named as staying where it is (one LeadSpace page per vendor)', lines.some((l) => /munnar-monsoon/.test(l)));
    ok('a city taken from the address ("Chennai") is not marked as a guess', res.results[0].page.city === 'Chennai' && res.results[0].page.cityGuessed === false, J(res.results[0].page));
    ok('travel has no LeadSpace trade of its own: it starts as the general page and says so', res.results[0].page.category === 'freelancer');

    section('[feat:leadspace.campaign-merge-apply] Apply copies everything and loses nothing');
    lines.length = 0;
    res = await runMigration(prisma, { apply: true }, log);
    ok('one page, two campaigns and three leads were copied', res.results[0].created.profile === true && res.results[0].created.postJobs === 2 && res.results[0].created.leadEvents === 3, J(res.results[0].created));
    ok('EVERY original row is exactly as it was: pages, campaigns, leads and the DomainCampaign record', (await originals()) === before);
    const prof = await prisma.leadspaceProfile.findUnique({ where: { vendorId: allwin.id } });
    ok('the landing page became a DRAFT LeadSpace page with the same address slug, not verified, not indexed', prof.slug === 'goa-diwali' && prof.status === 'DRAFT' && prof.verificationStatus === 'UNVERIFIED' && prof.noindex === true, J(prof));
    ok('its words, picture, map, phone numbers and view count came across', prof.tagline === 'Beach, food and fireworks' && /twelve years/.test(prof.about) && prof.heroImage === 'https://img.example/goa.jpg' && prof.mapsLink === 'https://maps.example/allwin' && prof.phone === '9840011111' && prof.alertWhatsapp === '9840022222' && prof.views === 421 && prof.city === 'Chennai');
    ok('benefits and a testimonial became trust points; photos became the gallery; the catalogue became services with prices', prof.trust.includes('Local guide') && prof.trust.some((t) => /Wonderful trip/.test(t)) && prof.gallery.length === 2 && prof.services.length === 2 && prof.services[0].price === 12999, J(prof.services));
    const jobs = await prisma.postJob.findMany({ where: { vendorId: allwin.id }, orderBy: { createdAt: 'asc' } });
    ok('each campaign is a history entry: the finished one is Posted, the draft stays a draft', jobs.length === 2 && jobs.find((j) => j.content.legacy.campaignId === camp1.id).status === 'POSTED' && jobs.find((j) => j.content.legacy.campaignId === camp2.id).status === 'DRAFT');
    const j1 = jobs.find((j) => j.content.legacy.campaignId === camp1.id);
    ok('the campaign text, channels, cost and results are kept inside the entry', /Goa 3N\/4D|Goa for Diwali/.test(j1.content.caption) && j1.content.legacy.channels.length === 2 && j1.content.legacy.walletCost === 300 && j1.content.legacy.analytics.replies === 14, J(j1.content));
    ok('nothing imported can post by itself: the plan is paused and no entry has an account', (await prisma.promotionPlan.findUnique({ where: { vendorId: allwin.id } })).status === 'PAUSED' && jobs.every((j) => j.accountId === null && j.socialPostId === null));
    const events = await prisma.leadEvent.findMany({ where: { vendorId: allwin.id }, orderBy: { customerName: 'asc' } });
    const ev = (n) => events.find((e) => e.customerName === n);
    ok('each lead is in the Leads tab as an enquiry marked imported, never charged', events.length === 3 && events.every((e) => e.type === 'ENQUIRY' && e.source === 'legacy-campaign' && e.priceChargedPaise === 0 && e.idempotencyKey.startsWith('legacy:') && e.payload.imported === true));
    ok('their status, message, number and original date are kept', ev('Suresh').status === 'DELIVERED' && ev('Anita').status === 'CONTACTED' && ev('Bad Number').status === 'WON' && ev('Suresh').payload.message === 'Need 4 seats for Goa' && ev('Anita').customerPhone === '9876500002' && ev('Suresh').createdAt.toISOString() === '2026-09-25T10:00:00.000Z', J(events.map((e) => [e.customerName, e.status, e.customerPhone])));
    ok('a number that is not a valid mobile is kept as typed, not dropped', ev('Bad Number').customerPhone === '12345');
    ok('a vendor with no campaign data was not touched', (await prisma.leadspaceProfile.count({ where: { vendorId: bystander.id } })) === 0 && (await prisma.postJob.count({ where: { vendorId: bystander.id } })) === 0);
    ok('the apply said what it did, per vendor', lines.some((l) => /made as a DRAFT LeadSpace page/.test(l)) && lines.some((l) => /3 of 3 copied/.test(l)));

    section('[feat:leadspace.campaign-merge-twice] Running it again changes nothing');
    const counts = async () => J([await prisma.leadspaceProfile.count(), await prisma.postJob.count(), await prisma.leadEvent.count(), await prisma.promotionPlan.count()]);
    const c1 = await counts();
    res = await runMigration(prisma, { apply: true }, () => undefined);
    ok('nothing is created the second time', (await counts()) === c1 && res.results[0].created.leadEvents === 0 && res.results[0].created.postJobs === 0 && res.results[0].created.profile === false, J(res.results[0].created));
    ok('and the originals are still untouched', (await originals()) === before);
    ok('a new campaign lead arriving later is picked up by the next run, once', await (async () => {
      await lead('Late Lead', '9876500009', 'new', 'one more');
      const r = await runMigration(prisma, { apply: true }, () => undefined); const r2 = await runMigration(prisma, { apply: true }, () => undefined);
      return r.results[0].created.leadEvents === 1 && r2.results[0].created.leadEvents === 0 && (await prisma.leadEvent.count({ where: { vendorId: allwin.id } })) === 4;
    })());

    section('[feat:leadspace.campaign-merge-vendor] The vendor sees it in the app, can import for themselves, and the old address works');
    let r = await call('GET', '/leadspace/leads', undefined, allwin.token);
    ok('the imported leads are in the vendor\'s Leads tab', r.data.total === 4 && r.data.rows.some((x) => x.customerName === 'Suresh' && x.source === 'legacy-campaign' && !x.held), J(r.data.rows?.[0]));
    r = await call('GET', '/leadspace/page', undefined, allwin.token);
    ok('the Page tab shows the migrated draft with what is left to do', r.data.profile.slug === 'goa-diwali' && r.data.checklist.some((c) => !c.done), J(r.data.checklist));
    ok('the old campaign address still serves until the new page is published (no public page yet)', (await call('GET', '/leadspace/public/page/goa-diwali')).status === 404);
    r = await call('GET', '/leadspace/page/import-legacy', undefined, allwin.token);
    ok('the vendor can see what is waiting to be copied (nothing, it is all done)', r.data.campaigns.toImport === 0 && r.data.leads.toImport === 0 && r.data.page.action === 'HAS_PROFILE', J(r.data));
    const fresh = await h.createVendor({ key: 'fresh', industry: 'travel', plan: 'WORKSPACE' });
    await prisma.campaign.create({ data: { vendorId: fresh.id, name: 'Self serve', status: 'draft', channels: [], content: { whatsapp: 'hello' } } });
    r = await call('GET', '/leadspace/page/import-legacy', undefined, fresh.token);
    ok('a vendor with old campaigns sees them waiting', r.data.campaigns.toImport === 1, J(r.data));
    r = await call('POST', '/leadspace/page/import-legacy', {}, fresh.token);
    ok('and can copy them in one tap; only their own', r.status < 300 && r.data.created.postJobs === 1 && (await prisma.postJob.count({ where: { vendorId: allwin.id } })) === 2, J(r.body));
    await prisma.leadspaceProfile.update({ where: { vendorId: allwin.id }, data: { phone: '9840011111', status: 'PUBLISHED' } });
    ok('once the vendor publishes the new page, it serves at the same slug', (await call('GET', '/leadspace/public/page/goa-diwali')).status === 200);

    section('[feat:leadspace.campaign-merge-rollback] Rollback removes only what the import made');
    const rb = await runMigration(prisma, { apply: false, rollback: true, vendor: 'allwin' }, log);
    ok('a rollback dry run removes nothing', (await prisma.leadEvent.count({ where: { vendorId: allwin.id } })) === 4 && rb.results[0].postJobs === 2 && rb.results[0].leadEvents === 4);
    ok('a page that was published is kept by the rollback, with the reason', rb.results[0].profileRemoved === false && /kept/.test(rb.results[0].profileKept), J(rb.results[0]));
    await prisma.leadspaceProfile.update({ where: { vendorId: allwin.id }, data: { status: 'DRAFT' } });
    await call('POST', '/leadspace/public/otp', { slug: 'goa-diwali', phone: '9811111111', consent: true });
    const rb2 = await runMigration(prisma, { apply: true, rollback: true, vendor: 'allwin' }, log);
    ok('a draft that nobody used is removed with the imported history and leads', rb2.results[0].profileRemoved === true && (await prisma.leadspaceProfile.count({ where: { vendorId: allwin.id } })) === 0 && (await prisma.postJob.count({ where: { vendorId: allwin.id } })) === 0 && (await prisma.leadEvent.count({ where: { vendorId: allwin.id } })) === 0, J(rb2.results[0]));
    ok('and the originals are still exactly there', (await originals()).includes('Goa for Diwali') && (await prisma.campaignLead.count({ where: { vendorId: allwin.id } })) === 4 && (await prisma.domainCampaignRecord.count({ where: { id: rec.id } })) === 1 && (await prisma.campaign.count({ where: { vendorId: allwin.id } })) === 2);
    ok('an unknown vendor is reported in plain words', await (async () => { const out = []; await runMigration(prisma, { vendor: 'nobody-here' }, (l) => out.push(l)); return /No vendor/.test(out.join()); })());

    section('[feat:leadspace.campaign-merge-registry] The registry, the old addresses and the labels');
    const reg = h.dist('registry/registry.generated');
    ok('Campaigns is no longer a feature; LeadSpace is, under Marketing and Growth', !reg.FEATURES.some((f) => f.id === 'marketing.campaigns') && reg.FEATURES.find((f) => f.id === 'marketing.leadspace').department === 'marketing');
    ok('the old dashboard addresses redirect to LeadSpace tabs', reg.resolveLegacyRoute(reg.FEATURES, '/dashboard/campaigns') === '/dashboard/marketing/leadspace?tab=promote' && reg.resolveLegacyRoute(reg.FEATURES, '/dashboard/landing-page') === '/dashboard/marketing/leadspace?tab=page' && reg.resolveLegacyRoute(reg.FEATURES, '/dashboard/leadspace') === '/dashboard/marketing/leadspace');
    ok('the AI credit wallet is unchanged by all of this: the same table, no LeadSpace write to it', (await prisma.walletTransaction.count()) === 0 && (await prisma.wallet.count({ where: { vendorId: allwin.id } })) <= 1);
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
void path;
