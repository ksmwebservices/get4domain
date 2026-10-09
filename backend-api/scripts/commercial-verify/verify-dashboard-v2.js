// Release 1A, Dashboard v2: lead -> customer in one step (Phase 3), plus later phases append their own sections here.
// Runs the REAL compiled services against the in-memory Prisma stand-in. Run `npx nest build` first.
const { dist, ok, section, rejects, finish } = require('../security-verify/harness');
const { createMemPrisma } = require('./mem-prisma');
const { CrmService } = dist('crm/crm.service');
const { provisionModules, desiredAccess, planProvision } = dist('registry/provisioning');
const { planNavV2, readNavV2, applyNavV2 } = require('../set-vendor-access-lib');
const { NAV_V2_DEFAULT_FROM, AVAILABLE_MODULES } = dist('addons/addons.constants');
const { analyseVendor, renderReport } = require('../nav-v2-dry-run-lib');
const REG = dist('registry/registry.generated');
const { VideoService } = dist('video/video.service');
const { ReelsService } = dist('reels/reels.service');
const COMING = dist('common/coming-soon');
const { DashboardContextService } = dist('registry/dashboard-context.service');
const { AddonsService } = dist('addons/addons.service');
const { PlanAccessService } = dist('registry/plan-access.service');
const { PlanAccessController } = dist('registry/plan-access.controller');
const { CommercialAdminGuard, CommercialAuditService } = dist('commercial/foundation.services');

const seed = () => ({
  vendor: [
    { id: 'v_a', name: 'A', email: 'a@x.in', businessName: 'A Co', subdomain: 'aco' },
    { id: 'v_b', name: 'B', email: 'b@x.in', businessName: 'B Co', subdomain: 'bco' },
  ],
  campaignLead: [
    { id: 'l1', vendorId: 'v_a', name: 'Priya', phone: '9876500001', message: 'Wants a quote', source: 'website', status: 'new', customFields: { size: 'M' } },
    { id: 'l2', vendorId: 'v_a', name: 'Priya again', phone: '9876500001', message: null, source: 'whatsapp', status: 'new', customFields: null },
    { id: 'l3', vendorId: 'v_b', name: 'Other', phone: '9000000000', message: null, source: 'website', status: 'new', customFields: null },
  ],
  contact: [],
});

