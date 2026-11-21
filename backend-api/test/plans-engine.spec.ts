import { expandSeed, SeedFile } from '../src/plans/seed/seed-file';
import * as fs from 'fs';
import * as path from 'path';
import {
  can, effectiveStatus, EngineCell, EngineInput, resolveEntitlements, toRenderEntitlements, EngineSubscription, assertWithinLimitResult,
} from '../src/plans/entitlements/entitlement-engine';

/**
 * S51.4: the pure entitlement core. The matrix comes from the SEED FILE (so the tests use real data), but every rule is also checked with
 * hand-made data to prove the engine does not depend on any particular price, limit or state.
 */
const seed: SeedFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
const expanded = expandSeed(seed);
const DAY = 86_400_000;
const NOW = new Date('2027-03-01T00:00:00.000Z');

function baseInput(over: Partial<EngineInput> = {}): EngineInput {
  const plans = expanded.plans.map((p) => ({ id: `id_${p.key}`, key: p.key, track: p.track, level: p.level, status: p.status }));
  const matrix = new Map<string, Map<string, { state: never; limitValue: number | null; enumValue: string | null; upsellText: string | null }>>();
  for (const c of expanded.planFeatures) {
    const pid = `id_${c.planKey}`;
    if (!matrix.has(pid)) matrix.set(pid, new Map());
    matrix.get(pid)!.set(c.featureKey, { state: c.state as never, limitValue: c.limitValue, enumValue: c.enumValue, upsellText: c.upsellText });
  }
  return {
    now: NOW, flagOn: true, subscription: null, plans, matrix, featureKeys: expanded.features.map((f) => f.key), overrides: [],
    settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' }, ...over,
  };
}
const sub = (planKey: string, over: Partial<EngineSubscription> = {}): EngineSubscription => ({
  id: 's1', planId: `id_${planKey}`, status: 'ACTIVE', termMonths: planKey.endsWith('_pro') ? 3 : null,
  startsAt: new Date(NOW.getTime() - 10 * DAY), endsAt: planKey.endsWith('_pro') ? new Date(NOW.getTime() + 30 * DAY) : null, graceEndsAt: null, ...over,
});

describe('effectiveStatus (computed from dates, no cron needed)', () => {
  const proEnd = new Date(NOW.getTime() - 2 * DAY);
  it.each([
    ['FREE plan, no end date', sub('handyman_free'), 'ACTIVE'],
    ['PRO before its end', sub('handyman_pro'), 'ACTIVE'],
    ['PRO 2 days past the end, 7 grace days', sub('handyman_pro', { endsAt: proEnd }), 'GRACE'],
    ['PRO 8 days past the end, 7 grace days', sub('handyman_pro', { endsAt: new Date(NOW.getTime() - 8 * DAY) }), 'EXPIRED'],
    ['stored CANCELLED', sub('handyman_pro', { status: 'CANCELLED' }), 'CANCELLED'],
    ['explicit graceEndsAt wins over graceDays', sub('handyman_pro', { endsAt: proEnd, graceEndsAt: new Date(NOW.getTime() - 1 * DAY) }), 'EXPIRED'],
  ] as [string, EngineSubscription, string][])('%s -> %s', (_n, s, want) => {
    expect(effectiveStatus(s, NOW, { graceDays: 7 })).toBe(want);
  });
  it('graceDays is data: 0 means no grace, 30 gives a month', () => {
    const s = sub('handyman_pro', { endsAt: new Date(NOW.getTime() - 2 * DAY) });
    expect(effectiveStatus(s, NOW, { graceDays: 0 })).toBe('EXPIRED');
    expect(effectiveStatus(s, NOW, { graceDays: 30 })).toBe('GRACE');
  });
});

describe('resolve: modes', () => {
  it('a vendor with no subscription and the flag off is LEGACY: nothing V3 applies, every V3 feature is HIDDEN', () => {
    const r = resolveEntitlements(baseInput({ flagOn: false }));
    expect(r.mode).toBe('LEGACY');
    expect(r.plan).toBeNull();
    expect(Object.values(r.features).every((f) => f.state === 'HIDDEN' && f.source === 'STATUS')).toBe(true);
    expect(Object.keys(r.features).length).toBe(expanded.features.length);
  });

  it('flag on but no subscription is UNASSIGNED (hidden, and staff can see it needs a plan)', () => {
    const r = resolveEntitlements(baseInput({ flagOn: true }));
    expect(r.mode).toBe('UNASSIGNED');
    expect(r.features['site.video'].state).toBe('HIDDEN');
  });

  it('a vendor with a subscription is V3 whatever the flag says', () => {
    const r = resolveEntitlements(baseInput({ flagOn: false, subscription: sub('professional_pro') }));
    expect(r.mode).toBe('V3');
    expect(r.plan).toBe('professional_pro');
    expect(r.track).toBe('PROFESSIONAL');
    expect(r.level).toBe('PRO');
  });
});

