import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException, SetMetadata } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CAPABILITIES, FEATURES, PlanKey, planDisplayName } from '../registry/registry.generated';
import type { Capability, MinPlan, PlanLimits } from '../registry/registry.generated';

/**
 * Plan-driven entitlements (Full BOS). ONE function decides what a vendor may use:
 *   registry defaults  <-  admin plan overrides (g4d_plan_overrides)  <-  the vendor's plan (billing term)  <-  admin per-vendor exception
 * Business code never asks "which plan is this?"; it asks `check(vendorId, 'bos.books')`. The server enforces it (HTTP 403, code PLAN_REQUIRED);
 * hiding a menu item is only the polite half. Capturing records is never gated (capability.capture === 'always' is simply never asked about).
 *
 * Lapse and downgrade lock, they never delete: a lapsed or downgraded vendor is treated as Essentials for the gated views; every record stays.
 */

export const REQUIRE_CAPABILITY_KEY = 'requireCapability';
/** Declares the capability a route needs; enforced by EntitlementGuard (403 PLAN_REQUIRED with the plan that includes it). */
export const RequireCapability = (id: string) => SetMetadata(REQUIRE_CAPABILITY_KEY, id);

const RANK: Record<MinPlan, number> = { WORKSPACE: 1, BOS: 2, CUSTOM: 3 };

export interface CapabilityAccess { id: string; label: string; allowed: boolean; requiredPlan: string; reason: 'PLAN' | 'EXCEPTION_ON' | 'EXCEPTION_OFF' | 'CUSTOM'; limits: Record<string, number | null> }
export interface Entitlements { plan: PlanKey; planName: string; custom: boolean; lapsed: boolean; capabilities: Record<string, CapabilityAccess> }

interface Override { minPlan?: PlanKey; limits?: Record<string, Partial<Record<PlanKey, number | null>>> }

@Injectable()
export class EntitlementsService {
  private cache = new Map<string, { at: number; value: Entitlements }>();
  ttlMs = 15_000;

  constructor(private readonly prisma: PrismaService) {}

  invalidate(vendorId?: string): void { if (vendorId) this.cache.delete(vendorId); else this.cache.clear(); }

  /** The plan-access table as admin sees it: registry default merged with any override. */
  async table(): Promise<{ capability: Capability; minPlan: PlanKey; limits: Record<string, PlanLimits>; overridden: boolean }[]> {
    const rows = await this.prisma.planOverride.findMany();
    const by = new Map(rows.map((r) => [r.key, r.value as unknown as Override]));
    return CAPABILITIES.map((c) => {
      const o = by.get(c.id);
      const limits: Record<string, PlanLimits> = {};
      for (const [name, def] of Object.entries(c.limits ?? {})) limits[name] = { ...def, ...(o?.limits?.[name] ?? {}) } as PlanLimits;
      return { capability: c, minPlan: o?.minPlan ?? c.minPlan, limits, overridden: Boolean(o) };
    });
  }

  async resolve(vendorId: string, now = Date.now()): Promise<Entitlements> {
    const hit = this.cache.get(vendorId);
    if (hit && now - hit.at < this.ttlMs) return hit.value;
    const [term, addons, table] = await Promise.all([
      this.prisma.billingTerm.findFirst({ where: { vendorId, isCurrent: true }, select: { planKey: true, status: true } }),
      this.prisma.vendorAddon.findMany({ where: { vendorId, OR: [{ addonKey: 'bos_custom' }, { addonKey: { startsWith: 'cap:' } }] } }),
      this.table(),
    ]);
    const custom = addons.some((a) => a.addonKey === 'bos_custom' && a.enabled);
    const lapsed = term?.status === 'LAPSED' || term?.status === 'CANCELLED';
    // No term yet (demo / sandbox) and a lapsed term both see the Essentials set; the vendor's data is never touched.
    const plan: PlanKey = !term || lapsed ? 'WORKSPACE' : (term.planKey as PlanKey);
    const exc = new Map(addons.filter((a) => a.addonKey.startsWith('cap:')).map((a) => [a.addonKey.slice(4), a.enabled]));
    const capabilities: Record<string, CapabilityAccess> = {};
    for (const t of table) {
      const need = t.minPlan;
      let allowed = custom || RANK[plan] >= RANK[need];
      let reason: CapabilityAccess['reason'] = custom ? 'CUSTOM' : 'PLAN';
      if (exc.has(t.capability.id)) { allowed = exc.get(t.capability.id) as boolean; reason = allowed ? 'EXCEPTION_ON' : 'EXCEPTION_OFF'; }
      const limits: Record<string, number | null> = {};
      for (const [name, l] of Object.entries(t.limits)) limits[name] = custom ? null : (l[plan] ?? null);
      capabilities[t.capability.id] = { id: t.capability.id, label: t.capability.label, allowed, requiredPlan: planDisplayName(need), reason, limits };
    }
    const value: Entitlements = { plan, planName: planDisplayName(plan), custom, lapsed, capabilities };
    this.cache.set(vendorId, { at: now, value });
    return value;
  }

