import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { planError } from '../plans.errors';
import { FEATURE_KEY, validateMatrixRow } from './admin-validation';
import { Actor, AuditService } from './audit.service';
import { CreateFeatureDto, SaveMatrixDto, UpdateFeatureDto } from './dto/plans-admin.dto';
import { expectedDate, PageQueryDto, pageArgs, paged, staleWrite, unknownPlan } from './plans-admin.common';

/** The feature catalogue and the plan-feature matrix (what each plan gives). */
@Injectable()
export class FeaturesAdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly entitlements: EntitlementsService) {}

  async listFeatures(q: PageQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const [items, total] = await Promise.all([
      this.prisma.v3Feature.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }], skip, take }),
      this.prisma.v3Feature.count(),
    ]);
    return paged(items, total, page, pageSize);
  }

  async createFeature(dto: CreateFeatureDto, actor: Actor) {
    if (!FEATURE_KEY.test(dto.key)) throw new BadRequestException('A feature key is dotted lower case, for example site.video.');
    const feature = await this.prisma.$transaction(async (tx) => {
      const created = await tx.v3Feature.create({ data: { key: dto.key, name: dto.name, group: dto.group, kind: dto.kind, unit: dto.unit ?? null, description: dto.description ?? null, sortOrder: dto.sortOrder ?? 0 } });
      await this.audit.record(tx, actor, 'feature.create', 'feature', created.id, null, created);
      return created;
    });
    this.entitlements.invalidateAll();
    return feature;
  }

  async updateFeature(key: string, dto: UpdateFeatureDto, actor: Actor) {
    const feature = await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3Feature.findUnique({ where: { key } });
      if (!before) throw new NotFoundException('That feature does not exist.');
      const data: Prisma.V3FeatureUpdateManyMutationInput = { updatedAt: new Date() };
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.group !== undefined) data.group = dto.group;
      if (dto.unit !== undefined) data.unit = dto.unit;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
      const res = await tx.v3Feature.updateMany({ where: { key, updatedAt: expectedDate(dto.expectedUpdatedAt) }, data });
      if (res.count === 0) throw staleWrite();
      const after = await tx.v3Feature.findUniqueOrThrow({ where: { key } });
      await this.audit.record(tx, actor, 'feature.update', 'feature', before.id, before, after);
      return after;
    });
    this.entitlements.invalidateAll();
    return feature;
  }

  async deleteFeature(key: string, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3Feature.findUnique({ where: { key } });
      if (!before) throw new NotFoundException('That feature does not exist.');
      const used = (await tx.v3PlanFeature.count({ where: { featureKey: key } })) + (await tx.v3EntitlementOverride.count({ where: { featureKey: key } }));
      if (used > 0) throw new ConflictException(planError('FEATURE_IN_USE', 'This feature is used by a plan or an override, so it cannot be deleted.'));
      await tx.v3Feature.delete({ where: { key } });
      await this.audit.record(tx, actor, 'feature.delete', 'feature', before.id, before, null);
    });
    this.entitlements.invalidateAll();
    return { deleted: true };
  }

  // ------------------------------------------------------------------------------------------------------------------------------ matrix
  async getPlanFeatures(planId: string) {
    const plan = await this.prisma.v3Plan.findUnique({ where: { id: planId }, select: { id: true, key: true, updatedAt: true } });
    if (!plan) throw unknownPlan();
    const rows = await this.prisma.v3PlanFeature.findMany({ where: { planId }, orderBy: { featureKey: 'asc' } });
    return { plan, items: rows };
  }

  /** Bulk save of matrix rows in ONE transaction. The plan's updatedAt is the version: two staff saving the same plan cannot both win. */
  async savePlanFeatures(planId: string, dto: SaveMatrixDto, actor: Actor) {
    const keys = dto.rows.map((r) => r.featureKey);
    if (new Set(keys).size !== keys.length) throw new BadRequestException('A feature appears twice in the list.');
    for (const r of dto.rows) validateMatrixRow(r);
    const saved = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.v3Plan.findUnique({ where: { id: planId } });
      if (!plan) throw unknownPlan();
      const known = new Set((await tx.v3Feature.findMany({ where: { key: { in: keys } }, select: { key: true } })).map((f) => f.key));
      const missing = keys.filter((k) => !known.has(k));
      if (missing.length) throw new BadRequestException(`Unknown feature(s): ${missing.join(', ')}.`);
      const bump = await tx.v3Plan.updateMany({ where: { id: planId, updatedAt: expectedDate(dto.expectedUpdatedAt) }, data: { updatedAt: new Date() } });
      if (bump.count === 0) throw staleWrite();
      const before = await tx.v3PlanFeature.findMany({ where: { planId, featureKey: { in: keys } }, orderBy: { featureKey: 'asc' } });
      for (const r of dto.rows) {
        const data = { state: r.state, limitValue: r.limitValue ?? null, enumValue: r.enumValue ?? null, upsellText: r.upsellText ?? null };
        await tx.v3PlanFeature.upsert({ where: { planId_featureKey: { planId, featureKey: r.featureKey } }, create: { planId, featureKey: r.featureKey, ...data }, update: data });
      }
      const after = await tx.v3PlanFeature.findMany({ where: { planId, featureKey: { in: keys } }, orderBy: { featureKey: 'asc' } });
      await this.audit.record(tx, actor, 'plan.features.save', 'plan', planId, before, after);
      const planAfter = await tx.v3Plan.findUniqueOrThrow({ where: { id: planId }, select: { id: true, key: true, updatedAt: true } });
      return { plan: planAfter, items: after };
    });
    this.entitlements.invalidateAll();
    return saved;
  }
}