describe('resolve: precedence (override, then plan, then HIDDEN)', () => {
  it('the plan feature applies, with the source PLAN', () => {
    const r = resolveEntitlements(baseInput({ subscription: sub('handyman_free') }));
    expect(r.features['site.pages']).toMatchObject({ state: 'LIMITED', limit: 1, source: 'PLAN', overLimit: false });
    expect(r.features['site.video']).toMatchObject({ state: 'LOCKED_PREVIEW', source: 'PLAN' });
    expect(r.features['site.video'].upsellText).toMatch(/video/i);
  });

  it('an unknown key is HIDDEN by default', () => {
    const r = resolveEntitlements(baseInput({ subscription: sub('handyman_pro') }));
    expect(can(r, 'not.a.feature')).toMatchObject({ allowed: false, state: 'HIDDEN' });
  });

  it('a non-expired override wins over the plan; the source says OVERRIDE', () => {
    const r = resolveEntitlements(baseInput({
      subscription: sub('handyman_free'),
      overrides: [{ id: 'o1', featureKey: 'site.video', state: 'ACTIVE', limitValue: null, enumValue: null, reason: 'trial', expiresAt: new Date(NOW.getTime() + DAY), createdAt: NOW }],
    }));
    expect(r.features['site.video']).toMatchObject({ state: 'ACTIVE', source: 'OVERRIDE' });
  });

  it('an expired override is ignored and the plan value returns', () => {
    const r = resolveEntitlements(baseInput({
      subscription: sub('handyman_free'),
      overrides: [{ id: 'o1', featureKey: 'site.video', state: 'ACTIVE', limitValue: null, enumValue: null, reason: 'trial', expiresAt: new Date(NOW.getTime() - 1000), createdAt: NOW }],
    }));
    expect(r.features['site.video']).toMatchObject({ state: 'LOCKED_PREVIEW', source: 'PLAN' });
  });

  it('with several overrides on one feature the newest non-expired one is used; an override can raise a limit', () => {
    const r = resolveEntitlements(baseInput({
      subscription: sub('handyman_free'),
      overrides: [
        { id: 'o1', featureKey: 'site.pages', state: 'LIMITED', limitValue: 3, enumValue: null, reason: 'a', expiresAt: null, createdAt: new Date(NOW.getTime() - 5 * DAY) },
        { id: 'o2', featureKey: 'site.pages', state: 'LIMITED', limitValue: 9, enumValue: null, reason: 'b', expiresAt: null, createdAt: new Date(NOW.getTime() - 1 * DAY) },
      ],
    }));
    expect(r.features['site.pages']).toMatchObject({ limit: 9, source: 'OVERRIDE' });
  });

  it('an override also works for a LEGACY or UNASSIGNED vendor (staff decision), nothing else changes for them', () => {
    const r = resolveEntitlements(baseInput({
      flagOn: false,
      overrides: [{ id: 'o1', featureKey: 'site.video', state: 'ACTIVE', limitValue: null, enumValue: null, reason: 'pilot', expiresAt: null, createdAt: NOW }],
    }));
    expect(r.mode).toBe('LEGACY');
    expect(r.features['site.video'].state).toBe('ACTIVE');
    expect(r.features['site.pages'].state).toBe('HIDDEN');
  });
});

