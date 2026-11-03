import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { selectTaxRate } from '../pricing/price-quote';
import { PublicPlans, shapePublicPlans } from './public-plans.shape';

@Injectable()
export class PublicPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlans(now: Date = new Date()): Promise<PublicPlans> {
    const [plans, prices, cells, features, taxRows, allow] = await Promise.all([
      this.prisma.v3Plan.findMany({ where: { status: 'ACTIVE', isPublic: true } }),
      this.prisma.v3PlanPrice.findMany({ where: { status: 'APPROVED', effectiveFrom: { lte: now } } }),
      this.prisma.v3PlanFeature.findMany({ where: { state: { not: 'HIDDEN' } } }),
      this.prisma.v3Feature.findMany(),
      this.prisma.v3TaxRate.findMany({ where: { active: true } }),
      this.prisma.v3PlanSetting.findUnique({ where: { key: 'allowMonthly' } }),
    ]);
    const tax = selectTaxRate(taxRows.map((t) => ({ name: t.name, ratePercent: Number(t.ratePercent), appliesTo: t.appliesTo, active: t.active, validFrom: t.validFrom })), now);
    return shapePublicPlans({
      now, plans, prices, cells, features, tax: tax ? { name: tax.name, ratePercent: tax.ratePercent } : null, allowMonthly: allow?.valueJson === true,
    });
  }
}
