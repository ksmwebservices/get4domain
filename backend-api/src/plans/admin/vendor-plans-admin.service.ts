import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { requireReason, validateMatrixRow } from './admin-validation';
import { Actor, AuditService } from './audit.service';
import { AssignSubscriptionDto, CreateOverrideDto, UpdateOverrideDto } from './dto/plans-admin.dto';
import { expectedDate, PageQueryDto, pageArgs, paged, staleWrite, unknownVendor } from './plans-admin.common';

/** One vendor's plan: assign a plan, see what they resolve to and why, give or remove an override, switch the v3_plans flag. */
@Injectable()
export class VendorPlansAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  private async assertVendor(vendorId: string): Promise<void> {
    if (!(await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } }))) throw unknownVendor();
  }

  async assign(vendorId: string, dto: AssignSubscriptionDto, actor: Actor) {
    const reason = requireReason(dto.reason);
    return this.subscriptions.assignPlan({
      vendorId, planKey: dto.planKey, termMonths: dto.termMonths ?? null, endsAt: dto.endsAt ? new Date(dto.endsAt) : null, source: 'STAFF', actor, reason,
    });
  }

  async getSubscription(vendorId: string) {
    await this.assertVendor(vendorId);
    const [current, history, events] = await Promise.all([
      this.prisma.v3PlanSubscription.findUnique({ where: { currentVendorId: vendorId }, include: { plan: { select: { key: true, name: true, track: true, level: true } } } }),
      this.prisma.v3PlanSubscription.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, take: 50, include: { plan: { select: { key: true } } } }),
      this.prisma.v3SubscriptionEvent.findMany({ where: { vendorId }, orderBy: { at: 'desc' }, take: 100 }),
    ]);
    return { current, history, events };
  }

  /** What this vendor resolves to right now, and for every feature WHY (the source and, for an override, who and until when). */
  async getEntitlements(vendorId: string) {
    await this.assertVendor(vendorId);
    const resolved = await this.entitlements.resolve(vendorId);
    const overrides = await this.prisma.v3EntitlementOverride.findMany({ where: { vendorId } });
    const now = Date.now();
    const features = Object.fromEntries(Object.entries(resolved.features).map(([key, f]) => {
      const o = f.source === 'OVERRIDE' ? overrides.filter((x) => x.featureKey === key && (!x.expiresAt || x.expiresAt.getTime() > now)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] : undefined;
      return [key, { ...f, why: { source: f.source, planKey: resolved.plan, overrideId: o?.id ?? null, overrideReason: o?.reason ?? null, overrideExpiresAt: o?.expiresAt ?? null } }];
    }));
    return { ...resolved, features };
  }

  // ------------------------------------------------------------------------------------------------------------------------------ overrides
  async listOverrides(vendorId: string, q: PageQueryDto) {
    await this.assertVendor(vendorId);
    const { skip, take, page, pageSize } = pageArgs(q);
    const [items, total] = await Promise.all([
      this.prisma.v3EntitlementOverride.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.v3EntitlementOverride.count({ where: { vendorId } }),
    ]);
    return paged(items, total, page, pageSize);
  }

  async createOverride(vendorId: string, dto: CreateOverrideDto, actor: Actor) {
    const reason = requireReason(dto.reason);
    validateMatrixRow({ featureKey: dto.featureKey, state: dto.state, limitValue: dto.limitValue, enumValue: dto.enumValue, upsellText: 'n/a' });
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) throw new BadRequestException('The expiry date must be in the future.');
    const row = await this.prisma.$transaction(async (tx) => {
      if (!(await tx.vendor.findUnique({ where: { id: vendorId }, select: { id: true } }))) throw unknownVendor();
      if (!(await tx.v3Feature.findUnique({ where: { key: dto.featureKey }, select: { id: true } }))) throw new NotFoundException('That feature does not exist.');
      const created = await tx.v3EntitlementOverride.create({
        data: { vendorId, featureKey: dto.featureKey, state: dto.state, limitValue: dto.limitValue ?? null, enumValue: dto.enumValue ?? null, reason, expiresAt, createdByStaffId: actor.id ?? 'unknown' },
      });
      await this.audit.record(tx, actor, 'override.create', 'override', created.id, null, created);
      return created;
    });
    this.entitlements.invalidate(vendorId);
    return row;
  }

  async updateOverride(overrideId: string, dto: UpdateOverrideDto, actor: Actor) {
    const reason = dto.reason !== undefined ? requireReason(dto.reason) : undefined;
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3EntitlementOverride.findUnique({ where: { id: overrideId } });
      if (!before) throw new NotFoundException('That override does not exist.');
      const next = { state: dto.state ?? before.state, limitValue: dto.limitValue !== undefined ? dto.limitValue : before.limitValue };
      validateMatrixRow({ featureKey: before.featureKey, state: next.state, limitValue: next.limitValue, upsellText: 'n/a' });
      const data: Prisma.V3EntitlementOverrideUpdateManyMutationInput = { updatedAt: new Date(), state: next.state, limitValue: next.limitValue };
      if (dto.enumValue !== undefined) data.enumValue = dto.enumValue;
      if (reason !== undefined) data.reason = reason;
      if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
      const res = await tx.v3EntitlementOverride.updateMany({ where: { id: overrideId, updatedAt: expectedDate(dto.expectedUpdatedAt) }, data });
      if (res.count === 0) throw staleWrite();
      const after = await tx.v3EntitlementOverride.findUniqueOrThrow({ where: { id: overrideId } });
      await this.audit.record(tx, actor, 'override.update', 'override', overrideId, before, after);
      return after;
    });
    this.entitlements.invalidate(row.vendorId);
    return row;
  }

  /** Overrides are expired, never erased, so the trail stays complete. */
  async expireOverride(overrideId: string, actor: Actor) {
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3EntitlementOverride.findUnique({ where: { id: overrideId } });
      if (!before) throw new NotFoundException('That override does not exist.');
      await tx.v3EntitlementOverride.update({ where: { id: overrideId }, data: { expiresAt: new Date() } });
      const after = await tx.v3EntitlementOverride.findUniqueOrThrow({ where: { id: overrideId } });
      await this.audit.record(tx, actor, 'override.expire', 'override', overrideId, before, after);
      return after;
    });
    this.entitlements.invalidate(row.vendorId);
    return row;
  }

  // ------------------------------------------------------------------------------------------------------------------------------ flag
  async setFlag(vendorId: string, enabled: boolean, actor: Actor) {
    const flag = await this.prisma.$transaction(async (tx) => {
      if (!(await tx.vendor.findUnique({ where: { id: vendorId }, select: { id: true } }))) throw unknownVendor();
      const before = await tx.v3VendorFlag.findUnique({ where: { vendorId_key: { vendorId, key: 'v3_plans' } } });
      const after = await tx.v3VendorFlag.upsert({
        where: { vendorId_key: { vendorId, key: 'v3_plans' } },
        create: { vendorId, key: 'v3_plans', enabled, updatedByStaffId: actor.id },
        update: { enabled, updatedByStaffId: actor.id },
      });
      await this.audit.record(tx, actor, 'flag.set', 'vendor_flag', after.id, before, after);
      return after;
    });
    this.entitlements.invalidate(vendorId);
    return flag;
  }
}