describe('resolve: status rules (downgrade, never delete)', () => {
  const expiredPro = (planKey: string) => sub(planKey, { endsAt: new Date(NOW.getTime() - 30 * DAY) });

  it('ACTIVE and GRACE keep the plan; GRACE sets the warning flag', () => {
    const grace = resolveEntitlements(baseInput({ subscription: sub('handyman_pro', { endsAt: new Date(NOW.getTime() - DAY) }) }));
    expect(grace.subscriptionStatus).toBe('GRACE');
    expect(grace.graceWarning).toBe(true);
    expect(grace.features['site.video']).toMatchObject({ state: 'ACTIVE', source: 'PLAN' });
    const active = resolveEntitlements(baseInput({ subscription: sub('handyman_pro') }));
    expect(active.graceWarning).toBe(false);
  });

  it('after grace the vendor falls to the same TRACK\'s FREE plan features, source STATUS', () => {
    for (const [pro, free] of [['handyman_pro', 'HANDYMAN'], ['professional_pro', 'PROFESSIONAL'], ['ecommerce_pro', 'ECOMMERCE']]) {
      const r = resolveEntitlements(baseInput({ subscription: expiredPro(pro) }));
      expect(r.subscriptionStatus).toBe('EXPIRED');
      expect(r.track).toBe(free);
      expect(r.level).toBe('FREE');
      expect(r.features['site.video']).toMatchObject({ state: 'LOCKED_PREVIEW', source: 'STATUS' });
    }
  });

  it('a stored CANCELLED subscription falls to Free at once', () => {
    const r = resolveEntitlements(baseInput({ subscription: sub('professional_pro', { status: 'CANCELLED' }) }));
    expect(r.subscriptionStatus).toBe('CANCELLED');
    expect(r.level).toBe('FREE');
    expect(r.features['site.booking'].state).toBe('LOCKED_PREVIEW');   // 5.1c: Free shows the booking as a locked preview (was HIDDEN)
  });

  it('downgradeBehaviour KEEP_UNTIL_REPLACED keeps the Pro features after expiry (setting, no code change)', () => {
    const r = resolveEntitlements(baseInput({ subscription: expiredPro('handyman_pro'), settings: { graceDays: 7, downgradeBehaviour: 'KEEP_UNTIL_REPLACED' } }));
    expect(r.subscriptionStatus).toBe('EXPIRED');
    expect(r.level).toBe('PRO');
    expect(r.features['site.video'].state).toBe('ACTIVE');
  });

  it('content is never deleted: items beyond a limit make the feature LIMITED with overLimit true (read-only), not removed', () => {
    const r = resolveEntitlements(baseInput({ subscription: expiredPro('handyman_pro'), usage: { 'site.services': 20, 'site.pages': 1 } }));
    expect(r.features['site.services']).toMatchObject({ state: 'LIMITED', limit: 8, overLimit: true });
    expect(r.features['site.pages']).toMatchObject({ limit: 1, overLimit: false });
    expect(can(r, 'site.services', 20)).toMatchObject({ allowed: false, reason: 'LIMIT_REACHED' });
  });

  it('a missing Free plan for the track hides everything instead of throwing', () => {
    const input = baseInput({ subscription: expiredPro('handyman_pro') });
    input.plans = input.plans.filter((p) => p.key !== 'handyman_free');
    const r = resolveEntitlements(input);
    expect(r.features['site.pages'].state).toBe('HIDDEN');
  });
});

describe('can and limits', () => {
  const r = resolveEntitlements(baseInput({ subscription: sub('handyman_free') }));
  it('ACTIVE is allowed, LOCKED_PREVIEW and HIDDEN are not, with different reasons', () => {
    expect(can(r, 'directory.listing')).toMatchObject({ allowed: true, state: 'ACTIVE', reason: null });
    expect(can(r, 'site.video')).toMatchObject({ allowed: false, state: 'LOCKED_PREVIEW', reason: 'FEATURE_LOCKED' });
    expect(can(r, 'site.booking')).toMatchObject({ allowed: false, state: 'LOCKED_PREVIEW', reason: 'FEATURE_LOCKED' });   // 5.1c (was HIDDEN)
    expect(can(r, 'shop.cart')).toMatchObject({ allowed: false, state: 'HIDDEN', reason: 'FEATURE_HIDDEN' });   // a handyman has no cart at all
  });

  it('LIMITED is allowed below the limit and refused at it (LIMIT_REACHED)', () => {
    expect(can(r, 'site.services', 7)).toMatchObject({ allowed: true, limit: 8 });
    expect(can(r, 'site.services', 8)).toMatchObject({ allowed: false, reason: 'LIMIT_REACHED', limit: 8 });
    expect(can(r, 'site.services')).toMatchObject({ allowed: true });
  });

  it('assertWithinLimitResult carries the stable code and the upsell text', () => {
    expect(assertWithinLimitResult(r, 'site.services', 3)).toBeNull();
    expect(assertWithinLimitResult(r, 'site.services', 8)).toMatchObject({ code: 'LIMIT_REACHED' });
    expect(assertWithinLimitResult(r, 'site.video', 0)).toMatchObject({ code: 'FEATURE_LOCKED', upsellText: expect.stringMatching(/video/i) });
  });

  it('LIMITED with no limit is unlimited and a limit of 0 refuses at once (any values work)', () => {
    const input = baseInput({ subscription: sub('handyman_free') });
    input.matrix.get('id_handyman_free')!.set('site.services', { state: 'LIMITED' as never, limitValue: null, enumValue: null, upsellText: null });
    input.matrix.get('id_handyman_free')!.set('site.faqs', { state: 'LIMITED' as never, limitValue: 0, enumValue: null, upsellText: null });
    const x = resolveEntitlements(input);
    expect(can(x, 'site.services', 9999).allowed).toBe(true);
    expect(can(x, 'site.faqs', 0)).toMatchObject({ allowed: false, reason: 'LIMIT_REACHED' });
  });
});

