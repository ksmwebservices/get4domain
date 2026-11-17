import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { validateSettingValue, validateTaxRate } from './admin-validation';
import { Actor, AuditService } from './audit.service';
import { CreateTaxRateDto, PutPlanSettingDto, UpdateTaxRateDto } from './dto/plans-admin.dto';
import { expectedDate, PageQueryDto, pageArgs, paged, staleWrite } from './plans-admin.common';

/** Tax rates and plan settings: the money rules. (No discount rules in version 3: the four discount-rule routes were retired in Wave 4; the tables stay.) */
@Injectable()
export class RulesAdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly entitlements: EntitlementsService) {}

  // ------------------------------------------------------------------------------------------------------------------------------ tax rates
  async listTaxRates(q: PageQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const [items, total] = await Promise.all([this.prisma.v3TaxRate.findMany({ orderBy: { validFrom: 'desc' }, skip, take }), this.prisma.v3TaxRate.count()]);
    return paged(items.map((t) => ({ ...t, ratePercent: Number(t.ratePercent) })), total, page, pageSize);
  }

  async createTaxRate(dto: CreateTaxRateDto, actor: Actor) {
    validateTaxRate(dto.ratePercent);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.v3TaxRate.create({ data: { name: dto.name, ratePercent: dto.ratePercent, appliesTo: dto.appliesTo ?? 'ALL', active: dto.active ?? true, ...(dto.validFrom ? { validFrom: new Date(dto.validFrom) } : {}) } });
      await this.audit.record(tx, actor, 'tax.create', 'tax_rate', created.id, null, created);
      return created;
    });
    this.entitlements.invalidateAll();
    return { ...row, ratePercent: Number(row.ratePercent) };
  }

  async updateTaxRate(id: string, dto: UpdateTaxRateDto, actor: Actor) {
    if (dto.ratePercent !== undefined) validateTaxRate(dto.ratePercent);
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3TaxRate.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('That tax rate does not exist.');
      const data: Prisma.V3TaxRateUpdateManyMutationInput = { updatedAt: new Date() };
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.ratePercent !== undefined) data.ratePercent = dto.ratePercent;
      if (dto.appliesTo !== undefined) data.appliesTo = dto.appliesTo;
      if (dto.active !== undefined) data.active = dto.active;
      if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
      const res = await tx.v3TaxRate.updateMany({ where: { id, updatedAt: expectedDate(dto.expectedUpdatedAt) }, data });
      if (res.count === 0) throw staleWrite();
      const after = await tx.v3TaxRate.findUniqueOrThrow({ where: { id } });
      await this.audit.record(tx, actor, 'tax.update', 'tax_rate', id, before, after);
      return after;
    });
    this.entitlements.invalidateAll();
    return { ...row, ratePercent: Number(row.ratePercent) };
  }

  async deleteTaxRate(id: string, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3TaxRate.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('That tax rate does not exist.');
      await tx.v3TaxRate.delete({ where: { id } });
      await this.audit.record(tx, actor, 'tax.delete', 'tax_rate', id, before, null);
    });
    return { deleted: true };
  }

  // ------------------------------------------------------------------------------------------------------------------------------ settings
  async listSettings(q: PageQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const [items, total] = await Promise.all([this.prisma.v3PlanSetting.findMany({ orderBy: { key: 'asc' }, skip, take }), this.prisma.v3PlanSetting.count()]);
    return paged(items, total, page, pageSize);
  }

  async putSetting(key: string, dto: PutPlanSettingDto, actor: Actor) {
    validateSettingValue(key, dto.valueJson);
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3PlanSetting.findUnique({ where: { key } });
      const value = dto.valueJson as Prisma.InputJsonValue;
      if (!before) {
        const created = await tx.v3PlanSetting.create({ data: { key, valueJson: value, description: dto.description ?? null } });
        await this.audit.record(tx, actor, 'setting.create', 'plan_setting', key, null, created);
        return created;
      }
      if (!dto.expectedUpdatedAt) throw new BadRequestException('expectedUpdatedAt is required to change an existing setting.');
      const res = await tx.v3PlanSetting.updateMany({
        where: { key, updatedAt: expectedDate(dto.expectedUpdatedAt) },
        data: { valueJson: value, updatedAt: new Date(), ...(dto.description !== undefined ? { description: dto.description } : {}) },
      });
      if (res.count === 0) throw staleWrite();
      const after = await tx.v3PlanSetting.findUniqueOrThrow({ where: { key } });
      await this.audit.record(tx, actor, 'setting.update', 'plan_setting', key, before, after);
      return after;
    });
    this.entitlements.invalidateAll();
    return row;
  }
}
