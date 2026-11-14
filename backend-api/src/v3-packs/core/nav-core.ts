import { Tier, TIERS, tierRank } from './pack-core';

/**
 * The entitlement resolver and navigation core of the pack engine (Amendment 13 V3, V6, V7). PURE: no clock, no database.
 *
 * It does NOT redo plan arithmetic. The Stage 5.1 engine (`resolveEntitlements`) already decides which plan applies now (grace, expiry, cancel, suspension and the fall-back to the
 * track's Free plan) and hands over `mode`, `level` and `track`. This file turns those three facts, plus the vendor's pack and capabilities and the tier matrix, into a list of tabs:
 *   - tier        = the plan track of the plan that applies now (HANDYMAN, PROFESSIONAL, ECOMMERCE)
 *   - "Pro"       = any paid plan (level PRO); a Free trial (level FREE, or a V3 vendor with no plan yet) only opens the tabs marked freeTrial
 *   - LEGACY      = a vendor still on the Version 2 rules: nothing here restricts them (the same rule as the retired-module guard)
 * Nothing is ever deleted. A downgrade or an expiry only changes a state, and the state comes back with the plan.
 */
export type TabState = 'ACTIVE' | 'LOCKED_PREVIEW' | 'HIDDEN';
export type TabReason = 'FREE_TRIAL' | 'NEEDS_TIER' | 'TIER_DOWNGRADE' | 'GATED_PACK' | 'PLAN_PAUSED' | null;

/** The groups of the tab list, in the order the vendor app draws them (common tabs, pack tabs, capability tabs, add-on tabs). A tab's group is its scope. */
export const NAV_GROUPS = ['COMMON', 'PACK', 'CAPABILITY', 'ADDON'] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

const TIER_LABEL: Record<Tier, string> = { HANDYMAN: 'Handyman', PROFESSIONAL: 'Professional', ECOMMERCE: 'Ecommerce' };
/** The sentence under a locked or hidden tab. No timeframe, no price (prices are the owner's and live in the price book), and no internal product word. */
export function upsellText(reason: TabReason, needsTier: Tier | null): string | null {
  const plan = needsTier ? TIER_LABEL[needsTier] : null;
  switch (reason) {
    case 'FREE_TRIAL': return plan ? `Open this with a paid plan, from the ${plan} plan.` : 'Open this with a paid plan.';
    case 'NEEDS_TIER': return plan ? `This needs the ${plan} plan.` : 'This needs a higher plan.';
    case 'TIER_DOWNGRADE': return plan ? `Hidden on your current plan. Your records are kept. It returns with the ${plan} plan.` : 'Hidden on your current plan. Your records are kept.';
    case 'PLAN_PAUSED': return 'Your plan is paused. Your records are kept and this opens again when the plan resumes.';
    default: return null;
  }
}

export interface NavTabDef { scope: 'COMMON' | 'PACK' | 'CAPABILITY' | 'ADDON'; ownerKey: string; key: string; label: string; route: string; minTier: Tier | null; capabilityKey: string | null; freeTrial: boolean; sortOrder: number }
export interface NavTab { key: string; label: string; route: string; scope: NavTabDef['scope']; group: NavGroup; ownerKey: string; state: TabState; reason: TabReason; needsTier: Tier | null; upsellText: string | null; capabilityKey: string | null }

export interface NavInput {
  mode: 'LEGACY' | 'V3' | 'UNASSIGNED';
  /** the level of the plan that applies now; null when the vendor has no plan yet */
  level: 'FREE' | 'PRO' | null;
  /** the plan track of the plan that applies now */
  tier: Tier | null;
  /** only the ACTIVE tab definitions; the PACK ones may be those of every pack (the resolver keeps the vendor's own) */
  tabs: NavTabDef[];
  pack: { key: string; counselGated: boolean } | null;
  /** the setting that opens the health, legal and finance packs once counsel has signed off (default closed) */
  gatedPacksOpen: boolean;
  /** tier -> the capabilities its row allows */
  matrix: ReadonlyMap<Tier, ReadonlySet<string>>;
  /** the capabilities the vendor switched on (a vendor holds any number) */
  held: ReadonlySet<string>;
  /** add-on packs active for the vendor (V3A): each adds its own tabs and the capabilities it grants, whatever the tier row says */
  addons?: ReadonlySet<string>;
  addonGrants?: ReadonlySet<string>;
  /** the paid plan is paused (Amendment 13 B13): the Free trial tabs stay ACTIVE, the rest are LOCKED_PREVIEW (capability tabs HIDDEN) with the reason PLAN_PAUSED, and every record is kept */
  paused?: boolean;
}

