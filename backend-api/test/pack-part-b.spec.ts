import * as fs from 'fs';
import * as path from 'path';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { chooseEffectivePlan, resolveEntitlements } from '../src/plans/entitlements/entitlement-engine';
import { NAV_GROUPS, NavTabDef, resolveNav, upsellText } from '../src/v3-packs/core/nav-core';
import { SHELL_MATRIX, shellSections, tabsFor, TEAM_TAB_AREA } from '../src/v3-packs/core/shell-access';
import { AppShellService } from '../src/v3-packs/app-shell.service';
import { REQUIRES_TAB, TabGuard } from '../src/v3-packs/requires-tab';
import { makeEngine } from './support/pack-fakes';
import { MeDomainsController } from '../src/site-domains/api/me-domains.controller';
import { MeConnectionController } from '../src/v3-domain-automation/api/connection.controllers';
import { MeDomainSalesController } from '../src/v3-registrar/api/registrar.controllers';
import { DomainsController } from '../src/domains/domains.controller';

const staff = { type: 'STAFF' as const, id: 'staff1' };
const owner = (v: string) => ({ type: 'VENDOR' as const, id: v });
const codeOf = async (p: Promise<unknown>): Promise<{ code?: string; status?: number }> => {
  try { await p; return {}; } catch (e) { const x = e as { getStatus?: () => number; getResponse?: () => Record<string, unknown> }; return { code: x.getResponse?.().code as string, status: x.getStatus?.() }; }
};
const src = path.resolve(__dirname, '../src');

// ── B13: the paused plan state ─────────────────────────────────────────────────────────────────────────────────────────

