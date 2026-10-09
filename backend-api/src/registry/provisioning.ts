import { Prisma } from '@prisma/client';
import { FEATURES, featureState, profileOfIndustry } from './registry.generated';
import type { PlanKey, Profile, VendorPlan } from './registry.generated';

/**
 * Plan-driven module provisioning (Release 1A, Phase 4). The registry (registry/features.ts) is the only place that says which module or
 * add-on a feature needs and which plan includes it; this file turns that into VendorModule / VendorAddon rows.
 *
 * Rules (KSM, 2026-10-08):
 *  - GRANT ONLY. A module the plan includes (and that is really built) is switched on. Nothing is ever switched off here and no vendor data is
 *    ever deleted: a downgrade, a lapse or a smaller plan changes what the menu offers, not what the vendor has already set up.
 *  - An explicit OFF row (set by KSM in Plan access, or by an older setting) is an exception and is respected, and reported as "kept off".
 *  - Idempotent: running it twice writes nothing the second time (no rows, no audit entry).
 */

export interface DesiredAccess { modules: string[]; addons: string[] }
export interface CurrentAccess { modules: { moduleKey: string; enabled: boolean }[]; addons: { addonKey: string; enabled: boolean }[] }
export interface ProvisionPlan {
  grantModules: string[];
  grantAddons: string[];
  /** Wanted by the plan but explicitly switched off for this vendor: left alone. */
  keptOffModules: string[];
  keptOffAddons: string[];
  /** Switched on for this vendor but not part of its plan: reported, never removed. */
  beyondPlanModules: string[];
  beyondPlanAddons: string[];
}

/** The modules/add-ons a vendor on `plan` (a Custom client when `custom`) with this business `profile` is entitled to. */
export function desiredAccess(plan: VendorPlan, custom: boolean, profile: Profile): DesiredAccess {
  const modules = new Set<string>();
  const addons = new Set<string>();
  for (const f of FEATURES) {
    if (!f.moduleKey && !f.addonKey) continue;
    // `hidden` only hides the menu entry (e.g. Stationery); the module behind it is still part of the plan.
    if (featureState({ ...f, hidden: false }, { plan, custom, profile, navV2: true }) !== 'OPEN') continue;
    if (f.moduleKey) modules.add(f.moduleKey);
    if (f.addonKey) addons.add(f.addonKey);
  }
  return { modules: [...modules].sort(), addons: [...addons].sort() };
}

export function planProvision(cur: CurrentAccess, want: DesiredAccess): ProvisionPlan {
  const modOn = new Map(cur.modules.map((m) => [m.moduleKey, m.enabled]));
  const addOn = new Map(cur.addons.map((a) => [a.addonKey, a.enabled]));
  return {
    grantModules: want.modules.filter((k) => modOn.get(k) !== true && modOn.get(k) !== false),
    grantAddons: want.addons.filter((k) => addOn.get(k) !== true && addOn.get(k) !== false),
    keptOffModules: want.modules.filter((k) => modOn.get(k) === false),
    keptOffAddons: want.addons.filter((k) => addOn.get(k) === false),
    beyondPlanModules: cur.modules.filter((m) => m.enabled && !want.modules.includes(m.moduleKey)).map((m) => m.moduleKey).sort(),
    beyondPlanAddons: cur.addons.filter((a) => a.enabled && !want.addons.includes(a.addonKey) && a.addonKey !== 'nav_v2' && a.addonKey !== 'bos_custom' && a.addonKey !== 'workspace_menu' && a.addonKey !== 'leadspace_only').map((a) => a.addonKey).sort(),
  };
}

export interface ProvisionResult { plan: ProvisionPlan; changed: boolean }

/**
 * Brings the vendor's module/add-on rows up to its plan. `db` is a transaction client (settlement, renewal, plan change) or the Prisma service
 * (admin override). `reason` and `actor` go to the commercial audit log whenever something was granted.
 */
export async function provisionModules(
  db: Prisma.TransactionClient,
  vendorId: string,
  planKey: PlanKey,
  opts: { actor: string; reason: string },
): Promise<ProvisionResult> {
  const vendor = await db.vendor.findUnique({ where: { id: vendorId }, select: { industry: true } });
  const [modules, addons] = await Promise.all([
    db.vendorModule.findMany({ where: { vendorId } }),
    db.vendorAddon.findMany({ where: { vendorId } }),
  ]);
  const custom = addons.some((a) => a.addonKey === 'bos_custom' && a.enabled);
  const want = desiredAccess(planKey, custom, profileOfIndustry(vendor?.industry));
  const plan = planProvision({ modules, addons }, want);
  // A vendor who buys a plan leaves the LeadSpace-only app: the full dashboard takes over (LeadSpace stays under Marketing and Growth). Nothing is deleted.
  const leavingLeadspaceOnly = addons.some((a) => a.addonKey === 'leadspace_only' && a.enabled);
  if (leavingLeadspaceOnly) await db.vendorAddon.update({ where: { vendorId_addonKey: { vendorId, addonKey: 'leadspace_only' } }, data: { enabled: false } });
  const changed = plan.grantModules.length + plan.grantAddons.length > 0;
  if (!changed) return { plan, changed };
  for (const moduleKey of plan.grantModules) {
    await db.vendorModule.upsert({ where: { vendorId_moduleKey: { vendorId, moduleKey } }, create: { vendorId, moduleKey, enabled: true }, update: { enabled: true } });
  }
  for (const addonKey of plan.grantAddons) {
    await db.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId, addonKey } }, create: { vendorId, addonKey, enabled: true }, update: { enabled: true } });
  }
  await db.commercialAuditLog.create({
    data: {
      actor: opts.actor, actorRole: 'system', action: 'vendor.modules_provisioned', entityType: 'Vendor', entityId: vendorId,
      detail: { plan: planKey, reason: opts.reason, grantedModules: plan.grantModules, grantedAddons: plan.grantAddons, keptOff: [...plan.keptOffModules, ...plan.keptOffAddons] } as Prisma.InputJsonValue,
    },
  });
  return { plan, changed };
}
