import { BadRequestException, Injectable } from '@nestjs/common';
import { LeadPriceRule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EVENT_TYPES } from './leadspace.types';

export interface PriceQuery { eventType: string; category?: string | null; city?: string | null; at?: Date }

/** Pure: the price rule that applies. City and category first, then category, then the global rule. Rules are never edited, so history is exact. */
export function resolveRule(rules: LeadPriceRule[], q: PriceQuery): LeadPriceRule | null {
  const at = q.at ?? new Date();
  const live = rules.filter((r) => r.eventType === q.eventType && r.effectiveFrom <= at && (!r.effectiveTo || r.effectiveTo > at));
  const city = (q.city ?? '').trim().toLowerCase();
  const category = (q.category ?? '').trim().toLowerCase();
  const same = (a: string | null, b: string): boolean => (a ?? '').trim().toLowerCase() === b;
  const newest = (xs: LeadPriceRule[]): LeadPriceRule | null => xs.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ?? null;
  return (
    (city && category ? newest(live.filter((r) => r.city && r.category && same(r.city, city) && same(r.category, category))) : null) ??
    (category ? newest(live.filter((r) => !r.city && r.category && same(r.category, category))) : null) ??
    newest(live.filter((r) => !r.city && !r.category))
  );
}

@Injectable()
export class LeadPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(q: PriceQuery): Promise<{ pricePaise: number; ruleId: string } | null> {
    const rules = await this.prisma.leadPriceRule.findMany({ where: { eventType: q.eventType } });
    const r = resolveRule(rules, q);
    return r ? { pricePaise: r.pricePaise, ruleId: r.id } : null;
  }

  /** The vendor-facing price list for a category and city. */
  async priceList(category: string, city: string): Promise<Record<string, number | null>> {
    const out: Record<string, number | null> = {};
    for (const t of EVENT_TYPES) out[t] = (await this.resolve({ eventType: t, category, city }))?.pricePaise ?? null;
    return out;
  }

  /** Admin: set a price. The rule that applied before ends now and the new one starts now (versioned, never edited). */
  async setPrice(input: { eventType: string; category?: string | null; city?: string | null; pricePaise: number; note?: string }, by: string): Promise<LeadPriceRule> {
    if (!(EVENT_TYPES as readonly string[]).includes(input.eventType)) throw new BadRequestException('Choose one of the five event types.');
    if (!Number.isInteger(input.pricePaise) || input.pricePaise < 0 || input.pricePaise > 5_000_000) throw new BadRequestException('Enter a price between 0 and Rs 50,000, in whole paise.');
    const category = input.category?.trim() || null;
    const city = input.city?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.leadPriceRule.updateMany({ where: { eventType: input.eventType, category, city, effectiveTo: null }, data: { effectiveTo: now } });
      return tx.leadPriceRule.create({ data: { eventType: input.eventType, category, city, pricePaise: input.pricePaise, effectiveFrom: now, createdBy: by, note: input.note ?? null } });
    });
  }

  list(): Promise<LeadPriceRule[]> { return this.prisma.leadPriceRule.findMany({ orderBy: [{ eventType: 'asc' }, { effectiveFrom: 'desc' }], take: 500 }); }
}
