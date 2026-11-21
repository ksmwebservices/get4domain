import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { selectTaxRate } from '../pricing/price-quote';
import { PublicPricing, shapePublicPricing } from './public-pricing.shape';

export const PRICING_CACHE_TTL_MS = 60_000;

/**
 * The public pricing answer (Wave 3 Part B). Read-only. Kept 60 seconds in process memory so a busy page costs one read of the price tables a minute; a price approved a moment ago shows within that minute.
 * The GST rate is the SAME tax-rate row the checkout reads (data the owner confirms), so the page and the checkout cannot disagree.
 */
@Injectable()
export class PublicPricingService {
  clock: () => Date = () => new Date();
  private cached: { at: number; v: PublicPricing } | null = null;
  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void { this.cached = null; }

  async get(): Promise<PublicPricing> {
    const now = this.clock();
    if (this.cached && now.getTime() - this.cached.at < PRICING_CACHE_TTL_MS) return this.cached.v;
    const [plans, prices, taxRows, capabilities, tierCells, addonPacks, addonPrices, themeSwitchPrices] = await Promise.all([
      this.prisma.v3Plan.findMany({ where: { status: 'ACTIVE', isPublic: true } }),
      this.prisma.v3PlanPrice.findMany({ where: { status: 'APPROVED', effectiveFrom: { lte: now } } }),
      this.prisma.v3TaxRate.findMany({ where: { active: true } }),
      this.prisma.v3Capability.findMany({ where: { active: true } }),
      this.prisma.v3TierCapability.findMany({ where: { allowed: true } }),
      this.prisma.v3AddonPack.findMany({ where: { status: 'ACTIVE' } }),
      this.prisma.v3AddonPackPrice.findMany({ where: { status: 'APPROVED' } }),
      this.prisma.v3ServicePrice.findMany({ where: { status: 'APPROVED', service: { key: 'THEME_SWITCH' } } }),
    ]);
    const tax = selectTaxRate(taxRows.map((t) => ({ name: t.name, ratePercent: Number(t.ratePercent), appliesTo: t.appliesTo, active: t.active, validFrom: t.validFrom })), now);
    const v = shapePublicPricing({
      now, plans, prices, tax: tax ? { name: tax.name, ratePercent: tax.ratePercent } : null,
      capabilities, tierCells, addonPacks, addonPrices, themeSwitchPrices,
    });
    this.cached = { at: now.getTime(), v };
    return v;
  }
}
