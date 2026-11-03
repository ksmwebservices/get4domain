import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EngineCell, EngineOverride, EnginePlan, EngineSettings, EngineSubscription } from './entitlement-engine';

export interface Catalogue {
  plans: EnginePlan[];
  /** plan id -> feature key -> cell */
  matrix: Map<string, Map<string, EngineCell>>;
  featureKeys: string[];
  settings: EngineSettings;
}
export interface VendorState {
  flagOn: boolean;
  subscription: EngineSubscription | null;
  overrides: EngineOverride[];
}

export const V3_PLANS_FLAG = 'v3_plans';
export const DEFAULT_GRACE_DAYS = 7;
export const DEFAULT_DOWNGRADE = 'FALL_TO_FREE';

/** Where the engine reads its data from. An abstract class so Nest can inject it and tests can fake it. */
export abstract class PlansRepository {
  abstract loadCatalogue(): Promise<Catalogue>;
  abstract loadVendorState(vendorId: string): Promise<VendorState>;
}

/** Reads only the V3 tables (g4d_plans ... g4d_vendor_flags). Never a legacy billing, BOS, commercial or add-on table. */
@Injectable()
export class PrismaPlansRepository extends PlansRepository {
  constructor(private readonly prisma: PrismaService) { super(); }

  async loadCatalogue(): Promise<Catalogue> {
    const [plans, features, cells, settings] = await Promise.all([
      this.prisma.v3Plan.findMany({ select: { id: true, key: true, track: true, level: true, status: true } }),
      this.prisma.v3Feature.findMany({ select: { key: true } }),
      this.prisma.v3PlanFeature.findMany({ select: { planId: true, featureKey: true, state: true, limitValue: true, enumValue: true, upsellText: true } }),
      this.prisma.v3PlanSetting.findMany({ where: { key: { in: ['graceDays', 'downgradeBehaviour'] } } }),
    ]);
    const matrix = new Map<string, Map<string, EngineCell>>();
    for (const c of cells) {
      if (!matrix.has(c.planId)) matrix.set(c.planId, new Map());
      matrix.get(c.planId)!.set(c.featureKey, { state: c.state, limitValue: c.limitValue, enumValue: c.enumValue, upsellText: c.upsellText });
    }
    const setting = (k: string): unknown => settings.find((s) => s.key === k)?.valueJson;
    const grace = setting('graceDays');
    const down = setting('downgradeBehaviour');
    return {
      plans,
      matrix,
      featureKeys: features.map((f) => f.key),
      settings: { graceDays: typeof grace === 'number' && grace >= 0 ? grace : DEFAULT_GRACE_DAYS, downgradeBehaviour: typeof down === 'string' ? down : DEFAULT_DOWNGRADE },
    };
  }

  async loadVendorState(vendorId: string): Promise<VendorState> {
    const [flag, current, overrides] = await Promise.all([
      this.prisma.v3VendorFlag.findUnique({ where: { vendorId_key: { vendorId, key: V3_PLANS_FLAG } }, select: { enabled: true } }),
      this.prisma.v3PlanSubscription.findUnique({ where: { currentVendorId: vendorId } }),
      this.prisma.v3EntitlementOverride.findMany({ where: { vendorId } }),
    ]);
    // no current row: the most recent one (cancelled or ended) still tells us the track, so the vendor falls to that track's Free plan
    const sub = current ?? (await this.prisma.v3PlanSubscription.findFirst({ where: { vendorId }, orderBy: { createdAt: 'desc' } }));
    return {
      flagOn: flag?.enabled === true,
      subscription: sub && { id: sub.id, planId: sub.planId, status: sub.status, termMonths: sub.termMonths, startsAt: sub.startsAt, endsAt: sub.endsAt, graceEndsAt: sub.graceEndsAt },
      overrides: overrides.map((o) => ({ id: o.id, featureKey: o.featureKey, state: o.state, limitValue: o.limitValue, enumValue: o.enumValue, reason: o.reason, expiresAt: o.expiresAt, createdAt: o.createdAt })),
    };
  }
}
