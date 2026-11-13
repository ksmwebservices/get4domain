import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { loadPackEngine, buildSeed } from '../src/v3-packs/seed/pack-seed';
import { readSeedSources } from '../src/v3-packs/seed/seed-files';
import { PACK_SETTING_KEYS } from '../src/v3-packs/pack-engine.service';
import { RequiresTab, REQUIRES_TAB, TabGuard } from '../src/v3-packs/requires-tab';
import { MemoryRefStore, makeEngine, realSeed } from './support/pack-fakes';

const staff = { type: 'STAFF' as const, id: 'staff1' };
const owner = (v: string) => ({ type: 'VENDOR' as const, id: v });
const codeOf = async (p: Promise<unknown>): Promise<{ code?: string; status?: number; body?: Record<string, unknown> }> => {
  try { await p; return {}; } catch (e) { const x = e as { getStatus?: () => number; getResponse?: () => Record<string, unknown> }; const body = x.getResponse?.() ?? {}; return { code: body.code as string, status: x.getStatus?.(), body }; }
};

describe('the loaders: dry run, apply, idempotent', () => {
  it('a dry run reads and counts but writes nothing', async () => {
    const s = new MemoryRefStore();
    const r = await loadPackEngine(s, realSeed(), { apply: false });
    expect(r.applied).toBe(false); expect(s.creates).toBe(0);
    expect([r.capabilities.toCreate, r.matrix.toCreate, r.packs.toCreate, r.tabs.toCreate, r.addons.toCreate, r.categories.toCreate]).toEqual([14, 42, 16, 109, 4, 196]);
    expect(r.needsBlueprint).toBe(53); expect(r.problems).toEqual([]);
  });
  it('--apply writes everything once; a second run creates nothing', async () => {
    const s = new MemoryRefStore();
    const first = await loadPackEngine(s, realSeed(), { apply: true });
    expect(first.applied).toBe(true); expect([first.packs.created, first.tabs.created, first.categories.created, first.addons.created]).toEqual([16, 109, 196, 4]);
    const before = s.creates;
    const second = await loadPackEngine(s, realSeed(), { apply: true });
    expect(s.creates).toBe(before); expect(second.packs.toCreate + second.tabs.toCreate + second.categories.toCreate + second.matrix.toCreate + second.capabilities.toCreate + second.addons.toCreate).toBe(0);
    expect(second.packs.existing).toBe(16); expect(second.categories.differs).toEqual([]);
  });
  it('never overwrites an edit made by staff; it only names the row that differs', async () => {
    const s = new MemoryRefStore(); await loadPackEngine(s, realSeed(), { apply: true });
    await s.setMatrixCell('HANDYMAN', 'STORE', true, null);
    await s.updateCategory('plumber', { minTier: 'PROFESSIONAL' }, null);
    const r = await loadPackEngine(s, realSeed(), { apply: true });
    expect(r.matrix.differs).toEqual(['HANDYMAN|STORE']); expect(r.categories.differs).toEqual(['plumber']);
    expect((await s.listMatrix()).find((c) => c.tier === 'HANDYMAN' && c.capabilityKey === 'STORE')!.allowed).toBe(true);
    expect((await s.getCategory('plumber'))!.minTier).toBe('PROFESSIONAL');
  });
  it('refuses to apply while a sheet has a problem, and writes nothing', async () => {
    const src = readSeedSources(); src.categoryMasterCsv = src.categoryMasterCsv.replace('FIELD_SERVICE', 'NOT_A_PACK');
    const s = new MemoryRefStore();
    const r = await loadPackEngine(s, buildSeed(src), { apply: true });
    expect(r.refused).toBe(true); expect(r.problems.join()).toMatch(/unknown pack "NOT_A_PACK"/); expect(s.creates).toBe(0);
  });
});