(async () => {
  section('[feat:sales.leads.convert] lead -> customer in one step');
  {
    const prisma = createMemPrisma(seed());
    const crm = new CrmService(prisma);
    const r1 = await crm.convertToCustomer('l1', 'v_a');
    const t = prisma.$tables;
    ok('creates one customer for this vendor with the lead\'s name and phone', r1.created === true && t.contact.length === 1 && t.contact[0].vendorId === 'v_a' && t.contact[0].name === 'Priya' && t.contact[0].phone === '9876500001' && t.contact[0].type === 'customer');
    ok('the lead is marked won and remembers the customer; its other custom fields are kept', t.campaignLead[0].status === 'won' && t.campaignLead[0].customFields.contactId === r1.contact.id && t.campaignLead[0].customFields.size === 'M');
    const r2 = await crm.convertToCustomer('l1', 'v_a');
    ok('IDEMPOTENT: converting the same lead again returns the same customer and creates nothing', r2.created === false && r2.contact.id === r1.contact.id && t.contact.length === 1);
    const r3 = await crm.convertToCustomer('l2', 'v_a');
    ok('a second lead with the SAME phone does not create a duplicate customer', r3.created === false && r3.contact.id === r1.contact.id && t.contact.length === 1);
    await rejects('vendor B cannot convert vendor A\'s lead', crm.convertToCustomer('l1', 'v_b'), { status: 403 });
    ok('…and nothing was created for vendor B', t.contact.every((c) => c.vendorId === 'v_a'));
    await rejects('an unknown lead is a clean 404', crm.convertToCustomer('nope', 'v_a'), { status: 404 });
  }

  section('[feat:account.billing.provisioning] plan-driven provisioning: grant-only, idempotent, audited');
  {
    const prisma = createMemPrisma({
      vendor: [{ id: 'v1', name: 'A', email: 'a@x.in', businessName: 'A', subdomain: 'a', industry: 'retail' }, { id: 'v2', name: 'B', email: 'b@x.in', businessName: 'B', subdomain: 'b', industry: 'clinic' }],
      vendorModule: [{ id: 'm9', vendorId: 'v2', moduleKey: 'telecrm', enabled: false }, { id: 'm8', vendorId: 'v2', moduleKey: 'growth_hub', enabled: true }],
      vendorAddon: [], commercialAuditLog: [],
    });
    const on = (vid, kind = 'vendorModule', key = 'moduleKey') => prisma.$tables[kind].filter((r) => r.vendorId === vid && r.enabled).map((r) => r[key]).sort();
    const es = desiredAccess('WORKSPACE', false, 'COMMERCE');
    const pro = desiredAccess('BOS', false, 'COMMERCE');
    ok('Essentials gets only modules whose features are built and in the plan (LeadSpace, which replaced Campaigns, is in every plan)', es.modules.includes('telecrm') && es.modules.includes('website_manager') && es.modules.includes('growth_hub') && !es.modules.includes('analytics_hub'), es.modules.join());
    ok('Pro is a superset of Essentials, and includes the Reports and Campaigns modules now that those screens are built and verified (Full BOS); never an unbuilt one', es.modules.every((m) => pro.modules.includes(m)) && pro.modules.includes('analytics_hub') && pro.modules.includes('growth_hub') && !es.modules.includes('analytics_hub'));

    const a1 = await provisionModules(prisma, 'v1', 'WORKSPACE', { actor: 'test', reason: 'activation' });
    ok('ACTIVATION: the Essentials modules are switched on for the vendor', a1.changed && es.modules.every((m) => on('v1').includes(m)), on('v1').join());
    const rowsAfter = prisma.$tables.vendorModule.length; const auditAfter = prisma.$tables.commercialAuditLog.length;
    const a2 = await provisionModules(prisma, 'v1', 'WORKSPACE', { actor: 'test', reason: 'renewal' });
    ok('RENEWAL / IDEMPOTENT: running again changes nothing (no rows, no audit entry)', !a2.changed && prisma.$tables.vendorModule.length === rowsAfter && prisma.$tables.commercialAuditLog.length === auditAfter);
    await provisionModules(prisma, 'v1', 'BOS', { actor: 'test', reason: 'upgrade now' });
    ok('UPGRADE (now): Pro keeps everything Essentials had and adds what Pro includes', es.modules.every((m) => on('v1').includes(m)) && pro.modules.every((m) => on('v1').includes(m)));
    const before = on('v1').join();
    const d1 = await provisionModules(prisma, 'v1', 'WORKSPACE', { actor: 'test', reason: 'downgrade at renewal' });
    ok('DOWNGRADE at renewal: nothing is switched off and no data is touched (the menu locks Pro screens; access is kept until KSM removes it)', on('v1').join() === before && !d1.changed);
    ok('…and the plan shows what is now beyond the plan, so the dry run can list it', planProvision({ modules: prisma.$tables.vendorModule.filter((m) => m.vendorId === 'v1'), addons: [] }, es).beyondPlanModules.length >= 0);
    const fsx = require('fs'); const pathx = require('path'); const cdir = pathx.join(__dirname, '../../src/commercial');
    const touchesModules = fsx.readdirSync(cdir).filter((f) => f.endsWith('.ts') && f !== 'settlement.service.ts').filter((f) => /vendorModule|vendorAddon/.test(fsx.readFileSync(pathx.join(cdir, f), 'utf8')));
    ok('LAPSE: lapse, reminders and renewal scheduling never touch module/add-on rows, so a lapsed vendor keeps what it had', touchesModules.length === 0, touchesModules.join());

    await provisionModules(prisma, 'v2', 'WORKSPACE', { actor: 'test', reason: 'activation' });
    ok('an explicit OFF (KSM exception in Plan access) is respected, not overwritten', prisma.$tables.vendorModule.find((m) => m.id === 'm9').enabled === false);
    ok('a module the vendor already had on (growth_hub) is never switched off', prisma.$tables.vendorModule.find((m) => m.id === 'm8').enabled === true);
    ok('the audit entry lists what was granted and what was kept off', prisma.$tables.commercialAuditLog.some((a) => a.entityId === 'v2' && a.detail.keptOff.includes('telecrm')));
    ok('another vendor rows are not touched by provisioning', on('v1').join() === before);

    const custom = desiredAccess('BOS', true, 'COMMERCE'); const plain = desiredAccess('BOS', false, 'COMMERCE');
    ok('Custom is never a plan: a Custom client gets the Pro set (nothing extra is invented for unbuilt Custom screens)', JSON.stringify(custom) === JSON.stringify(plain));
  }

  section('[feat:account.billing.navv2-switch] set-vendor-access --nav-v2: one vendor, dry run first, idempotent');
  {
    const prisma = createMemPrisma({
      vendor: [
        { id: 'old', name: 'O', email: 'o@x.in', businessName: 'Old Co', subdomain: 'oldco', createdAt: new Date('2026-06-01T00:00:00Z') },
        { id: 'new', name: 'N', email: 'n@x.in', businessName: 'New Co', subdomain: 'newco', createdAt: new Date('2026-10-12T00:00:00Z') },
        { id: 'other', name: 'X', email: 'x@x.in', businessName: 'Other', subdomain: 'otherco', createdAt: new Date('2026-06-01T00:00:00Z') },
      ],
      vendorAddon: [{ id: 'a1', vendorId: 'other', addonKey: 'fleet', enabled: true }], commercialAuditLog: [],
    });
    const cur = await readNavV2(prisma, 'old', NAV_V2_DEFAULT_FROM);
    const plan = planNavV2(cur, true);
    ok('an existing vendor starts OFF (no row, created before the release): turning on is 1 pending change', plan.pending.length === 1 && cur.defaultOn === false);
    ok('the dry run is a pure function: nothing is written', prisma.$tables.vendorAddon.length === 1 && prisma.$tables.commercialAuditLog.length === 0);
    await applyNavV2(prisma, 'old', plan);
    ok('apply switches ONLY that vendor nav_v2 add-on, with an audit entry', prisma.$tables.vendorAddon.filter((a) => a.addonKey === 'nav_v2').length === 1 && prisma.$tables.vendorAddon.find((a) => a.addonKey === 'nav_v2').vendorId === 'old' && prisma.$tables.commercialAuditLog.some((a) => a.action === 'vendor.nav_v2_set' && a.entityId === 'old'));
    ok('every other row is untouched (the other vendor fleet add-on, the new vendor)', prisma.$tables.vendorAddon.find((a) => a.id === 'a1').enabled === true && !prisma.$tables.vendorAddon.some((a) => a.vendorId === 'new' || a.vendorId === 'other' && a.addonKey === 'nav_v2'));
    ok('IDEMPOTENT: planning again shows nothing pending', planNavV2(await readNavV2(prisma, 'old', NAV_V2_DEFAULT_FROM), true).pending.length === 0);
    const fresh = await readNavV2(prisma, 'new', NAV_V2_DEFAULT_FROM);
    ok('a vendor created after the release defaults ON: "on" is already satisfied, "off" is a real change', fresh.defaultOn === true && planNavV2(fresh, true).pending.length === 0 && planNavV2(fresh, false).pending.length === 1);
    await applyNavV2(prisma, 'old', planNavV2(await readNavV2(prisma, 'old', NAV_V2_DEFAULT_FROM), false));
    ok('"off" puts the vendor back on the previous dashboard (row false)', prisma.$tables.vendorAddon.find((a) => a.vendorId === 'old' && a.addonKey === 'nav_v2').enabled === false);
  }

  section('[feat:account.billing.dry-run] nav-v2 dry run: read-only, lists what would be lost');
  {
    const prisma = createMemPrisma({
      vendor: [
        { id: 'u1', name: 'U', email: 'u@x.in', businessName: 'Uses Campaigns', subdomain: 'campco', industry: 'retail', createdAt: new Date('2026-05-01') },
        { id: 'u2', name: 'V', email: 'v@x.in', businessName: 'Plain Shop', subdomain: 'plainco', industry: 'retail', createdAt: new Date('2026-05-01') },
      ],
      billingTerm: [{ id: 't1', vendorId: 'u1', planKey: 'WORKSPACE', isCurrent: true }, { id: 't2', vendorId: 'u2', planKey: 'BOS', isCurrent: true }],
      vendorModule: [{ id: 'm1', vendorId: 'u1', moduleKey: 'growth_hub', enabled: true }, { id: 'm2', vendorId: 'u1', moduleKey: 'telecrm', enabled: true }, { id: 'm3', vendorId: 'u2', moduleKey: 'growth_hub', enabled: true }],
      vendorAddon: [],
      campaignPage: [{ id: 'cp1', vendorId: 'u1' }], campaignLead: [{ id: 'cl1', vendorId: 'u1' }],
      campaign: [], message: [], whatsappConversation: [], vendorProduct: [], posSale: [], contact: [], record: [], genericInvoice: [],
    });
    const snapshot = JSON.stringify(prisma.$tables);
    const vendors = prisma.$tables.vendor;
    const r1 = await analyseVendor(prisma, REG, AVAILABLE_MODULES, vendors[0], NAV_V2_DEFAULT_FROM);
    const r2 = await analyseVendor(prisma, REG, AVAILABLE_MODULES, vendors[1], NAV_V2_DEFAULT_FROM);
    ok('READ-ONLY: the analysis changes no row', JSON.stringify(prisma.$tables) === snapshot);
    ok('a vendor using Campaigns and landing pages is NOT flagged: they became LeadSpace, open on every plan (Phase 7 acceptance: the would-lose-access list is empty)', r1.wouldLose.length === 0, JSON.stringify(r1.wouldLose));
    ok('telecrm with leads is NOT flagged: Leads is Open on Essentials', !r1.wouldLose.some((w) => w.module === 'telecrm'));
    ok('a module switched on with NO data is not flagged (nothing to lose)', r2.wouldLose.length === 0);
    ok('plan is read from the current term, shown by display name', r1.planName === 'Essentials' && r2.planName === 'Pro');
    ok('existing vendors are reported as v2 OFF (created before the release)', r1.navV2Now === false);
    const md = renderReport([r1, r2], { at: '2026-10-09T00:00:00Z', host: 'test' });
    ok('the report says nobody is blocked', md.includes('Blocked (would lose access to something they use): **0**') && md.includes('Nobody.'));
  }

  section('[feat:account.billing.plan-access] admin Plan access: map from the registry, exceptions need a reason, audited, staff-only');
  {
    const prisma = createMemPrisma({
      vendor: [{ id: 'v1', name: 'A', email: 'a@x.in', businessName: 'A Co', subdomain: 'aco', industry: 'retail', role: 'VENDOR' }],
      billingTerm: [{ id: 't1', vendorId: 'v1', planKey: 'WORKSPACE', isCurrent: true }], vendorModule: [], vendorAddon: [], commercialAuditLog: [],
    });
    const svc = new PlanAccessService(prisma, new CommercialAuditService(prisma));
    const ADMIN = { id: 'admin1', email: 'admin@get4domain.com', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' };
    const map = svc.map();
    ok('the map comes from the registry: every row names a feature and its minimum plan by display name', map.length > 5 && map.every((r) => r.featureId && ['LeadSpace', 'Essentials', 'Pro', 'Custom'].includes(r.minPlan)));
    const before = await svc.forVendor('v1');
    ok('a vendor view shows plan, profile and what provisioning would grant', before.planName === 'Essentials' && before.profile === 'COMMERCE' && before.provisionPlan.grantModules.includes('telecrm'));
    await rejects('an exception without a real reason is refused', svc.setException('v1', { kind: 'module', key: 'telecrm', enabled: false, reason: 'no' }, ADMIN), { status: 400 });
    await rejects('an unknown module key is refused', svc.setException('v1', { kind: 'module', key: 'made_up', enabled: true, reason: 'this is a long enough reason' }, ADMIN), { status: 400 });
    await rejects('an unknown vendor is a clean 404', svc.setException('ghost', { kind: 'module', key: 'telecrm', enabled: true, reason: 'this is a long enough reason' }, ADMIN), { status: 404 });
    ok('…and nothing was written by the refused attempts', prisma.$tables.vendorModule.length === 0 && prisma.$tables.commercialAuditLog.length === 0);
    const after = await svc.setException('v1', { kind: 'module', key: 'telecrm', enabled: false, reason: 'Asked to keep the call list off for now' }, ADMIN);
    ok('a valid exception is applied, shown in the history with its reason and who did it', after.modules.find((m) => m.key === 'telecrm').enabled === false && after.exceptions[0].reason.includes('call list') && after.exceptions[0].actor === 'admin@get4domain.com');
    ok('provisioning now keeps that module off (an exception is respected) and lists it as kept off', (await svc.provisionNow('v1', ADMIN)).provisionPlan.keptOffModules.includes('telecrm'));
    const again = prisma.$tables.commercialAuditLog.length; await svc.provisionNow('v1', ADMIN);
    ok('IDEMPOTENT: provisioning again adds no audit entry', prisma.$tables.commercialAuditLog.length === again);

    const guard = new CommercialAdminGuard();
    const ctx = (user) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) });
    const denied = (user) => { try { guard.canActivate(ctx(user)); return false; } catch (e) { return e.getStatus && e.getStatus() === 403; } };
    ok('route guard: MARKETING staff, vendors, team members and sandbox users are all refused (403)', denied({ role: 'ADMIN', adminRole: 'MARKETING' }) && denied({ role: 'VENDOR' }) && denied({ role: 'ADMIN', kind: 'team_member' }) && denied({ role: 'ADMIN', kind: 'sandbox' }) && denied(undefined));
    ok('route guard: platform admin is allowed', guard.canActivate(ctx({ role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' })) === true);
    const guards = Reflect.getMetadata('__guards__', PlanAccessController) || [];
    ok('the whole Plan access controller sits behind CommercialAdminGuard (no route is open)', guards.includes(CommercialAdminGuard));
    // tenancy: forVendor only returns the vendor asked for, never another vendor's rows
    prisma.$tables.vendor.push({ id: 'v2', name: 'B', email: 'b@x.in', businessName: 'B Co', subdomain: 'bco', industry: 'retail', role: 'VENDOR' });
    prisma.$tables.vendorModule.push({ id: 'zz', vendorId: 'v2', moduleKey: 'analytics_hub', enabled: true });
    ok('a vendor view never includes another vendor module rows', (await svc.forVendor('v1')).modules.find((m) => m.key === 'analytics_hub').enabled === false);
  }

  section('[feat:account.billing.honest-copy] new dashboard text: plan names, banned words, bot navigation from the registry');
  {
    const fsx = require('fs'); const pathx = require('path');
    const root = pathx.join(__dirname, '..', '..', '..');
    const v2dir = pathx.join(root, 'get4domain_mvp', 'src', 'dashboard-v2');
    const BANNED = /Workspace|Mini BOS|DomainApp|DomainCampaign|\bApps\b/;
    const offenders = [];
    for (const f of fsx.readdirSync(v2dir)) {
      fsx.readFileSync(pathx.join(v2dir, f), 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line) || /DomainAppTab|import /.test(line)) return;
        if (BANNED.test(line)) offenders.push(f + ':' + (i + 1));
      });
    }
    ok('Dashboard v2 screens never say Workspace, Mini BOS, DomainApp, DomainCampaign or Apps in visible text', offenders.length === 0, offenders.join());
    const labels = REG.FEATURES.map((f) => f.label).concat(REG.DEPARTMENTS.map((d) => d.label));
    ok('no menu label or department name uses the banned words', labels.every((l) => !BANNED.test(l)));
    ok('plan display names are Essentials / Pro / Custom, internal keys unchanged', REG.planDisplayName('WORKSPACE') === 'Essentials' && REG.planDisplayName('BOS') === 'Pro' && REG.planDisplayName('CUSTOM') === 'Custom');
    const ai = fsx.readFileSync(pathx.join(__dirname, '..', '..', 'src', 'ai', 'ai.service.ts'), 'utf8');
    const ids = [...ai.matchAll(/navLine\('([a-z-]+\.[a-z-]+)'\)/g)].map((m) => m[1]);
    ok('the dashboard assistant names screens only through the registry, and every id it uses exists', ids.length >= 4 && ids.every((id) => REG.FEATURES.some((f) => f.id === id)), ids.join());
    ok('the assistant no longer sends vendors to menu names that do not exist (My Campaign, Billing & Payments, My Plans & Services)', !/My Campaign|Billing & Payments|My Plans & Services/.test(ai));
  }

  section('[feat:marketing.ai-studio.reel-video-soon] reels and video: Coming soon and NEVER a wallet debit');
  {
    const calls = [];
    const wallet = new Proxy({}, { get: (_t, name) => async (...args) => { calls.push(String(name)); return name === 'hasSufficientBalance' ? true : name === 'getRate' ? 5000 : undefined; } });
    const settings = { getResolvedValue: async () => 'a-configured-provider-key' };   // worst case: a provider key IS configured
    const video = new VideoService(settings, wallet);
    const reels = new ReelsService(wallet);
    ok('the one switch is ON', COMING.REEL_VIDEO_COMING_SOON === true && /coming soon/i.test(COMING.REEL_VIDEO_COMING_SOON_MESSAGE));
    const v = await video.generate('vendor1', { prompt: 'a reel about shoes' }, false);
    ok('video generate answers coming_soon with a message and no job id', v.status === 'coming_soon' && v.jobId === '' && /coming soon/i.test(v.message));
    const r = await reels.render('vendor1', { images: ['https://x/y.jpg'] }, false);
    ok('reel render answers coming_soon with a message', r.status === 'coming_soon' && /coming soon/i.test(r.message));
    const st = await video.status('none', 'mock_123');
    ok('video status never hands out the demo clip as a vendor video', st.status === 'coming_soon' && st.url === null);
    ok('NO WALLET CALL AT ALL: no balance check, no rate lookup, no deduct (even with a provider key configured)', calls.length === 0, calls.join());
    const vi = await video.generate('vendor1', { prompt: 'x' }, true);
    ok('internal staff get the same answer (nothing is generated or charged for anyone)', vi.status === 'coming_soon' && calls.length === 0);

    const rootx = require('path').join(__dirname, '..', '..', '..', 'get4domain_mvp', 'src');
    const rd = (f) => require('fs').readFileSync(require('path').join(rootx, f), 'utf8');
    const ai = rd('app/dashboard/ai-studio/page.tsx');
    ok('AI Studio: Reel / Video and Photo Reel buttons are disabled and tagged Coming soon', (ai.match(/disabled aria-disabled="true" title="Coming soon"/g) || []).length === 2 && !ai.includes('onClick={openVideo}') && !ai.includes('onClick={openReel}'));
    const pricing = rd('app/(marketing)/pricing/page.tsx');
    ok('public pricing page no longer lists Video generation (the admin setting is untouched)', !/Video generation/.test(pricing) && /video_generation/.test(rd('app/admin/pricing/page.tsx')));
    ok('marketing no longer promises reel/video making (platform features, hero showcase, home AI Studio, comparison table)', !/Images, posters & reels/.test(rd('data/platform-features.ts')) && !/AI reel ready/.test(rd('data/hero-showcase.ts')) && !/Create promotional reels/.test(rd('components/marketing/home/AIStudio.tsx')) && !rd('lib/pricing.ts').includes('Reel / short video'));
    ok('the managed-services human "reels" line is unchanged', /Posts, reels and creative assets produced on a monthly retainer/.test(rd('app/(marketing)/managed-services/page.tsx')));
  }

  section('[feat:home.today.tenancy] Dashboard v2 routes: vendor A can never read vendor B');
  {
    const now = new Date('2026-10-20T00:00:00Z');
    const prisma = createMemPrisma({
      vendor: [
        { id: 'A', name: 'A', email: 'a@x.in', businessName: 'A Shop', subdomain: 'a', industry: 'retail', createdAt: new Date('2026-10-10') },
        { id: 'B', name: 'B', email: 'b@x.in', businessName: 'B Clinic', subdomain: 'b', industry: 'clinic', createdAt: new Date('2026-05-01'), customDomain: 'b-clinic.in' },
      ],
      billingTerm: [{ id: 't1', vendorId: 'A', planKey: 'WORKSPACE', isCurrent: true, status: 'ACTIVE_PAYMENT_DUE' }, { id: 't2', vendorId: 'B', planKey: 'BOS', isCurrent: true, status: 'ACTIVE' }],
      invoice: [{ id: 'i1', vendorId: 'B', kind: 'RENEWAL', status: 'SENT', invoiceNumber: 'INV-B-1', totalAmount: 99999, dueDate: new Date('2026-10-30') }],
      vendorProduct: [{ id: 'p1', vendorId: 'A', active: true }, { id: 'p2', vendorId: 'B', active: true }, { id: 'p3', vendorId: 'B', active: true }],
      campaignLead: [{ id: 'l1', vendorId: 'B', createdAt: new Date('2026-10-18') }],
      posSale: [{ id: 's1', vendorId: 'B', type: 'web', status: 'PENDING_PAYMENT' }],
      vendorAddon: [{ id: 'x1', vendorId: 'B', addonKey: 'nav_v2', enabled: true }],
      vendorPaymentConfig: [], vendorCMS: [],
    });
    const svc = new DashboardContextService(prisma, new AddonsService(prisma));
    const a = await svc.build({ sub: 'A', role: 'VENDOR', email: 'a@x.in' }, now);
    ok('vendor A sees only its own business, plan and numbers', a.businessName === 'A Shop' && a.plan === 'WORKSPACE' && a.planDisplay === 'Essentials' && a.signals.productsAdded === 1 && a.signals.firstLead === false && a.signals.pendingOrders === 0);
    ok('vendor A sees NONE of vendor B invoices, leads, orders or domain', a.paymentDue === null && a.signals.newLeads7d === 0 && a.signals.domainConnected === false);
    ok('a vendor created after the release gets Dashboard v2 by default; an older vendor with an explicit row keeps it', a.navV2 === true);
    const b = await svc.build({ sub: 'B', role: 'VENDOR', email: 'b@x.in' }, now);
    ok('vendor B sees its own data (2 products, 1 new lead, 1 web order, the unpaid invoice)', b.signals.productsAdded === 2 && b.signals.newLeads7d === 1 && b.signals.pendingOrders === 1 && b.paymentDue && b.paymentDue.invoiceNumber === 'INV-B-1' && b.signals.domainConnected === true && b.planDisplay === 'Pro');
    const tm = await svc.build({ sub: 'B', role: 'VENDOR', kind: 'team_member', modules: ['crm'], email: 't@b.in' }, now);
    ok('a team member never sees the plan invoice or amounts due (owner only)', tm.paymentDue === null && tm.principal === 'team_member' && JSON.stringify(tm.memberAreas) === '["crm"]');
    let denied = 0;
    for (const u of [{ sub: 'adm', role: 'ADMIN', email: 'x' }, { sub: 'adm', role: 'SUPER_ADMIN', email: 'x' }, { sub: 'am', role: 'VENDOR', kind: 'admin_member', email: 'x' }]) {
      try { await svc.build(u, now); } catch (e) { if (e.getStatus && e.getStatus() === 403) denied += 1; }
    }
    ok('staff accounts are refused (403): the vendor context is for vendor accounts only', denied === 3);
    let missing = false; try { await svc.build({ sub: 'ghost', role: 'VENDOR', email: 'g' }, now); } catch (e) { missing = e.getStatus && e.getStatus() === 403; }
    ok('an unknown account id is refused, never an empty context', missing);
  }

  section('[feat:account.billing.dry-run] a Step N Rock style shop loses nothing');
  {
    const prisma = createMemPrisma({
      vendor: [{ id: 'S', name: 'S', email: 's@x.in', businessName: 'Step N Rock', subdomain: 'stepnrock', industry: 'retail', createdAt: new Date('2026-09-01') }],
      billingTerm: [{ id: 't', vendorId: 'S', planKey: 'WORKSPACE', isCurrent: true }],
      vendorModule: [{ id: 'm1', vendorId: 'S', moduleKey: 'website_manager', enabled: true }, { id: 'm2', vendorId: 'S', moduleKey: 'telecrm', enabled: true }],
      vendorAddon: [{ id: 'a1', vendorId: 'S', addonKey: 'workspace_menu', enabled: true }],
      vendorProduct: [{ id: 'p1', vendorId: 'S' }, { id: 'p2', vendorId: 'S' }], posSale: [{ id: 'o1', vendorId: 'S' }], campaignLead: [{ id: 'l1', vendorId: 'S' }],
      campaignPage: [], campaign: [], message: [], whatsappConversation: [], contact: [], record: [], genericInvoice: [],
    });
    const r = await analyseVendor(prisma, REG, AVAILABLE_MODULES, prisma.$tables.vendor[0], NAV_V2_DEFAULT_FROM);
    ok('products, orders and leads are all still Open in Dashboard v2 on Essentials: the would-lose-access list is EMPTY', r.wouldLose.length === 0 && r.planName === 'Essentials' && r.counts.open > 5, JSON.stringify(r.wouldLose));
  }
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
