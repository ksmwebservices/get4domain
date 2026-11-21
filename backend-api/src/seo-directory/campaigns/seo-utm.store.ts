import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UtmVisit } from '../core/utm-capture';

export interface UtmReportRow { day: string; pageType: string; source: string; medium: string; campaign: string; keywordKey: string; count: number }

/** The daily UTM aggregate port. Counts only: nothing here can hold a visitor. A Prisma implementation and an in-memory twin (tests) implement it. */
export abstract class SeoUtmStore {
  /** atomic: one statement adds to the day's counter, creating the row on the first visit */
  abstract increment(day: string, v: UtmVisit): Promise<void>;
  abstract report(q: { from: string; to: string; skip: number; take: number }): Promise<{ items: UtmReportRow[]; total: number }>;
}

@Injectable()
export class PrismaSeoUtmStore extends SeoUtmStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async increment(day: string, v: UtmVisit): Promise<void> {
    // One atomic statement with ONE arbiter (the unique key); a random id for the same reason as the click aggregate. One retry covers a racing first insert of the day.
    for (let attempt = 0; ; attempt++) {
      try {
        await this.prisma.$executeRaw`INSERT INTO "g4d_seo_utm_daily" ("id", "day", "pageType", "source", "medium", "campaign", "keywordKey", "count", "createdAt", "updatedAt")
          VALUES (${`su_${randomUUID()}`}, ${day}, ${v.pageType}, ${v.source}, ${v.medium}, ${v.campaign}, ${v.keywordKey}, 1, NOW(), NOW())
          ON CONFLICT ("day", "pageType", "source", "medium", "campaign", "keywordKey") DO UPDATE SET "count" = "g4d_seo_utm_daily"."count" + 1, "updatedAt" = NOW()`;
        return;
      } catch (e) { if (attempt >= 1) throw e; }
    }
  }

  async report(q: { from: string; to: string; skip: number; take: number }): Promise<{ items: UtmReportRow[]; total: number }> {
    const where = { day: { gte: q.from, lte: q.to } };
    const [rows, total] = await Promise.all([
      this.prisma.v3SeoUtmDaily.findMany({ where, orderBy: [{ day: 'desc' }, { count: 'desc' }, { id: 'asc' }], skip: q.skip, take: q.take }),
      this.prisma.v3SeoUtmDaily.count({ where }),
    ]);
    return { items: rows.map((r) => ({ day: r.day, pageType: r.pageType, source: r.source, medium: r.medium, campaign: r.campaign, keywordKey: r.keywordKey, count: r.count })), total };
  }
}