  /** Admin: change the plan that includes a capability, or its limits. Stored as an override of the registry default; `reset` removes it. */
  async setOverride(capabilityId: string, patch: { minPlan?: PlanKey; limits?: Record<string, Partial<Record<PlanKey, number | null>>>; reset?: boolean }, actor: string): Promise<void> {
    const cap = CAPABILITIES.find((c) => c.id === capabilityId);
    if (!cap) throw new NotFoundException('That feature does not exist.');
    if (patch.reset) {
      await this.prisma.planOverride.deleteMany({ where: { key: capabilityId } });
    } else {
      const prev = ((await this.prisma.planOverride.findUnique({ where: { key: capabilityId } }))?.value ?? {}) as Override;
      for (const name of Object.keys(patch.limits ?? {})) if (!cap.limits?.[name]) throw new BadRequestException(`"${name}" is not a limit of this feature.`);
      const mergedLimits: NonNullable<Override['limits']> = { ...(prev.limits ?? {}) };
      for (const [k, v] of Object.entries(patch.limits ?? {})) mergedLimits[k] = { ...(prev.limits?.[k] ?? {}), ...v };
      const next: Override = { ...prev, ...(patch.minPlan ? { minPlan: patch.minPlan } : {}), limits: mergedLimits };
      await this.prisma.planOverride.upsert({ where: { key: capabilityId }, create: { key: capabilityId, value: next as unknown as Prisma.InputJsonValue, updatedBy: actor }, update: { value: next as unknown as Prisma.InputJsonValue, updatedBy: actor } });
    }
    this.invalidate();
  }

  /** Admin: switch one capability on or off for one vendor (null removes the exception and the plan decides again). */
  async setVendorException(vendorId: string, capabilityId: string, enabled: boolean | null): Promise<void> {
    if (!CAPABILITIES.some((c) => c.id === capabilityId)) throw new NotFoundException('That feature does not exist.');
    const key = `cap:${capabilityId}`;
    if (enabled === null) await this.prisma.vendorAddon.deleteMany({ where: { vendorId, addonKey: key } });
    else await this.prisma.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId, addonKey: key } }, create: { vendorId, addonKey: key, enabled }, update: { enabled } });
    this.invalidate(vendorId);
  }

  /** Throws the plain, structured 403 the dashboard turns into the upgrade card. */
  async check(vendorId: string, capabilityId: string): Promise<CapabilityAccess> {
    const e = await this.resolve(vendorId);
    const c = e.capabilities[capabilityId];
    if (!c) throw new ForbiddenException({ message: 'This is not available.', code: 'PLAN_REQUIRED', feature: capabilityId, requiredPlan: 'Pro' });
    if (!c.allowed) {
      throw new ForbiddenException({
        message: c.reason === 'EXCEPTION_OFF' ? 'This has been switched off for your account. Contact support if you need it.' : `${c.label} is part of the ${c.requiredPlan} plan. Your records are kept and show up as soon as you upgrade.`,
        code: 'PLAN_REQUIRED', feature: capabilityId, requiredPlan: c.requiredPlan,
      });
    }
    return c;
  }

  /** A named limit (null = unlimited). */
  async limit(vendorId: string, capabilityId: string, name: string): Promise<number | null> {
    const e = await this.resolve(vendorId);
    return e.capabilities[capabilityId]?.limits[name] ?? null;
  }

  /** The registry features that exist for the vendor's plan, for the dashboard (menu state stays in the registry; this is the server's own answer). */
  featureIds(): string[] { return FEATURES.map((f) => f.id); }
}

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly ent: EntitlementsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const need = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_CAPABILITY_KEY, [context.getHandler(), context.getClass()]);
    if (!need) return true;
    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true; // staff tools and public routes are not vendor-plan gated
    await this.ent.check(user.sub, need);
    return true;
  }
}
