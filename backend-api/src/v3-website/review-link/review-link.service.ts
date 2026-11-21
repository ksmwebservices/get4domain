import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LiveProjector, ProjectionCtx } from '../projection/live-projector';
import { WebsiteService } from '../website.service';

export interface ReviewLinkRow { vendorId: string; url: string; host: string; version: number }

/** The staff projection of the live Google review link (slice B3). Prisma below; a memory twin lives in test/support. One row per vendor; a vendor with no link has no row. */
export abstract class ReviewLinkStore {
  /** Replaces the vendor's row, or removes it when `url` is null. */
  abstract replace(vendorId: string, version: number, url: string | null): Promise<void>;
  abstract get(vendorId: string): Promise<ReviewLinkRow | null>;
}

const hostOf = (url: string): string => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };

@Injectable()
export class PrismaReviewLinkStore extends ReviewLinkStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async replace(vendorId: string, version: number, url: string | null): Promise<void> {
    if (!url) { await this.prisma.v3ReviewLink.deleteMany({ where: { vendorId } }); return; }
    await this.prisma.v3ReviewLink.upsert({ where: { vendorId }, create: { vendorId, url, host: hostOf(url), version }, update: { url, host: hostOf(url), version } });
  }
  async get(vendorId: string) { return (await this.prisma.v3ReviewLink.findUnique({ where: { vendorId } })) as ReviewLinkRow | null; }
}

/** Writes the staff projection of the review link when a version goes live. */
@Injectable()
export class ReviewLinkProjector extends LiveProjector {
  constructor(private readonly store: ReviewLinkStore) { super(); }
  async project(c: ProjectionCtx): Promise<void> { await this.store.replace(c.vendorId, c.version, c.doc.reviewUrl ?? null); }
}

/** The vendor's review-link field (from the draft) and the staff read of what is live. Nothing here calls Google: the link is only stored and handed to the theme. */
@Injectable()
export class ReviewLinkService {
  constructor(private readonly web: WebsiteService, private readonly store: ReviewLinkStore) {}
  async view(vendorId: string): Promise<{ url: string; pro: boolean }> {
    const [c, pro] = await Promise.all([this.web.seoContext(vendorId), this.web.isProVendor(vendorId)]);
    return { url: c.doc.reviewUrl ?? '', pro };
  }
  staffGet(vendorId: string): Promise<ReviewLinkRow | null> { return this.store.get(vendorId); }
}
