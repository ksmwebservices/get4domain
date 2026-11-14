/**
 * The entitlement core (S51.4). PURE: no database, no Nest, no clock (the caller passes `now`). It works for ANY plans, features, states and
 * limits: nothing in here names a price, a limit or a feature. See docs/v3/V3_S1_PLANS_ENTITLEMENTS.md sections 3 to 5.
 */
export type FeatureStateName = 'ACTIVE' | 'LIMITED' | 'LOCKED_PREVIEW' | 'HIDDEN';
export type SubscriptionStatusName = 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED';
export type PlanState = SubscriptionStatusName | 'PAUSED' | null;
export type EntitlementSource = 'PLAN' | 'OVERRIDE' | 'STATUS';
export type EntitlementMode = 'LEGACY' | 'V3' | 'UNASSIGNED';
export type DenyReason = 'FEATURE_LOCKED' | 'FEATURE_HIDDEN' | 'LIMIT_REACHED';

export interface EnginePlan { id: string; key: string; track: string; level: string; status: string }
export interface EngineCell { state: FeatureStateName; limitValue: number | null; enumValue: string | null; upsellText: string | null }
export interface EngineSubscription {
  id: string; planId: string; status: SubscriptionStatusName; termMonths: number | null;
  startsAt: Date; endsAt: Date | null; graceEndsAt: Date | null;
}
export interface EngineOverride {
  id: string; featureKey: string; state: FeatureStateName; limitValue: number | null; enumValue: string | null;
  reason: string; expiresAt: Date | null; createdAt: Date;
}
export interface EngineSettings { graceDays: number; downgradeBehaviour: string }

export interface EngineInput {
  now: Date;
  /** the per-vendor flag v3_plans */
  flagOn: boolean;
  subscription: EngineSubscription | null;
  plans: EnginePlan[];
  /** plan id -> feature key -> cell */
  matrix: Map<string, Map<string, EngineCell>>;
  /** every key of the feature catalogue (so the result lists them all) */
  featureKeys: string[];
  overrides: EngineOverride[];
  settings: EngineSettings;
  /** how many items the vendor currently has per feature key (only needed to flag overLimit) */
  usage?: Record<string, number>;
  /** owner rule 9: a SUSPENDED vendor gets the track's Free entitlements and no override can switch a Pro feature back on. Nothing is deleted. */
  vendorSuspended?: boolean;
  /** Amendment 13 B13: staff paused the paid plan. Like a suspension for the plan that applies (the track's Free plan), reported as its own state; the subscription row, the term and every record are untouched. */
  vendorPaused?: boolean;
}

export interface ResolvedFeature {
  state: FeatureStateName;
  limit: number | null;
  enumValue: string | null;
  upsellText: string | null;
  overLimit: boolean;
  source: EntitlementSource;
}
export interface ResolvedEntitlements {
  mode: EntitlementMode;
  /** the plan whose features apply now (the Free plan after a downgrade) */
  plan: string | null;
  /** the plan on the subscription row */
  subscribedPlan: string | null;
  track: string | null;
  level: string | null;
  subscriptionStatus: SubscriptionStatusName | null;
  graceWarning: boolean;
  /** true when the vendor is suspended (the Free entitlements apply; the site and listing stay live) */
  suspended: boolean;
  /** true while the paid plan is paused (the Free entitlements apply, every record is kept) */
  paused?: boolean;
  /** the one word a screen switches on: PAUSED while paused, otherwise the subscription status (null when there is none). The engine always sets both; a hand-built value in a test may leave them out. */
  planState?: PlanState;
  features: Record<string, ResolvedFeature>;
}
export interface CanResult { allowed: boolean; state: FeatureStateName; limit: number | null; reason: DenyReason | null; upsellText: string | null }

const DAY_MS = 86_400_000;

