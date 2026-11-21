import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** The tax rates that staff have set and that are in force, read from the rate table. Never a number in code: empty until staff set some. Shared by jobs, appointments and the store. */
export abstract class TaxRateSource { abstract activeRates(at: Date): Promise<number[]> }

@Injectable()
export class PrismaTaxRateSource extends TaxRateSource {
  constructor(private readonly prisma: PrismaService) { super(); }
  async activeRates(at: Date): Promise<number[]> {
    const rows = await this.prisma.v3TaxRate.findMany({ where: { active: true, validFrom: { lte: at } } });
    return [...new Set(rows.map((r) => Number(r.ratePercent)))].sort((a, b) => a - b);
  }
}