describe('registration (A5)', () => {
  it('offers the category pack, the category minimum tier, its starter services and what each capability needs', async () => {
    const { svc } = await makeEngine();
    const o = await svc.offer('plumber');
    expect(o.pack.key).toBe('FIELD_SERVICE'); expect(o.tier).toBe('HANDYMAN'); expect(o.starterServices.length).toBeGreaterThan(0);
    expect(o.capabilities).toEqual([{ key: 'STORE', name: 'Online store', included: false, needsTier: 'ECOMMERCE' }]);
    expect(o.addonPacks).toEqual([{ key: 'SHOP', name: 'Shop', bundleDiscount: false, priceStatus: 'PENDING' }]);
  });
  it('sets the one primary pack and keeps the picks', async () => {
    const { svc, vendors, activity } = await makeEngine();
    const first = (await svc.offer('plumber')).starterServices[0];
    const r = await svc.register('v1', { categoryKey: 'plumber', starterServices: [first] }, owner('v1'));
    expect(r).toMatchObject({ packKey: 'FIELD_SERVICE', tier: 'HANDYMAN', starterServices: [first] });
    expect((await vendors.getVendorPack('v1'))!.packKey).toBe('FIELD_SERVICE');
    expect(activity.map((a) => a.actionKey)).toContain('pack.registered');
  });
  it('a capability above the tier answers CAPABILITY_NEEDS_TIER and names the tier', async () => {
    const { svc, vendors } = await makeEngine();
    const e = await codeOf(svc.register('v1', { categoryKey: 'plumber', capabilities: ['STORE'] }, owner('v1')));
    expect(e).toMatchObject({ code: 'CAPABILITY_NEEDS_TIER', status: 403 }); expect(e.body).toMatchObject({ needsTier: 'ECOMMERCE', capability: 'STORE' });
    expect(await vendors.getVendorPack('v1')).toBeNull();
  });
  it('refuses a starter service the category does not offer, an unknown category and an unknown capability', async () => {
    const { svc } = await makeEngine();
    expect((await codeOf(svc.register('v1', { categoryKey: 'plumber', starterServices: ['Space travel'] }, owner('v1')))).code).toBe('PACK_STARTER_UNKNOWN');
    expect((await codeOf(svc.register('v1', { categoryKey: 'no-such' }, owner('v1')))).code).toBe('PACK_CATEGORY_UNKNOWN');
    expect((await codeOf(svc.register('v1', { categoryKey: 'plumber', capabilities: ['FLY'] }, owner('v1')))).code).toBe('PACK_CAPABILITY_UNKNOWN');
  });
  it('the pack never changes with the tier: the same category updates the picks, a different one is refused', async () => {
    const { svc } = await makeEngine();
    await svc.register('v1', { categoryKey: 'plumber' }, owner('v1'));
    await expect(svc.register('v1', { categoryKey: 'plumber', starterServices: [] }, owner('v1'))).resolves.toMatchObject({ packKey: 'FIELD_SERVICE' });
    expect((await codeOf(svc.register('v1', { categoryKey: 'electrician' }, owner('v1')))).code).toBe('PACK_ALREADY_SET');
  });
  it('a category with the new V3 tier (pharmacy is Ecommerce) offers the store without a tier problem', async () => {
    const { svc } = await makeEngine();
    const o = await svc.offer('pharmacy');
    expect(o.tier).toBe('ECOMMERCE'); expect(o.capabilities.every((c) => c.included)).toBe(true);
  });
});

describe('navigation (A4) through the service', () => {
  it('Free trial: four tabs ACTIVE; paid: the common tabs ACTIVE; no plan data is touched', async () => {
    const { svc, plans } = await makeEngine();
    plans.states.set('v1', { mode: 'V3', level: 'FREE', track: 'PROFESSIONAL' });
    const free = await svc.navigation('v1');
    expect(free.tabs.filter((t) => t.state === 'ACTIVE').map((t) => t.key).sort()).toEqual(['industry', 'plan', 'support', 'website']);
    plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    expect((await svc.navigation('v1')).tabs.find((t) => t.key === 'crm')!.state).toBe('ACTIVE');
  });
  it('a vendor with no pack yet still gets the common tabs', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'HANDYMAN' });
    const n = await svc.navigation('v1');
    expect(n.pack).toBeNull(); expect(n.tabs.map((t) => t.scope)).toEqual(Array(13).fill('COMMON'));
  });
  it.each([['PROPERTY', 'listings-agent'], ['CLINIC', 'general-physician'], ['RETAIL', 'grocery-kirana']])('the %s pack tabs reach the vendor from the category map', async (pack, _hint) => {
    const { svc, plans, refs } = await makeEngine();
    const cat = [...refs.cats.values()].find((c) => c.packKey === pack && c.optionalCapabilities.every((k) => k !== 'STORE' || c.minTier !== 'HANDYMAN'))!;
    plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'ECOMMERCE' }); await svc.setSetting('gatedPacksOpen', true, staff);
    await svc.register('v1', { categoryKey: cat.categoryKey }, owner('v1'));
    const n = await svc.navigation('v1');
    expect(n.pack!.key).toBe(pack); expect(n.tabs.filter((t) => t.scope === 'PACK').length).toBeGreaterThan(0); expect(n.tabs.filter((t) => t.scope === 'PACK').every((t) => t.state === 'ACTIVE')).toBe(true);
  });
  it('a LEGACY vendor is not restricted', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('old', { mode: 'LEGACY', level: null, track: null });
    expect((await svc.navigation('old')).tabs.every((t) => t.state === 'ACTIVE')).toBe(true);
  });
});

