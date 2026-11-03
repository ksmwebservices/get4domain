import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SiteBuildService } from '../../site-publish/publish/site-build.service';
import { SiteRepository } from '../../site-publish/publish/site.repository';
import { ThemeRenderService } from '../../site-publish/renderer/theme-render.service';
import { StepError } from '../provisioning.errors';
import { DraftSiteBuilder, PrepareDraftInput } from './draft-site-builder';

/**
 * Renderer mode of the Free site draft: site settings with the category's default Standard theme (and its layout variant), the city as the draft address when
 * the vendor has none yet (so the page can say where the business is), then a DRAFT_PREVIEW publication built by the same SiteBuildService everything else uses.
 * Never publishes. Safe to run twice (settings are upserted; an unchanged build returns the same preview).
 */
@Injectable()
export class RendererDraftBuilder extends DraftSiteBuilder {
  constructor(private readonly repo: SiteRepository, private readonly build: SiteBuildService, private readonly themes: ThemeRenderService, private readonly prisma: PrismaService) { super(); }

  async prepare(i: PrepareDraftInput): Promise<{ publicationId: string }> {
    const themeId = this.themes.defaultThemeFor(i.category);
    if (!themeId) throw new StepError('SITE_BUILD_REFUSED', false);
    const variant = this.themes.kitApi.variantFor(i.category);
    await this.repo.upsertSettings(i.vendorId, { themeId, variant: typeof variant === 'string' ? variant : variant?.id ?? null, language: i.language === 'ta' ? 'en,ta' : 'en' });
    await this.fillAddress(i.vendorId, i.city);
    try {
      const r = await this.build.build(i.vendorId, { actor: { type: 'SYSTEM', id: null, ip: null } });
      return { publicationId: r.publication.id };
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() >= 400 && e.getStatus() < 500) throw new StepError('SITE_BUILD_REFUSED', false);   // a refusal will not change on retry
      throw e;
    }
  }

  /** The legacy starter fills the address with the city for a published site; for a draft nothing did. Only an empty address is touched, and only in the draft. */
  private async fillAddress(vendorId: string, city?: string): Promise<void> {
    const c = (city ?? '').trim();
    if (!c) return;
    const row = await this.prisma.vendorCMS.findUnique({ where: { vendorId }, select: { address: true, draft: true } });
    if (!row) return;
    const draft = (row.draft && typeof row.draft === 'object' && !Array.isArray(row.draft) ? row.draft : {}) as Record<string, unknown>;
    const current = String(('address' in draft ? draft.address : row.address) ?? '').trim();
    if (current) return;
    await this.prisma.vendorCMS.update({ where: { vendorId }, data: { draft: { ...draft, address: c } } });
  }
}
