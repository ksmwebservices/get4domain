import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { overlayDraft } from '../site-doc/site-merge';
import { sampleMap } from '../site-doc/sample-markers';
import { buildFreeHomeContent, FreeHomeContent } from '../site-publish/content/free-home-content';

export interface HomeDetails { track?: string | null; city?: string | null; area?: string | null; pincode?: string | null }
export interface HomePlan {
  fill: Array<'tagline' | 'about' | 'services'>;
  /** text that already exists in the pending draft (a category pack's starter text) but not in the live column the legacy site route reads: copied there, not replaced */
  promote: Array<'tagline' | 'about'>;
  content: FreeHomeContent;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const empty = (v: unknown): boolean => String(v ?? '').trim() === '';

/**
 * S1.2: gives a Free site renderable home content from the registration details. It fills only EMPTY fields (a vendor's own words, and any starter text a category pack already put there, are never
 * replaced), marks what it wrote as sample text (the existing sample markers, so the vendor's edit replaces it and it is never counted as their own), and adds the generic services of the track as sample
 * catalogue rows only when the vendor has no catalogue at all. Running it again changes nothing. It writes the legacy VendorCMS and VendorProduct rows through the same columns the starter content uses;
 * the e-mail address is never read.
 */
@Injectable()
export class FreeHomeContentService {
  constructor(private readonly prisma: PrismaService) {}

  /** What a run would do, without doing it (the dry run of scripts/live/rebuild-site-content.js uses this). */
  async plan(vendorId: string, d: HomeDetails = {}): Promise<HomePlan | null> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { businessName: true, industry: true } });
    if (!vendor) return null;
    const row = await this.prisma.vendorCMS.findUnique({ where: { vendorId } });
    const cur = row ? obj(overlayDraft(row as unknown as { draft?: unknown })) : {};
    const content = buildFreeHomeContent({ businessName: String(cur.businessName ?? '').trim() || vendor.businessName, categoryText: vendor.industry, track: d.track ?? null, city: d.city, area: d.area, pincode: d.pincode });
    const fill: HomePlan['fill'] = []; const promote: HomePlan['promote'] = [];
    for (const k of ['tagline', 'about'] as const) {
      if (empty(cur[k])) fill.push(k);
      else if (row && empty((row as unknown as Record<string, unknown>)[k])) promote.push(k);
    }
    if ((await this.prisma.vendorProduct.count({ where: { vendorId } })) === 0) fill.push('services');
    return { fill, promote, content };
  }

  async ensure(vendorId: string, d: HomeDetails = {}): Promise<HomePlan | null> {
    const plan = await this.plan(vendorId, d);
    if (!plan || (plan.fill.length === 0 && plan.promote.length === 0)) return plan;
    const row = await this.prisma.vendorCMS.findUnique({ where: { vendorId } });
    const text = plan.fill.filter((f): f is 'tagline' | 'about' => f !== 'services');
    if (row && plan.promote.length) {
      const eff = obj(overlayDraft(row as unknown as { draft?: unknown }));
      await this.prisma.vendorCMS.update({ where: { vendorId }, data: Object.fromEntries(plan.promote.map((k) => [k, eff[k]])) as never });
    }
    if (row && text.length) {
      const extras = obj(row.extras);
      const sample = { ...sampleMap(extras), ...Object.fromEntries(text.map((k) => [k, true])) };
      const live: Record<string, unknown> = { extras: { ...extras, sample } };
      for (const k of text) live[k] = plan.content[k];
      const draft = row.draft && typeof row.draft === 'object' && !Array.isArray(row.draft) ? { ...(row.draft as Record<string, unknown>) } : null;
      if (draft) for (const k of text) if (k in draft) draft[k] = plan.content[k];   // a draft key that is present but empty would hide the text laid on the live column
      await this.prisma.vendorCMS.update({ where: { vendorId }, data: { ...live, ...(draft ? { draft: draft as never } : {}) } as never });
    }
    if (plan.fill.includes('services')) {
      await this.prisma.vendorProduct.createMany({
        data: plan.content.services.map((s) => ({ vendorId, name: s.name, description: s.description, price: null, active: true, customFields: { sample: 'true', samplePrice: 'true' } })),
      });
    }
    return plan;
  }
}
