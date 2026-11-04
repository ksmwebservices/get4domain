import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { can, EngineInput, resolveEntitlements, EngineSubscription } from '../src/plans/entitlements/entitlement-engine';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed, SeedFile, validateSeedFile } from '../src/plans/seed/seed-file';
import { MemorySeedStore } from './support/memory-seed-store';

/**
 * Slice 5.1c (owner rule 5 and 6): Free sites are informational listings with no call to action and no leads, requests or orders; Pro has them by track.
 * The matrix comes from the SEED FILE, so these tests read the real data.
 */
const seedPath = path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json');
const seed: SeedFile = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const expanded = expandSeed(seed);
const NOW = new Date('2027-03-01T00:00:00.000Z');
const TRACKS = ['handyman', 'professional', 'ecommerce'] as const;
const digest = (x: unknown): string => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);

/** Every feature key that concerns a call to action, a lead, a request, an order, a payment, an offer, AI Studio, social or reports. */
const CONCERN_KEYS = [
  'requests.inbox', 'payments.vendor_methods', 'offers.banners', 'promotion.subdomain', 'site.cta', 'site.booking', 'shop.cart',
  'leads.platform', 'ai.credits_included', 'social.publishing', 'reports.basic', 'reports.audit',
];

function inputFor(planKey: string): EngineInput {
  const plans = expanded.plans.map((p) => ({ id: `id_${p.key}`, key: p.key, track: p.track, level: p.level, status: p.status }));
  const matrix = new Map<string, Map<string, { state: never; limitValue: number | null; enumValue: string | null; upsellText: string | null }>>();
  for (const c of expanded.planFeatures) {
    const pid = `id_${c.planKey}`;
    if (!matrix.has(pid)) matrix.set(pid, new Map());
    matrix.get(pid)!.set(c.featureKey, { state: c.state as never, limitValue: c.limitValue, enumValue: c.enumValue, upsellText: c.upsellText });
  }
  const pro = planKey.endsWith('_pro');
  const subscription: EngineSubscription = { id: 's', planId: `id_${planKey}`, status: 'ACTIVE', termMonths: pro ? 3 : null, startsAt: new Date(NOW.getTime() - 86_400_000), endsAt: pro ? new Date(NOW.getTime() + 30 * 86_400_000) : null, graceEndsAt: null };
  return { now: NOW, flagOn: true, subscription, plans, matrix, featureKeys: expanded.features.map((f) => f.key), overrides: [], settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' } };
}
const stateOf = (planKey: string, key: string) => resolveEntitlements(inputFor(planKey)).features[key]?.state;

describe('5.1c Free versus Pro matrix', () => {
  it('the seed still validates and has the six new feature keys', () => {
    expect(validateSeedFile(seed)).toEqual([]);
    const keys = seed.features.map((f) => f.key);
    for (const k of ['requests.inbox', 'payments.vendor_methods', 'offers.banners', 'promotion.subdomain', 'promotion.custom_domain_addon', 'site.cta']) expect(keys).toContain(k);
    expect(expanded.planFeatures.length).toBe(6 * keys.length);
  });

  it.each(TRACKS)('FREE %s: every concern key is LOCKED_PREVIEW (never ACTIVE or LIMITED), or HIDDEN where the track has no such feature', (track) => {
    for (const key of CONCERN_KEYS) {
      const s = stateOf(`${track}_free`, key);
      expect(['LOCKED_PREVIEW', 'HIDDEN']).toContain(s);
      expect(s).not.toBe('ACTIVE'); expect(s).not.toBe('LIMITED');
    }
    for (const key of ['requests.inbox', 'payments.vendor_methods', 'offers.banners', 'promotion.subdomain', 'site.cta', 'leads.platform', 'ai.credits_included', 'social.publishing', 'reports.basic']) {
      expect(stateOf(`${track}_free`, key)).toBe('LOCKED_PREVIEW');
    }
  });

  it('FREE has no LIMIT row for leads, bookings, enquiries or requests', () => {
    for (const c of expanded.planFeatures.filter((p) => p.planKey.endsWith('_free') && /^(leads|requests|site\.booking|site\.cta|payments|offers)/.test(p.featureKey))) {
      expect(c.state).not.toBe('LIMITED'); expect(c.limitValue).toBeNull();
    }
  });

  it('FREE keeps what an informational listing needs', () => {
    for (const track of TRACKS) {
      expect(stateOf(`${track}_free`, 'directory.listing')).toBe('ACTIVE');
      for (const k of ['site.pages', 'site.services', 'site.gallery', 'site.themes']) expect(['ACTIVE', 'LIMITED']).toContain(stateOf(`${track}_free`, k));
    }
  });

  it('per-track meaning on PRO: handyman bookings and quotes, professional appointments and quotes, ecommerce cart, orders and coupons', () => {
    for (const track of TRACKS) {
      for (const k of ['site.cta', 'requests.inbox', 'payments.vendor_methods', 'offers.banners', 'promotion.subdomain']) expect(stateOf(`${track}_pro`, k)).toBe('ACTIVE');
    }
    expect(stateOf('handyman_pro', 'site.booking')).toBe('ACTIVE'); expect(stateOf('professional_pro', 'site.booking')).toBe('ACTIVE');
    expect(stateOf('ecommerce_pro', 'shop.cart')).toBe('ACTIVE');
    expect(stateOf('handyman_pro', 'shop.cart')).toBe('HIDDEN'); expect(stateOf('professional_pro', 'shop.cart')).toBe('HIDDEN');
    expect(stateOf('ecommerce_pro', 'site.booking')).toBe('HIDDEN');
  });

  it('the custom-domain promotion add-on is in no plan; only an override grants it', () => {
    for (const p of expanded.plans) expect(stateOf(p.key, 'promotion.custom_domain_addon')).toBe('HIDDEN');
    const input = inputFor('handyman_pro');
    input.overrides = [{ id: 'o1', featureKey: 'promotion.custom_domain_addon', state: 'ACTIVE', limitValue: null, enumValue: null, reason: 'owner approved add-on', expiresAt: new Date(NOW.getTime() + 86_400_000), createdAt: NOW }];
    const r = resolveEntitlements(input);
    expect(r.features['promotion.custom_domain_addon'].state).toBe('ACTIVE'); expect(can(r, 'promotion.custom_domain_addon').allowed).toBe(true);
    input.now = new Date(NOW.getTime() + 2 * 86_400_000);
    expect(resolveEntitlements(input).features['promotion.custom_domain_addon'].state).toBe('HIDDEN');
  });

  it('the engine denies a locked Free feature with an upsell and allows it on Pro', () => {
    const free = resolveEntitlements(inputFor('ecommerce_free'));
    expect(can(free, 'site.cta')).toMatchObject({ allowed: false, reason: 'FEATURE_LOCKED' });
    expect(can(free, 'requests.inbox').upsellText).toBeTruthy();
    expect(can(resolveEntitlements(inputFor('ecommerce_pro')), 'site.cta').allowed).toBe(true);
  });

  it('no price, tax, discount or plan row changed (digests pinned from before the change)', () => {
    expect(digest(expanded.prices)).toBe('3e655b52f6c2c2af');
    expect(digest(expanded.taxRates)).toBe('e5e4d6c8acc6002f');
    expect(digest(expanded.discountRules)).toBe('feaeafbb6d39fedc');
    expect(digest(expanded.plans)).toBe('d37ddd7a561fab2f');
  });

  it('the setting cartRequiresCustomDomain does not exist anywhere in the seed or the code', () => {
    expect(Object.keys(seed.settings)).not.toContain('cartRequiresCustomDomain');
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const n of fs.readdirSync(d)) {
        const p = path.join(d, n);
        if (fs.statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p); } else if (/\.(ts|json|js)$/.test(n) && fs.readFileSync(p, 'utf8').includes('cartRequiresCustomDomain')) hits.push(p);
      }
    };
    walk(path.resolve(__dirname, '../src')); walk(path.resolve(__dirname, '../prisma/seed'));
    expect(hits).toEqual([]);
  });

  it('loading twice is idempotent', async () => {
    const store = new MemorySeedStore();
    const first = await applySeed(store, expanded, { apply: true });
    const second = await applySeed(store, expanded, { apply: true });
    expect(second.created).toBe(0); expect(second.updated).toBe(0); expect(second.unchanged).toBe(first.created);
  });
});
