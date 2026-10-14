import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VendorCMS } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CmsService } from '../cms/cms.service';
import { UpdateVendorCmsDto } from '../cms/dto/update-vendor-cms.dto';
import { makePreviewToken } from './preview-token';
import { draftDiffers, overlayDraft } from './site-merge';
import { SiteRefreshService } from './site-refresh.service';
import {
  SITE_FIELDS, SITE_FLAG_ADDON, SITE_PLAN_LIMITS, SITE_TEXT_MAX, SITE_THEME_KEYS, SITE_VARIANTS, SITE_VERSIONS_KEPT,
  SitePlan, SiteVariantSlot,
} from './site-doc.constants';

export interface SiteView {
  enabled: boolean;
  /** the plan the limits come from (LEADSPACE is the free base tier) */
  plan: SitePlan;
  limits: { pages: number; mediaMb: number };
  usage: { pages: number; mediaBytes: number };
  subdomain: string | null;
  publicUrl: string | null;
  /** what is live right now */
  live: Record<string, unknown>;
  /** what the editor shows: live with the pending edits laid over it */
  doc: Record<string, unknown>;
  dirty: boolean;
  version: number;
  publishedAt: Date | null;
}

const PICK_SNAPSHOT = [...SITE_FIELDS, 'packKey'] as const;

@Injectable()
export class SiteDocService {
  constructor(private readonly prisma: PrismaService, private readonly cms: CmsService, private readonly refresh: SiteRefreshService) {}

  async enabled(vendorId: string): Promise<boolean> {
    const a = await this.prisma.vendorAddon.findUnique({ where: { vendorId_addonKey: { vendorId, addonKey: SITE_FLAG_ADDON } }, select: { enabled: true } });
    return a?.enabled === true;
  }

  private async requireEnabled(vendorId: string): Promise<void> {
    if (!(await this.enabled(vendorId))) throw new ForbiddenException('The new Website Manager is not switched on for your account yet. Please contact support.');
  }

  /** The plan the limits come from: the current paid term, else the free LeadSpace base tier. */
  async planOf(vendorId: string): Promise<SitePlan> {
    const term = await this.prisma.billingTerm.findFirst({ where: { vendorId, isCurrent: true, status: { in: ['ACTIVE', 'ACTIVE_PAYMENT_DUE', 'LAPSED'] } }, select: { planKey: true } });
    return term?.planKey === 'BOS' ? 'BOS' : term?.planKey === 'WORKSPACE' ? 'WORKSPACE' : 'LEADSPACE';
  }

  private pageLimitMessage(plan: SitePlan, limit: number): string {
    return `Your plan includes ${limit} page${limit === 1 ? '' : 's'} (the home page counts as one). Remove a page, or upgrade your plan to add more.${plan === 'BOS' ? '' : ''}`;
  }

  // — reading —