const plans = [{ id: 'p-free', key: 'pro_free', track: 'PROFESSIONAL', level: 'FREE', status: 'ACTIVE' }, { id: 'p-pro', key: 'pro_paid', track: 'PROFESSIONAL', level: 'PRO', status: 'ACTIVE' }];
const sub = { id: 's1', planId: 'p-pro', status: 'ACTIVE' as const, termMonths: 12, startsAt: new Date('2026-01-01'), endsAt: new Date('2027-01-01'), graceEndsAt: null };
const cell = (state: string) => ({ state: state as never, limitValue: null, enumValue: null, upsellText: 'Upgrade' });
const matrix = new Map([['p-free', new Map([['crm', cell('LOCKED_PREVIEW')]])], ['p-pro', new Map([['crm', cell('ACTIVE')]])]]);
const base = { now: new Date('2026-06-01'), flagOn: true, subscription: sub, plans, matrix, featureKeys: ['crm'], overrides: [], settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' } };

describe('B13 the entitlement engine: a paused plan', () => {
  it('a running paid plan that is not paused is unchanged: the paid plan applies and the state is ACTIVE', () => {
    const r = resolveEntitlements(base);
    expect([r.plan, r.level, r.paused, r.planState, r.subscriptionStatus]).toEqual(['pro_paid', 'PRO', false, 'ACTIVE', 'ACTIVE']);
    expect(r.features.crm.state).toBe('ACTIVE');
  });
  it('a paused paid plan falls to the track\'s Free plan, says PAUSED, and keeps the subscription row and its status untouched', () => {
    const r = resolveEntitlements({ ...base, vendorPaused: true });
    expect([r.plan, r.subscribedPlan, r.level, r.paused, r.planState, r.subscriptionStatus]).toEqual(['pro_free', 'pro_paid', 'FREE', true, 'PAUSED', 'ACTIVE']);
    expect(r.features.crm.state).toBe('LOCKED_PREVIEW');
  });
  it('a pause on a vendor who has no paid plan is not reported (nothing is paused)', () => {
    const free = { ...sub, planId: 'p-free', termMonths: null };
    const r = resolveEntitlements({ ...base, subscription: free, vendorPaused: true });
    expect([r.paused, r.planState]).toEqual([false, 'ACTIVE']);
    expect(chooseEffectivePlan({ subscription: free, plans, settings: base.settings, now: base.now, vendorPaused: true }).fellBack).toBe(false);
  });
  it('resuming returns the paid plan at once (nothing was deleted or rewritten)', () => {
    expect(resolveEntitlements({ ...base, vendorPaused: false }).plan).toBe('pro_paid');
  });
});

const defs: NavTabDef[] = [
  { scope: 'COMMON', ownerKey: 'COMMON', key: 'website', label: 'Website', route: '/website', minTier: null, capabilityKey: null, freeTrial: true, sortOrder: 1 },
  { scope: 'COMMON', ownerKey: 'COMMON', key: 'crm', label: 'CRM', route: '/crm', minTier: null, capabilityKey: null, freeTrial: false, sortOrder: 2 },
  { scope: 'PACK', ownerKey: 'RETAIL', key: 'orders', label: 'Orders', route: '/orders', minTier: 'PROFESSIONAL', capabilityKey: null, freeTrial: false, sortOrder: 1 },
  { scope: 'CAPABILITY', ownerKey: 'STORE', key: 'store', label: 'Store', route: '/store', minTier: null, capabilityKey: 'STORE', freeTrial: false, sortOrder: 1 },
  { scope: 'ADDON', ownerKey: 'SHOP', key: 'shop', label: 'Shop', route: '/shop', minTier: null, capabilityKey: null, freeTrial: false, sortOrder: 1 },
];
const matrixSets = new Map<'HANDYMAN' | 'PROFESSIONAL' | 'ECOMMERCE', ReadonlySet<string>>([['HANDYMAN', new Set()], ['PROFESSIONAL', new Set()], ['ECOMMERCE', new Set(['STORE'])]]);
const input = { mode: 'V3' as const, level: 'PRO' as const, tier: 'ECOMMERCE' as const, tabs: defs, pack: { key: 'RETAIL', counselGated: false }, gatedPacksOpen: false, matrix: matrixSets, held: new Set(['STORE']), addons: new Set(['SHOP']) };

describe('B13 the navigation core: paused', () => {
  it('Free trial tabs stay ACTIVE; every other tab is LOCKED_PREVIEW with the reason PLAN_PAUSED, capability tabs HIDDEN, and the add-on tab locked', () => {
    const tabs = resolveNav({ ...input, level: 'FREE', paused: true });
    const by = Object.fromEntries(tabs.map((t) => [t.key, t]));
    expect([by.website.state, by.website.reason]).toEqual(['ACTIVE', null]);
    for (const k of ['crm', 'orders', 'shop']) expect([k, by[k].state, by[k].reason]).toEqual([k, 'LOCKED_PREVIEW', 'PLAN_PAUSED']);
    expect([by.store.state, by.store.reason]).toEqual(['HIDDEN', 'PLAN_PAUSED']);
    expect(by.crm.upsellText).toMatch(/paused/i);
  });
  it('after the plan resumes every tab returns (nothing was removed from the list)', () => {
    const paused = resolveNav({ ...input, level: 'FREE', paused: true }).map((t) => t.key);
    const resumed = resolveNav({ ...input, paused: false });
    expect(resumed.map((t) => t.key)).toEqual(paused);
    expect(resumed.every((t) => t.state === 'ACTIVE')).toBe(true);
  });
});

// ── B9: the contract of the tab list ───────────────────────────────────────────────────────────────────────────────────

describe('B9 the navigation contract: key, label, route, group, state and upsell text', () => {
  const tabs = resolveNav({ ...input, level: 'FREE' });
  it('every tab carries exactly the contract fields', () => {
    for (const t of tabs) expect(Object.keys(t).sort()).toEqual(['capabilityKey', 'group', 'key', 'label', 'needsTier', 'ownerKey', 'reason', 'route', 'scope', 'state', 'upsellText']);
  });
  it('the groups are COMMON, PACK, CAPABILITY and ADDON, drawn in that order, and a tab\'s group is one of them', () => {
    expect([...NAV_GROUPS]).toEqual(['COMMON', 'PACK', 'CAPABILITY', 'ADDON']);
    const seen = tabs.map((t) => NAV_GROUPS.indexOf(t.group));
    expect(seen.every((g) => g >= 0)).toBe(true);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
  it('a locked tab has an upsell sentence, an ACTIVE tab has none, and the sentences hold no price, timeframe or internal word', () => {
    for (const t of tabs) { if (t.state === 'ACTIVE') expect(t.upsellText).toBeNull(); else expect(typeof t.upsellText).toBe('string'); }
    const all = [upsellText('FREE_TRIAL', 'PROFESSIONAL'), upsellText('FREE_TRIAL', null), upsellText('NEEDS_TIER', 'ECOMMERCE'), upsellText('TIER_DOWNGRADE', 'ECOMMERCE'), upsellText('PLAN_PAUSED', null)].join(' ');
    expect(all).not.toMatch(/₹|\d|workspace|bos\b|leadspace|leads|days|months|weeks/i);
  });
  it('the tier named in an upsell is the tier that opens the tab', () => {
    const crm = resolveNav({ ...input, level: 'PRO', tier: 'HANDYMAN', held: new Set() }).find((t) => t.key === 'orders')!;
    expect([crm.state, crm.reason, crm.needsTier]).toEqual(['LOCKED_PREVIEW', 'NEEDS_TIER', 'PROFESSIONAL']);
    expect(crm.upsellText).toContain('Professional');
  });
});

// ── the service: pause and resume, activity, isolation, navigation answer ─────────────────────────────────────────────

describe('B13 the pack engine service: pause and resume', () => {
  it('pausing a running paid plan locks the tabs and says PAUSED in the navigation answer; resuming brings them back', async () => {
    const { svc, plans: p, vendors, activity } = await makeEngine();
    p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('v1', { categoryKey: 'plumber' }, owner('v1'));
    expect((await svc.navigation('v1')).tabs.find((t) => t.key === 'crm')!.state).toBe('ACTIVE');
    await expect(svc.pausePlan('v1', 'Owner asked for a break', staff)).resolves.toMatchObject({ paused: true });
    p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL', paused: true });
    const nav = await svc.navigation('v1');
    expect([nav.paused, nav.planState, nav.level]).toEqual([true, 'PAUSED', 'FREE']);
    expect(nav.tabs.find((t) => t.key === 'crm')).toMatchObject({ state: 'LOCKED_PREVIEW', reason: 'PLAN_PAUSED' });
    expect(nav.tabs.find((t) => t.key === 'website')!.state).toBe('ACTIVE');
    p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await expect(svc.resumePlan('v1', staff)).resolves.toEqual({ paused: false });
    expect((await svc.navigation('v1')).tabs.find((t) => t.key === 'crm')!.state).toBe('ACTIVE');
    expect(vendors.pauseHistory).toHaveLength(1);   // the pause is kept as history, never deleted
    expect(activity.filter((a) => a.actionKey === 'plan.paused' || a.actionKey === 'plan.resumed').map((a) => a.actionKey)).toEqual(['plan.paused', 'plan.resumed']);
    expect(p.invalidated).toEqual(['v1', 'v1']);   // the entitlement cache is told, so the change shows at once
  });
  it('a second pause, a resume with no pause, and a pause of a plan that is not paid each answer with a registered code', async () => {
    const { svc, plans: p } = await makeEngine();
    p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'HANDYMAN' }); p.states.set('free', { mode: 'V3', level: 'FREE', track: 'HANDYMAN' }); p.states.set('old', { mode: 'LEGACY', level: null, track: null });
    await svc.pausePlan('v1', 'first', staff); p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'HANDYMAN', paused: true });
    expect(await codeOf(svc.pausePlan('v1', 'again', staff))).toEqual({ code: 'PLAN_ALREADY_PAUSED', status: 409 });
    expect(await codeOf(svc.resumePlan('free', staff))).toEqual({ code: 'PLAN_NOT_PAUSED', status: 409 });
    expect(await codeOf(svc.pausePlan('free', 'x', staff))).toEqual({ code: 'PLAN_NOT_PAUSABLE', status: 409 });
    expect(await codeOf(svc.pausePlan('old', 'x', staff))).toEqual({ code: 'PLAN_NOT_PAUSABLE', status: 409 });
  });
  it('a pause of one vendor never touches another vendor', async () => {
    const { svc, plans: p, vendors } = await makeEngine();
    p.states.set('a', { mode: 'V3', level: 'PRO', track: 'HANDYMAN' }); p.states.set('b', { mode: 'V3', level: 'PRO', track: 'HANDYMAN' });
    await svc.pausePlan('a', 'only a', staff);
    expect(await vendors.getOpenPause('a')).not.toBeNull(); expect(await vendors.getOpenPause('b')).toBeNull();
    expect(await codeOf(svc.resumePlan('b', staff))).toEqual({ code: 'PLAN_NOT_PAUSED', status: 409 });
  });
});