describe('renderer bridge (pinned mapping for the theme kit)', () => {
  const render = (planKey: string, over: Partial<EngineInput> = {}, domain = false) => toRenderEntitlements(resolveEntitlements(baseInput({ subscription: sub(planKey), ...over })), domain);

  it('video = site.video ACTIVE', () => {
    expect(render('handyman_free').video).toBe(false);   // LOCKED_PREVIEW
    expect(render('handyman_pro').video).toBe(true);
  });
  it('cart = shop.cart ACTIVE (Ecommerce Pro only in the seed)', () => {
    expect(render('ecommerce_pro').cart).toBe(true);
    expect(render('ecommerce_free').cart).toBe(false);
    expect(render('professional_pro').cart).toBe(false);
  });
  it('booking = site.booking ACTIVE (Handyman/Professional Pro, never Ecommerce)', () => {
    expect(render('handyman_pro').booking).toBe(true);
    expect(render('professional_pro').booking).toBe(true);
    expect(render('ecommerce_pro').booking).toBe(false);
    expect(render('handyman_free').booking).toBe(false);
  });
  it('customDomain = site.custom_domain ACTIVE AND a verified domain exists', () => {
    expect(render('handyman_pro').customDomain).toBe(false);          // no verified domain yet
    expect(render('handyman_pro', {}, true).customDomain).toBe(true);
    expect(render('handyman_free', {}, true).customDomain).toBe(false);
  });
  it('LIMITED, LOCKED_PREVIEW and HIDDEN are all false; the result has exactly the five booleans the theme kit asks for', () => {
    const input = baseInput({ subscription: sub('handyman_pro') });
    input.matrix.get('id_handyman_pro')!.set('site.video', { state: 'LIMITED' as never, limitValue: 3, enumValue: null, upsellText: null });
    expect(toRenderEntitlements(resolveEntitlements(input), true).video).toBe(false);
    expect(Object.keys(render('handyman_pro')).sort()).toEqual(['booking', 'callsToAction', 'cart', 'customDomain', 'video']);   // 5.4b: callsToAction = site.cta ACTIVE
    for (const v of Object.values(render('handyman_pro'))) expect(typeof v).toBe('boolean');
  });
  it('a LEGACY vendor gets all five false', () => {
    expect(toRenderEntitlements(resolveEntitlements(baseInput({ flagOn: false })), true)).toEqual({ video: false, cart: false, booking: false, customDomain: false, callsToAction: false });
  });
});

describe('the engine does not depend on any particular value', () => {
  it('works with hand-made plans, features and states that are not in the seed', () => {
    const input: EngineInput = {
      now: NOW, flagOn: true,
      subscription: { id: 's', planId: 'P', status: 'ACTIVE', termMonths: 12, startsAt: NOW, endsAt: new Date(NOW.getTime() + DAY), graceEndsAt: null },
      plans: [{ id: 'P', key: 'x_pro', track: 'HANDYMAN', level: 'PRO', status: 'ACTIVE' }, { id: 'F', key: 'x_free', track: 'HANDYMAN', level: 'FREE', status: 'ACTIVE' }],
      matrix: new Map<string, Map<string, EngineCell>>([['P', new Map<string, EngineCell>([['a.b', { state: 'LIMITED', limitValue: 77, enumValue: 'gold', upsellText: 'u' }]])], ['F', new Map<string, EngineCell>([['a.b', { state: 'HIDDEN', limitValue: null, enumValue: null, upsellText: null }]])]]),
      featureKeys: ['a.b', 'c.d'], overrides: [], settings: { graceDays: 1, downgradeBehaviour: 'FALL_TO_FREE' },
    };
    const r = resolveEntitlements(input);
    expect(r.features['a.b']).toMatchObject({ state: 'LIMITED', limit: 77, enumValue: 'gold' });
    expect(r.features['c.d']).toMatchObject({ state: 'HIDDEN' });
  });
});