describe('downgrade and expiry hide but never delete (A3)', () => {
  it('switching a capability on, then dropping a tier: the tab is HIDDEN, every record stays, and it returns on upgrade', async () => {
    const { svc, vendors, plans } = await makeEngine();
    plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'ECOMMERCE' });
    await svc.register('v1', { categoryKey: 'plumber' }, owner('v1'));
    await svc.setCapability('v1', 'STORE', true, owner('v1'));
    expect((await svc.navigation('v1')).tabs.find((t) => t.key === 'store')!.state).toBe('ACTIVE');
    plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    const down = await svc.navigation('v1');
    expect(down.tabs.find((t) => t.key === 'store')).toMatchObject({ state: 'HIDDEN', reason: 'TIER_DOWNGRADE' });
    expect((await vendors.listVendorCapabilities('v1')).find((c) => c.capabilityKey === 'STORE')).toMatchObject({ enabled: true });
    expect((await vendors.getVendorPack('v1'))!.packKey).toBe('FIELD_SERVICE');
    plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'ECOMMERCE' });
    expect((await svc.navigation('v1')).tabs.find((t) => t.key === 'store')!.state).toBe('ACTIVE');
  });
  it('expiry (the plan engine reports the Free level) locks the tabs, deletes nothing, and the paid state returns with the plan', async () => {
    const { svc, vendors, plans } = await makeEngine();
    plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('v1', { categoryKey: 'general-physician', starterServices: [] }, owner('v1')).catch(() => svc.register('v1', { categoryKey: 'plumber' }, owner('v1')));
    await svc.setCapability('v1', 'APPOINTMENTS', true, owner('v1'));
    plans.states.set('v1', { mode: 'V3', level: 'FREE', track: 'PROFESSIONAL' });
    const lapsed = await svc.navigation('v1');
    expect(lapsed.tabs.find((t) => t.key === 'appointments')!.state).toBe('LOCKED_PREVIEW'); expect(lapsed.tabs.find((t) => t.key === 'crm')!.state).toBe('LOCKED_PREVIEW');
    expect((await vendors.listVendorCapabilities('v1')).length).toBe(1);
    plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    expect((await svc.navigation('v1')).tabs.find((t) => t.key === 'appointments')!.state).toBe('ACTIVE');
  });
  it('switching a capability off hides the tab and keeps the row', async () => {
    const { svc, vendors, plans } = await makeEngine(); plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.setCapability('v1', 'APPOINTMENTS', true, owner('v1')); await svc.setCapability('v1', 'APPOINTMENTS', false, owner('v1'));
    expect((await svc.navigation('v1')).tabs.some((t) => t.key === 'appointments')).toBe(false);
    expect((await vendors.listVendorCapabilities('v1'))[0]).toMatchObject({ capabilityKey: 'APPOINTMENTS', enabled: false });
  });
});

