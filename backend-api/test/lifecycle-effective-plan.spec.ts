import * as fs from 'fs';
import * as path from 'path';
import { can, chooseEffectivePlan, EngineInput, EngineSubscription, effectiveStatus, resolveEntitlements, toRenderEntitlements } from '../src/plans/entitlements/entitlement-engine';
import { expandSeed, SeedFile } from '../src/plans/seed/seed-file';

/**
 * Slice 5.1d (owner rule 9): effective plan for every state combination. Pure core; the matrix is the real seed. Nothing is deleted by expiry or suspension: the engine only
 * chooses WHICH plan's cells apply, so a renewal restores Pro at once.
 */
const seed: SeedFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
const expanded = expandSeed(seed);
const DAY = 86_400_000;
const NOW = new Date('2027-03-01T00:00:00.000Z');

function input(over: Partial<EngineInput> = {}): EngineInput {
  const plans = expanded.plans.map((p) => ({ id: `id_${p.key}`, key: p.key, track: p.track, level: p.level, status: p.status }));
  const matrix = new Map<string, Map<string, { state: never; limitValue: number | null; enumValue: string | null; upsellText: string | null }>>();
  for (const c of expanded.planFeatures) {
    const pid = `id_${c.planKey}`;
    if (!matrix.has(pid)) matrix.set(pid, new Map());
    matrix.get(pid)!.set(c.featureKey, { state: c.state as never, limitValue: c.limitValue, enumValue: c.enumValue, upsellText: c.upsellText });
  }
  return { now: NOW, flagOn: true, subscription: null, plans, matrix, featureKeys: expanded.features.map((f) => f.key), overrides: [], settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' }, ...over };
}
const sub = (planKey: string, over: Partial<EngineSubscription> = {}): EngineSubscription => ({
  id: 's1', planId: `id_${planKey}`, status: 'ACTIVE', termMonths: planKey.endsWith('_pro') ? 3 : null, startsAt: new Date(NOW.getTime() - 100 * DAY),
  endsAt: planKey.endsWith('_pro') ? new Date(NOW.getTime() + 30 * DAY) : null, graceEndsAt: null, ...over,
});
const endedDaysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

describe('effective plan: every combination of subscription state and vendor status', () => {
  it.each([
    // [name, subscription, suspended, expected effective plan, graceWarning, fellBack]
    ['active Pro', sub('handyman_pro'), false, 'handyman_pro', false, false],
    ['Pro in grace (2 days past the end, 7 grace days)', sub('handyman_pro', { endsAt: endedDaysAgo(2) }), false, 'handyman_pro', true, false],
    ['Pro after grace (8 days past the end)', sub('handyman_pro', { endsAt: endedDaysAgo(8) }), false, 'handyman_free', false, true],
    ['cancelled Pro', sub('handyman_pro', { status: 'CANCELLED' }), false, 'handyman_free', false, true],
    ['Free plan', sub('handyman_free'), false, 'handyman_free', false, false],
    ['active Pro but the vendor is SUSPENDED', sub('handyman_pro'), true, 'handyman_free', false, true],
    ['Pro in grace and SUSPENDED', sub('handyman_pro', { endsAt: endedDaysAgo(2) }), true, 'handyman_free', false, true],
    ['expired Pro and SUSPENDED', sub('handyman_pro', { endsAt: endedDaysAgo(30) }), true, 'handyman_free', false, true],
    ['Free and SUSPENDED', sub('handyman_free'), true, 'handyman_free', false, false],
    ['ecommerce Pro SUSPENDED falls to the ECOMMERCE Free plan', sub('ecommerce_pro'), true, 'ecommerce_free', false, true],
  ] as [string, EngineSubscription, boolean, string, boolean, boolean][])('%s', (_n, s, suspended, plan, warn, fell) => {
    const r = resolveEntitlements(input({ subscription: s, vendorSuspended: suspended }));
    expect(r.plan).toBe(plan); expect(r.graceWarning).toBe(warn);
    const choice = chooseEffectivePlan({ subscription: s, plans: input().plans, settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' }, now: NOW, vendorSuspended: suspended });
    expect(choice.effective?.key).toBe(plan); expect(choice.fellBack).toBe(fell);
    expect(r.suspended).toBe(suspended);
  });

  it('the grace and expiry arithmetic is the engine one (effectiveStatus), not a copy', () => {
    const s = sub('handyman_pro', { endsAt: endedDaysAgo(2) });
    expect(effectiveStatus(s, NOW, { graceDays: 7 })).toBe('GRACE');
    expect(chooseEffectivePlan({ subscription: s, plans: input().plans, settings: { graceDays: 1, downgradeBehaviour: 'FALL_TO_FREE' }, now: NOW, vendorSuspended: false }).status).toBe('EXPIRED');
  });

  it('no subscription: nothing to fall back to (mode follows the flag), and suspension changes nothing', () => {
    expect(resolveEntitlements(input({ subscription: null, vendorSuspended: true })).plan).toBeNull();
  });

  it('Pro features stop on suspension and on expiry; the Free cells apply (site.cta locked, requests locked)', () => {
    for (const s of [sub('professional_pro', { endsAt: endedDaysAgo(30) }), sub('professional_pro')]) {
      const r = resolveEntitlements(input({ subscription: s, vendorSuspended: s.endsAt !== null && s.endsAt > NOW }));
      expect(can(r, 'site.cta').allowed).toBe(false); expect(can(r, 'requests.inbox').allowed).toBe(false); expect(can(r, 'payments.vendor_methods').allowed).toBe(false);
      expect(toRenderEntitlements(r).booking).toBe(false);
    }
  });

  it('a renewal restores Pro at once (same engine, a new current subscription)', () => {
    const expired = resolveEntitlements(input({ subscription: sub('professional_pro', { endsAt: endedDaysAgo(30) }) }));
    expect(can(expired, 'site.cta').allowed).toBe(false);
    const renewed = resolveEntitlements(input({ subscription: sub('professional_pro', { id: 's2', endsAt: new Date(NOW.getTime() + 90 * DAY) }) }));
    expect(can(renewed, 'site.cta').allowed).toBe(true); expect(renewed.plan).toBe('professional_pro');
  });

  it('overrides are ignored while a vendor is suspended (a staff grant cannot keep Pro features on a suspended vendor)', () => {
    const o = { id: 'o1', featureKey: 'site.cta', state: 'ACTIVE' as const, limitValue: null, enumValue: null, reason: 'x', expiresAt: null, createdAt: NOW };
    expect(can(resolveEntitlements(input({ subscription: sub('handyman_free'), overrides: [o] })), 'site.cta').allowed).toBe(true);   // not suspended: the override works
    expect(can(resolveEntitlements(input({ subscription: sub('handyman_free'), overrides: [o], vendorSuspended: true })), 'site.cta').allowed).toBe(false);
  });

  it('the owner can still pick KEEP_UNTIL_REPLACED for expiry, but suspension always gives Free', () => {
    const keep = { graceDays: 7, downgradeBehaviour: 'KEEP_UNTIL_REPLACED' };
    expect(resolveEntitlements(input({ subscription: sub('handyman_pro', { endsAt: endedDaysAgo(30) }), settings: keep })).plan).toBe('handyman_pro');
    expect(resolveEntitlements(input({ subscription: sub('handyman_pro', { endsAt: endedDaysAgo(30) }), settings: keep, vendorSuspended: true })).plan).toBe('handyman_free');
  });
});
