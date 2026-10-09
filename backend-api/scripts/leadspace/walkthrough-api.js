// A LOCAL LeadSpace walkthrough API for looking at the real screens in a browser: the real compiled API over an in-memory PGlite database (never a real database),
// seeded with a LeadSpace-only vendor who has a live page, a funded wallet, delivered and held leads, and a normal Essentials vendor and an admin.
//   node scripts/leadspace/walkthrough-api.js      (needs `npx nest build` first; stays running; logins are written to $LS_WALK_CREDS or printed)
const fs = require('fs');
const { startHarness } = require('../e2e/bos-harness');

(async () => {
  const h = await startHarness({ port: 3090, pgPort: 54340 });
  const { prisma, call } = h;
  const gateway = h.svc('WhatsappGatewayService', 'messaging/whatsapp/whatsapp-gateway.service');
  const sandbox = gateway.getProvider();
  const purse = h.svc('LeadPurseService', 'leadspace/purse.service');
  const PASS = 'Demo1Pass';
  const creds = { password: PASS };

  const admin = await h.createAdmin({ key: 'walkadmin' });
  creds.admin = admin.email;
  await prisma.vendor.update({ where: { email: admin.email }, data: { password: await h.dist('auth/auth.service').AuthService.hashPassword(PASS) } });
  await call('PUT', '/admin/leadspace/settings/otpPerIpPerHour', { value: 100000 }, admin.token);
  for (const [eventType, rupees] of [['ENQUIRY', 150], ['BOOKING', 200], ['APPOINTMENT', 200], ['SITE_VISIT', 400], ['CART_ORDER', 75]]) await call('POST', '/admin/leadspace/prices', { eventType, pricePaise: rupees * 100 }, admin.token);

  const reg = await call('POST', '/auth/register', { name: 'Ravi Kumar', email: 'ravi@local.test', password: PASS, businessName: 'Ravi Plumbing Works', industry: 'general', product: 'leadspace' });
  creds.leadspaceOnly = 'ravi@local.test';
  const T = reg.data.accessToken; const vid = reg.data.user.id;
  await call('POST', '/leadspace/page', { category: 'home-services', city: 'Chennai', businessName: 'Ravi Plumbing Works', services: [{ name: 'Tap repair', price: 350, description: 'Leaking or dripping taps fixed' }, { name: 'Geyser fitting', price: 900 }, { name: 'Bathroom fitting', price: 1500 }], tagline: 'Leaks fixed the same day', about: 'A family-run plumbing team serving Adyar, Velachery and T Nagar for twelve years.', address: '12 Lake View Road, Adyar, Chennai', hours: 'Mon-Sat 8am-8pm', offer: { headline: 'Monsoon check', text: 'Free leak inspection this month' } }, T);
  const vr = await call('POST', '/leadspace/page/verify-phone/request', { phone: '9840012345' }, T);
  await call('POST', '/leadspace/page/verify-phone/confirm', { phone: '9840012345', otpId: vr.data.otpId, code: sandbox.lastTo('9840012345').variables[0] }, T);
  await call('POST', '/leadspace/page/publish', undefined, T);
  const slug = (await call('GET', '/leadspace/page', undefined, T)).data.profile.slug;
  creds.slug = slug;
  await prisma.$transaction((tx) => purse.credit(tx, { vendorId: vid, amountPaise: 45000, reason: 'REFILL', idempotencyKey: 'walk-fund' }));
  let n = 0;
  const lead = async (name, message) => {
    const phone = `98765${String(10000 + (n += 17)).slice(-5)}`;
    const o = await call('POST', '/leadspace/public/otp', { slug, phone, consent: true });
    return call('POST', '/leadspace/public/event', { slug, name, phone, payload: { service: 'Tap repair', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: '9 am - 12 pm', message }, otpId: o.data.otpId, code: sandbox.lastTo(phone).variables[0] });
  };
  await lead('Priya Kumar', 'Kitchen tap is leaking badly, can someone come today?');
  await lead('Anil Menon', 'Need a geyser fitted in a new flat in Velachery');
  await lead('Farida Begum', 'Bathroom fittings quote please');
  await lead('Held Customer One', 'This one is waiting for a refill');
  await lead('Held Customer Two', 'And so is this one');

  const ws = await h.createVendor({ key: 'walkws', industry: 'retail', plan: 'WORKSPACE' });
  creds.essentials = ws.email; creds.essentialsPassword = ws.password;

  if (process.env.LS_WALK_CREDS) fs.writeFileSync(process.env.LS_WALK_CREDS, JSON.stringify(creds, null, 2));
  console.log(`LEADSPACE WALKTHROUGH API on ${h.base}\n${JSON.stringify(creds, null, 2)}`);
  setInterval(() => undefined, 1 << 30);
})().catch((e) => { console.error(e); process.exit(1); });
