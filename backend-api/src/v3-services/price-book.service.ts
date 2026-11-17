import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriceBook, PriceRowIn, shapePriceBook } from './core/price-book-core';

/** Reads the three price tables and hands them to the pure shaper. Read only; every change still goes through the existing plan, service and pack price routes (which audit it). */
@Injectable()
export class PriceBookService {
  clock: () => Date = () => new Date();
  constructor(private readonly prisma: PrismaService) {}

  async get(withMoney: boolean): Promise<PriceBook> {
    const [plans, planPrices, services, servicePrices, packs, packPrices] = await Promise.all([
      this.prisma.v3Plan.findMany({ select: { id: true, key: true, track: true, level: true, name: true, status: true } }),
      this.prisma.v3PlanPrice.findMany(),
      this.prisma.v3Service.findMany({ select: { id: true, key: true, name: true, status: true } }),
      this.prisma.v3ServicePrice.findMany(),
      this.prisma.v3AddonPack.findMany({ select: { id: true, key: true, name: true, status: true } }),
      this.prisma.v3AddonPackPrice.findMany(),
    ]);
    const rows = (list: Array<{ id: string; amountPaise: number; taxInclusive: boolean; status: string; effectiveFrom: Date | null; note?: string | null }>, owner: (r: never) => string, term?: (r: never) => number): PriceRowIn[] =>
      list.map((r) => ({ id: r.id, ownerId: owner(r as never), ...(term ? { termMonths: term(r as never) } : {}), amountPaise: r.amountPaise, taxInclusive: r.taxInclusive, status: r.status, effectiveFrom: r.effectiveFrom, note: r.note ?? null }));
    return shapePriceBook({
      now: this.clock(), withMoney,
      plans: plans.map((p) => ({ ...p, track: String(p.track), level: String(p.level), status: String(p.status) })),
      planPrices: rows(planPrices, (r: { planId: string }) => r.planId, (r: { termMonths: number }) => r.termMonths),
      services: services.map((s) => ({ ...s, status: String(s.status) })), servicePrices: rows(servicePrices, (r: { serviceId: string }) => r.serviceId),
      packs: packs.map((p) => ({ ...p, status: String(p.status) })), packPrices: rows(packPrices, (r: { packId: string }) => r.packId),
    });
  }
}
