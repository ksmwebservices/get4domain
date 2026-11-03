import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { planError } from '../plans.errors';
import { validateAmount, validateTerm } from './admin-validation';
import { Actor, AuditService } from './audit.service';
import { CreatePlanDto, CreatePriceDto, UpdatePlanDto, UpdatePriceDto } from './dto/plans-admin.dto';
import { expectedDate, PageQueryDto, pageArgs, paged, staleWrite, unknownPlan } from './plans-admin.common';

/** Plans and their price rows. Every write: one transaction = the change + its audit row; the entitlement cache is cleared afterwards. */
@Injectable()
export class PlansAdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly entitlements: EntitlementsService) {}

  async listPlans(q: PageQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const [items, total] = await Promise.all([
      this.prisma.v3Plan.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }], skip, take }),
      this.prisma.v3Plan.count(),
    ]);
    return paged(items, total, page, pageSize);
  }

  async getPlan(id: string) {
    const plan = await this.prisma.v3Plan.findUnique({ where: { id }, include: { prices: { orderBy: [{ termMonths: 'asc' }, { effectiveFrom: 'desc' }] }, features: { orderBy: { featureKey: 'asc' } } } });
    if (!plan) throw unknownPlan();
    return plan;
  }

  async createPlan(dto: CreatePlanDto, actor: Actor) {
    if (dto.key !== `${dto.track.toLowerCase()}_${dto.level.toLowerCase()}`) {
      throw new BadRequestException(`A plan key is the track and level in lower case, for example ${dto.track.toLowerCase()}_${dto.level.toLowerCase()}.`);
    }
    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.v3Plan.create({
        data: { key: dto.key, track: dto.track, level: dto.level, name: dto.name, description: dto.description ?? null, status: dto.status ?? 'DRAFT', isPublic: dto.isPublic ?? false, sortOrder: dto.sortOrder ?? 0 },
      });
      await this.audit.record(tx, actor, 'plan.create', 'plan', created.id, null, created);
      return created;
    });
    this.entitlements.invalidateAll();
    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto, actor: Actor) {
    const plan = await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3Plan.findUnique({ where: { id } });
      if (!before) throw unknownPlan();
      const data: Prisma.V3PlanUpdateManyMutationInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
      if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
      data.updatedAt = new Date();
      const res = await tx.v3Plan.updateMany({ where: { id, updatedAt: expectedDate(dto.expectedUpdatedAt) }, data });
      if (res.count === 0) throw staleWrite();
      const after = await tx.v3Plan.findUniqueOrThrow({ where: { id } });
      await this.audit.record(tx, actor, 'plan.update', 'plan', id, before, after);
      return after;
    });
    this.entitlements.invalidateAll();
    return plan;
  }

  /** A plan that has ever been given to a vendor can only be retired. An unused plan can be deleted (its price and matrix rows go with it). */
  async deletePlan(id: string, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3Plan.findUnique({ where: { id }, include: { prices: true, features: true } });
      if (!before) throw unknownPlan();
      if ((await tx.v3PlanSubscription.count({ where: { planId: id } })) > 0) {
        throw new ConflictException(planError('PLAN_IN_USE', 'This plan has been given to vendors, so it cannot be deleted. Retire it instead.'));
      }
      await tx.v3Plan.delete({ where: { id } });
      await this.audit.record(tx, actor, 'plan.delete', 'plan', id, before, null);
    });
    this.entitlements.invalidateAll();
    return { deleted: true };
  }

  // ------------------------------------------------------------------------------------------------------------------------------ prices
  private async allowMonthly(tx: Prisma.TransactionClient | PrismaService): Promise<boolean> {
    const s = await tx.v3PlanSetting.findUnique({ where: { key: 'allowMonthly' } });
    return s?.valueJson === true;
  }

  async listPrices(planId: string, q: PageQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    if (!(await this.prisma.v3Plan.findUnique({ where: { id: planId }, select: { id: true } }))) throw unknownPlan();
    const where = { planId };
    const [items, total] = await Promise.all([
      this.prisma.v3PlanPrice.findMany({ where, orderBy: [{ termMonths: 'asc' }, { effectiveFrom: 'desc' }], skip, take }),
      this.prisma.v3PlanPrice.count({ where }),
    ]);
    return paged(items, total, page, pageSize);
  }

  async createPrice(planId: string, dto: CreatePriceDto, actor: Actor) {
    const price = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.v3Plan.findUnique({ where: { id: planId } });
      if (!plan) throw unknownPlan();
      if (plan.level === 'FREE') throw new BadRequestException(planError('FREE_PLAN_HAS_NO_PRICE', 'A Free plan has no price.'));
      validateAmount(dto.amountPaise);
      validateTerm(dto.termMonths, await this.allowMonthly(tx));
      const created = await tx.v3PlanPrice.create({
        data: { planId, termMonths: dto.termMonths, amountPaise: dto.amountPaise, taxInclusive: dto.taxInclusive ?? false, status: dto.status ?? 'PROPOSED', ...(dto.effectiveFrom ? { effectiveFrom: new Date(dto.effectiveFrom) } : {}) },
      });
      await this.audit.record(tx, actor, 'price.create', 'price', created.id, null, created);
      return created;
    });
    this.entitlements.invalidateAll();
    return price;
  }

  /**
   * Editing a price never changes what a vendor already bought: a subscription keeps its own COPY of the price (priceSnapshotJson), so there is no
   * live link to orphan.
   */
  async updatePrice(priceId: string, dto: UpdatePriceDto, actor: Actor) {
    const price = await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3PlanPrice.findUnique({ where: { id: priceId } });
      if (!before) throw new NotFoundException('That price does not exist.');
      if (dto.amountPaise !== undefined) validateAmount(dto.amountPaise);
      const data: Prisma.V3PlanPriceUpdateManyMutationInput = { updatedAt: new Date() };
      if (dto.amountPaise !== undefined) data.amountPaise = dto.amountPaise;
      if (dto.taxInclusive !== undefined) data.taxInclusive = dto.taxInclusive;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.effectiveFrom !== undefined) data.effectiveFrom = new Date(dto.effectiveFrom);
      const res = await tx.v3PlanPrice.updateMany({ where: { id: priceId, updatedAt: expectedDate(dto.expectedUpdatedAt) }, data });
      if (res.count === 0) throw staleWrite();
      const after = await tx.v3PlanPrice.findUniqueOrThrow({ where: { id: priceId } });
      await this.audit.record(tx, actor, 'price.update', 'price', priceId, before, after);
      return after;
    });
    this.entitlements.invalidateAll();
    return price;
  }

  async deletePrice(priceId: string, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3PlanPrice.findUnique({ where: { id: priceId } });
      if (!before) throw new NotFoundException('That price does not exist.');
      await tx.v3PlanPrice.delete({ where: { id: priceId } });
      await this.audit.record(tx, actor, 'price.delete', 'price', priceId, before, null);
    });
    this.entitlements.invalidateAll();
    return { deleted: true };
  }
}