describe('cross-tenant isolation (A7)', () => {
  it('vendor B sees nothing of vendor A\'s pack, capabilities or add-ons', async () => {
    const { svc, vendors, plans } = await makeEngine();
    plans.states.set('A', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' }); plans.states.set('B', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('A', { categoryKey: 'plumber' }, owner('A')); await svc.setCapability('A', 'APPOINTMENTS', true, owner('A'));
    await svc.setVendorAddon('A', 'PHARMACY_COUNTER', 'ACTIVE', staff);
    const b = await svc.navigation('B');
    expect(b.pack).toBeNull(); expect(b.tabs.every((t) => t.scope === 'COMMON')).toBe(true);
    expect(await vendors.getVendorPack('B')).toBeNull(); expect(await vendors.listVendorCapabilities('B')).toEqual([]); expect(await vendors.listVendorAddons('B')).toEqual([]);
    expect((await svc.myCapabilities('B')).some((c) => c.held)).toBe(false);
    const a = await svc.navigation('A'); expect(a.tabs.some((t) => t.key === 'pharmacy_counter')).toBe(true); expect(b.tabs.some((t) => t.key === 'pharmacy_counter')).toBe(false);
  });
});

describe('add-on packs through the service (V3A)', () => {
  it('SHOP grants the store to a Professional vendor and ending it hides the tab and keeps the data', async () => {
    const { svc, vendors, plans } = await makeEngine(); plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    expect((await codeOf(svc.setCapability('v1', 'STORE', true, owner('v1')))).code).toBe('CAPABILITY_NEEDS_TIER');
    await svc.setVendorAddon('v1', 'SHOP', 'ACTIVE', staff);
    expect((await svc.navigation('v1')).tabs.find((t) => t.key === 'store')!.state).toBe('ACTIVE');
    await svc.setVendorAddon('v1', 'SHOP', 'ENDED', staff);
    expect((await svc.navigation('v1')).tabs.find((t) => t.key === 'store')!.state).toBe('HIDDEN');
    expect((await vendors.listVendorCapabilities('v1')).find((c) => c.capabilityKey === 'STORE')!.enabled).toBe(true);
  });
  it('an unknown add-on pack is refused', async () => { const { svc } = await makeEngine(); expect((await codeOf(svc.setVendorAddon('v1', 'MAGIC', 'ACTIVE', staff))).code).toBe('PACK_NOT_FOUND'); });
});

describe('online medicine checkout stays OFF (V3A)', () => {
  it('is OFF by default and for every vendor, ON only after SUPER_ADMIN switches it, and only for the Pharmacy pack', async () => {
    const { svc, plans } = await makeEngine();
    plans.states.set('ph', { mode: 'V3', level: 'PRO', track: 'ECOMMERCE' }); plans.states.set('pl', { mode: 'V3', level: 'PRO', track: 'ECOMMERCE' });
    await svc.register('ph', { categoryKey: 'pharmacy' }, owner('ph')); await svc.register('pl', { categoryKey: 'plumber' }, owner('pl'));
    expect((await svc.adminSettings()).onlineMedicineCheckout).toBe(false);
    expect((await svc.navigation('ph')).flags.onlineMedicineCheckout).toBe(false);
    await svc.setSetting('onlineMedicineCheckout', true, staff);
    expect((await svc.navigation('ph')).flags.onlineMedicineCheckout).toBe(true); expect((await svc.navigation('pl')).flags.onlineMedicineCheckout).toBe(false);
    expect(PACK_SETTING_KEYS.onlineMedicineCheckout).toBe('packOnlineMedicineCheckout');
  });
  it('the pack tabs of a counsel gated pack (Pharmacy, Clinic, Lab, Legal and finance) stay HIDDEN until the switch is on', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('ph', { mode: 'V3', level: 'PRO', track: 'ECOMMERCE' });
    await svc.register('ph', { categoryKey: 'pharmacy' }, owner('ph'));
    expect((await svc.navigation('ph')).tabs.filter((t) => t.scope === 'PACK').every((t) => t.state === 'HIDDEN')).toBe(true);
    await svc.setSetting('gatedPacksOpen', true, staff);
    expect((await svc.navigation('ph')).tabs.filter((t) => t.scope === 'PACK').every((t) => t.state === 'ACTIVE')).toBe(true);
  });
});

describe('admin edits (A6) write the activity log', () => {
  it('editing a pack, a tab, a category, the matrix and a switch each write one activity row', async () => {
    const { svc, activity } = await makeEngine();
    await svc.editPack('CLINIC', { reviewStatus: 'OWNER_REVIEWED' }, staff);
    await svc.saveTab({ scope: 'COMMON', ownerKey: 'COMMON', key: 'reports', label: 'Reports', route: '/reports' }, staff);
    await svc.editCategory('plumber', { minTier: 'PROFESSIONAL' }, staff);
    await svc.setMatrixCell('HANDYMAN', 'APPOINTMENTS', true, staff);
    await svc.setSetting('gatedPacksOpen', true, staff);
    expect(activity.map((a) => a.actionKey)).toEqual(['pack.edited', 'pack.tab.saved', 'pack.category.edited', 'pack.matrix.changed', 'pack.setting.changed']);
  });
  it('a changed matrix cell changes what the tier allows from the next read', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'HANDYMAN' });
    expect((await codeOf(svc.setCapability('v1', 'APPOINTMENTS', true, owner('v1')))).code).toBe('CAPABILITY_NEEDS_TIER');
    await svc.setMatrixCell('HANDYMAN', 'APPOINTMENTS', true, staff);
    await expect(svc.setCapability('v1', 'APPOINTMENTS', true, owner('v1'))).resolves.toEqual({ key: 'APPOINTMENTS', enabled: true });
  });
  it('refuses an invalid pack config, an invalid tab, an unknown pack, tier or capability', async () => {
    const { svc } = await makeEngine();
    expect((await codeOf(svc.editPack('CLINIC', { config: { crmPipelines: 'x' } }, staff))).code).toBe('PACK_INVALID');
    expect((await codeOf(svc.saveTab({ scope: 'PACK', ownerKey: 'NOPE', key: 'k', label: 'K', route: '/k' }, staff))).code).toBe('PACK_INVALID');
    expect((await codeOf(svc.editPack('NOPE', { name: 'x' }, staff))).code).toBe('PACK_NOT_FOUND');
    expect((await codeOf(svc.setMatrixCell('GOLD', 'STORE', true, staff))).code).toBe('PACK_MATRIX_INVALID');
    expect((await codeOf(svc.setMatrixCell('HANDYMAN', 'FLY', true, staff))).code).toBe('PACK_CAPABILITY_UNKNOWN');
    expect((await codeOf(svc.editCategory('plumber', { packKey: 'NOPE' }, staff))).code).toBe('PACK_NOT_FOUND');
  });
});

