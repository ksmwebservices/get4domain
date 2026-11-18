import { NavInput, NavTabDef, resolveNav } from '../src/v3-packs/core/nav-core';
import { matrixRecords, Tier, TIERS } from '../src/v3-packs/core/pack-core';
import { COMMON_TAB_GROUP } from '../src/v3-vendor-gaps/core/gaps-core';
import { readSeedSources } from '../src/v3-packs/seed/seed-files';
import { realSeed } from './support/pack-fakes';

/** B3.4: the thirteen tabs the vendor app used to place and lock with its own fixed list now come from the server. */
const KEYS = ['reviews', 'chat', 'reports', 'tasks', 'wallet', 'packs', 'team', 'profile', 'notifications', 'legal', 'account', 'activity', 'offerings'];
const FREE_OPEN = ['profile', 'notifications', 'legal', 'account', 'activity'];
const GROUP: Record<string, string> = { tasks: 'business', offerings: 'business', reviews: 'grow', chat: 'grow', reports: 'grow', wallet: 'money', packs: 'money', team: 'more', profile: 'more', notifications: 'more', legal: 'more', account: 'more', activity: 'more' };

const seed = realSeed();
const defs: NavTabDef[] = seed.tabs.map((t) => ({ scope: t.scope, ownerKey: t.ownerKey, key: t.key, label: t.label, route: t.route, minTier: t.minTier, capabilityKey: t.capabilityKey, freeTrial: t.freeTrial, sortOrder: t.sortOrder }));
const matrix = new Map<Tier, Set<string>>(TIERS.map((t) => [t, new Set(matrixRecords(readSeedSources().settings).filter((c) => c.tier === t && c.allowed).map((c) => c.capabilityKey))]));
const base = (over: Partial<NavInput>): NavInput => ({ mode: 'V3', level: 'PRO', tier: 'PROFESSIONAL', tabs: defs, pack: null, gatedPacksOpen: false, matrix, held: new Set(), ...over });

describe('the server sends every key the vendor app used to guess', () => {
  it('each key is a common tab with a label, a route and a bar group', () => {
    const nav = resolveNav(base({ level: 'FREE' }));
    for (const k of KEYS) {
      const t = nav.find((x) => x.key === k && x.scope === 'COMMON');
      expect([k, !!t]).toEqual([k, true]);
      expect([k, t!.group]).toEqual([k, GROUP[k]]); expect(COMMON_TAB_GROUP[k]).toBe(GROUP[k]);
      expect(t!.label.length).toBeGreaterThan(2); expect(t!.route.startsWith('/')).toBe(true);
    }
  });
  it('on a Free plan the five account tabs are ACTIVE and the other eight are LOCKED_PREVIEW with the reason and an upsell line', () => {
    const nav = resolveNav(base({ level: 'FREE' }));
    for (const k of KEYS) {
      const t = nav.find((x) => x.key === k)!;
      if (FREE_OPEN.includes(k)) expect([k, t.state]).toEqual([k, 'ACTIVE']);
      else { expect([k, t.state, t.reason]).toEqual([k, 'LOCKED_PREVIEW', 'FREE_TRIAL']); expect(t.upsellText).toBeTruthy(); }
    }
  });
  it('on a paid plan every one of them is ACTIVE, and a paused plan locks the paid ones again (the server decides, not the app)', () => {
    for (const k of KEYS) expect([k, resolveNav(base({})).find((x) => x.key === k)!.state]).toEqual([k, 'ACTIVE']);
    const paused = resolveNav(base({ paused: true }));
    for (const k of KEYS) expect([k, paused.find((x) => x.key === k)!.state]).toEqual([k, FREE_OPEN.includes(k) ? 'ACTIVE' : 'LOCKED_PREVIEW']);
  });
  it('a Version 2 (LEGACY) vendor is never restricted', () => {
    for (const k of KEYS) expect(resolveNav(base({ mode: 'LEGACY', level: null, tier: null })).find((x) => x.key === k)!.state).toBe('ACTIVE');
  });
});

describe('who among the team sees them', () => {
  it('every key has an audience; money, people and the business record are owner only', () => {
    const { TEAM_TAB_AREA } = jest.requireActual('../src/v3-packs/core/shell-access') as typeof import('../src/v3-packs/core/shell-access');
    for (const k of KEYS) expect([k, k in TEAM_TAB_AREA]).toEqual([k, true]);
    for (const k of ['wallet', 'packs', 'team', 'profile', 'activity']) expect(TEAM_TAB_AREA[k]).toBe('OWNER_ONLY');
  });
});
