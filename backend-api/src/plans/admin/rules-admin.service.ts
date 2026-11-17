import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { planError } from '../plans.errors';
import { checkGstChange, GstChangeInput } from '../pricing/gst-rate-core';
import { selectTaxRate, TaxRateRow } from '../pricing/price-quote';
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

  /** A rate whose start has passed was (or could have been) used to price an order: it is history. The generic PUT and DELETE must not rewrite or remove it; a change is a NEW rate that starts later (PUT /v3/admin/gst-rate). */
  private assertNotStarted(before: { validFrom: Date }): void {
    if (before.validFrom.getTime() <= this.clock().getTime()) throw new ConflictException(planError('TAX_RATE_IN_FORCE', 'This rate has already started, so it cannot be changed or removed. Add a new rate that starts later instead.'));
  }

  async updateTaxRate(id: string, dto: UpdateTaxRateDto, actor: Actor) {
    if (dto.ratePercent !== undefined) validateTaxRate(dto.ratePercent);
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.v3TaxRate.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('That tax rate does not exist.');
      this.assertNotStarted(before);
      // a rate still waiting to start must not be moved into the past either: that would rewrite what orders were priced with
      if (dto.validFrom !== undefined && new Date(dto.validFrom).getTime() <= this.clock().getTime()) throw new ConflictException(planError('TAX_RATE_IN_FORCE', 'A rate cannot be made to start in the past. Choose a later day.'));
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
      this.assertNotStarted(before);
      await tx.v3TaxRate.delete({ where: { id } });
      await this.audit.record(tx, actor, 'tax.delete', 'tax_rate', id, before, null);
    });
    return { deleted: true };
  }

  // ------------------------------------------------------------------------------------------------------------------------------ the GST rate (Wave 4 W7)
  clock: () => Date = () => new Date();

  private toRow = (t: { name: string; ratePercent: unknown; appliesTo: string; active: boolean; validFrom: Date }): TaxRateRow => ({ name: t.name, ratePercent: Number(t.ratePercent), appliesTo: t.appliesTo, active: t.active, validFrom: t.validFrom });

  /** The rate in force right now (the SAME selection checkout uses), what is scheduled, and the whole history, newest first. No rate set: inForce is null and the platform cannot price an order with GST. */
  async gstRate() {
    const all = (await this.prisma.v3TaxRate.findMany({ orderBy: { validFrom: 'desc' } })) as Array<{ id: string; name: string; ratePercent: unknown; appliesTo: string; active: boolean; validFrom: Date }>;
    const now = this.clock();
    const inForce = selectTaxRate(all.map(this.toRow), now);
    const view = (t: { id: string; name: string; ratePercent: unknown; active: boolean; validFrom: Date }) => ({ id: t.id, name: t.name, ratePercent: Number(t.ratePercent), active: t.active, effectiveFrom: t.validFrom });
    return {
      inForce: inForce ? { name: inForce.name, ratePercent: inForce.ratePercent, effectiveFrom: inForce.validFrom } : null,
      upcoming: all.filter((t) => t.active && t.validFrom.getTime() > now.getTime()).map(view).reverse(),
      history: all.map(view),
    };
  }

  /**
   * SUPER_ADMIN sets the GST rate from an effective day (today, or later; never the past). It adds a NEW row and edits or removes nothing, so the table is the history, and an order already made keeps the rate
   * it was quoted with (the rate is in the order's own quote). The same change twice, or a rate equal to the one already in force at that moment, changes nothing (idempotent). A different rate on a day that
   * already has a row is refused with GST_RATE_EXISTS. Audited with the reason.
   */
  async setGstRate(input: GstChangeInput, actor: Actor) {
    const c = checkGstChange(input, this.clock());
    if (!c.ok) throw new BadRequestException({ ...planError('GST_RATE_INVALID', 'Some details need fixing.'), details: { fields: c.fields } });
    const now = this.clock();
    const validFrom = c.value.validFrom ?? now;
    const changed = await this.prisma.$transaction(async (tx) => {
      const rows = ((await tx.v3TaxRate.findMany({})) as Array<{ name: string; ratePercent: unknown; appliesTo: string; active: boolean; validFrom: Date }>).map(this.toRow);
      const at = selectTaxRate(rows, validFrom);
      if (at && at.ratePercent === c.value.ratePercent) return false;   // already the rate from that moment: nothing to add
      if (rows.some((r) => r.validFrom.getTime() === validFrom.getTime())) throw new ConflictException(planError('GST_RATE_EXISTS', 'A rate already starts on that day. Choose another day.'));
      const now0 = selectTaxRate(rows, now);
      const created = await tx.v3TaxRate.create({ data: { name: now0?.name ?? at?.name ?? 'GST', ratePercent: c.value.ratePercent, appliesTo: 'ALL', active: true, validFrom } });
      await this.audit.record(tx, actor, 'gst.rate.set', 'tax_rate', (created as { id?: string }).id ?? null,
        now0 ? { ratePercent: now0.ratePercent, effectiveFrom: now0.validFrom } : null, { ratePercent: c.value.ratePercent, effectiveFrom: validFrom, reason: c.value.reason });
      return true;
    });
    if (changed) this.entitlements.invalidateAll();
    return { changed, ...(await this.gstRate()) };
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