// ── B10: add-on packs in the vendor's pack list ───────────────────────────────────────────────────────────────────────

describe('B10 add-on packs', () => {
  it('all four keys are returned with the price PENDING and no number', async () => {
    const { svc } = await makeEngine();
    const list = await svc.myAddons('v1');
    expect(list.map((a) => a.key).sort()).toEqual(['HOME_SAMPLE_COLLECTION', 'ONLINE_ORDERING_DELIVERY', 'PHARMACY_COUNTER', 'SHOP']);
    for (const a of list) { expect([a.priceStatus, a.price, a.priceNote]).toEqual(['PENDING', null, 'Price not set']); expect(JSON.stringify(a)).not.toMatch(/\d{2,}|₹|paise/i); }
  });
  it('a vendor sees which add-ons its category offers, and which are on', async () => {
    const { svc, plans: p } = await makeEngine(); p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('v1', { categoryKey: 'plumber' }, owner('v1'));
    const before = await svc.myAddons('v1');
    expect(before.find((a) => a.key === 'SHOP')).toMatchObject({ offered: true, active: false });
    await svc.setVendorAddon('v1', 'SHOP', 'ACTIVE', staff);
    expect((await svc.myAddons('v1')).find((a) => a.key === 'SHOP')).toMatchObject({ active: true });
    expect((await svc.myAddons('other')).find((a) => a.key === 'SHOP')).toMatchObject({ active: false });   // another vendor is not affected
  });
  it('buying an add-on answers ADDON_PRICE_PENDING (409) while the price is pending, and an add-on the category does not offer is not found', async () => {
    const { svc, plans: p } = await makeEngine(); p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('v1', { categoryKey: 'plumber' }, owner('v1'));
    expect(await svc.isAddonKey('SHOP')).toBe(true); expect(await svc.isAddonKey('starter_ai_pack')).toBe(false);
    expect(await codeOf(svc.refuseAddonPurchase('v1', 'SHOP'))).toEqual({ code: 'ADDON_PRICE_PENDING', status: 409 });
    expect(await codeOf(svc.refuseAddonPurchase('v1', 'PHARMACY_COUNTER'))).toEqual({ code: 'PACK_NOT_FOUND', status: 404 });
  });
});

