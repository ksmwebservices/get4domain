import { capabilityAnswer, lowestTierFor, NavInput, NavTabDef, resolveNav, tabAccess } from '../src/v3-packs/core/nav-core';
import { matrixRecords, Tier, TIERS } from '../src/v3-packs/core/pack-core';
import { realSeed } from './support/pack-fakes';

const seed = realSeed();
const defs: NavTabDef[] = seed.tabs.map((t) => ({ scope: t.scope, ownerKey: t.ownerKey, key: t.key, label: t.label, route: t.route, minTier: t.minTier, capabilityKey: t.capabilityKey, freeTrial: t.freeTrial, sortOrder: t.sortOrder }));
const matrix = new Map<Tier, Set<string>>(TIERS.map((t) => [t, new Set(matrixRecords(realSettings()).filter((c) => c.tier === t && c.allowed).map((c) => c.capabilityKey))]));
function realSettings() { return require('../src/v3-packs/seed/seed-files').readSeedSources().settings; }

const base = (over: Partial<NavInput>): NavInput => ({ mode: 'V3', level: 'PRO', tier: 'PROFESSIONAL', tabs: defs, pack: null, gatedPacksOpen: false, matrix, held: new Set(), ...over });
const stateOf = (nav: ReturnType<typeof resolveNav>, key: string): string | undefined => nav.find((t) => t.key === key)?.state;
const COMMON = ['website', 'industry', 'promotion', 'crm', 'telecrm', 'billing', 'accounting', 'social', 'ai_studio', 'domain', 'support', 'plan', 'migration'];

describe('Free trial', () => {
  it.each(TIERS.map((t) => [t]))('on a %s Free plan only the site, industry management, plan and support are ACTIVE; every other common tab is LOCKED_PREVIEW', (tier) => {
    const nav = resolveNav(base({ level: 'FREE', tier }));
    expect(nav.filter((t) => t.state === 'ACTIVE').map((t) => t.key).sort()).toEqual(['industry', 'plan', 'support', 'website']);
    for (const k of COMMON.filter((c) => !['website', 'industry', 'plan', 'support'].includes(c))) expect([k, stateOf(nav, k)]).toEqual([k, 'LOCKED_PREVIEW']);
    expect(nav.filter((t) => t.state === 'LOCKED_PREVIEW').every((t) => t.reason === 'FREE_TRIAL')).toBe(true);
  });
  it('a V3 vendor with no plan yet (UNASSIGNED) is on the trial rules too', () => {
    expect(resolveNav(base({ mode: 'UNASSIGNED', level: null, tier: null })).filter((t) => t.state === 'ACTIVE').map((t) => t.key).sort()).toEqual(['industry', 'plan', 'support', 'website']);
  });
  it('a Free vendor sees the tabs of their pack and the capabilities they hold, all locked', () => {
    const nav = resolveNav(base({ level: 'FREE', tier: 'PROFESSIONAL', pack: { key: 'CLINIC', counselGated: false }, held: new Set(['APPOINTMENTS']) }));
    expect(nav.filter((t) => t.scope === 'PACK').length).toBeGreaterThan(0);
    expect(nav.filter((t) => t.scope === 'PACK' || t.scope === 'CAPABILITY').every((t) => t.state === 'LOCKED_PREVIEW')).toBe(true);
    expect(stateOf(nav, 'appointments')).toBe('LOCKED_PREVIEW');
  });
});

describe('paid plans: "Pro" is any paid plan', () => {
  it.each(TIERS.map((t) => [t]))('on a %s paid plan every common tab is ACTIVE', (tier) => {
    const nav = resolveNav(base({ level: 'PRO', tier }));
    for (const k of COMMON) expect([k, stateOf(nav, k)]).toEqual([k, 'ACTIVE']);
  });
  it('an expired or cancelled plan reaches the resolver as level FREE (the Stage 5.1 engine decides that) and falls back to the trial rules; the tabs come back with the plan', () => {
    const paid = resolveNav(base({ level: 'PRO', tier: 'PROFESSIONAL', pack: { key: 'CLINIC', counselGated: false }, held: new Set(['APPOINTMENTS']) }));
    const lapsed = resolveNav(base({ level: 'FREE', tier: 'PROFESSIONAL', pack: { key: 'CLINIC', counselGated: false }, held: new Set(['APPOINTMENTS']) }));
    const back = resolveNav(base({ level: 'PRO', tier: 'PROFESSIONAL', pack: { key: 'CLINIC', counselGated: false }, held: new Set(['APPOINTMENTS']) }));
    expect(stateOf(paid, 'crm')).toBe('ACTIVE'); expect(stateOf(lapsed, 'crm')).toBe('LOCKED_PREVIEW'); expect(back).toEqual(paid);
  });
});

