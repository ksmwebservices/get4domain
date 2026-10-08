import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ADDON_KEYS, AVAILABLE_ADDONS, AVAILABLE_MODULES, MODULE_KEYS } from '../addons/addons.constants';
import { validOverrideReason } from '../commercial/activation-guard';
import { Actor, CommercialAuditService } from '../commercial/foundation.services';
import { desiredAccess, planProvision, provisionModules, ProvisionPlan } from './provisioning';
import { FEATURES, planDisplayName, profileOfIndustry } from './registry.generated';
import type { PlanKey } from './registry.generated';

export interface PlanAccessRow { moduleKey: string | null; addonKey: string | null; featureId: string; label: string; department: string; minPlan: string; status: string }

export interface VendorPlanAccess {
  vendor: { id: string; businessName: string; subdomain: string | null; industry: string | null };
  plan: PlanKey | null;
  planName: string;
  profile: string;
  custom: boolean;
  modules: { key: string; label: string; enabled: boolean; fromRow: boolean }[];
  addons: { key: string; label: string; enabled: boolean }[];
  provisionPlan: ProvisionPlan | null;
  exceptions: { id: string; at: Date; actor: string; kind: string; key: string; enabled: boolean; reason: string }[];
}

/** Admin "Plan access": which module each plan includes (read from the registry, never typed in twice) and per-vendor exceptions with a reason. */
@Injectable()
export class PlanAccessService {
  constructor(private readonly prisma: PrismaService, private readonly audit: CommercialAuditService) {}

  /** The module-to-plan map. One row per registry feature that needs a module or add-on. */
  map(): PlanAccessRow[] {
    return FEATURES.filter((f) => f.moduleKey || f.addonKey).map((f) => ({
      moduleKey: f.moduleKey ?? null, addonKey: f.addonKey ?? null, featureId: f.id, label: f.label, department: f.department,
      minPlan: planDisplayName(f.minPlan), status: f.status,
    }));
  }

  async searchVendors(q?: string): Promise<{ id: string; businessName: string; subdomain: string | null; plan: string; navV2: boolean }[]> {
    const term = (q ?? '').trim();
    const vendors = await this.prisma.vendor.findMany({
      where: { role: 'VENDOR', ...(term ? { OR: [{ businessName: { contains: term, mode: 'insensitive' } }, { subdomain: { contains: term, mode: 'insensitive' } }] } : {}) },
      select: { id: true, businessName: true, subdomain: true },
      orderBy: { createdAt: 'desc' }, take: 25,
    });
    const out = [];
    for (const v of vendors) {
      const [current, nav] = await Promise.all([
        this.prisma.billingTerm.findFirst({ where: { vendorId: v.id, isCurrent: true }, select: { planKey: true } }),
        this.prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId: v.id, addonKey: 'nav_v2' } } }),
      ]);
      out.push({ ...v, plan: planDisplayName(current?.planKey ?? null), navV2: nav?.enabled === true });
    }
    return out;
  }

  async forVendor(vendorId: string): Promise<VendorPlanAccess> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, businessName: true, subdomain: true, industry: true } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const [term, moduleRows, addonRows, history] = await Promise.all([
      this.prisma.billingTerm.findFirst({ where: { vendorId, isCurrent: true }, select: { planKey: true } }),
      this.prisma.vendorModule.findMany({ where: { vendorId } }),
      this.prisma.vendorAddon.findMany({ where: { vendorId } }),
      this.prisma.commercialAuditLog.findMany({ where: { entityType: 'Vendor', entityId: vendorId, action: 'plan_access.exception' }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const plan = (term?.planKey ?? null) as PlanKey | null;
    const custom = addonRows.some((a) => a.addonKey === 'bos_custom' && a.enabled);
    const profile = profileOfIndustry(vendor.industry);
    const modOn = new Map(moduleRows.map((m) => [m.moduleKey, m.enabled]));
    const addOn = new Map(addonRows.map((a) => [a.addonKey, a.enabled]));
    return {
      vendor, plan, planName: planDisplayName(plan), profile, custom,
      modules: AVAILABLE_MODULES.map((m) => ({ key: m.key, label: m.label, enabled: modOn.has(m.key) ? Boolean(modOn.get(m.key)) : m.defaultEnabled, fromRow: modOn.has(m.key) })),
      addons: AVAILABLE_ADDONS.map((a) => ({ key: a.key, label: a.label, enabled: addOn.has(a.key) ? Boolean(addOn.get(a.key)) : a.defaultEnabled })),
      provisionPlan: plan ? planProvision({ modules: moduleRows, addons: addonRows }, desiredAccess(plan, custom, profile)) : null,
      exceptions: history.map((h) => {
        const d = (h.detail ?? {}) as { kind?: string; key?: string; enabled?: boolean; reason?: string };
        return { id: h.id, at: h.createdAt, actor: h.actor, kind: d.kind ?? '', key: d.key ?? '', enabled: Boolean(d.enabled), reason: d.reason ?? '' };
      }),
    };
  }

  /** A per-vendor exception: switch one module or add-on on or off, with a reason of at least ten characters. Audited. */
  async setException(vendorId: string, dto: { kind: 'module' | 'addon'; key: string; enabled: boolean; reason: string }, actor: Actor): Promise<VendorPlanAccess> {
    if (dto.kind === 'module' ? !MODULE_KEYS.has(dto.key) : !ADDON_KEYS.has(dto.key)) throw new BadRequestException(`Unknown ${dto.kind}: ${dto.key}`);
    if (!validOverrideReason(dto.reason)) throw new BadRequestException('Give a reason of at least 10 characters. It is kept in the audit log.');
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (dto.kind === 'module') {
        await tx.vendorModule.upsert({ where: { vendorId_moduleKey: { vendorId, moduleKey: dto.key } }, create: { vendorId, moduleKey: dto.key, enabled: dto.enabled }, update: { enabled: dto.enabled } });
      } else {
        await tx.vendorAddon.upsert({ where: { vendorId_addonKey: { vendorId, addonKey: dto.key } }, create: { vendorId, addonKey: dto.key, enabled: dto.enabled }, update: { enabled: dto.enabled } });
      }
      await this.audit.log(actor, 'plan_access.exception', 'Vendor', vendorId, { kind: dto.kind, key: dto.key, enabled: dto.enabled, reason: dto.reason.trim() }, tx);
    });
    return this.forVendor(vendorId);
  }

  /** Admin override: bring the vendor's modules up to its current plan now (same grant-only function activation and renewal use). */
  async provisionNow(vendorId: string, actor: Actor): Promise<VendorPlanAccess> {
    const term = await this.prisma.billingTerm.findFirst({ where: { vendorId, isCurrent: true }, select: { planKey: true } });
    if (!term) throw new BadRequestException('This vendor has no active plan yet, so there is nothing to provision.');
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await provisionModules(tx, vendorId, term.planKey as PlanKey, { actor: actor.email || actor.id, reason: 'admin override (Plan access)' });
    });
    return this.forVendor(vendorId);
  }
}