/** The lowest tier whose row allows the capability, or null when no tier does. */
export function lowestTierFor(capability: string, matrix: NavInput['matrix']): Tier | null {
  for (const t of TIERS) if (matrix.get(t)?.has(capability)) return t;
  return null;
}
export function tierAllows(tier: Tier | null, capability: string, matrix: NavInput['matrix'], grants?: ReadonlySet<string>): boolean {
  return grants?.has(capability) === true || (tier !== null && matrix.get(tier)?.has(capability) === true);
}

const tab = (d: NavTabDef, state: TabState, reason: TabReason = null, needsTier: Tier | null = null): NavTab => ({ key: d.key, label: d.label, route: d.route, scope: d.scope, group: d.scope, ownerKey: d.ownerKey, state, reason, needsTier, upsellText: upsellText(reason, needsTier), capabilityKey: d.capabilityKey });

export function resolveNav(i: NavInput): NavTab[] {
  const order: Record<NavTabDef['scope'], number> = { COMMON: 0, PACK: 1, CAPABILITY: 2, ADDON: 3 };
  const defs = i.tabs
    .filter((d) => d.scope === 'COMMON' || (d.scope === 'PACK' && i.pack !== null && d.ownerKey === i.pack.key) || (d.scope === 'CAPABILITY' && (i.held.has(d.ownerKey) || i.addonGrants?.has(d.ownerKey) === true)) || (d.scope === 'ADDON' && i.addons?.has(d.ownerKey) === true))
    .sort((a, b) => order[a.scope] - order[b.scope] || a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  const paid = i.mode === 'V3' && i.level === 'PRO';
  const out: NavTab[] = [];
  for (const d of defs) {
    if (i.mode === 'LEGACY') { out.push(tab(d, 'ACTIVE')); continue; }
    if (d.scope === 'PACK' && i.pack?.counselGated && !i.gatedPacksOpen) { out.push(tab(d, 'HIDDEN', 'GATED_PACK')); continue; }
    if (d.freeTrial) { out.push(tab(d, 'ACTIVE')); continue; }
    if (i.paused === true) { out.push(d.scope === 'CAPABILITY' ? tab(d, 'HIDDEN', 'PLAN_PAUSED') : tab(d, 'LOCKED_PREVIEW', 'PLAN_PAUSED')); continue; }
    if (!paid) { out.push(tab(d, 'LOCKED_PREVIEW', 'FREE_TRIAL', d.capabilityKey ? lowestTierFor(d.capabilityKey, i.matrix) : d.minTier)); continue; }
    if (d.scope === 'CAPABILITY') {
      out.push(tierAllows(i.tier, d.ownerKey, i.matrix, i.addonGrants) ? tab(d, 'ACTIVE') : tab(d, 'HIDDEN', 'TIER_DOWNGRADE', lowestTierFor(d.ownerKey, i.matrix)));
      continue;
    }
    if (d.minTier && (i.tier === null || tierRank(i.tier) < tierRank(d.minTier))) { out.push(tab(d, 'LOCKED_PREVIEW', 'NEEDS_TIER', d.minTier)); continue; }
    if (d.capabilityKey && !tierAllows(i.tier, d.capabilityKey, i.matrix, i.addonGrants)) { out.push(tab(d, 'LOCKED_PREVIEW', 'NEEDS_TIER', lowestTierFor(d.capabilityKey, i.matrix))); continue; }
    out.push(tab(d, 'ACTIVE'));
  }
  return out;
}

export type TabAccess = { allowed: true } | { allowed: false; state: TabState | 'UNKNOWN'; reason: TabReason; needsTier: Tier | null };
/** May this vendor open the routes behind a tab? Only an ACTIVE tab opens; a tab the vendor does not have at all is refused too (fail closed). A LEGACY vendor is never restricted here. */
export function tabAccess(mode: NavInput['mode'], nav: readonly NavTab[], key: string): TabAccess {
  if (mode === 'LEGACY') return { allowed: true };
  const t = nav.find((x) => x.key === key);
  if (!t) return { allowed: false, state: 'UNKNOWN', reason: null, needsTier: null };
  return t.state === 'ACTIVE' ? { allowed: true } : { allowed: false, state: t.state, reason: t.reason, needsTier: t.needsTier };
}

export type CapabilityAnswer =
  | { ok: true }
  | { ok: false; code: 'NEEDS_TIER'; needsTier: Tier | null }
  | { ok: false; code: 'UNKNOWN_CAPABILITY' };
/** "May a vendor of this tier add this capability?" The same answer registration and the capability routes give: a capability above the tier names the tier that has it. */
export function capabilityAnswer(tier: Tier | null, capability: string, known: ReadonlySet<string>, matrix: NavInput['matrix'], grants?: ReadonlySet<string>): CapabilityAnswer {
  if (!known.has(capability)) return { ok: false, code: 'UNKNOWN_CAPABILITY' };
  return tierAllows(tier, capability, matrix, grants) ? { ok: true } : { ok: false, code: 'NEEDS_TIER', needsTier: lowestTierFor(capability, matrix) };
}