/** Computed from the dates every time, so a vendor never depends on a scheduled job. Only CANCELLED is taken from the stored row. */
export function effectiveStatus(sub: Pick<EngineSubscription, 'status' | 'endsAt' | 'graceEndsAt'>, now: Date, settings: { graceDays: number }): SubscriptionStatusName {
  if (sub.status === 'CANCELLED') return 'CANCELLED';
  if (!sub.endsAt) return 'ACTIVE';
  if (now.getTime() < sub.endsAt.getTime()) return 'ACTIVE';
  const graceEnd = sub.graceEndsAt ?? new Date(sub.endsAt.getTime() + Math.max(0, settings.graceDays) * DAY_MS);
  return now.getTime() < graceEnd.getTime() ? 'GRACE' : 'EXPIRED';
}

const hidden = (source: EntitlementSource = 'STATUS'): ResolvedFeature => ({ state: 'HIDDEN', limit: null, enumValue: null, upsellText: null, overLimit: false, source });

function finish(cell: { state: FeatureStateName; limitValue: number | null; enumValue: string | null; upsellText: string | null }, source: EntitlementSource, used: number | undefined): ResolvedFeature {
  const overLimit = cell.state === 'LIMITED' && cell.limitValue !== null && used !== undefined && used > cell.limitValue;
  return { state: cell.state, limit: cell.limitValue, enumValue: cell.enumValue, upsellText: cell.upsellText, overLimit, source };
}

export interface EffectivePlanChoice {
  subscribed: EnginePlan | undefined;
  /** the plan whose cells apply now */
  effective: EnginePlan | undefined;
  status: SubscriptionStatusName | null;
  /** true when the effective plan is the track's Free plan because Pro lapsed, was cancelled or the vendor is suspended */
  fellBack: boolean;
  suspended: boolean;
}

/**
 * Which plan applies? The ONE place that decides (slice 5.1d reuses the slice 5.1 grace and expiry arithmetic through effectiveStatus; nothing is duplicated).
 * ACTIVE gives its plan; GRACE keeps the plan (the caller shows a warning); after the grace period, or when cancelled, the track's Free plan (unless the owner chose
 * KEEP_UNTIL_REPLACED for expiry); a SUSPENDED vendor always gets the Free plan of their track. Pure: nothing is stored or deleted.
 */
export function chooseEffectivePlan(a: { subscription: EngineSubscription | null; plans: EnginePlan[]; settings: EngineSettings; now: Date; vendorSuspended?: boolean; vendorPaused?: boolean }): EffectivePlanChoice {
  const suspended = a.vendorSuspended === true;
  const paused = a.vendorPaused === true;
  if (!a.subscription) return { subscribed: undefined, effective: undefined, status: null, fellBack: false, suspended };
  const subscribed = a.plans.find((p) => p.id === a.subscription!.planId);
  const status = effectiveStatus(a.subscription, a.now, a.settings);
  let effective = subscribed;
  let fellBack = false;
  const lapsed = status === 'EXPIRED' || status === 'CANCELLED';
  const dropForLapse = lapsed && subscribed && subscribed.level !== 'FREE' && (status === 'CANCELLED' || a.settings.downgradeBehaviour !== 'KEEP_UNTIL_REPLACED');
  const dropForSuspension = (suspended || paused) && subscribed && subscribed.level !== 'FREE';
  if (dropForLapse || dropForSuspension) {
    effective = a.plans.find((p) => p.track === subscribed!.track && p.level === 'FREE');
    fellBack = true;
  }
  return { subscribed, effective, status, fellBack, suspended };
}

