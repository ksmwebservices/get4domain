// LeadSpace capture engine on REAL Postgres (PGlite) through the REAL NestJS API: OTP + consent, the verified-event charge, hold and release,
// idempotency, dedupe and auto credit, disputes, refunds, and the common WhatsApp number rules.
// Needs `npx nest build` first and PGlite (SKIPs cleanly when it is not installed).
const crypto = require('crypto');
const { startHarness, available } = require('../e2e/bos-harness');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

let phoneSeq = 0;
const nextPhone = () => `9${String(100000000 + (phoneSeq += 7919)).padStart(9, '0')}`.slice(0, 10);

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - LeadSpace real-Postgres proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3096, pgPort: 54332 });
  const { prisma, call } = h;
  const purse = h.svc('LeadPurseService', 'leadspace/purse.service');
  const gateway = h.svc('WhatsappGatewayService', 'messaging/whatsapp/whatsapp-gateway.service');
  const captureSvc = h.svc('LeadCaptureService', 'leadspace/capture.service');
  const { CloudApiWhatsappProvider } = h.dist('messaging/whatsapp/cloud-api.provider');
  const sandbox = gateway.getProvider();
  let code = 0;
  try {
    const admin = await h.createAdmin({ key: 'lsadmin' });
    const A = admin.token;
    const shop = await h.createVendor({ key: 'lsshop', industry: 'retail', plan: 'WORKSPACE' });
    const V = shop.token;
    const other = await h.createVendor({ key: 'lsother', industry: 'retail', plan: 'WORKSPACE' });
    const profile = await prisma.leadspaceProfile.create({ data: { vendorId: shop.id, slug: 'lsshop-chennai', category: 'home-services', city: 'Chennai', goal: 'ENQUIRY', businessName: 'LS Shop', phone: '9000000000', status: 'PUBLISHED', verificationStatus: 'VERIFIED', noindex: false } });
    await prisma.leadspaceProfile.create({ data: { vendorId: other.id, slug: 'lsother-madurai', category: 'home-services', city: 'Madurai', goal: 'ENQUIRY', businessName: 'LS Other', phone: '9000000001', status: 'PUBLISHED' } });

    const fund = (vendorId, paise, key) => prisma.$transaction((tx) => purse.credit(tx, { vendorId, amountPaise: paise, reason: 'REFILL', idempotencyKey: key }));
    const otpFor = async (phone, slug = profile.slug) => {
      const r = await call('POST', '/leadspace/public/otp', { slug, phone, consent: true });
      if (r.status >= 300) return { r };
      const msg = sandbox.lastTo(phone);
      return { r, otpId: r.data.otpId, code: msg?.variables?.[0] };
    };
    /** a full customer journey: ask for a code, read it from the sandbox outbox, send the event */
    const lead = async (phone = nextPhone(), over = {}, slug = profile.slug) => {
      const o = await otpFor(phone, slug);
      if (!o.otpId) return { status: o.r.status, body: o.r.body, otp: o };
      const r = await call('POST', '/leadspace/public/event', { slug, name: 'Test Customer', phone, payload: { message: 'Need a plumber today' }, otpId: o.otpId, code: o.code, ...over });
      return { ...r, phone, otp: o };
    };
    const balance = async (id = shop.id) => purse.balance(id);

    section('[feat:leadspace.pricing] Prices are admin data and versioned');
    let r = await call('POST', '/admin/leadspace/prices', { eventType: 'ENQUIRY', pricePaise: 15000 }, A);
    ok('admin sets a global enquiry price', r.status < 300 && r.data.pricePaise === 15000, J(r.body));
    r = await call('POST', '/admin/leadspace/prices', { eventType: 'ENQUIRY', category: 'home-services', city: 'Chennai', pricePaise: 20000 }, A);
    ok('admin sets a city and trade price', r.status < 300, J(r.body));
    r = await call('POST', '/admin/leadspace/prices', { eventType: 'ENQUIRY', category: 'home-services', city: 'Chennai', pricePaise: 25000, note: 'busy season' }, A);
    const rules = (await call('GET', '/admin/leadspace/prices', undefined, A)).data;
    const chennai = rules.filter((x) => x.city === 'Chennai' && x.eventType === 'ENQUIRY');
    ok('changing a price keeps the old row (ended) and adds a new one', chennai.length === 2 && chennai.filter((x) => !x.effectiveTo).length === 1 && chennai.find((x) => !x.effectiveTo).pricePaise === 25000, J(chennai));
    ok('a vendor is refused on the admin price route', (await call('POST', '/admin/leadspace/prices', { eventType: 'ENQUIRY', pricePaise: 1 }, V)).status === 403);
    ok('a negative or silly price is refused', (await call('POST', '/admin/leadspace/prices', { eventType: 'ENQUIRY', pricePaise: -5 }, A)).status === 400);
    r = await call('GET', '/leadspace/wallet', undefined, V);
    ok('the vendor wallet shows the price for their own trade and city', r.data.prices.ENQUIRY === 25000, J(r.data.prices));
    r = await call('GET', '/leadspace/wallet', undefined, other.token);
    ok('another city falls back to the global price', r.data.prices.ENQUIRY === 15000, J(r.data.prices));
    await call('POST', '/admin/leadspace/prices', { eventType: 'ENQUIRY', category: 'home-services', city: 'Chennai', pricePaise: 15000 }, A);
    await call('PUT', '/admin/leadspace/settings/otpPerIpPerHour', { value: 100000 }, A);
    await call('PUT', '/admin/leadspace/settings/vendorSpamOtpPerDay', { value: 100000 }, A);
    ok('settings reject a value of the wrong kind', (await call('PUT', '/admin/leadspace/settings/dedupeWindowHours', { value: 'soon' }, A)).status === 400);
    ok('settings reject a name that does not exist', (await call('PUT', '/admin/leadspace/settings/nonsense', { value: 1 }, A)).status === 400);

    section('[feat:leadspace.otp] Consent, one-time code and its limits');
    r = await call('POST', '/leadspace/public/otp', { slug: profile.slug, phone: nextPhone(), consent: false });
    ok('no code is sent without consent', r.status === 400, J(r.body));
    r = await call('POST', '/leadspace/public/otp', { slug: profile.slug, phone: '12345', consent: true });
    ok('a bad number is refused with a plain sentence', r.status === 400 && /10-digit/.test(r.body.message), J(r.body));
    const p1 = nextPhone();
    const o1 = await otpFor(p1);
    ok('a code is sent from the common number through the provider layer', o1.r.status < 300 && /^\d{6}$/.test(o1.code ?? '') && sandbox.lastTo(p1).template === 'leadspace_otp', J(o1.r.body));
    const stored = await prisma.leadOtp.findUnique({ where: { id: o1.otpId } });
    ok('only a hash of the code is stored', stored.codeHash.length === 64 && !J(stored).includes(o1.code));
    ok('consent is recorded with the text version', (await prisma.consentRecord.count({ where: { id: stored.consentId, textVersion: 'ls-consent-v1' } })) === 1);
    const log1 = await prisma.whatsappMessageLog.findFirst({ where: { template: 'leadspace_otp' }, orderBy: { createdAt: 'desc' } });
    ok('the send is logged against the vendor with the number masked', log1.vendorId === shop.id && log1.toMasked.includes('xxxxx') && !log1.toMasked.includes(p1));
    r = await call('POST', '/leadspace/public/event', { slug: profile.slug, name: 'Wrong Code', phone: p1, payload: { message: 'hello there' }, otpId: o1.otpId, code: '000000' });
    ok('a wrong code is refused and counted', r.status === 400 && (await prisma.leadOtp.findUnique({ where: { id: o1.otpId } })).attempts === 1, J(r.body));
    for (let i = 0; i < 5; i++) await call('POST', '/leadspace/public/event', { slug: profile.slug, name: 'Guess', phone: p1, payload: { message: 'hello there' }, otpId: o1.otpId, code: '111111' });
    r = await call('POST', '/leadspace/public/event', { slug: profile.slug, name: 'Right Code', phone: p1, payload: { message: 'hello there' }, otpId: o1.otpId, code: o1.code });
    ok('after too many wrong attempts even the right code is refused', r.status === 400, J(r.body));
    const p2 = nextPhone();
    for (let i = 0; i < 3; i++) await otpFor(p2);
    r = await call('POST', '/leadspace/public/otp', { slug: profile.slug, phone: p2, consent: true });
    ok('a fourth code for one number inside an hour is refused (limit per phone)', r.status === 429, J(r.body));
    const dev = 'device-abc';
    let lastDev;
    for (let i = 0; i < 9; i++) lastDev = await call('POST', '/leadspace/public/otp', { slug: profile.slug, phone: nextPhone(), consent: true, deviceId: dev });
    ok('the ninth code from one device inside an hour is refused (limit per device)', lastDev.status === 429, J(lastDev.body));
    const pb = nextPhone();
    await call('POST', '/admin/leadspace/blocked-phones', { phone: pb, reason: 'spam' }, A);
    r = await call('POST', '/leadspace/public/otp', { slug: profile.slug, phone: pb, consent: true });
    ok('no code is ever sent to a blocked number', r.status === 400 && !sandbox.lastTo(pb), J(r.body));
    r = await call('POST', '/leadspace/public/otp', { slug: 'no-such-page', phone: nextPhone(), consent: true });
    ok('a page that does not exist is a plain 404', r.status === 404, J(r.body));
    const p3 = nextPhone();
    const o3 = await otpFor(p3);
    await prisma.leadOtp.update({ where: { id: o3.otpId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    r = await call('POST', '/leadspace/public/event', { slug: profile.slug, name: 'Late', phone: p3, payload: { message: 'hello there' }, otpId: o3.otpId, code: o3.code });
    ok('an expired code is refused', r.status === 400, J(r.body));

    section('[feat:leadspace.capture] Verified event: charge in one transaction, price quoted at capture');
    await fund(shop.id, 30000, 'test-fund-1');
    const before = await balance();
    r = await lead();
    ok('a verified enquiry is captured and the customer sees a thank-you', r.status < 300 && /Thank you/.test(r.data?.message ?? ''), J(r.body));
    const ev1 = await prisma.leadEvent.findUnique({ where: { id: r.data.eventId } });
    ok('it is DELIVERED and charged the price in force (Rs 150)', ev1.status === 'DELIVERED' && ev1.priceChargedPaise === 15000 && ev1.priceQuotedPaise === 15000, J(ev1));
    ok('the wallet dropped by exactly the price', (await balance()) === before - 15000);
    const ledger = await prisma.leadPurseEntry.findFirst({ where: { idempotencyKey: `lead:${ev1.id}` } });
    ok('the ledger row carries the running balance and links the lead', ledger?.type === 'DEBIT' && ledger.balanceAfter === before - 15000 && ev1.ledgerId === ledger.id && ledger.refId === ev1.id);
    r = await call('POST', '/admin/leadspace/prices', { eventType: 'ENQUIRY', category: 'home-services', city: 'Chennai', pricePaise: 99900 }, A);
    ok('a later price change does not touch an earlier lead', (await prisma.leadEvent.findUnique({ where: { id: ev1.id } })).priceChargedPaise === 15000);
    await call('POST', '/admin/leadspace/prices', { eventType: 'ENQUIRY', category: 'home-services', city: 'Chennai', pricePaise: 15000 }, A);

    // idempotency
    const pi = nextPhone();
    const oi = await otpFor(pi);
    const bodyI = { slug: profile.slug, name: 'Idem Customer', phone: pi, payload: { message: 'idempotent please' }, otpId: oi.otpId, code: oi.code, idempotencyKey: 'idem-key-1' };
    const b0 = await balance();
    const first = await call('POST', '/leadspace/public/event', bodyI);
    const again = await call('POST', '/leadspace/public/event', bodyI);
    ok('sending the same event twice (a double tap) gives the same lead and one charge', first.data.eventId === again.data.eventId && again.data.replayed === true && (await balance()) === b0 - 15000, J(again.body));
    // dedupe
    const b1 = await balance();
    const dup = await lead(pi);
    ok('the same customer asking again inside the dedupe window is one lead, not charged twice', dup.status < 300 && dup.data.replayed === true && (await balance()) === b1 && (await prisma.leadEvent.count({ where: { vendorId: shop.id, customerPhone: pi } })) === 1, J(dup.body));
    // auto credit window
    await prisma.leadEvent.updateMany({ where: { vendorId: shop.id, customerPhone: pi }, data: { createdAt: new Date(Date.now() - 20 * 3_600_000) } });
    const b2 = await balance();
    const rep = await lead(pi);
    const repEv = await prisma.leadEvent.findUnique({ where: { id: rep.data.eventId } });
    ok('a repeat after the dedupe window but inside 48h is captured, not charged and credited automatically', repEv.status === 'CREDITED' && repEv.priceChargedPaise === 0 && (await balance()) === b2, J(repEv));
    ok('the automatic credit is recorded as a duplicate decided by AUTO', (await prisma.invalidLeadCredit.count({ where: { leadId: repEv.id, reason: 'DUPLICATE', decidedBy: 'AUTO' } })) === 1);
    // vendor own number
    const b3 = await balance();
    const own = await lead('9000000000');
    const ownEv = await prisma.leadEvent.findUnique({ where: { id: own.data.eventId } });
    ok('the vendor testing with their own number is never charged', ownEv.status === 'CREDITED' && (await balance()) === b3 && (await prisma.invalidLeadCredit.count({ where: { leadId: ownEv.id, reason: 'VENDOR_OWN' } })) === 1, J(ownEv));
    // payload validation
    r = await lead(nextPhone(), { payload: { message: '' } });
    ok('an enquiry without a message is refused in plain words', r.status === 400 && /message/i.test(r.body.message), J(r.body));
    r = await lead(nextPhone(), { type: 'BOOKING', payload: { date: '2030-01-01' } });
    ok('a page cannot take a kind of request it does not offer', r.status === 400, J(r.body));
    const injected = await lead(nextPhone(), { name: '<script>alert(1)</script>Ravi', payload: { message: 'a <b>bold</b> request' } });
    const injEv = await prisma.leadEvent.findUnique({ where: { id: injected.data?.eventId ?? '' } });
    ok('angle brackets are stripped from what customers type', injEv && !/[<>]/.test(injEv.customerName) && !/[<>]/.test(J(injEv.payload)), J(injEv));

    section('[feat:leadspace.hold-release] A low wallet never pauses the page: hold, then release oldest first');
    const holdVendor = await h.createVendor({ key: 'lshold', industry: 'retail', plan: 'WORKSPACE' });
    const hp = await prisma.leadspaceProfile.create({ data: { vendorId: holdVendor.id, slug: 'lshold-chennai', category: 'home-services', city: 'Chennai', goal: 'ENQUIRY', businessName: 'Hold Shop', phone: '9222222222', status: 'PUBLISHED' } });
    const heldIds = [];
    for (let i = 0; i < 3; i++) {
      const x = await lead(nextPhone(), { name: `Waiting ${i}` }, hp.slug);
      ok(`customer ${i + 1} gets the same thank-you with an empty wallet (page is not paused)`, x.status < 300 && /Thank you/.test(x.data?.message ?? ''), J(x.body));
      heldIds.push(x.data.eventId);
      await new Promise((res) => setTimeout(res, 15));
    }
    const heldRows = await prisma.leadEvent.findMany({ where: { vendorId: holdVendor.id }, orderBy: { createdAt: 'asc' } });
    ok('all three are HELD, not charged, quoted at the price of the day', heldRows.every((e) => e.status === 'HELD' && e.priceChargedPaise === 0 && e.priceQuotedPaise === 15000));
    r = await call('GET', '/leadspace/leads?status=HELD', undefined, holdVendor.token);
    ok('the vendor sees a count and a masked contact only for held customers', r.data.total === 3 && r.data.rows.every((x) => x.held && x.customerName === 'Waiting customer' && /xxxxx/.test(x.customerPhone) && x.payload === null), J(r.data.rows[0]));
    r = await call('GET', '/leadspace/leads?search=Waiting', undefined, holdVendor.token);
    ok('searching cannot reveal a held customer', r.data.total === 0, J(r.data));
    r = await call('PUT', `/leadspace/leads/${heldIds[0]}/status`, { status: 'CONTACTED' }, holdVendor.token);
    ok('a held lead cannot be worked until released', r.status === 400, J(r.body));
    r = await call('GET', '/leadspace/summary', undefined, holdVendor.token);
    ok('the Home numbers count the held customers', r.data.held === 3, J(r.data));
    await fund(holdVendor.id, 30000, 'hold-fund-1');
    r = await call('POST', '/leadspace/wallet/release', {}, holdVendor.token);
    ok('a refill of Rs 300 releases exactly two customers, debiting at release', r.data.released === 2 && r.data.stillHeld === 1 && r.data.balancePaise === 0, J(r.body));
    const after = await prisma.leadEvent.findMany({ where: { vendorId: holdVendor.id }, orderBy: { createdAt: 'asc' } });
    ok('the OLDEST two were released and the newest is still held', after[0].status === 'DELIVERED' && after[1].status === 'DELIVERED' && after[2].status === 'HELD' && after[0].priceChargedPaise === 15000 && after[2].priceChargedPaise === 0, J(after.map((e) => e.status)));
    ok('each release left a ledger row with its own key', (await prisma.leadPurseEntry.count({ where: { vendorId: holdVendor.id, reason: 'LEAD_CHARGE' } })) === 2);
    r = await call('POST', '/leadspace/wallet/release', {}, holdVendor.token);
    ok('releasing again with no money changes nothing (no double charge)', r.data.released === 0 && r.data.stillHeld === 1 && (await balance(holdVendor.id)) === 0, J(r.body));
    r = await call('GET', `/leadspace/leads?status=DELIVERED`, undefined, holdVendor.token);
    ok('released customers show their real name and number', r.data.rows.length === 2 && r.data.rows.every((x) => !x.held && x.customerName.startsWith('Waiting ') && /^\d{10}$/.test(x.customerPhone)), J(r.data.rows[0]));
    r = await call('PUT', '/leadspace/wallet/low-balance-mode', { mode: 'REJECT' }, holdVendor.token);
    const rej = await lead(nextPhone(), {}, hp.slug);
    ok('with the vendor\'s choice set to REJECT the customer gets a polite message and nothing is stored', rej.status === 503 && /contact them directly/.test(rej.body.message) && (await prisma.leadEvent.count({ where: { vendorId: holdVendor.id } })) === 3, J(rej.body));
    await call('PUT', '/leadspace/wallet/low-balance-mode', { mode: 'HOLD' }, holdVendor.token);

    section('[feat:leadspace.atomic] Two events racing for the last rupees cannot both be charged');
    const raceVendor = await h.createVendor({ key: 'lsrace', industry: 'retail', plan: 'WORKSPACE' });
    const rp = await prisma.leadspaceProfile.create({ data: { vendorId: raceVendor.id, slug: 'lsrace-chennai', category: 'home-services', city: 'Chennai', goal: 'ENQUIRY', businessName: 'Race Shop', phone: '9333333333', status: 'PUBLISHED' } });
    await fund(raceVendor.id, 15000, 'race-fund-1');
    const prepared = [];
    for (let i = 0; i < 6; i++) { const ph = nextPhone(); const o = await otpFor(ph, rp.slug); prepared.push({ ph, o }); }
    const results = await Promise.all(prepared.map(({ ph, o }) => call('POST', '/leadspace/public/event', { slug: rp.slug, name: 'Racer', phone: ph, payload: { message: 'race condition' }, otpId: o.otpId, code: o.code })));
    const evs = await prisma.leadEvent.findMany({ where: { vendorId: raceVendor.id } });
    ok('all six customers got a thank-you', results.every((x) => x.status < 300), J(results.map((x) => x.status)));
    ok('exactly one was charged (Rs 150 was all there was) and five are held', evs.filter((e) => e.status === 'DELIVERED').length === 1 && evs.filter((e) => e.status === 'HELD').length === 5, J(evs.map((e) => e.status)));
    ok('the balance is exactly zero, never negative, with one debit row', (await balance(raceVendor.id)) === 0 && (await prisma.leadPurseEntry.count({ where: { vendorId: raceVendor.id, type: 'DEBIT' } })) === 1);
    const sameCode = prepared[0];
    ok('a used code cannot be used a second time', (await call('POST', '/leadspace/public/event', { slug: rp.slug, name: 'Racer', phone: sameCode.ph, payload: { message: 'again' }, otpId: sameCode.o.otpId, code: sameCode.o.code, idempotencyKey: 'other-key' })).status === 400);
    ok('the purse cannot be debited below zero by the service itself', await (async () => { const d = await prisma.$transaction((tx) => purse.debit(tx, { vendorId: raceVendor.id, amountPaise: 1, reason: 'ADJUSTMENT', idempotencyKey: 'neg-1' })); return d.ok === false; })());
    ok('a credit with the same idempotency key is applied once', await (async () => { await fund(raceVendor.id, 500, 'dup-credit'); await fund(raceVendor.id, 500, 'dup-credit'); return (await balance(raceVendor.id)) === 500; })());

    section('[feat:leadspace.orders] Cart orders: items, delivery details, confirm or decline, no payment');
    const cartVendor = await h.createVendor({ key: 'lscart', industry: 'retail', plan: 'WORKSPACE' });
    const cp = await prisma.leadspaceProfile.create({ data: { vendorId: cartVendor.id, slug: 'lscart-chennai', category: 'shop-retail', city: 'Chennai', goal: 'CART_ORDER', businessName: 'Cart Shop', phone: '9444444444', status: 'PUBLISHED' } });
    await call('POST', '/admin/leadspace/prices', { eventType: 'CART_ORDER', pricePaise: 5000 }, A);
    await fund(cartVendor.id, 20000, 'cart-fund');
    r = await lead(nextPhone(), { payload: { items: [], address: 'x' } }, cp.slug);
    ok('an order with no items is refused in plain words', r.status === 400 && /item/i.test(r.body.message), J(r.body));
    r = await lead(nextPhone(), { payload: { items: [{ name: 'Cake', qty: 0 }], address: '12 Main Road' } }, cp.slug);
    ok('a quantity of zero is refused', r.status === 400, J(r.body));
    const orderPhone = nextPhone();
    r = await lead(orderPhone, { payload: { items: [{ name: 'Black forest cake', qty: 2, pricePaise: 45000 }, { name: 'Brownie', qty: 4 }], address: '12 Main Road, Adyar', notes: 'Ring the bell' } }, cp.slug);
    const order = r.data && (await prisma.leadEvent.findUnique({ where: { id: r.data.eventId } }));
    ok('a verified order is captured, charged the order price, and awaits the vendor', r.status < 300 && order.type === 'CART_ORDER' && order.status === 'DELIVERED' && order.priceChargedPaise === 5000 && order.orderDecision === 'PENDING', J(r.body));
    r = await call('PUT', `/leadspace/leads/${order.id}/order`, { decision: 'CONFIRMED' }, cartVendor.token);
    ok('the vendor confirms the order', r.status < 300 && r.data.orderDecision === 'CONFIRMED', J(r.body));
    const o2 = await lead(nextPhone(), { payload: { items: [{ name: 'Brownie', qty: 1 }], address: '5 Beach Road' } }, cp.slug);
    r = await call('PUT', `/leadspace/leads/${o2.data.eventId}/order`, { decision: 'DECLINED', note: 'out of stock' }, cartVendor.token);
    ok('the vendor declines an order', r.status < 300 && r.data.orderDecision === 'DECLINED', J(r.body));
    const o3b = await lead(orderPhone, { payload: { items: [{ name: 'Brownie', qty: 1 }], address: '5 Beach Road' } }, cp.slug);
    ok('the same customer can place a different order the same day', o3b.status < 300 && o3b.data.replayed === false, J(o3b.body));
    r = await call('PUT', `/leadspace/leads/${order.id}/order`, { decision: 'CONFIRMED' }, other.token);
    ok('another vendor cannot decide this order', r.status === 404, J(r.body));
    r = await call('GET', '/leadspace/leads/export.csv', undefined, cartVendor.token);
    ok('the CSV export holds delivered leads with their numbers', r.status === 200 && /Black forest cake/.test(r.text) && /Date,Type,Name,Phone/.test(r.text));

    section('[feat:leadspace.credits] Invalid-lead disputes, admin decisions and refunds all live in the ledger');
    const disputeVendor = shop;
    await fund(shop.id, 60000, 'credits-fund');
    const dl = await lead();
    const dEv = await prisma.leadEvent.findUnique({ where: { id: dl.data.eventId } });
    r = await call('POST', `/leadspace/leads/${dEv.id}/dispute`, { reason: 'WRONG_NUMBER', note: 'rings but nobody knows this name' }, disputeVendor.token);
    ok('a vendor disputes a delivered lead with a reason', r.status < 300 && r.data.status === 'OPEN', J(r.body));
    ok('the lead shows as DISPUTED', (await prisma.leadEvent.findUnique({ where: { id: dEv.id } })).status === 'DISPUTED');
    r = await call('POST', `/leadspace/leads/${dEv.id}/dispute`, { reason: 'SPAM' }, disputeVendor.token);
    ok('the same lead cannot be disputed twice', r.status === 400, J(r.body));
    r = await call('POST', `/leadspace/leads/${dEv.id}/dispute`, { reason: 'SPAM' }, other.token);
    ok('another vendor cannot dispute this lead', r.status === 404, J(r.body));
    r = await call('GET', '/admin/leadspace/disputes', undefined, A);
    const dq = r.data.find((x) => x.leadId === dEv.id);
    ok('the admin sees it in the queue', Boolean(dq), J(r.body));
    const bal0 = await balance();
    r = await call('PUT', `/admin/leadspace/disputes/${dq.id}`, { decision: 'CREDIT', note: 'confirmed wrong number' }, A);
    ok('the admin credits it', r.status < 300 && r.data.status === 'CREDITED', J(r.body));
    ok('the wallet got the price back through a CREDIT_INVALID ledger row', (await balance()) === bal0 + 15000 && (await prisma.leadPurseEntry.count({ where: { vendorId: shop.id, reason: 'CREDIT_INVALID', refId: dEv.id } })) === 1);
    ok('an InvalidLeadCredit record says ADMIN decided and how much', (await prisma.invalidLeadCredit.count({ where: { leadId: dEv.id, decidedBy: 'ADMIN', amountPaise: 15000 } })) === 1);
    r = await call('PUT', `/admin/leadspace/disputes/${dq.id}`, { decision: 'CREDIT' }, A);
    ok('deciding twice is refused and credits nothing more', r.status === 400 && (await balance()) === bal0 + 15000, J(r.body));
    const dl2 = await lead();
    const d2 = await call('POST', `/leadspace/leads/${dl2.data.eventId}/dispute`, { reason: 'OTHER' }, shop.token);
    r = await call('PUT', `/admin/leadspace/disputes/${d2.data.id}`, { decision: 'REJECT', note: 'number is fine' }, A);
    ok('a rejected dispute puts the lead back to Delivered and credits nothing', r.data.status === 'REJECTED' && (await prisma.leadEvent.findUnique({ where: { id: dl2.data.eventId } })).status === 'DELIVERED');
    const dl3 = await lead();
    await prisma.leadEvent.update({ where: { id: dl3.data.eventId }, data: { deliveredAt: new Date(Date.now() - 49 * 3_600_000) } });
    r = await call('POST', `/leadspace/leads/${dl3.data.eventId}/dispute`, { reason: 'SPAM' }, shop.token);
    ok('after the dispute window a lead can no longer be disputed', r.status === 400 && /window/.test(r.body.message), J(r.body));
    // refunds
    await fund(shop.id, 100000, 'refill-for-refund');
    const refBal = await balance();
    r = await call('POST', '/leadspace/wallet/refund-request', { note: 'closing the shop' }, shop.token);
    ok('a vendor with a recent refill can ask for the unused balance back', r.status < 300 && r.data.status === 'REQUESTED', J(r.body));
    const refund = r.data;
    ok('only one refund request can be open', (await call('POST', '/leadspace/wallet/refund-request', {}, shop.token)).status === 400);
    r = await call('PUT', `/admin/leadspace/refunds/${refund.id}`, { decision: 'APPROVE', paymentFeePaise: 2500 }, A);
    ok('approving debits the wallet at once so it cannot be spent twice', r.status < 300 && r.data.status === 'APPROVED' && (await balance()) === refBal - refund.amountPaise, J(r.body));
    r = await call('PUT', `/admin/leadspace/refunds/${refund.id}`, { decision: 'PAID' }, A);
    ok('and is then marked paid after the payout', r.data.status === 'PAID');
    r = await call('POST', '/admin/leadspace/expiry-sweep', {}, A);
    ok('the expiry sweep is a dry run unless asked to apply', r.data.applied === false, J(r.body));
    const noRefill = await h.createVendor({ key: 'lsnorefill', industry: 'retail', plan: 'WORKSPACE' });
    await prisma.leadPurse.create({ data: { vendorId: noRefill.id, kind: 'LEADS', balancePaise: 5000 } });
    r = await call('POST', '/leadspace/wallet/refund-request', {}, noRefill.token);
    ok('no refund where nothing was ever bought', r.status === 400, J(r.body));

    section('[feat:leadspace.whatsapp] The common number: sandbox until Meta approves, rules enforced in code');
    const ls0 = await gateway.liveStatus();
    ok('live status reads Awaiting approval while the provider is the sandbox', ls0.status === 'Awaiting approval' && ls0.sandbox === true, J(ls0));
    r = await call('GET', '/admin/leadspace/whatsapp', undefined, A);
    ok('the admin sees the five templates with their approval status', r.data.templates.length === 5 && r.data.templates.every((t) => ['AUTHENTICATION', 'UTILITY'].includes(t.category)), J(r.data.templates?.map((t) => t.name)));
    const unknown = await gateway.send({ template: 'summer_sale', phone: '9555555555', variables: ['x'] });
    ok('a template that is not in the registry is refused', unknown.status === 'REFUSED');
    await prisma.whatsappTemplate.create({ data: { name: 'blast', category: 'MARKETING', body: 'Big sale today', approvalStatus: 'APPROVED' } });
    ok('a marketing-category template is refused', (await gateway.send({ template: 'blast', phone: '9555555555', variables: [] })).status === 'REFUSED');
    ok('promotional wording in a variable is refused', (await gateway.send({ template: 'leadspace_new_lead', phone: '9555555555', variables: ['enquiry', 'Shop', 'Ravi', '50% off discount sale', 'x'] })).status === 'REFUSED');
    ok('a number that cannot be a mobile is refused', (await gateway.send({ template: 'leadspace_otp', phone: '1234', variables: ['123456'] })).status === 'REFUSED');
    const spamPhone = '9666666666';
    let lastS;
    for (let i = 0; i < 13; i++) lastS = await gateway.send({ template: 'leadspace_low_balance', phone: spamPhone, variables: ['Shop', 'Rs 100', 'x'], vendorId: shop.id });
    ok('one number gets at most twelve messages a day', lastS.status === 'REFUSED' && /most messages/.test(lastS.reason), J(lastS));
    // live provider needs an approved template
    const calls = [];
    const fakeFetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ messages: [{ id: 'wamid.TEST' }] }), { status: 200 }); };
    gateway.setProvider(new CloudApiWhatsappProvider({ token: 't', phoneNumberId: '123', appSecret: 'appsecret', verifyToken: 'vt', fetcher: fakeFetch }));
    ok('on the live provider an unapproved template is refused, nothing leaves', (await gateway.send({ template: 'leadspace_otp', phone: '9777777777', variables: ['123456'] })).status === 'REFUSED' && calls.length === 0);
    const live1 = await gateway.liveStatus();
    ok('live status is still Awaiting approval with the live provider but no approved OTP template', live1.status === 'Awaiting approval' && live1.sandbox === false);
    await call('PUT', '/admin/leadspace/whatsapp/templates/leadspace_otp', { approvalStatus: 'APPROVED', providerTemplateId: 'leadspace_otp_v1' }, A);
    const sent = await gateway.send({ template: 'leadspace_otp', phone: '9777777777', variables: ['654321'] });
    ok('once Meta approves the OTP template it is sent through the Graph API with the code in the body and the copy-code button', sent.status === 'SENT' && calls.length === 1 && calls[0].body.template.name === 'leadspace_otp_v1' && calls[0].body.to === '919777777777' && calls[0].body.template.components.some((c) => c.type === 'button'), J(calls[0]));
    const live2 = await gateway.liveStatus();
    ok('live status turns to Live only when the provider is live AND the OTP template is approved', live2.status === 'Live', J(live2));
    const sig = (raw, secret) => `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
    const hook = { entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.TEST', status: 'delivered' }], messages: [{ from: '919777777777', id: 'wamid.IN', text: { body: 'hello' } }] } }] }] };
    r = await call('POST', '/messaging/whatsapp/webhook', hook, undefined, { 'x-hub-signature-256': 'sha256=bad' });
    ok('a webhook with a wrong signature is refused', r.status === 403, J(r.body));
    r = await call('POST', '/messaging/whatsapp/webhook', hook, undefined, { 'x-hub-signature-256': sig(JSON.stringify(hook), 'appsecret') });
    ok('a correctly signed webhook is accepted', r.status < 300, J(r.body));
    ok('the delivery status updated the message log', (await prisma.whatsappMessageLog.findFirst({ where: { providerMessageId: 'wamid.TEST' } }))?.status === 'DELIVERED');
    ok('a customer message sent to the common number is dropped, never stored or relayed', (await prisma.whatsappMessageLog.count({ where: { providerMessageId: 'wamid.IN' } })) === 0);
    const hs = await fetch(`${h.base}/messaging/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=abc123`);
    ok('the provider subscription handshake answers with the challenge', (await hs.text()) === 'abc123');
    const hsBad = await fetch(`${h.base}/messaging/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123`);
    ok('and refuses a wrong verify token', hsBad.status === 403);
    gateway.setProvider(sandbox);
    r = await call('GET', '/admin/leadspace/whatsapp/outbox', undefined, A);
    ok('with the sandbox back, the admin can read what would have been sent (to test a pilot before approval)', r.data.sandbox === true && r.data.messages.length > 0);
    const stats = await gateway.spamStats(shop.id);
    ok('spam stats per vendor count sent and refused messages', stats.sent > 0 && stats.refused > 0, J(stats));

    section('[feat:leadspace.isolation] Every query is scoped to the signed-in vendor');
    r = await call('GET', '/leadspace/leads', undefined, other.token);
    ok('another vendor sees none of this vendor\'s leads', r.data.total === 0, J(r.data));
    r = await call('GET', '/leadspace/wallet', undefined, other.token);
    ok('another vendor\'s wallet is its own', r.data.balancePaise === 0 && r.data.ledger.length === 0, J(r.data));
    r = await call('GET', '/leadspace/leads');
    ok('the vendor routes need a login', r.status === 401);
    r = await call('GET', '/admin/leadspace/prices', undefined, V);
    ok('a vendor is refused on every admin route', r.status === 403);
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