// ── B12: team members, read only, through the permission matrix as data ──────────────────────────────────────────────

describe('B12 the app shell and the permission matrix', () => {
  const owner1 = {}; const member = (modules: string[]) => ({ kind: 'team_member', modules });
  it('the owner is given every section; a member without a message area gets no inbox; a member with one gets it', () => {
    expect(shellSections(owner1).sort()).toEqual(['inbox', 'navigation', 'packs', 'plan']);
    expect(shellSections(member([])).sort()).toEqual(['navigation', 'packs', 'plan']);
    expect(shellSections(member(['communication'])).sort()).toEqual(['inbox', 'navigation', 'packs', 'plan']);
    expect(shellSections(member(['telecrm'])).includes('inbox')).toBe(true);
    expect(shellSections(member(['wallet', 'accounts'])).includes('inbox')).toBe(false);
  });
  it('the matrix is data: it names no price, order, invoice or setting section', () => {
    expect(Object.keys(SHELL_MATRIX).sort()).toEqual(['inbox', 'navigation', 'packs', 'plan']);
  });
  it('a team member\'s tab list never holds billing, plan, domain or migration, and common tabs need the member\'s area', async () => {
    const { svc, plans: p } = await makeEngine(); p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('v1', { categoryKey: 'plumber' }, owner('v1'));
    const nav = await svc.navigation('v1');
    const none = tabsFor(member([]), nav.tabs).map((t) => t.key);
    for (const k of ['billing', 'plan', 'domain', 'migration', 'crm', 'telecrm', 'accounting']) expect(none).not.toContain(k);
    expect(none).toEqual(expect.arrayContaining(['support']));
    const crmMember = tabsFor(member(['telecrm']), nav.tabs).map((t) => t.key);
    expect(crmMember).toEqual(expect.arrayContaining(['crm', 'telecrm'])); expect(crmMember).not.toContain('billing');
    expect(tabsFor(owner1, nav.tabs)).toHaveLength(nav.tabs.length);   // the owner's list is whole
  });
  it('a common tab nobody listed is owner only (fail closed), and every common tab of the data is listed', async () => {
    const { svc, plans: p } = await makeEngine(); p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    const nav = await svc.navigation('v1');
    expect(nav.tabs.filter((t) => t.scope === 'COMMON').map((t) => t.key).filter((k) => !(k in TEAM_TAB_AREA))).toEqual([]);
    expect(tabsFor(member(['website', 'campaigns', 'accounts', 'ai_studio', 'telecrm']), [{ ...nav.tabs[0], scope: 'COMMON', key: 'brand_new' }]).length).toBe(0);
  });
  it('the shell answer for a team member holds no price, order, invoice, term date or setting', async () => {
    const { svc, plans: p } = await makeEngine(); p.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('v1', { categoryKey: 'plumber' }, owner('v1'));
    const inbox = { badge: jest.fn(async () => ({ waiting: 2, unread: 1 })) };
    const shell = new AppShellService(svc, inbox as never);
    const m = await shell.get('v1', member(['communication']));
    expect(m.actor).toBe('TEAM_MEMBER'); expect(m.inbox).toEqual({ waiting: 2, unread: 1 });
    expect(Object.keys(m).sort()).toEqual(['actor', 'inbox', 'navigation', 'packs', 'plan', 'sections']);
    expect(Object.keys(m.plan!).sort()).toEqual(['level', 'mode', 'paused', 'planState', 'tier']);
    expect(JSON.stringify(m)).not.toMatch(/priceStatus|paise|amount|invoice|endsAt|startsAt|graceEndsAt|termMonths|disclaimer|setting/i);
    const noMsg = await shell.get('v1', member([]));
    expect(noMsg.inbox).toBeNull(); expect(inbox.badge).toHaveBeenCalledTimes(1);   // the count is not even read for a member without the area
    const o = await shell.get('v1', {});
    expect(o.actor).toBe('OWNER'); expect(o.navigation!.tabs.length).toBeGreaterThan(m.navigation!.tabs.length);
  });
  it('the shell of another vendor is its own: the tenant comes from the caller, never from a parameter', async () => {
    const { svc, plans: p } = await makeEngine(); p.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('a', { categoryKey: 'plumber' }, owner('a'));
    const shell = new AppShellService(svc, { badge: async () => ({ waiting: 0, unread: 0 }) } as never);
    expect((await shell.get('a', {})).navigation!.pack).not.toBeNull();
    expect((await shell.get('b', {})).navigation!.pack).toBeNull();
  });
});