describe('every pack', () => {
  it.each(seed.packs.map((p) => [p.key]))('%s: its own tabs are listed and ACTIVE on a paid plan (a counsel gated pack is HIDDEN until the switch is on)', (key) => {
    const gated = seed.packs.find((p) => p.key === key)!.config.flags.counselGated;
    const own = defs.filter((d) => d.scope === 'PACK' && d.ownerKey === key).map((d) => d.key);
    const closed = resolveNav(base({ pack: { key, counselGated: gated } }));
    expect(closed.filter((t) => t.scope === 'PACK').map((t) => t.key)).toEqual(own);
    expect(closed.filter((t) => t.scope === 'PACK').every((t) => t.state === (gated ? 'HIDDEN' : 'ACTIVE'))).toBe(true);
    if (gated) expect(closed.filter((t) => t.scope === 'PACK').every((t) => t.reason === 'GATED_PACK')).toBe(true);
    const open = resolveNav(base({ pack: { key, counselGated: gated }, gatedPacksOpen: true }));
    expect(open.filter((t) => t.scope === 'PACK').every((t) => t.state === 'ACTIVE')).toBe(true);
  });
  it('a vendor sees only their own pack\'s tabs, never another pack\'s', () => {
    const nav = resolveNav(base({ pack: { key: 'RETAIL', counselGated: false } }));
    expect(new Set(nav.filter((t) => t.scope === 'PACK').map((t) => t.ownerKey))).toEqual(new Set(['RETAIL']));
  });
});

describe('capabilities and tiers', () => {
  it('a held capability is ACTIVE when the tier allows it', () => {
    expect(stateOf(resolveNav(base({ tier: 'PROFESSIONAL', held: new Set(['APPOINTMENTS']) })), 'appointments')).toBe('ACTIVE');
    expect(stateOf(resolveNav(base({ tier: 'ECOMMERCE', held: new Set(['STORE']) })), 'store')).toBe('ACTIVE');
  });
  it('a downgrade HIDES what the lower tier does not allow and lists nothing the vendor never held', () => {
    const held = new Set(['APPOINTMENTS', 'STORE']);
    const pro = resolveNav(base({ tier: 'PROFESSIONAL', held }));
    expect(stateOf(pro, 'appointments')).toBe('ACTIVE'); expect(stateOf(pro, 'store')).toBe('HIDDEN');
    expect(pro.find((t) => t.key === 'store')?.reason).toBe('TIER_DOWNGRADE'); expect(pro.find((t) => t.key === 'store')?.needsTier).toBe('ECOMMERCE');
    const handy = resolveNav(base({ tier: 'HANDYMAN', held }));
    expect(stateOf(handy, 'appointments')).toBe('HIDDEN'); expect(handy.some((t) => t.key === 'memberships')).toBe(false);
  });
  it('the tier matrix is data: allowing STORE for Professional opens it with no code change', () => {
    const edited = new Map(matrix); edited.set('PROFESSIONAL', new Set([...matrix.get('PROFESSIONAL')!, 'STORE']));
    expect(stateOf(resolveNav(base({ tier: 'PROFESSIONAL', held: new Set(['STORE']), matrix: edited })), 'store')).toBe('ACTIVE');
  });
  it('a tab with a minimum tier is LOCKED_PREVIEW below it and ACTIVE at it', () => {
    const custom: NavTabDef[] = [...defs, { scope: 'COMMON', ownerKey: 'COMMON', key: 'ecom_only', label: 'Ecom only', route: '/x', minTier: 'ECOMMERCE', capabilityKey: null, freeTrial: false, sortOrder: 99 }];
    expect(resolveNav(base({ tier: 'PROFESSIONAL', tabs: custom })).find((t) => t.key === 'ecom_only')).toMatchObject({ state: 'LOCKED_PREVIEW', reason: 'NEEDS_TIER', needsTier: 'ECOMMERCE' });
    expect(stateOf(resolveNav(base({ tier: 'ECOMMERCE', tabs: custom })), 'ecom_only')).toBe('ACTIVE');
  });
  it('a capability above the tier answers NEEDS_TIER and names the lowest tier that has it', () => {
    const known = new Set(matrixRecords(realSettings()).map((c) => c.capabilityKey));
    expect(capabilityAnswer('HANDYMAN', 'STORE', known, matrix)).toEqual({ ok: false, code: 'NEEDS_TIER', needsTier: 'ECOMMERCE' });
    expect(capabilityAnswer('HANDYMAN', 'APPOINTMENTS', known, matrix)).toEqual({ ok: false, code: 'NEEDS_TIER', needsTier: 'PROFESSIONAL' });
    expect(capabilityAnswer('PROFESSIONAL', 'APPOINTMENTS', known, matrix)).toEqual({ ok: true });
    expect(capabilityAnswer('PROFESSIONAL', 'FLY', known, matrix)).toEqual({ ok: false, code: 'UNKNOWN_CAPABILITY' });
    expect(lowestTierFor('STORE', matrix)).toBe('ECOMMERCE');
  });
});