export function resolveEntitlements(input: EngineInput): ResolvedEntitlements {
  const { now, subscription: sub, plans, matrix, featureKeys, overrides, settings, usage } = input;
  const mode: EntitlementMode = !sub ? (input.flagOn ? 'UNASSIGNED' : 'LEGACY') : 'V3';
  const { subscribed, effective, status, fellBack, suspended } = chooseEffectivePlan({ subscription: sub, plans, settings, now, vendorSuspended: input.vendorSuspended, vendorPaused: input.vendorPaused });

  // newest non-expired override per feature (none while suspended: Pro features stop, whatever staff granted)
  const live = new Map<string, EngineOverride>();
  for (const o of suspended ? [] : overrides) {
    if (o.expiresAt && o.expiresAt.getTime() <= now.getTime()) continue;
    const cur = live.get(o.featureKey);
    if (!cur || o.createdAt.getTime() > cur.createdAt.getTime()) live.set(o.featureKey, o);
  }

  const planCells = effective ? matrix.get(effective.id) : undefined;
  const keys = new Set([...featureKeys, ...live.keys()]);
  const features: Record<string, ResolvedFeature> = {};
  for (const key of keys) {
    const o = live.get(key);
    const cell = planCells?.get(key);
    if (o) features[key] = finish({ state: o.state, limitValue: o.limitValue, enumValue: o.enumValue, upsellText: cell?.upsellText ?? null }, 'OVERRIDE', usage?.[key]);
    else if (cell) features[key] = finish(cell, fellBack ? 'STATUS' : 'PLAN', usage?.[key]);
    else features[key] = hidden('STATUS');
  }

  return {
    mode,
    plan: effective?.key ?? null,
    subscribedPlan: subscribed?.key ?? null,
    track: (effective ?? subscribed)?.track ?? null,
    level: effective?.level ?? null,
    subscriptionStatus: status,
    graceWarning: status === 'GRACE' && !suspended,
    suspended,
    paused: input.vendorPaused === true && !!subscribed && subscribed.level !== 'FREE',
    planState: input.vendorPaused === true && !!subscribed && subscribed.level !== 'FREE' ? 'PAUSED' : status,
    features,
  };
}

/** May the vendor use this feature? `currentCount` (how many they already have) is only needed for LIMITED features. */
export function can(resolved: ResolvedEntitlements, key: string, currentCount?: number): CanResult {
  const f = resolved.features[key] ?? hidden('STATUS');
  const base = { state: f.state, limit: f.limit, upsellText: f.upsellText };
  switch (f.state) {
    case 'ACTIVE': return { ...base, allowed: true, reason: null };
    case 'LIMITED':
      if (f.limit !== null && currentCount !== undefined && currentCount >= f.limit) return { ...base, allowed: false, reason: 'LIMIT_REACHED' };
      return { ...base, allowed: true, reason: null };
    case 'LOCKED_PREVIEW': return { ...base, allowed: false, reason: 'FEATURE_LOCKED' };
    default: return { ...base, allowed: false, reason: 'FEATURE_HIDDEN' };
  }
}

export interface LimitError { code: 'FEATURE_LOCKED' | 'LIMIT_REACHED'; upsellText: string | null; state: FeatureStateName; limit: number | null }
/** null when allowed; otherwise the stable machine code (a HIDDEN feature is reported as FEATURE_LOCKED too). */
export function assertWithinLimitResult(resolved: ResolvedEntitlements, key: string, currentCount: number): LimitError | null {
  const r = can(resolved, key, currentCount);
  if (r.allowed) return null;
  return { code: r.reason === 'LIMIT_REACHED' ? 'LIMIT_REACHED' : 'FEATURE_LOCKED', upsellText: r.upsellText, state: r.state, limit: r.limit };
}

export interface RenderEntitlements { video: boolean; cart: boolean; booking: boolean; customDomain: boolean; callsToAction: boolean }
/**
 * The five booleans the theme kit asks the platform for. Pinned by a test:
 *   video = site.video ACTIVE; cart = shop.cart ACTIVE; booking = site.booking ACTIVE;
 *   customDomain = (site.custom_domain or promotion.custom_domain_addon ACTIVE) and the custom domain is the site address (the domain slice supplies that fact: true only while the
 *   promotion add-on is active and a custom domain is ACTIVE, owner rule 4);
 *   callsToAction = site.cta ACTIVE (slice 5.4b: false = a listing-only site with no form, button, call, chat, booking or cart).
 * LIMITED, LOCKED_PREVIEW and HIDDEN are all false.
 */
export function toRenderEntitlements(resolved: ResolvedEntitlements, hasVerifiedDomain = false): RenderEntitlements {
  const on = (key: string): boolean => resolved.features[key]?.state === 'ACTIVE';
  return { video: on('site.video'), cart: on('shop.cart'), booking: on('site.booking'), customDomain: (on('site.custom_domain') || on('promotion.custom_domain_addon')) && hasVerifiedDomain === true, callsToAction: on('site.cta') };
}