describe('locked-route refusal (A4): the guard behind @RequiresTab', () => {
  const ctx = (user: unknown, key: string): { context: ExecutionContext; req: Record<string, unknown> } => {
    const req: Record<string, unknown> = { user };
    class C { handler(): void { /* route */ } }
    RequiresTab(key)(C.prototype, 'handler', Object.getOwnPropertyDescriptor(C.prototype, 'handler')!);
    const context = { getHandler: () => C.prototype.handler, getClass: () => C, switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    return { context, req };
  };
  const vendor = (id: string) => ({ sub: id, role: 'VENDOR', email: 'x@example.com' });

  it('refuses a Free vendor on a locked tab with the registered code TAB_LOCKED, the state, the reason and the tier', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('v1', { mode: 'V3', level: 'FREE', track: 'PROFESSIONAL' });
    const guard = new TabGuard(new Reflector(), svc); const { context } = ctx(vendor('v1'), 'crm');
    const err = await guard.canActivate(context).catch((e) => e as ForbiddenException);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'TAB_LOCKED', tab: 'crm', state: 'LOCKED_PREVIEW', reason: 'FREE_TRIAL' });
  });
  it('lets an ACTIVE tab through, and the Free vendor\'s plan tab too', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('v1', { mode: 'V3', level: 'FREE', track: 'HANDYMAN' }); plans.states.set('v2', { mode: 'V3', level: 'PRO', track: 'HANDYMAN' });
    const guard = new TabGuard(new Reflector(), svc);
    await expect(guard.canActivate(ctx(vendor('v1'), 'plan').context)).resolves.toBe(true);
    await expect(guard.canActivate(ctx(vendor('v2'), 'crm').context)).resolves.toBe(true);
  });
  it('refuses a HIDDEN tab after a downgrade and a tab the vendor never had', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'ECOMMERCE' });
    await svc.setCapability('v1', 'STORE', true, owner('v1')); plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    const guard = new TabGuard(new Reflector(), svc);
    expect(((await guard.canActivate(ctx(vendor('v1'), 'store').context).catch((e) => e)) as ForbiddenException).getResponse()).toMatchObject({ code: 'TAB_LOCKED', state: 'HIDDEN' });
    expect(((await guard.canActivate(ctx(vendor('v1'), 'lab').context).catch((e) => e)) as ForbiddenException).getResponse()).toMatchObject({ code: 'TAB_LOCKED', state: 'UNKNOWN' });
  });
  it('never restricts a vendor still on the Version 2 rules, and refuses staff (a vendor account is needed)', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('old', { mode: 'LEGACY', level: null, track: null });
    const guard = new TabGuard(new Reflector(), svc);
    await expect(guard.canActivate(ctx(vendor('old'), 'crm').context)).resolves.toBe(true);
    await expect(guard.canActivate(ctx({ sub: 's', role: 'SUPER_ADMIN', email: 's@example.com' }, 'crm').context)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('asks the engine once per request for one tab', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('v1', { mode: 'V3', level: 'PRO', track: 'HANDYMAN' });
    const spy = jest.spyOn(svc, 'access'); const guard = new TabGuard(new Reflector(), svc); const { context } = ctx(vendor('v1'), 'crm');
    await guard.canActivate(context); await guard.canActivate(context);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it('a route with no tab marker is left alone', async () => {
    const { svc } = await makeEngine(); const guard = new TabGuard(new Reflector(), svc);
    const context = { getHandler: () => () => undefined, getClass: () => class X {}, switchToHttp: () => ({ getRequest: () => ({}) }) } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true); expect(REQUIRES_TAB).toBe('packs:requires-tab');
  });
});
