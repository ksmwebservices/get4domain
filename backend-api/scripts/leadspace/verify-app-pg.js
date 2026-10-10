// The LeadSpace vendor app on REAL Postgres (PGlite) through the REAL NestJS API: a LeadSpace-only signup, the free base tier in the registry, leaving the
// LeadSpace-only mode when a plan is bought, the Home numbers, the upgrade offer, team access areas, and who may see which wallet route.
// Needs `npx nest build` first and PGlite (SKIPs cleanly when it is not installed).
const { startHarness, available } = require('../e2e/bos-harness');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - LeadSpace app proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3092, pgPort: 54336 });
  const { prisma, call } = h;
  const reg = h.dist('registry/registry.generated');
  const { provisionModules, desiredAccess } = h.dist('registry/provisioning');
  let code = 0;
  try {
    const admin = await h.createAdmin({ key: 'aadmin' });
    const A = admin.token;

    section('[feat:leadspace.app] A LeadSpace-only signup gets the five-tab app and nothing else');
    let r = await call('POST', '/auth/register', { name: 'Meena K', email: 'meena@local.test', password: 'Strong1Pass', businessName: 'Meena Beauty', industry: 'salon', product: 'leadspace' });
    ok('a LeadSpace signup is accepted', r.status < 300 && r.data.accessToken, J(r.body));
    const T = r.data.accessToken; const vid = r.data.user.id;
    ok('it switches on the leadspace feature and the LeadSpace-only mode', (await prisma.vendorAddon.count({ where: { vendorId: vid, addonKey: { in: ['leadspace', 'leadspace_only'] }, enabled: true } })) === 2);
    r = await call('GET', '/dashboard/context', undefined, T);
    ok('the dashboard context says the plan is LeadSpace (the free base tier)', r.data.plan === 'LEADSPACE' && r.data.planDisplay === 'LeadSpace' && r.data.term === null, J(r.body).slice(0, 300));
    r = await call('POST', '/auth/register', { name: 'X Y', email: 'x@local.test', password: 'Strong1Pass', businessName: 'Plain Co', industry: 'retail', product: 'nonsense' });
    ok('an unknown product is refused', r.status === 400);
    r = await call('POST', '/auth/register', { name: 'P Q', email: 'pq@local.test', password: 'Strong1Pass', businessName: 'Plain Co', industry: 'retail' });
    ok('a normal signup is not touched: no LeadSpace-only mode', r.status < 300 && (await prisma.vendorAddon.count({ where: { vendorId: r.data.user.id, addonKey: 'leadspace_only' } })) === 0);
    r = await call('GET', '/dashboard/context', undefined, r.data.accessToken);
    ok('and its plan is unchanged (no term yet)', r.data.plan === null, J(r.body).slice(0, 200));

    section('[feat:leadspace.base-tier] LeadSpace is in every plan, and the free tier gets nothing else');
    const F = reg.FEATURES; const get = (id) => F.find((f) => f.id === id);
    const V = (plan) => ({ plan, custom: false, profile: 'SERVICES', navV2: true });
    ok('LeadSpace is open on the free tier, Essentials and Pro', ['LEADSPACE', 'WORKSPACE', 'BOS'].every((p) => reg.featureState(get('marketing.leadspace'), V(p)) === 'OPEN'));
    ok('the free tier has no customer invoices, stock, accounts or TeleCRM (never open)', ['finance.invoices', 'commerce.stock', 'finance.expenses', 'sales.leads', 'commerce.pos'].every((id) => reg.featureState(get(id), V('LEADSPACE')) !== 'OPEN'));
    const want = desiredAccess('LEADSPACE', false, 'SERVICES');
    ok('provisioning for the free tier grants only the LeadSpace feature (and the Growth Hub module it lives on)', J(want.addons) === J(['leadspace']) && want.modules.includes('growth_hub') && !want.modules.includes('telecrm') && !want.modules.includes('website_manager'), J(want));
    ok('Essentials and Pro get LeadSpace too, so nobody who had Campaigns loses access', desiredAccess('WORKSPACE', false, 'SERVICES').addons.includes('leadspace') && desiredAccess('BOS', false, 'SERVICES').modules.includes('growth_hub'));

    section('[feat:leadspace.upgrade] Buying a plan leaves LeadSpace-only mode and deletes nothing');
    await prisma.leadspaceProfile.create({ data: { vendorId: vid, slug: 'meena-beauty-chennai', category: 'salon-beauty', city: 'Chennai', goal: 'APPOINTMENT', businessName: 'Meena Beauty', phone: '9788888888', status: 'PUBLISHED' } });
    await prisma.$transaction(async (tx) => { await tx.billingTerm.create({ data: { vendorId: vid, planKey: 'WORKSPACE', billingCycle: 'ANNUAL', cycleMonths: 12, listAmountPaise: 1198800, netAmountPaise: 1198800, gstMode: 'EXCLUSIVE', periodStart: new Date(), periodEnd: new Date(Date.now() + 365 * 86_400_000), status: 'ACTIVE', isCurrent: true, activatedAt: new Date(), createdBy: 'test' } }); await provisionModules(tx, vid, 'WORKSPACE', { actor: 'test', reason: 'bought a plan' }); });
    ok('the LeadSpace-only mode is switched off when a plan is provisioned', (await prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId: vid, addonKey: 'leadspace_only' } } })).enabled === false);
    ok('the LeadSpace feature, page and data stay', (await prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId: vid, addonKey: 'leadspace' } } })).enabled === true && (await prisma.leadspaceProfile.count({ where: { vendorId: vid } })) === 1);
    r = await call('GET', '/dashboard/context', undefined, T);
    ok('the context now shows the paid plan', r.data.plan === 'WORKSPACE', J(r.body).slice(0, 200));
    const run2 = await prisma.$transaction((tx) => provisionModules(tx, vid, 'WORKSPACE', { actor: 'test', reason: 'again' }));
    ok('provisioning again changes nothing (idempotent)', run2.changed === false);

    section('[feat:leadspace.home] The Home numbers and the offer to move up');
    const v = await h.createVendor({ key: 'ahome', industry: 'retail', plan: 'WORKSPACE' });
    const prof = await prisma.leadspaceProfile.create({ data: { vendorId: v.id, slug: 'ahome-chennai', category: 'tutor', city: 'Chennai', goal: 'BOOKING', businessName: 'Home Tutors', phone: '9799999999', status: 'PUBLISHED' } });
    const mk = (n, type, status, extra = {}) => prisma.leadEvent.createMany({ data: Array.from({ length: n }, (_, i) => ({ vendorId: v.id, profileId: prof.id, type, customerName: 'C', customerPhone: '9800000001', phoneHash: `h${Math.random()}`, payload: {}, status, priceChargedPaise: status === 'HELD' ? 0 : 5000, idempotencyKey: `home-${Math.random()}-${i}`, ...extra })) });
    await mk(3, 'BOOKING', 'DELIVERED'); await mk(2, 'CART_ORDER', 'DELIVERED'); await mk(1, 'ENQUIRY', 'HELD'); await mk(1, 'ENQUIRY', 'WON');
    r = await call('GET', '/leadspace/summary', undefined, v.token);
    ok('Home counts today\'s bookings and orders separately, and held ones', r.data.todayBookings === 3 && r.data.todayOrders === 2 && r.data.held === 1 && r.data.won === 1, J(r.data));
    ok('with 7 leads the offer to move up is not shown yet (threshold is 10)', r.data.upgradeSuggested === false && r.data.upgradeThreshold === 10);
    await mk(4, 'ENQUIRY', 'DELIVERED');
    r = await call('GET', '/leadspace/summary', undefined, v.token);
    ok('at the threshold the offer to move up is shown', r.data.upgradeSuggested === true, J(r.data));
    await call('PUT', '/admin/leadspace/settings/upgradeLeadThreshold', { value: 50 }, A);
    r = await call('GET', '/leadspace/summary', undefined, v.token);
    ok('the threshold is an admin setting', r.data.upgradeSuggested === false && r.data.upgradeThreshold === 50);

    section('[feat:leadspace.team] A team member sees only the areas they were given');
    const ModuleGuard = h.dist('common/guards/module.guard').ModuleGuard;
    const { Reflector } = require('@nestjs/core');
    const { RequireModule } = h.dist('common/decorators/require-module.decorator');
    class Wallet { w() { return 1; } }
    Reflect.decorate([RequireModule('wallet')], Wallet.prototype, 'w', Object.getOwnPropertyDescriptor(Wallet.prototype, 'w'));
    const g = new ModuleGuard(new Reflector());
    const ctx = (user) => ({ getHandler: () => Wallet.prototype.w, getClass: () => Wallet, switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    ok('a team member without the wallet area is refused on the wallet routes', (() => { try { g.canActivate(ctx({ kind: 'team_member', modules: ['campaigns'] })); return false; } catch { return true; } })());
    ok('and with it is let in; the owner always is', g.canActivate(ctx({ kind: 'team_member', modules: ['wallet'] })) === true && g.canActivate(ctx({ role: 'VENDOR' })) === true);
    const meta = Reflect.getMetadata('requireModule', h.dist('leadspace/leadspace.controllers').LeadspaceVendorController);
    ok('the vendor leads routes are in the campaigns area and the wallet routes in the wallet area', meta === 'campaigns' && Reflect.getMetadata('requireModule', h.dist('leadspace/leadspace.controllers').LeadspaceVendorController.prototype.wallet) === 'wallet' && Reflect.getMetadata('requireModule', h.dist('leadspace/wallet.controllers').LeadspaceRefillController) === 'wallet');
    ok('the page editor is in the website area', Reflect.getMetadata('requireModule', h.dist('leadspace/pages.controllers').LeadspacePageVendorController) === 'website');

    section('[feat:leadspace.callbacks] A reminder to call again, nothing typed in by hand');
    const istToday = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const istDayShift = (n) => new Date(Date.now() + 330 * 60_000 + n * 86_400_000).toISOString().slice(0, 10);
    const mine = await prisma.leadEvent.findFirst({ where: { vendorId: v.id, status: 'DELIVERED', type: 'BOOKING' } });
    r = await call('PUT', `/leadspace/leads/${mine.id}/callback`, { date: istToday }, v.token);
    ok('a lead can be given a call-again date of today', r.status < 300 && r.data.callbackAt, J(r.body));
    r = await call('GET', '/leadspace/summary', undefined, v.token);
    ok("Home shows how many calls are due today", r.data.callsDue === 1, J(r.data));
    r = await call('GET', '/leadspace/leads?calls=due', undefined, v.token);
    ok("today's calls lists exactly that lead", r.data.rows.length === 1 && r.data.rows[0].id === mine.id, J(r.data).slice(0, 300));
    r = await call('PUT', `/leadspace/leads/${mine.id}/callback`, { date: istDayShift(-1) }, v.token);
    ok('a day in the past is refused in plain words', r.status === 400 && /today or a day in the future/.test(J(r.body)), J(r.body));
    r = await call('PUT', `/leadspace/leads/${mine.id}/callback`, { date: istDayShift(400) }, v.token);
    ok('more than a year ahead is refused', r.status === 400, J(r.body));
    r = await call('PUT', `/leadspace/leads/${mine.id}/callback`, { date: 'tomorrow' }, v.token);
    ok('something that is not a date is refused', r.status === 400, J(r.body));
    const other2 = await h.createVendor({ key: 'aother', industry: 'retail', plan: 'WORKSPACE' });
    r = await call('PUT', `/leadspace/leads/${mine.id}/callback`, { date: istToday }, other2.token);
    ok("another vendor cannot set a reminder on this vendor's lead", r.status === 404, J(r.body));
    const heldLead = await prisma.leadEvent.findFirst({ where: { vendorId: v.id, status: 'HELD' } });
    r = await call('PUT', `/leadspace/leads/${heldLead.id}/callback`, { date: istToday }, v.token);
    ok('a waiting (held) customer cannot be given a reminder until the wallet is refilled', r.status === 400, J(r.body));
    r = await call('PUT', `/leadspace/leads/${mine.id}/status`, { status: 'WON' }, v.token);
    ok('marking the lead Won closes the reminder', r.status < 300 && r.data.callbackAt === null, J(r.body));
    r = await call('PUT', `/leadspace/leads/${mine.id}/callback`, { date: null }, v.token);
    ok('the reminder can also be cleared', r.status < 300 && r.data.callbackAt === null, J(r.body));

    section('[feat:leadspace.cart-complete] Only a finished, verified order is charged; an unfinished one is visible');
    const goals = h.dist('leadspace/goals');
    const throws = (fn) => { try { fn(); return null; } catch (e) { return String(e.message); } };
    ok('a delivery address of two letters is refused', /full delivery address/.test(throws(() => goals.validatePayload('CART_ORDER', { items: [{ name: 'Tea', qty: 1 }], address: 'xx' }))));
    ok('an order with no items is refused', /between 1 and 30/.test(throws(() => goals.validatePayload('CART_ORDER', { items: [], address: '12 Main Road, Adyar' }))));
    ok('a quantity of 0 or 100 is refused', !!throws(() => goals.validatePayload('CART_ORDER', { items: [{ name: 'Tea', qty: 0 }], address: '12 Main Road, Adyar' })) && !!throws(() => goals.validatePayload('CART_ORDER', { items: [{ name: 'Tea', qty: 100 }], address: '12 Main Road, Adyar' })));
    ok('a proper order passes', throws(() => goals.validatePayload('CART_ORDER', { items: [{ name: 'Tea', qty: 2 }], address: '12 Main Road, Adyar, Chennai' })) === null);
    await prisma.leadEvent.updateMany({ where: { vendorId: v.id, type: 'CART_ORDER' }, data: { orderDecision: 'PENDING' } });
    r = await call('GET', '/leadspace/summary', undefined, v.token);
    ok('Home counts the orders still waiting for a reply and how long the oldest has waited', r.data.ordersWaiting === 2 && r.data.oldestWaitingAt, J(r.data));
    const ord = await prisma.leadEvent.findFirst({ where: { vendorId: v.id, type: 'CART_ORDER' } });
    await call('PUT', `/leadspace/leads/${ord.id}/order`, { decision: 'CONFIRMED' }, v.token);
    r = await call('GET', '/leadspace/summary', undefined, v.token);
    ok('answering an order takes it off the waiting count', r.data.ordersWaiting === 1, J(r.data));
    await prisma.leadOtp.createMany({ data: Array.from({ length: 4 }, (_, i) => ({ id: `unfin-${i}`, phoneHash: `ph-${i}`, codeHash: 'x', vendorId: v.id, deviceHash: `d${i}`, expiresAt: new Date(Date.now() - 1000) })) });
    const day = new Date().toISOString().slice(0, 10);
    r = await call('GET', `/leadspace/promote/funnel?from=${day}&to=${day}`, undefined, v.token);
    ok('the funnel shows codes asked for and never used as unfinished (never charged)', r.data.unfinished === 4 && r.data.ordersConfirmed === 1, J(r.data));

    section('[feat:leadspace.buy-link] A product can send people to its own shop page, counted, never charged');
    const pbs = h.dist('leadspace/profile.service');
    ok('a normal https shop address is kept', pbs.safeBuyUrl('https://shop.example.in/item/9') === 'https://shop.example.in/item/9');
    ok('WhatsApp, Telegram, tel, mail, http and addresses with a password are all refused', ['https://wa.me/919800000000', 'https://api.whatsapp.com/send?phone=1', 'https://t.me/someone', 'tel:+919800000000', 'mailto:a@b.in', 'http://shop.example.in', 'https://user:pass@shop.example.in', 'javascript:alert(1)'].every((x) => pbs.safeBuyUrl(x) === null));
    await prisma.leadspaceProfile.update({ where: { id: prof.id }, data: { services: [{ name: 'Maths pack', price: 500, buyUrl: 'https://shop.example.in/maths' }, { name: 'Plain item', price: 100 }] } });
    r = await call('GET', '/leadspace/public/page/ahome-chennai');
    const items = r.data.blocks.find((b) => b.type === 'services').items;
    ok('the public page links through our redirect and never shows the vendor address', items[0].buyPath === '/ls/ahome-chennai/go/0' && items[1].buyPath === null && !J(r.body).includes('shop.example.in'), J(items));
    r = await call('POST', '/leadspace/public/outbound', { slug: 'ahome-chennai', index: 0 });
    ok('the redirect returns the saved address and counts the tap', r.status < 300 && r.data.url === 'https://shop.example.in/maths', J(r.body));
    r = await call('POST', '/leadspace/public/outbound', { slug: 'ahome-chennai', index: 1 });
    ok('an item without a buy link cannot be redirected', r.status === 404, J(r.body));
    r = await call('POST', '/leadspace/public/outbound', { slug: 'ahome-chennai', index: 7 });
    ok('an index past the list is not found', r.status === 404, J(r.body));
    r = await call('GET', `/leadspace/promote/funnel?from=${day}&to=${day}`, undefined, v.token);
    ok('the vendor funnel shows one tap on buy links', r.data.buyLinkTaps === 1, J(r.data));
    r = await call('POST', '/leadspace/public/outbound', { slug: 'ahome-chennai', index: 0, url: 'https://evil.example' });
    ok('the address can only come from what the vendor saved, never from the request', r.status === 400 || (r.status < 300 && r.data.url === 'https://shop.example.in/maths'), J(r.body));
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
