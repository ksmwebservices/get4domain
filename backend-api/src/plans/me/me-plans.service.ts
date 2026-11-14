import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PageQueryDto, pageArgs, paged } from '../admin/plans-admin.common';
import { RenderEntitlements, ResolvedFeature, toRenderEntitlements } from '../entitlements/entitlement-engine';
import { EntitlementsService } from '../entitlements/entitlements.service';

export interface MyEntitlements {
  mode: string; plan: string | null; track: string | null; level: string | null; subscriptionStatus: string | null; graceWarning: boolean;
  /** Amendment 13 B13: PAUSED while staff have paused the paid plan, otherwise the subscription status. A paused plan shows the Free trial tabs, locked ones say PLAN_PAUSED, and every record is kept. */
  planState: string | null; paused: boolean;
  features: Record<string, ResolvedFeature>;
  render: RenderEntitlements;
}

/** The signed-in vendor's own plan information. Every query is keyed by the vendor id of the VERIFIED principal, passed in by the controller. */
@Injectable()
export class MePlansService {
  constructor(private readonly prisma: PrismaService, private readonly engine: EntitlementsService) {}

  async entitlements(vendorId: string): Promise<MyEntitlements> {
    const r = await this.engine.resolve(vendorId);
    return {
      mode: r.mode, plan: r.plan, track: r.track, level: r.level, subscriptionStatus: r.subscriptionStatus, graceWarning: r.graceWarning, planState: r.planState ?? r.subscriptionStatus, paused: r.paused === true,
      features: r.features, render: toRenderEntitlements(r),
    };
  }

  async subscription(vendorId: string) {
    const include = { plan: { select: { key: true, name: true, track: true, level: true } } } as const;
    const sub = (await this.prisma.v3PlanSubscription.findUnique({ where: { currentVendorId: vendorId }, include }))
      ?? (await this.prisma.v3PlanSubscription.findFirst({ where: { vendorId }, orderBy: { createdAt: 'desc' }, include }));
    const resolved = await this.engine.resolve(vendorId);
    if (!sub) return { subscription: null, mode: resolved.mode };
    const snap = (sub.priceSnapshotJson ?? {}) as { amountPaise?: unknown; currency?: unknown; taxInclusive?: unknown };
    return {
      id: sub.id,
      plan: sub.plan,
      status: resolved.subscriptionStatus ?? sub.status,
      termMonths: sub.termMonths,
      startsAt: sub.startsAt,
      endsAt: sub.endsAt,
      graceEndsAt: sub.graceEndsAt,
      source: sub.source,
      price: typeof snap.amountPaise === 'number' ? { amountPaise: snap.amountPaise, currency: String(snap.currency ?? 'INR'), taxInclusive: snap.taxInclusive === true } : null,
    };
  }

  async events(vendorId: string, q: PageQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const where = { vendorId };
    const [rows, total] = await Promise.all([
      this.prisma.v3SubscriptionEvent.findMany({ where, orderBy: { at: 'desc' }, skip, take }),
      this.prisma.v3SubscriptionEvent.count({ where }),
    ]);
    const ids = [...new Set(rows.flatMap((e) => [e.fromPlanId, e.toPlanId]).filter((x): x is string => !!x))];
    const keys = new Map((ids.length ? await this.prisma.v3Plan.findMany({ where: { id: { in: ids } }, select: { id: true, key: true } }) : []).map((p) => [p.id, p.key]));
    const items = rows.map((e) => ({
      type: e.type, fromPlan: e.fromPlanId ? keys.get(e.fromPlanId) ?? null : null, toPlan: e.toPlanId ? keys.get(e.toPlanId) ?? null : null,
      reason: e.reason, actorType: e.actorType, at: e.at,
    }));
    return paged(items, total, page, pageSize);
  }
}