describe('add-on packs (V3A)', () => {
  it('SHOP lets a Professional vendor use the store without moving to Ecommerce; an add-on tab appears only while the add-on is active', () => {
    const noAddon = resolveNav(base({ tier: 'PROFESSIONAL', held: new Set(['STORE']) }));
    expect(stateOf(noAddon, 'store')).toBe('HIDDEN');
    const withAddon = resolveNav(base({ tier: 'PROFESSIONAL', held: new Set(['STORE']), addons: new Set(['SHOP']), addonGrants: new Set(['STORE']) }));
    expect(stateOf(withAddon, 'store')).toBe('ACTIVE');
    expect(stateOf(resolveNav(base({ addons: new Set(['PHARMACY_COUNTER']) })), 'pharmacy_counter')).toBe('ACTIVE');
    expect(resolveNav(base({})).some((t) => t.key === 'pharmacy_counter')).toBe(false);
    expect(stateOf(resolveNav(base({ level: 'FREE', addons: new Set(['PHARMACY_COUNTER']) })), 'pharmacy_counter')).toBe('LOCKED_PREVIEW');
  });
  it('the add-on answer to a capability above the tier', () => {
    const known = new Set(matrixRecords(realSettings()).map((c) => c.capabilityKey));
    expect(capabilityAnswer('PROFESSIONAL', 'STORE', known, matrix, new Set(['STORE']))).toEqual({ ok: true });
  });
});

describe('LEGACY vendors', () => {
  it('are never restricted: every tab is ACTIVE and the access check always allows', () => {
    const nav = resolveNav(base({ mode: 'LEGACY', level: null, tier: null, pack: { key: 'PHARMACY', counselGated: true } }));
    expect(nav.every((t) => t.state === 'ACTIVE')).toBe(true);
    expect(tabAccess('LEGACY', nav, 'anything')).toEqual({ allowed: true });
  });
});

describe('tab access (what the server enforces)', () => {
  const nav = resolveNav(base({ level: 'FREE', tier: 'HANDYMAN' }));
  it('an ACTIVE tab opens; a LOCKED_PREVIEW tab refuses and says why', () => {
    expect(tabAccess('V3', nav, 'plan')).toEqual({ allowed: true });
    expect(tabAccess('V3', nav, 'crm')).toEqual({ allowed: false, state: 'LOCKED_PREVIEW', reason: 'FREE_TRIAL', needsTier: null });
  });
  it('a tab the vendor does not have at all is refused too (fail closed)', () => { expect(tabAccess('V3', nav, 'appointments')).toMatchObject({ allowed: false, state: 'UNKNOWN' }); });
  it('a HIDDEN tab is refused', () => {
    const n = resolveNav(base({ tier: 'PROFESSIONAL', held: new Set(['STORE']) }));
    expect(tabAccess('V3', n, 'store')).toMatchObject({ allowed: false, state: 'HIDDEN', reason: 'TIER_DOWNGRADE' });
  });
});
