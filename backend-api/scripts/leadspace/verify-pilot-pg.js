// Pilot readiness on REAL Postgres (PGlite): the onboarding script for ten pilot vendors, the test-campaign kit with UTM links, and the sheet that lists spend,
// verified leads and cost per verified lead per campaign.
// Needs `npx nest build` first and PGlite (SKIPs cleanly when it is not installed).
const { startHarness, available } = require('../e2e/bos-harness');
const { onboard } = require('../leadspace-onboard-lib');
const { buildKit } = require('../leadspace-test-campaign-kit');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - pilot proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3089, pgPort: 54341 });
  const { prisma, call } = h;
  const gateway = h.svc('WhatsappGatewayService', 'messaging/whatsapp/whatsapp-gateway.service');
  const sandbox = gateway.getProvider();
  let code = 0;
  try {
    const admin = await h.createAdmin({ key: 'padm' });
    const A = admin.token;
    await call('PUT', '/admin/leadspace/settings/otpPerIpPerHour', { value: 100000 }, A);

    section('[feat:leadspace.pilot] Ten pilot vendors from one list');
    const pilots = [
      { name: 'Ravi K', email: 'ravi@pilot.test', phone: '9840011111', businessName: 'Ravi Plumbing', category: 'home-services', city: 'Chennai', services: [{ name: 'Tap repair', price: 350 }] },
      { name: 'Meena S', email: 'meena@pilot.test', phone: '9840022222', businessName: 'Meena Beauty', category: 'salon-beauty', city: 'Chennai' },
      { name: 'Bad Entry', email: 'not-an-email', phone: '123', businessName: 'X', category: 'spaceships', city: '' },
    ];
    const logs = [];
    let res = await onboard(prisma, pilots, false, (l) => logs.push(l));
    ok('the dry run writes nothing', (await prisma.vendor.count({ where: { email: { endsWith: '@pilot.test' } } })) === 0 && (await prisma.leadspaceProfile.count()) === 0);
    ok('it checks every entry and says in plain words what is wrong with the bad one', res[2].problems.length >= 4 && res[2].problems.some((p) => /category must be one of/.test(p)) && logs.some((l) => /e-mail is not valid/.test(l)), J(res[2].problems));
    ok('it prints the checklist of what only the vendor can do', res[0].checklist.length === 5 && logs.some((l) => /first refill/.test(l)));
    res = await onboard(prisma, pilots, true, () => undefined);
    ok('the apply creates the two good vendors and skips the bad one', res[0].status === 'CREATED' && res[1].status === 'CREATED' && res[2].status === 'SKIPPED', J(res.map((r) => r.status)));
    const rv = await prisma.vendor.findUnique({ where: { email: 'ravi@pilot.test' } });
    ok('each vendor is in LeadSpace-only mode with a draft page generated from their details', (await prisma.vendorAddon.count({ where: { vendorId: rv.id, enabled: true, addonKey: { in: ['leadspace', 'leadspace_only'] } } })) === 2 && (await prisma.leadspaceProfile.findUnique({ where: { vendorId: rv.id } })).status === 'DRAFT');
    const pr = await prisma.leadspaceProfile.findUnique({ where: { vendorId: rv.id } });
    ok('the alert number is their mobile, the page is not live and not verified, promotion is an inactive plan', pr.alertWhatsapp === '9840011111' && pr.verificationStatus === 'UNVERIFIED' && (await prisma.promotionPlan.findUnique({ where: { vendorId: rv.id } })).status === 'DRAFT');
    ok('they get a temporary password that works', await (async () => { const r = await call('POST', '/auth/login', { email: 'ravi@pilot.test', password: res[0].tempPassword }); return r.status < 300 && Boolean(r.data.accessToken); })());
    const again = await onboard(prisma, pilots, true, () => undefined);
    ok('running it again creates nothing twice', again[0].status === 'UPDATED' && (await prisma.vendor.count({ where: { email: 'ravi@pilot.test' } })) === 1 && (await prisma.leadspaceProfile.count({ where: { vendorId: rv.id } })) === 1);
    const login = await call('POST', '/auth/login', { email: 'ravi@pilot.test', password: res[0].tempPassword });
    const vr = await call('POST', '/leadspace/page/verify-phone/request', { phone: '9840011111' }, login.data.accessToken);
    const conf = await call('POST', '/leadspace/page/verify-phone/confirm', { phone: '9840011111', otpId: vr.data.otpId, code: sandbox.lastTo('9840011111').variables[0] }, login.data.accessToken);
    const pub = await call('POST', '/leadspace/page/publish', undefined, login.data.accessToken);
    ok('the vendor can then verify their number and publish, as the checklist says', conf.status < 300 && pub.data.status === 'PUBLISHED' && pub.data.verificationStatus === 'VERIFIED', J(pub.body));

    section('[feat:leadspace.test-kit] One test page per trade, UTM links and the sheet');
    const lines = [];
    let kit = await buildKit(prisma, { city: 'Chennai', phone: '9840099999', apply: false }, (l) => lines.push(l));
    ok('the dry run lists all twelve trades with their UTM campaign names and writes nothing', kit.length === 12 && kit[0].campaign.endsWith('-chennai-' + new Date().toISOString().slice(0, 7).replace('-', '')) && (await prisma.vendor.count({ where: { email: { startsWith: 'test-' } } })) === 0, J(kit[0]));
    ok('the link carries source, medium, campaign and content', /utm_source=meta&utm_medium=paid&utm_campaign=home-services-chennai-\d{6}&utm_content=1/.test(kit[0].link), kit[0].link);
    kit = await buildKit(prisma, { city: 'Chennai', phone: '9840099999', apply: true, publish: true }, () => undefined);
    ok('the apply makes twelve internal test vendors, each with a published page', (await prisma.leadspaceProfile.count({ where: { businessName: { startsWith: 'Test ' }, status: 'PUBLISHED' } })) === 12);
    const real = kit.find((k) => k.trade === 'home-services');
    ok('the link points at the real page address', /\/ls\/test-home-services-chennai/.test(real.link), real.link);

    // a test ad produces a lead with the UTM, and a boost is recorded with the campaign in the note
    await call('POST', '/admin/leadspace/prices', { eventType: 'BOOKING', pricePaise: 20000 }, A);
    const slug = real.link.split('/ls/')[1].split('?')[0];
    const phone = '9811222333';
    const o = await call('POST', '/leadspace/public/otp', { slug, phone, consent: true });
    const ev = await call('POST', '/leadspace/public/event', { slug, name: 'Ad Visitor', phone, payload: { service: 'Home Services service', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: '9 am - 12 pm' }, otpId: o.data.otpId, code: sandbox.lastTo(phone).variables[0], utm: { utm_source: 'meta', utm_medium: 'paid', utm_campaign: real.campaign, utm_content: '1' } });
    ok('the lead is captured (held: the test vendor has no wallet) with its UTM stored', ev.status < 300 && (await prisma.leadEvent.findUnique({ where: { id: ev.data.eventId } })).utm.utm_campaign === real.campaign);
    const today = new Date().toISOString().slice(0, 10);
    await call('POST', '/admin/leadspace/ad-spend', { date: today, channel: 'FACEBOOK_BOOST', amountPaise: 50000, note: `boost 1 ${real.campaign}` }, A);
    await call('POST', '/admin/leadspace/ad-spend', { date: today, channel: 'GOOGLE', amountPaise: 30000, note: 'tutor-chennai-202610 search ads' }, A);
    let sheet = await call('GET', '/admin/leadspace/test-campaign-sheet', undefined, A);
    const row = sheet.data.rows.find((r) => r.campaign === real.campaign);
    ok('the sheet shows the campaign: one verified lead, Rs 500 spent, Rs 500 per verified lead', row && row.verifiedEvents === 1 && row.held === 1 && row.spendPaise === 50000 && row.costPerVerifiedLeadPaise === 50000 && row.sources.includes('meta'), J(sheet.data.rows));
    ok('a campaign with spend and no leads yet still gets a row (so a wasted boost is visible)', sheet.data.rows.some((r) => r.campaign === 'tutor-chennai-202610' && r.spendPaise === 30000 && r.verifiedEvents === 0));
    const csv = await call('GET', '/admin/leadspace/test-campaign-sheet.csv', undefined, A);
    ok('the same sheet downloads as a CSV file', csv.status === 200 && csv.text.startsWith('Campaign,Sources,Verified leads') && csv.text.includes(real.campaign), csv.text.slice(0, 200));
    ok('a vendor cannot read the sheet', (await call('GET', '/admin/leadspace/test-campaign-sheet', undefined, login.data.accessToken)).status === 403);
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
