import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { overlayDraft } from '../../site-doc/site-merge';
import { SourceCms, SourceDocument, SourceExtras, SourceItem } from './content-types';

/**
 * The port between the site slice and wherever a vendor's site content lives today. Slice 5.5 replaces the implementation; the mapping to the renderer
 * (content-adapter.ts) and everything after it stay as they are.
 */
export abstract class ContentSource {
  /** The vendor's content as plain data, or null when the vendor does not exist. */
  abstract load(vendorId: string): Promise<SourceDocument | null>;
}

const arr = <T>(v: unknown): T[] | null => (Array.isArray(v) ? (v as T[]) : null);
const obj = <T>(v: unknown): T | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : null);
const MAX_ITEMS = 200;

/**
 * Reads the existing VendorCMS document (the published columns with the pending draft laid over them, through the existing overlayDraft), the vendor's active
 * items and whether a claim link was used. READ ONLY: it never writes the legacy tables and does not touch legacy billing, BOS or commercial tables.
 */
@Injectable()
export class CmsContentSource extends ContentSource {
  constructor(private readonly prisma: PrismaService) { super(); }

  async load(vendorId: string): Promise<SourceDocument | null> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, subdomain: true, businessName: true, name: true, phone: true, email: true, status: true, industry: true },
    });
    if (!vendor) return null;
    const row = await this.prisma.vendorCMS.findUnique({ where: { vendorId } });
    const live = row ? (overlayDraft(row as unknown as { draft?: unknown }) as unknown as Record<string, unknown>) : null;
    const cms: SourceCms | null = live && row
      ? {
          businessName: (live.businessName as string | null) ?? null, tagline: (live.tagline as string | null) ?? null, about: (live.about as string | null) ?? null,
          logo: (live.logo as string | null) ?? null, banner: (live.banner as string | null) ?? null, favicon: (live.favicon as string | null) ?? null,
          phone: (live.phone as string | null) ?? null, email: (live.email as string | null) ?? null, address: (live.address as string | null) ?? null,
          businessHours: (live.businessHours as string | null) ?? null, whatsapp: (live.whatsapp as string | null) ?? null,
          facebook: (live.facebook as string | null) ?? null, instagram: (live.instagram as string | null) ?? null, linkedin: (live.linkedin as string | null) ?? null,
          youtube: (live.youtube as string | null) ?? null, googleMaps: (live.googleMaps as string | null) ?? null,
          portfolio: arr(live.portfolio), testimonials: arr(live.testimonials), pages: arr(live.pages), extras: obj<SourceExtras>(live.extras),
          packKey: row.packKey ?? null, siteStatus: row.siteStatus, ogImage: (live.ogImage as string | null) ?? null, seoTitle: (live.seoTitle as string | null) ?? null, seoDesc: (live.seoDesc as string | null) ?? null,
        }
      : null;
    const products = await this.prisma.vendorProduct.findMany({ where: { vendorId, active: true }, orderBy: { createdAt: 'asc' }, take: MAX_ITEMS });
    const items: SourceItem[] = products.map((p) => {
      const cf = (p.customFields && typeof p.customFields === 'object' && !Array.isArray(p.customFields) ? p.customFields : {}) as Record<string, unknown>;
      return { id: p.id, name: p.name, description: p.description, price: p.price, image: p.image, category: p.category, active: p.active, sample: cf.sample === 'true', samplePrice: cf.samplePrice === 'true' };
    });
    const claimed = (await this.prisma.v3ClaimToken.count({ where: { vendorId, status: 'USED' } })) > 0;
    return { vendor, cms, items, claimed };
  }
}
