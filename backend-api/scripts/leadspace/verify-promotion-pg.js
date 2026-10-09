// LeadSpace promotion on REAL Postgres (PGlite) through the REAL NestJS API: the shared social publisher (accounts, encrypted tokens, scheduling, daily caps,
// retries, kill switches), the promotion plan and monthly calendar written to the guardrails, the approval queue, manual tasks, and the admin money reports.
// Needs `npx nest build` first and PGlite (SKIPs cleanly when it is not installed).
const { startHarness, available } = require('../e2e/bos-harness');

let pass = 0; let fail = 0; const failures = [];
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; failures.push(name); console.log(`  FAIL  ${name}${detail ? ` -> ${String(detail).slice(0, 400)}` : ''}`); } };
const section = (t) => console.log(`\n== ${t}`);
const J = (x) => JSON.stringify(x);

(async () => {
  if (!(await available())) { console.log('SKIP  PGlite not installed (set G4D_PGLITE_DIR) - LeadSpace promotion proofs not run'); process.exit(0); }
  const h = await startHarness({ port: 3093, pgPort: 54335 });
  const { prisma, call } = h;
  const publisher = h.svc('SocialPublisherService', 'social/social-publisher.service');
  const promo = h.svc('PromotionService', 'leadspace/promotion.service');
  const { PublishError } = h.dist('social/social-provider');
  const { RETRY_MINUTES } = h.dist('social/social-publisher.service');
  const { decryptSecret } = h.dist('platform-settings/crypto.util');
  let code = 0;
  try {
    const admin = await h.createAdmin({ key: 'padmin' });
    const A = admin.token;
    const mkAccount = async (body) => (await call('PUT', '/admin/social/accounts', { ownerType: 'PLATFORM', status: 'SANDBOX', ...body }, A)).data;
    const mkPost = (accountId, over = {}) => publisher.schedule({ accountId, content: 'Test post', scheduledFor: new Date(Date.now() - 60_000), idempotencyKey: `k-${Math.random()}`, ...over });

    section('[feat:leadspace.social-publisher] Accounts, encrypted tokens, scheduling, caps, retries');
    let r = await call('PUT', '/admin/social/accounts', { ownerType: 'PLATFORM', channel: 'TELEGRAM', name: 'Chennai Deals', externalId: '@chennaideals', token: '123456:SECRET-TOKEN-VALUE', city: 'Chennai' }, A);
    const tg = r.data;
    ok('an account is saved and the token is never returned', r.status < 300 && tg.hasToken === true && !J(r.body).includes('SECRET-TOKEN-VALUE') && !('tokenEnc' in tg), J(r.body));
    const row = await prisma.socialAccount.findUnique({ where: { id: tg.id } });
    ok('the token is encrypted at rest and decrypts back', row.tokenEnc && !row.tokenEnc.includes('SECRET') && decryptSecret(row.tokenEnc) === '123456:SECRET-TOKEN-VALUE');
    ok('a new account with a token waits for a connection test', tg.status === 'AWAITING_APPROVAL');
    r = await call('GET', '/admin/social/accounts', undefined, A);
    ok('listing accounts never shows a token either', !J(r.body).includes('SECRET-TOKEN-VALUE') && !J(r.body).includes('tokenEnc'));
    r = await call('PUT', '/admin/social/accounts', { ownerType: 'PLATFORM', channel: 'TELEGRAM', name: 'Chennai Deals', status: 'SANDBOX', id: tg.id }, A);
    ok('an account can be switched to sandbox (nothing leaves the machine)', r.data.status === 'SANDBOX');
    ok('a vendor cannot use the social admin routes', (await call('GET', '/admin/social/accounts', undefined, (await h.createVendor({ key: 'pvendor0', industry: 'retail', plan: 'WORKSPACE' })).token)).status === 403);

    const p1 = await mkPost(tg.id, { content: 'Hello Chennai', idempotencyKey: 'same-key' });
    const p1b = await mkPost(tg.id, { content: 'Hello Chennai', idempotencyKey: 'same-key' });
    ok('scheduling the same key twice gives one post', p1.id === p1b.id);
    let run = await publisher.runDue();
    ok('a due post is sent through the sandbox provider and logged as POSTED', run.posted === 1 && (await prisma.socialPost.findUnique({ where: { id: p1.id } })).status === 'POSTED' && publisher.sandboxFor('TELEGRAM').posts.length === 1, J(run));
    const posted = await prisma.socialPost.findUnique({ where: { id: p1.id } });
    ok('the log keeps the provider id and a link', /^sandbox_telegram_/.test(posted.providerPostId) && posted.postUrl.includes('sandbox'), J(posted));
    r = await call('GET', '/admin/social/posts', undefined, A);
    ok('the admin sees the post log', r.data.some((x) => x.id === p1.id && x.status === 'POSTED'));
    run = await publisher.runDue();
    ok('running again posts nothing twice', run.posted === 0 && publisher.sandboxFor('TELEGRAM').posts.length === 1);

    const future = await mkPost(tg.id, { scheduledFor: new Date(Date.now() + 3_600_000) });
    ok('a post set for later is not sent early', (await publisher.runDue()).picked === 0 && (await prisma.socialPost.findUnique({ where: { id: future.id } })).status === 'SCHEDULED');
    r = await call('POST', `/admin/social/posts/${future.id}/cancel`, undefined, A);
    ok('a waiting post can be cancelled', r.data.status === 'CANCELLED');

    const capped = await mkAccount({ channel: 'FACEBOOK_PAGE', name: 'Capped Page', dailyCap: 2 });
    for (let i = 0; i < 3; i++) await mkPost(capped.id);
    run = await publisher.runDue();
    ok('a daily cap of two posts only two and defers the third to tomorrow morning', run.posted === 2 && run.deferred === 1, J(run));
    const deferred = await prisma.socialPost.findFirst({ where: { accountId: capped.id, status: 'SCHEDULED' } });
    ok('the deferred post says why and waits until tomorrow', /Daily limit of 2/.test(deferred.error) && deferred.nextAttemptAt > new Date() && deferred.attempts === 0, J(deferred));
    await call('PUT', '/admin/leadspace/settings/channelDailyCaps', { value: { FACEBOOK_PAGE: 1, INSTAGRAM: 3, TELEGRAM: 6, GOOGLE_BUSINESS: 1 } }, A);

    const live = await mkAccount({ channel: 'INSTAGRAM', name: 'Insta Live', externalId: 'ig1', token: 'tok', status: 'CONNECTED' });
    let mode = 'retry'; let calls = 0;
    publisher.setProvider('INSTAGRAM', { channel: 'INSTAGRAM', sandbox: false, async publish() { calls++; throw new PublishError(mode === 'retry' ? 'Instagram is busy' : 'The picture is too small', mode === 'retry'); }, async test() { return { ok: true, message: 'fine' }; }, async results() { return null; } });
    const flaky = await mkPost(live.id, { imageUrl: 'https://img.example/a.jpg', idempotencyKey: 'flaky' });
    const t0 = new Date();
    const times = [0, 6, 22, 90, 400].map((m) => new Date(t0.getTime() + m * 60_000 + 1000));
    await publisher.runDue(times[0]);
    let f = await prisma.socialPost.findUnique({ where: { id: flaky.id } });
    ok('a busy network is retried: the post stays scheduled with the next try five minutes later', f.status === 'SCHEDULED' && f.attempts === 1 && f.error === 'Instagram is busy' && f.nextAttemptAt.getTime() - times[0].getTime() === RETRY_MINUTES[0] * 60_000, J(f));
    await publisher.runDue(new Date(times[0].getTime() + 60_000));
    ok('it is not tried again before its time', calls === 1);
    for (let i = 1; i < 5; i++) await publisher.runDue(times[i]);
    f = await prisma.socialPost.findUnique({ where: { id: flaky.id } });
    ok('after five tries it is FAILED with the reason kept, and not retried forever', f.status === 'FAILED' && f.attempts === 5 && calls === 5 && f.error === 'Instagram is busy', J(f));
    mode = 'hard';
    const hard = await mkPost(live.id, { imageUrl: 'https://img.example/b.jpg', idempotencyKey: 'hard' });
    await publisher.runDue();
    f = await prisma.socialPost.findUnique({ where: { id: hard.id } });
    ok('an error that cannot be fixed by waiting fails at once', f.status === 'FAILED' && f.attempts === 1 && /too small/.test(f.error), J(f));
    ok('the account shows the last error for the admin', /too small/.test((await prisma.socialAccount.findUnique({ where: { id: live.id } })).lastError));
    let igErr = null; try { await publisher.schedule({ accountId: live.id, content: 'no picture', idempotencyKey: 'nopic' }); } catch (e) { igErr = e.message; }
    ok('an Instagram post without a picture is refused when scheduled', /need a picture/.test(igErr ?? ''), igErr);

    r = await call('POST', `/admin/social/accounts/${live.id}/test`, undefined, A);
    ok('Test connection runs a read-only call and marks the account Connected', r.data.ok === true && (await prisma.socialAccount.findUnique({ where: { id: live.id } })).status === 'CONNECTED', J(r.body));
    const stuck = await mkPost(tg.id, { idempotencyKey: 'stuck' });
    await prisma.socialPost.update({ where: { id: stuck.id }, data: { status: 'POSTING', updatedAt: new Date(Date.now() - 30 * 60_000) } });
    run = await publisher.runDue();
    ok('a post left half-sent by a restart is picked up again', (await prisma.socialPost.findUnique({ where: { id: stuck.id } })).status === 'POSTED', J(run));

    const killed = await mkPost(tg.id, { idempotencyKey: 'killed' });
    r = await call('PUT', '/admin/leadspace/promotion/global-kill', { on: true }, A);
    ok('the global kill switch is on', r.data.globalKillSwitch === true);
    run = await publisher.runDue();
    ok('with it on, nothing is posted for anyone', run.picked === 0 && (await prisma.socialPost.findUnique({ where: { id: killed.id } })).status === 'SCHEDULED');
    await call('PUT', '/admin/leadspace/promotion/global-kill', { on: false }, A);
    run = await publisher.runDue();
    ok('turned off again, the waiting post goes out', run.posted === 1);
    const guard = new (h.dist('leadspace/staff.guard').LeadspaceStaffGuard)();
    ok('MARKETING staff may run the promotion queue and the kill switch', (() => { try { return guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: { role: 'ADMIN', adminRole: 'MARKETING', kind: 'admin_member' } }) }) }); } catch { return false; } })());
    r = await call('DELETE', `/admin/social/accounts/${live.id}`, undefined, A);
    ok('disconnecting removes the token and stops posting but keeps the history', r.data.status === 'DISCONNECTED' && r.data.hasToken === false && (await prisma.socialPost.count({ where: { accountId: live.id } })) === 2);

    section('[feat:leadspace.promotion] Plan, calendar, guardrails, approval, manual tasks, kill switches');
    const shop = await h.createVendor({ key: 'pshop', industry: 'retail', plan: 'WORKSPACE' });
    const prof = await prisma.leadspaceProfile.create({ data: { vendorId: shop.id, slug: 'ravi-plumbing-chennai', category: 'home-services', city: 'Chennai', goal: 'BOOKING', businessName: 'Ravi Plumbing', tagline: 'Leaks fixed the same day', phone: '9711111111', alertWhatsapp: '9711111111', status: 'PUBLISHED', verificationStatus: 'VERIFIED', noindex: false, heroImage: 'https://img.example/ravi.jpg', services: [{ name: 'Tap repair', price: 350, description: 'Leaking tap fixed' }, { name: 'Geyser fitting', price: 900 }], offer: { headline: 'Monsoon check', text: 'Free leak inspection this month' } } });
    await prisma.socialAccount.updateMany({ data: { status: 'DISCONNECTED' } });
    const fbChennai = await mkAccount({ channel: 'FACEBOOK_PAGE', name: 'Chennai Home Services Deals', theme: 'Chennai Home Services Deals', city: 'Chennai', category: 'home-services', dailyCap: 10 });
    const fbOther = await mkAccount({ channel: 'FACEBOOK_PAGE', name: 'Madurai Deals', city: 'Madurai', dailyCap: 10 });
    const tgGeneric = await mkAccount({ channel: 'TELEGRAM', name: 'Get4Domain Local Deals', dailyCap: 10 });
    const pick = h.dist('leadspace/promotion.service').pickAccount;
    const accs = await prisma.socialAccount.findMany();
    ok('the page for the vendor\'s own city and trade is chosen first', pick(accs, 'FACEBOOK_PAGE', 'Chennai', 'home-services').id === fbChennai.id);
    ok('a page for another city is never chosen', pick(accs, 'FACEBOOK_PAGE', 'Salem', 'home-services') === null);
    ok('a general channel is the fallback', pick(accs, 'TELEGRAM', 'Chennai', 'home-services').id === tgGeneric.id);

    r = await call('GET', '/leadspace/promote', undefined, shop.token);
    ok('the vendor sees promotion is off and can be turned on', r.data.on === false && r.data.canTurnOn === true, J(r.data));
    r = await call('POST', '/leadspace/promote/calendar', {}, shop.token);
    ok('no calendar before promotion is switched on', r.status === 400 && /Switch promotion on/.test(r.body.message), J(r.body));
    r = await call('PUT', '/leadspace/promote', { on: true, channels: ['FACEBOOK_PAGE', 'TELEGRAM', 'FACEBOOK_GROUPS', 'GOOGLE_BUSINESS', 'INSTAGRAM'], perWeek: 5 }, shop.token);
    ok('promotion is switched on with channels and posts a week', r.status < 300 && r.data.status === 'ACTIVE' && r.data.manualUntil, J(r.body));
    ok('the first two weeks of a new vendor are manual approval', Math.abs(new Date(r.data.manualUntil).getTime() - (Date.now() + 14 * 86_400_000)) < 120_000);
    ok('a silly number of posts is refused', (await call('PUT', '/leadspace/promote', { perWeek: 40 }, shop.token)).status === 400);

    // a writer that tries to break the rules, then one that behaves
    let n = 0;
    const bad = [
      (b) => `${b}\nGuaranteed results or your money back!`,
      (b) => `${b}\nTap repair only Rs 99 today!`,
      (b) => `Our friendly team fixes leaks across Chennai. Tap repair from Rs 350.\nBook now: https://get4domain.com/ls/ravi-plumbing-chennai?utm_source=x`,
    ];
    promo.setAiWriter(async (p, angle, base) => (n < bad.length ? bad[n++](base) : null));
    r = await call('POST', '/leadspace/promote/calendar', { days: 30 }, shop.token);
    ok('a month of posts is written: about five a week', r.status < 300 && r.data.created >= 20 && r.data.created <= 23, J(r.body));
    ok('every post needs approval in the first weeks', r.data.needsApproval === r.data.created);
    ok('text that promised a guarantee or quoted a price not on the page was thrown out and the plain text used', r.data.skipped.length === 2 && /claim we do not allow|not on the page/.test(r.data.skipped.join(' ')), J(r.data.skipped));
    const jobs = await prisma.postJob.findMany({ where: { vendorId: shop.id }, orderBy: { scheduledFor: 'asc' } });
    ok('exactly one AI-written text was accepted and marked as such', jobs.filter((j) => j.content.source === 'ai').length === 1);
    ok('no post anywhere carries a guarantee or an unlisted price', jobs.every((j) => !/guarantee/i.test(j.content.caption) && !/Rs 99\b/.test(j.content.caption)));
    ok('every post links to the page with campaign tracking', jobs.every((j) => j.content.caption.includes('/ls/ravi-plumbing-chennai') || j.manualTask || j.content.caption.includes('Link in bio')));
    ok('posts are themed by city and trade on the matching Get4Domain page', jobs.filter((j) => j.channel === 'FACEBOOK_PAGE').every((j) => j.accountId === fbChennai.id && j.theme === 'Chennai Home Services Deals'));
    ok('Facebook Groups posts are manual tasks with the copy ready (no API)', jobs.filter((j) => j.manualTask && /Facebook Groups/.test(j.manualTarget)).length >= 3);
    ok('Google Business Profile becomes a guided task until the vendor grants access', jobs.some((j) => j.manualTask && /Google Business Profile/.test(j.manualTarget) && j.content.guided));
    ok('Instagram posts use the page banner', jobs.filter((j) => j.channel === 'INSTAGRAM').every((j) => j.assetUrl === 'https://img.example/ravi.jpg'));
    ok('posts are spread over the month, from tomorrow, not all on one day', new Set(jobs.map((j) => j.scheduledFor.toISOString().slice(0, 10))).size >= 15 && jobs[0].scheduledFor > new Date());
    r = await call('POST', '/leadspace/promote/calendar', { days: 30 }, shop.token);
    ok('asking again for the same month does not double up', r.status === 400 && /already has posts/.test(r.body.message), J(r.body));

    r = await call('GET', '/admin/leadspace/promotion/queue', undefined, A);
    ok('the admin sees the posts waiting for approval, with the business name', r.data.length === jobs.length && r.data[0].businessName === 'Ravi Plumbing', J(r.data[0]));
    const first = jobs.filter((j) => !j.manualTask)[0];
    r = await call('PUT', `/admin/leadspace/promotion/jobs/${first.id}/edit`, { caption: 'Guaranteed to fix any leak' }, A);
    ok('an edit that breaks the guardrails is refused', r.status === 400, J(r.body));
    r = await call('PUT', `/admin/leadspace/promotion/jobs/${first.id}/edit`, { caption: `Leaks in Chennai? Tap repair from Rs 350. https://get4domain.com/ls/ravi-plumbing-chennai` }, A);
    ok('a clean edit is saved', r.status < 300 && /Rs 350/.test(r.data.content.caption), J(r.body));
    const second = jobs.filter((j) => !j.manualTask)[1];
    r = await call('PUT', `/admin/leadspace/promotion/jobs/${second.id}/reject`, { note: 'wrong tone' }, A);
    ok('a post can be rejected with a reason', r.data.status === 'SKIPPED' && JSON.stringify(r.data.approvalLog).includes('wrong tone'), J(r.body));
    const ids = jobs.filter((j) => j.id !== second.id).map((j) => j.id);
    r = await call('POST', '/admin/leadspace/promotion/approve', { ids }, A);
    ok('approving posts schedules the ones for connected accounts on the publisher', r.data.approved === ids.length && r.data.scheduled > 0, J(r.data));
    const sched = await prisma.postJob.findMany({ where: { vendorId: shop.id, status: 'SCHEDULED', manualTask: false } });
    ok('each scheduled post has a publisher post with an idempotency key tied to the job', sched.length > 0 && (await prisma.socialPost.count({ where: { idempotencyKey: { in: sched.map((j) => `job:${j.id}`) } } })) === sched.length);
    ok('publisher posts are labelled with the vendor they belong to (for the kill switch)', (await prisma.socialPost.count({ where: { createdBy: `promotion:${shop.id}` } })) === sched.length);
    r = await call('POST', '/admin/leadspace/promotion/approve', { ids }, A);
    ok('approving twice does nothing more', r.data.approved === 0 && r.data.refused.length === ids.length);

    const tasks = (await call('GET', '/admin/leadspace/promotion/tasks', undefined, A)).data;
    ok('the manual task list shows approved Facebook Groups and Google tasks with the copy ready to paste', tasks.length >= 4 && tasks.every((t) => t.content.caption.length > 20 && t.businessName === 'Ravi Plumbing'), J(tasks[0]));
    r = await call('POST', `/admin/leadspace/promotion/tasks/${tasks[0].id}/done`, undefined, A);
    ok('a manual task is marked done', r.data.status === 'POSTED' && r.data.manualDoneAt, J(r.body));
    ok('and leaves the open list', (await call('GET', '/admin/leadspace/promotion/tasks', undefined, A)).data.length === tasks.length - 1);

    // results flow back
    await prisma.socialPost.updateMany({ where: { id: { in: (await prisma.socialPost.findMany({ where: { createdBy: `promotion:${shop.id}` }, take: 3 })).map((x) => x.id) } }, data: { scheduledFor: new Date(Date.now() - 1000) } });
    const dueRun = await publisher.runDue();
    await publisher.pullResults();
    const synced = await promo.sync();
    r = await call('GET', '/leadspace/promote', undefined, shop.token);
    ok('posts that went out appear to the vendor as posted, read only, with a link and results', dueRun.posted > 0 && synced > 0 && r.data.posted.some((x) => x.postUrl && x.results), J(r.data.posted?.slice(0, 2)));
    r = await call('POST', '/leadspace/promote/change-request', { text: 'Please promote the geyser offer first' }, shop.token);
    ok('the vendor can ask for a change, and the admin is told', r.data.received === true && (await prisma.notification.count({ where: { type: 'leadspace_change_request' } })) === 1);

    // kill switches
    const waiting = await prisma.socialPost.count({ where: { createdBy: `promotion:${shop.id}`, status: 'SCHEDULED' } });
    r = await call('PUT', `/admin/leadspace/promotion/vendors/${shop.id}/kill`, { on: true }, A);
    ok('the per-vendor kill switch pauses the plan', r.data.killSwitch === true && r.data.status === 'PAUSED');
    ok('and cancels every post still waiting for that vendor, keeping what was already posted', waiting > 0 && (await prisma.socialPost.count({ where: { createdBy: `promotion:${shop.id}`, status: 'SCHEDULED' } })) === 0 && (await prisma.socialPost.count({ where: { createdBy: `promotion:${shop.id}`, status: 'POSTED' } })) > 0);
    r = await call('PUT', '/leadspace/promote', { on: true }, shop.token);
    ok('the vendor cannot switch it back on while the admin kill switch is set', r.status === 403, J(r.body));
    r = await call('POST', '/leadspace/promote/calendar', {}, shop.token);
    ok('and no new calendar is written', r.status >= 400);
    await call('PUT', `/admin/leadspace/promotion/vendors/${shop.id}/kill`, { on: false }, A);

    section('[feat:leadspace.promotion-rules] Trade rules and the auto-approve step');
    const re = await h.createVendor({ key: 'prera', industry: 'realestate', plan: 'WORKSPACE' });
    await prisma.leadspaceProfile.create({ data: { vendorId: re.id, slug: 'lakeview-chennai', category: 'real-estate', city: 'Chennai', goal: 'SITE_VISIT', businessName: 'Lakeview Homes', phone: '9722222222', alertWhatsapp: '9722222222', status: 'PUBLISHED', verificationStatus: 'VERIFIED', noindex: false, reraNumber: 'TN/29/Building/0123/2020', services: [{ name: 'Lake View Apartments', price: 5500000 }] } });
    promo.setAiWriter(null);
    r = await call('PUT', '/leadspace/promote', { on: true, channels: ['TELEGRAM'], perWeek: 2 }, re.token);
    ok('a real-estate page with a RERA number can be promoted', r.status < 300, J(r.body));
    r = await call('POST', '/leadspace/promote/calendar', { days: 14 }, re.token);
    const reJobs = await prisma.postJob.findMany({ where: { vendorId: re.id } });
    ok('every real-estate post carries the RERA number', r.status < 300 && reJobs.length >= 3 && reJobs.every((j) => j.content.caption.includes('RERA: TN/29/Building/0123/2020')), J(reJobs.map((j) => j.content.caption.slice(-60))));
    promo.setAiWriter(async (p, angle, base) => base.replace(/\nRERA:.*$/, '') + '\nAssured returns of 20% a year!');
    await prisma.postJob.updateMany({ where: { vendorId: re.id }, data: { status: 'SKIPPED' } });
    r = await call('POST', '/leadspace/promote/calendar', { days: 14, replace: true }, re.token);
    ok('AI text promising returns is thrown out for real estate', r.data.skipped.length > 0 && (await prisma.postJob.findMany({ where: { vendorId: re.id, status: { not: 'SKIPPED' } } })).every((j) => !/Assured returns/.test(j.content.caption)), J(r.data));
    promo.setAiWriter(null);

    const cl = await h.createVendor({ key: 'pclin', industry: 'clinic', plan: 'WORKSPACE' });
    const cp = await prisma.leadspaceProfile.create({ data: { vendorId: cl.id, slug: 'care-clinic-chennai', category: 'clinic', city: 'Chennai', goal: 'APPOINTMENT', businessName: 'Care Clinic', phone: '9733333333', alertWhatsapp: '9733333333', status: 'PUBLISHED', verificationStatus: 'VERIFIED', noindex: false, regulated: { clinic: true, reviewed: true }, services: [{ name: 'General consultation' }] } });
    r = await call('PUT', '/leadspace/promote', { on: true }, cl.token);
    ok('a clinic cannot switch promotion on by itself', r.status === 400, J(r.body));
    await call('PUT', `/admin/leadspace/pages/${cp.id}/review`, { approve: true, allowPromotion: true }, A);
    r = await call('PUT', '/leadspace/promote', { on: true, channels: ['TELEGRAM'], perWeek: 1 }, cl.token);
    ok('once an admin allows it, it can', r.status < 300, J(r.body));
    r = await call('POST', '/leadspace/promote/calendar', { days: 14 }, cl.token);
    const clJobs = await prisma.postJob.findMany({ where: { vendorId: cl.id } });
    ok('clinic posts hold no medical claim', clJobs.length > 0 && clJobs.every((j) => !/cure|painless|best doctor/i.test(j.content.caption)), J(clJobs.map((j) => j.content.caption)));

    // after the manual weeks, auto-approve schedules straight away
    const au = await h.createVendor({ key: 'pauto', industry: 'retail', plan: 'WORKSPACE' });
    await prisma.leadspaceProfile.create({ data: { vendorId: au.id, slug: 'auto-shop-chennai', category: 'shop-retail', city: 'Chennai', goal: 'CART_ORDER', businessName: 'Auto Shop', phone: '9744444444', alertWhatsapp: '9744444444', status: 'PUBLISHED', verificationStatus: 'VERIFIED', noindex: false, services: [{ name: 'Rice', price: 100, image: 'https://img.example/rice.jpg' }] } });
    await call('PUT', '/leadspace/promote', { on: true, channels: ['TELEGRAM'], perWeek: 2 }, au.token);
    await prisma.promotionPlan.update({ where: { vendorId: au.id }, data: { manualUntil: new Date(Date.now() - 86_400_000) } });
    r = await call('POST', '/leadspace/promote/calendar', { days: 14 }, au.token);
    ok('with auto-approve off, posts still wait for a person after the manual weeks', r.data.needsApproval === r.data.created && r.data.created > 0, J(r.data));
    await prisma.postJob.updateMany({ where: { vendorId: au.id }, data: { status: 'SKIPPED' } });
    r = await call('PUT', `/admin/leadspace/promotion/vendors/${au.id}/auto-approve`, { on: true }, A);
    r = await call('POST', '/leadspace/promote/calendar', { days: 14, replace: true }, au.token);
    const auJobs = await prisma.postJob.findMany({ where: { vendorId: au.id, status: { not: 'SKIPPED' } } });
    ok('with auto-approve on after the manual weeks, posts are scheduled without a person', r.data.needsApproval === 0 && auJobs.length > 0 && auJobs.every((j) => j.status === 'SCHEDULED' && j.socialPostId), J(auJobs.map((j) => j.status)));

    r = await call('GET', '/admin/leadspace/promotion/sitemap-task', undefined, A);
    ok('the sitemap task names the sitemap, how many pages it holds, and the steps', /sitemap-leadspace\.xml$/.test(r.data.url) && r.data.pages >= 3 && r.data.steps.length === 4, J(r.data));
    r = await call('POST', '/admin/leadspace/promotion/sitemap-task/done', undefined, A);
    ok('marking it done is recorded', (await call('GET', '/admin/leadspace/promotion/sitemap-task', undefined, A)).data.lastDoneAt);

    section('[feat:leadspace.cost-report] Cost per verified lead and the margin alert');
    const ev = (vendorId, profileId, n, status, charged) => prisma.leadEvent.createMany({ data: Array.from({ length: n }, (_, i) => ({ vendorId, profileId, type: 'ENQUIRY', customerName: 'C', customerPhone: '9800000000', phoneHash: `r${Math.random()}`, payload: {}, status, priceChargedPaise: charged, idempotencyKey: `rep-${Math.random()}-${i}` })) });
    const rv = await h.createVendor({ key: 'prep', industry: 'retail', plan: 'WORKSPACE' });
    const rp = await prisma.leadspaceProfile.create({ data: { vendorId: rv.id, slug: 'rep-madurai', category: 'tutor', city: 'Madurai', goal: 'BOOKING', businessName: 'Rep Tutors', phone: '9755555555', status: 'PUBLISHED' } });
    await ev(rv.id, rp.id, 10, 'DELIVERED', 11800);
    await ev(rv.id, rp.id, 2, 'CREDITED', 0);
    const today = new Date().toISOString().slice(0, 10);
    r = await call('POST', '/admin/leadspace/ad-spend', { date: today, channel: 'FACEBOOK_BOOST', category: 'tutor', city: 'Madurai', amountPaise: 80000, note: 'boosted 3 posts' }, A);
    ok('the admin enters ad spend by hand', r.status < 300 && r.data.amountPaise === 80000, J(r.body));
    r = await call('POST', '/admin/leadspace/ad-spend', { date: today, channel: 'GOOGLE', category: 'photography-events', city: 'Salem', amountPaise: 5000 }, A);
    r = await call('GET', '/admin/leadspace/cost-report', undefined, A);
    const row2 = r.data.rows.find((x) => x.category === 'tutor' && x.city === 'Madurai');
    ok('the report counts valid verified events (credited ones are left out)', row2.verifiedEvents === 10 && row2.credited === 2, J(row2));
    ok('revenue is shown before GST: 10 x Rs 118 = Rs 1,000', row2.revenueNetPaise === 100000, J(row2));
    ok('cost per verified lead = spend / verified events (Rs 800 / 10 = Rs 80)', row2.spendPaise === 80000 && row2.costPerVerifiedLeadPaise === 8000, J(row2));
    ok('margin = (1,000 - 800) / 1,000 = 20%', row2.marginPercent === 20, J(row2));
    ok('a margin below the floor raises an alert', /below the 50% floor/.test(row2.alert) && r.data.alerts.some((a) => /tutor in Madurai/.test(a)), J(r.data.alerts));
    ok('spend that matches no trade and city with events is shown as unallocated, not hidden', r.data.unallocatedSpendPaise === 5000, J(r.data.unallocatedSpendPaise));
    await call('PUT', '/admin/leadspace/settings/marginFloorPercent', { value: 10 }, A);
    r = await call('GET', '/admin/leadspace/cost-report', undefined, A);
    ok('the floor is a setting: at 10% the same row is fine', r.data.rows.find((x) => x.category === 'tutor').alert === null);
    ok('a vendor cannot read the cost report', (await call('GET', '/admin/leadspace/cost-report', undefined, rv.token)).status === 403);

    section('[feat:leadspace.funnel] A vendor\'s funnel from views to won');
    await prisma.leadspaceDailyStat.create({ data: { profileId: rp.id, vendorId: rv.id, day: new Date(`${today}T00:00:00Z`), views: 200, ctaClicks: 40, formStarts: 20 } });
    await prisma.leadOtp.createMany({ data: Array.from({ length: 15 }, (_, i) => ({ phoneHash: `p${i}`, codeHash: 'x', vendorId: rv.id, expiresAt: new Date(Date.now() + 60000) })) });
    await prisma.leadEvent.updateMany({ where: { vendorId: rv.id, status: 'DELIVERED' }, data: { status: 'CONTACTED' } });
    const some = await prisma.leadEvent.findMany({ where: { vendorId: rv.id, status: 'CONTACTED' }, take: 3 });
    await prisma.leadEvent.updateMany({ where: { id: { in: some.map((x) => x.id) } }, data: { status: 'WON' } });
    r = await call('GET', '/leadspace/promote/funnel', undefined, rv.token);
    ok('views, taps, forms, codes, events, contacted, won and credited are all counted', r.data.views === 200 && r.data.buttonTaps === 40 && r.data.formsStarted === 20 && r.data.codesRequested === 15 && r.data.verifiedEvents === 12 && r.data.won === 3 && r.data.contacted === 10 && r.data.credited === 2, J(r.data));
    ok('conversion steps are percentages of the step before', r.data.conversion.viewToTap === 20 && r.data.conversion.tapToForm === 50 && r.data.conversion.formToCode === 75, J(r.data.conversion));
    ok('the cost per verified event comes from the cost report', r.data.costPerVerifiedEventPaise === 8000 && r.data.attributedSpendPaise === 80000, J(r.data));
    ok('the admin can open any vendor\'s funnel', (await call('GET', `/admin/leadspace/vendors/${rv.id}/funnel`, undefined, A)).data.views === 200);
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
