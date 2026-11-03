import { Prisma, PrismaClient } from '@prisma/client';
import { SeedEntity, SeedStore, UpsertResult } from './seed-applier';

type Row = Record<string, unknown>;
const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/** SeedStore over Prisma. Used by scripts/seed-v3-plans.js against STAGING only (the script goes through the staging guard). */
export class PrismaSeedStore implements SeedStore {
  constructor(private readonly prisma: PrismaClient) {}

  private async planId(key: string): Promise<string> {
    const p = await this.prisma.v3Plan.findUnique({ where: { key }, select: { id: true } });
    if (!p) throw new Error(`plan ${key} is not loaded yet`);
    return p.id;
  }

  async find(entity: SeedEntity, key: string): Promise<Row | null> {
    switch (entity) {
      case 'plans': {
        const r = await this.prisma.v3Plan.findUnique({ where: { key } });
        return r && { key: r.key, track: r.track, level: r.level, name: r.name, description: r.description, status: r.status, isPublic: r.isPublic, sortOrder: r.sortOrder };
      }
      case 'features': {
        const r = await this.prisma.v3Feature.findUnique({ where: { key } });
        return r && { key: r.key, name: r.name, group: r.group, kind: r.kind, unit: r.unit, description: r.description, sortOrder: r.sortOrder };
      }
      case 'planFeatures': {
        const [planKey, featureKey] = key.split('|');
        const plan = await this.prisma.v3Plan.findUnique({ where: { key: planKey }, select: { id: true } });
        if (!plan) return null;
        const r = await this.prisma.v3PlanFeature.findUnique({ where: { planId_featureKey: { planId: plan.id, featureKey } } });
        return r && { planKey, featureKey, state: r.state, limitValue: r.limitValue, enumValue: r.enumValue, upsellText: r.upsellText };
      }
      case 'settings': {
        const r = await this.prisma.v3PlanSetting.findUnique({ where: { key } });
        return r && { key: r.key, valueJson: r.valueJson, description: r.description };
      }
      case 'taxRates': {
        const r = await this.prisma.v3TaxRate.findFirst({ where: { name: key } });
        return r && { name: r.name, ratePercent: Number(r.ratePercent), appliesTo: r.appliesTo, active: r.active, validFrom: iso(r.validFrom) };
      }
      case 'discountRules': {
        const [type, name] = key.split('|');
        const r = await this.prisma.v3DiscountRule.findFirst({ where: { type: type as never, name } });
        return r && { type: r.type, name: r.name, percentOff: r.percentOff === null ? null : Number(r.percentOff), amountOffPaise: r.amountOffPaise, conditions: r.conditions, stackable: r.stackable, status: r.status, active: r.active, validFrom: iso(r.validFrom) };
      }
      case 'prices': {
        const [planKey, term, from] = key.split('|');
        const plan = await this.prisma.v3Plan.findUnique({ where: { key: planKey }, select: { id: true } });
        if (!plan) return null;
        const r = await this.prisma.v3PlanPrice.findUnique({ where: { planId_termMonths_effectiveFrom: { planId: plan.id, termMonths: Number(term), effectiveFrom: new Date(from) } } });
        return r && { planKey, termMonths: r.termMonths, amountPaise: r.amountPaise, taxInclusive: r.taxInclusive, status: r.status, effectiveFrom: iso(r.effectiveFrom) };
      }
    }
  }

  async write(entity: SeedEntity, key: string, row: Row): Promise<UpsertResult> {
    const existed = (await this.find(entity, key)) !== null;
    const r = row as Record<string, never>;
    switch (entity) {
      case 'plans': {
        const data = { track: r.track, level: r.level, name: r.name, description: r.description, status: r.status, isPublic: r.isPublic, sortOrder: r.sortOrder };
        await this.prisma.v3Plan.upsert({ where: { key }, create: { key, ...data }, update: data });
        break;
      }
      case 'features': {
        const data = { name: r.name, group: r.group, kind: r.kind, unit: r.unit, description: r.description, sortOrder: r.sortOrder };
        await this.prisma.v3Feature.upsert({ where: { key }, create: { key, ...data }, update: data });
        break;
      }
      case 'planFeatures': {
        const planId = await this.planId(String(r.planKey));
        const data = { state: r.state, limitValue: r.limitValue, enumValue: r.enumValue, upsellText: r.upsellText };
        await this.prisma.v3PlanFeature.upsert({ where: { planId_featureKey: { planId, featureKey: String(r.featureKey) } }, create: { planId, featureKey: String(r.featureKey), ...data }, update: data });
        break;
      }
      case 'settings': {
        const data = { valueJson: r.valueJson as Prisma.InputJsonValue, description: r.description as unknown as string | null };
        await this.prisma.v3PlanSetting.upsert({ where: { key }, create: { key, ...data }, update: data });
        break;
      }
      case 'taxRates': {
        const data = { ratePercent: r.ratePercent as unknown as number, appliesTo: r.appliesTo, active: r.active, validFrom: new Date(String(r.validFrom)) };
        const found = await this.prisma.v3TaxRate.findFirst({ where: { name: key }, select: { id: true } });
        if (found) await this.prisma.v3TaxRate.update({ where: { id: found.id }, data });
        else await this.prisma.v3TaxRate.create({ data: { name: key, ...data } });
        break;
      }
      case 'discountRules': {
        const [type, name] = key.split('|');
        const data = {
          percentOff: r.percentOff as unknown as number | null, amountOffPaise: r.amountOffPaise as unknown as number | null, conditions: r.conditions as Prisma.InputJsonValue,
          stackable: r.stackable, status: r.status, active: r.active, validFrom: new Date(String(r.validFrom)),
        };
        const found = await this.prisma.v3DiscountRule.findFirst({ where: { type: type as never, name }, select: { id: true } });
        if (found) await this.prisma.v3DiscountRule.update({ where: { id: found.id }, data });
        else await this.prisma.v3DiscountRule.create({ data: { type: type as never, name, ...data } });
        break;
      }
      case 'prices': {
        const planId = await this.planId(String(r.planKey));
        const effectiveFrom = new Date(String(r.effectiveFrom));
        const data = { amountPaise: r.amountPaise, taxInclusive: r.taxInclusive, status: r.status };
        await this.prisma.v3PlanPrice.upsert({
          where: { planId_termMonths_effectiveFrom: { planId, termMonths: Number(r.termMonths), effectiveFrom } },
          create: { planId, termMonths: Number(r.termMonths), effectiveFrom, ...data }, update: data,
        });
        break;
      }
    }
    return existed ? 'updated' : 'created';
  }
}