// ── B11: the domain screen is closed on a Free trial ────────────────────────────────────────────────────────────────────

describe('B11 the domain screen routes', () => {
  const sources = ['site-domains/api/me-domains.controller.ts', 'v3-domain-automation/api/connection.controllers.ts', 'v3-registrar/api/registrar.controllers.ts', 'domains/domains.controller.ts'];
  it('every vendor controller of the domain screen is behind @RequiresTab(\'domain\')', () => {
    for (const f of sources) expect([f, /@RequiresTab\('domain'\)/.test(fs.readFileSync(path.join(src, f), 'utf8'))]).toEqual([f, true]);
  });
  it('the metadata is on the classes themselves, so every route of them is covered', () => {
    for (const c of [MeDomainsController, MeConnectionController, MeDomainSalesController, DomainsController]) expect([c.name, Reflect.getMetadata(REQUIRES_TAB, c)]).toEqual([c.name, { key: 'domain' }]);
  });
  const ctxFor = (vendorId: string): ExecutionContext => ({
    getHandler: () => function h() {}, getClass: () => { class C {} Reflect.defineMetadata(REQUIRES_TAB, { key: 'domain' }, C); return C; },
    switchToHttp: () => ({ getRequest: () => ({ user: { sub: vendorId, role: 'VENDOR', email: 'v@x.invalid' } }) }),
  }) as unknown as ExecutionContext;
  it('a Free trial vendor is refused with TAB_LOCKED; a paid vendor passes; a vendor on the Version 2 rules passes; a paused vendor is refused', async () => {
    const { svc, plans: p } = await makeEngine();
    p.states.set('free', { mode: 'V3', level: 'FREE', track: 'PROFESSIONAL' }); p.states.set('paid', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    p.states.set('old', { mode: 'LEGACY', level: null, track: null }); p.states.set('paused', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL', paused: true });
    const guard = new TabGuard(new Reflector(), svc);
    const err = await guard.canActivate(ctxFor('free')).catch((e) => e as ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'TAB_LOCKED', tab: 'domain', state: 'LOCKED_PREVIEW', reason: 'FREE_TRIAL' });
    await expect(guard.canActivate(ctxFor('paid'))).resolves.toBe(true);
    await expect(guard.canActivate(ctxFor('old'))).resolves.toBe(true);
    expect(((await guard.canActivate(ctxFor('paused')).catch((e) => e)) as ForbiddenException).getResponse()).toMatchObject({ code: 'TAB_LOCKED', reason: 'PLAN_PAUSED' });
  });
});
