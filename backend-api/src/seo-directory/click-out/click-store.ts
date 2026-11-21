import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface ClickKey { day: string; pageType: string; categoryId: string | null; locationId: string | null; keywordTargetId: string | null }

/** The daily click-out aggregate port. Counts only: nothing here can hold a visitor. A Prisma implementation and an in-memory twin (tests) implement it. */
export abstract class SeoClickStore {
  /** atomic: one statement adds to the day's counter, creating the row on the first click */
  abstract increment(k: ClickKey): Promise<void>;
}

@Injectable()
export class PrismaSeoClickStore extends SeoClickStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async increment(k: ClickKey): Promise<void> {
    // One atomic statement with ONE arbiter (the unique key). The id is random for the same reason as the directory visit counter: a deterministic id would be a second unique index.
    // One retry covers a racing first insert of the day.
    for (let attempt = 0; ; attempt++) {
      try {
        await this.prisma.$executeRaw`INSERT INTO "g4d_seo_click_daily" ("id", "day", "pageType", "categoryKey", "locationKey", "keywordKey", "count", "createdAt", "updatedAt")
          VALUES (${`sc_${randomUUID()}`}, ${k.day}, ${k.pageType}, ${k.categoryId ?? ''}, ${k.locationId ?? ''}, ${k.keywordTargetId ?? ''}, 1, NOW(), NOW())
          ON CONFLICT ("day", "pageType", "categoryKey", "locationKey", "keywordKey") DO UPDATE SET "count" = "g4d_seo_click_daily"."count" + 1, "updatedAt" = NOW()`;
        return;
      } catch (e) { if (attempt >= 1) throw e; }
    }
  }
}