  async view(vendorId: string): Promise<SiteView> {
    const [vendor, row, plan, enabled, media] = await Promise.all([
      this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { subdomain: true } }),
      this.prisma.vendorCMS.findUnique({ where: { vendorId } }),
      this.planOf(vendorId),
      this.enabled(vendorId),
      this.prisma.mediaAsset.aggregate({ where: { vendorId }, _sum: { bytes: true } }),
    ]);
    const base = (row ?? { draft: null }) as Record<string, unknown> & { draft?: unknown; siteVersion?: number; publishedAt?: Date | null };
    const { draft: _d, ...live } = base;
    void _d;
    const doc = overlayDraft(base);
    const pages = Array.isArray(doc.pages) ? (doc.pages as unknown[]).length : 0;
    return {
      enabled, plan, limits: SITE_PLAN_LIMITS[plan], usage: { pages: 1 + pages, mediaBytes: media._sum.bytes ?? 0 },
      subdomain: vendor?.subdomain ?? null, publicUrl: vendor?.subdomain ? `https://${vendor.subdomain}.get4domain.com` : null,
      live, doc: doc as Record<string, unknown>, dirty: row ? draftDiffers(base as { draft?: unknown } & Record<string, unknown>) : false,
      version: row?.siteVersion ?? 0, publishedAt: row?.publishedAt ?? null,
    };
  }

  // — validation shared by saving a draft and publishing —

  /** Plain-sentence checks on the design choices, extra pages and size of text. Throws a BadRequest the vendor can act on. */
  validatePatch(patch: Record<string, unknown>, plan: SitePlan): void {
    const layout = patch.layout as Record<string, unknown> | undefined;
    if (layout !== undefined) {
      if (typeof layout !== 'object' || layout === null || Array.isArray(layout)) throw new BadRequestException('The design choices are not in the right form.');
      for (const [k, v] of Object.entries(layout)) {
        if (v === '' || v === null || v === undefined) continue;
        if (k === 'themeKey') { if (!(SITE_THEME_KEYS as readonly string[]).includes(String(v))) throw new BadRequestException('Choose one of the themes shown in the list.'); continue; }
        const allowed = (SITE_VARIANTS as Record<string, readonly string[]>)[k as SiteVariantSlot];
        if (!allowed) throw new BadRequestException(`"${k}" is not a layout you can change.`);
        if (!allowed.includes(String(v))) throw new BadRequestException(`Choose one of the layouts shown for ${k}.`);
      }
    }
    const pages = patch.pages as { slug: string }[] | undefined;
    if (pages !== undefined) {
      const limit = SITE_PLAN_LIMITS[plan].pages;
      if (1 + pages.length > limit) throw new BadRequestException(this.pageLimitMessage(plan, limit));
      const slugs = new Set<string>();
      for (const p of pages) { if (slugs.has(p.slug)) throw new BadRequestException(`Two pages use the address "${p.slug}". Give each page its own address.`); slugs.add(p.slug); }
    }
    for (const [f, max] of Object.entries(SITE_TEXT_MAX)) {
      const v = patch[f];
      if (typeof v === 'string' && v.length > (max as number)) throw new BadRequestException(`"${f}" is too long. Keep it under ${max} characters.`);
    }
  }

  // — draft —

  async saveDraft(vendorId: string, dto: UpdateVendorCmsDto): Promise<SiteView> {
    await this.requireEnabled(vendorId);
    const patch = this.onlyProvided(dto);
    if (Object.keys(patch).length === 0) return this.view(vendorId);
    this.validatePatch(patch, await this.planOf(vendorId));
    const row = await this.prisma.vendorCMS.findUnique({ where: { vendorId }, select: { draft: true } });
    const merged = { ...((row?.draft && typeof row.draft === 'object' && !Array.isArray(row.draft) ? row.draft : {}) as Record<string, unknown>), ...patch };
    await this.prisma.vendorCMS.upsert({
      where: { vendorId },
      create: { vendorId, draft: merged as Prisma.InputJsonValue },
      update: { draft: merged as Prisma.InputJsonValue },
    });
    return this.view(vendorId);
  }

  async discardDraft(vendorId: string): Promise<SiteView> {
    await this.requireEnabled(vendorId);
    await this.prisma.vendorCMS.updateMany({ where: { vendorId }, data: { draft: Prisma.DbNull } });
    return this.view(vendorId);
  }

  /** Only the fields the caller actually sent, restricted to the ones a site may change. */
  private onlyProvided(dto: UpdateVendorCmsDto): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of SITE_FIELDS) { const v = (dto as unknown as Record<string, unknown>)[f]; if (v !== undefined) out[f] = v; }
    return out;
  }

  // — preview —

  async previewLink(vendorId: string): Promise<{ url: string; expiresInMinutes: number }> {
    await this.requireEnabled(vendorId);
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { subdomain: true } });
    if (!v?.subdomain) throw new BadRequestException('Your site address is not set up yet. Please contact support.');
    return { url: `/site/${v.subdomain}?preview=${makePreviewToken(vendorId)}`, expiresInMinutes: 30 };
  }

  // — publish —

  async publish(vendorId: string, actor: string, note?: string): Promise<{ view: SiteView; refreshed: boolean; message: string }> {
    await this.requireEnabled(vendorId);
    const row = await this.prisma.vendorCMS.findUnique({ where: { vendorId } });
    if (!row || !row.draft || !draftDiffers(row as unknown as { draft?: unknown } & Record<string, unknown>)) throw new BadRequestException('There is nothing new to publish. Make a change first.');
    const patch = row.draft as Record<string, unknown>;
    this.validatePatch(patch, await this.planOf(vendorId));
    return this.commit(vendorId, row, patch, actor, note ?? 'Published');
  }

  /** Writes a patch to the published columns as one transaction with the new version and clears the draft. If anything fails nothing changes and the old site stays live. */
  private async commit(vendorId: string, row: VendorCMS, patch: Record<string, unknown>, actor: string, note: string): Promise<{ view: SiteView; refreshed: boolean; message: string }> {
    await this.cms.preflightVendorCms(vendorId, patch as unknown as UpdateVendorCmsDto);
    const columns = this.cms.toColumns(patch as unknown as UpdateVendorCmsDto);
    const next = row.siteVersion + 1;
    try {
      await this.prisma.$transaction(async (tx) => {
        // the very first publish also keeps the site as it was before, so it can be restored
        if (row.siteVersion === 0 && (await tx.siteVersion.count({ where: { vendorId } })) === 0) {
          await tx.siteVersion.create({ data: { vendorId, version: 0, snapshot: this.snapshot(row) as Prisma.InputJsonValue, note: 'Your site before the new editor', createdBy: 'system' } });
        }
        const updated = await tx.vendorCMS.update({ where: { vendorId }, data: { ...columns, draft: Prisma.DbNull, siteVersion: next, publishedAt: new Date() } });
        await tx.siteVersion.create({ data: { vendorId, version: next, snapshot: this.snapshot(updated) as Prisma.InputJsonValue, note: note.slice(0, 200), createdBy: actor } });
        await tx.siteVersion.deleteMany({ where: { vendorId, version: { lte: next - SITE_VERSIONS_KEPT } } });
      });
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof ForbiddenException) throw e;
      throw new BadRequestException('We could not publish your changes. Your live site has not changed. Please try again in a moment.');
    }
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { subdomain: true } });
    const r = await this.refresh.refresh(v?.subdomain ?? null);
    return { view: await this.view(vendorId), refreshed: r.refreshed, message: r.detail };
  }

  private snapshot(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of PICK_SNAPSHOT) out[f] = (row as Record<string, unknown>)[f] ?? null;
    return out;
  }

  // — versions —

  async versions(vendorId: string): Promise<{ version: number; note: string | null; createdAt: Date; createdBy: string | null; current: boolean }[]> {
    await this.requireEnabled(vendorId);
    const [rows, row] = await Promise.all([
      this.prisma.siteVersion.findMany({ where: { vendorId }, orderBy: { version: 'desc' }, take: SITE_VERSIONS_KEPT + 1, select: { version: true, note: true, createdAt: true, createdBy: true } }),
      this.prisma.vendorCMS.findUnique({ where: { vendorId }, select: { siteVersion: true } }),
    ]);
    return rows.map((r) => ({ ...r, current: r.version === (row?.siteVersion ?? 0) }));
  }

  async restore(vendorId: string, version: number, actor: string): Promise<{ view: SiteView; refreshed: boolean; message: string }> {
    await this.requireEnabled(vendorId);
    const [snap, row] = await Promise.all([
      this.prisma.siteVersion.findUnique({ where: { vendorId_version: { vendorId, version } } }),
      this.prisma.vendorCMS.findUnique({ where: { vendorId } }),
    ]);
    if (!snap || !row) throw new NotFoundException('We could not find that version. It may be older than the last ten.');
    const patch: Record<string, unknown> = {};
    for (const f of SITE_FIELDS) { const v = (snap.snapshot as Record<string, unknown>)[f]; patch[f] = v === null || v === undefined ? (f === 'portfolio' || f === 'testimonials' || f === 'pages' ? [] : f === 'layout' ? {} : '') : v; }
    this.validatePatch(patch, await this.planOf(vendorId));
    return this.commit(vendorId, row, patch, actor, `Restored version ${version}`);
  }
}
