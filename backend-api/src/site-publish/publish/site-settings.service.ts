import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EntitlementsService } from '../../plans/entitlements/entitlements.service';
import { Actor } from '../../plans/admin/audit.service';
import { planError } from '../../plans/plans.errors';
import { categoryFor, toRendererInput, limitsFrom } from '../content/content-adapter';
import { ContentSource } from '../content/content-source';
import { SourceDocument } from '../content/content-types';
import { resolveTheme } from '../content/theme-resolution';
import { ThemeRenderService } from '../renderer/theme-render.service';
import { evaluateIndexing, homeContentOk } from '../seo/indexing-rule';
import { MissingField } from '../site.errors';
import { PublishService } from './publish.service';
import { SiteAudit } from './site-audit';
import { DEFAULT_SITE_BASE } from './site-config';
import { SiteBuildService } from './site-build.service';
import { PublicationRow, SiteRepository, SiteSettingsRow } from './site.repository';

export interface PublicationSummary { id: string; version: number; status: string; themeId: string; indexable: boolean; languages: string; warnings: string[]; createdAt: string; publishedAt: string | null; rolledBackFromVersion: number | null }
export interface SiteStatus {
  settings: { themeId: string | null; language: string; variant: string | null; motionIntensity: string; forceNoindex: boolean };
  themeId: string | null;
  current: PublicationSummary | null;
  preview: PublicationSummary | null;
  missing: MissingField[];
  allowedThemes: string[];
}
export const summarise = (p: PublicationRow | null): PublicationSummary | null => (p ? {
  id: p.id, version: p.version, status: p.status, themeId: p.themeId, indexable: p.indexable, languages: p.languages, warnings: p.warningsJson,
  createdAt: p.createdAt.toISOString(), publishedAt: p.publishedAt?.toISOString() ?? null, rolledBackFromVersion: p.rolledBackFromVersion,
} : null);

/** The settings of a vendor's site and the summary the dashboards show: theme choice (entitlement checked), the staff noindex switch, the live missing-field list. Never html. */
@Injectable()
export class SiteSettingsService {
  constructor(
    private readonly repo: SiteRepository,
    private readonly themes: ThemeRenderService,
    private readonly content: ContentSource,
    @Inject(EntitlementsService) private readonly entitlements: Pick<EntitlementsService, 'resolve'>,
    private readonly build: SiteBuildService,
    private readonly publisher: PublishService,
    private readonly audit: SiteAudit,
  ) {}

  private async context(vendorId: string): Promise<{ doc: SourceDocument; categoryId: string | null; track: string | null; ent: Awaited<ReturnType<Pick<EntitlementsService, 'resolve'>['resolve']>> }> {
    const doc = await this.content.load(vendorId);
    if (!doc) throw new NotFoundException(planError('UNKNOWN_VENDOR', 'That vendor does not exist.'));
    const kit = this.themes.kitApi;
    const categoryId = categoryFor(doc, kit, kit.categoryMap());
    return { doc, categoryId, track: categoryId ? kit.categoryById(categoryId).track : null, ent: await this.entitlements.resolve(vendorId) };
  }

  private allowed(categoryId: string | null, track: string | null, library: boolean): string[] {
    if (!categoryId || !track) return [];
    const def = this.themes.defaultThemeFor(categoryId);
    return library ? this.themes.listThemes().filter((t) => t.tracks.includes(track)).map((t) => t.id) : def ? [def] : [];
  }

  async status(vendorId: string): Promise<SiteStatus> {
    const { doc, categoryId, track, ent } = await this.context(vendorId);
    const s = await this.repo.getSettings(vendorId);
    const f = ent.features['site.themes'];
    const library = f?.state === 'ACTIVE' && f.enumValue === 'library';
    const input = categoryId ? toRendererInput(doc, { categoryId, lang: 'en', year: 2000, siteBase: process.env.SITE_BASE_DOMAIN || DEFAULT_SITE_BASE, limits: limitsFrom(ent) }) : null;
    const missing = evaluateIndexing({
      businessName: doc.cms?.businessName || doc.vendor.businessName, categoryId, claimed: doc.claimed, verifiedContact: doc.claimed, address: String(doc.cms?.address ?? ''),
      serviceAreas: ((input?.content.areas as unknown[]) ?? []).length, homeContent: input ? homeContentOk(input.content as never) : false, forceNoindex: s?.forceNoindex ?? false,
    }).missing;
    const resolved = categoryId && track ? resolveTheme({ requested: s?.themeId ?? null, categoryId, track, themes: this.themes.listThemes(), defaultId: this.themes.defaultThemeFor(categoryId), entitlement: f ? { state: f.state, enumValue: f.enumValue, upsellText: f.upsellText } : null, strict: false }).themeId : null;
    const newest = await this.repo.newestPublication(vendorId);
    const current = await this.repo.currentPublication(vendorId);
    return {
      settings: { themeId: s?.themeId ?? null, language: s?.language ?? 'en', variant: s?.variant ?? null, motionIntensity: s?.motionIntensity ?? 'LOW', forceNoindex: s?.forceNoindex ?? false },
      themeId: resolved, current: summarise(current), preview: newest && newest.status === 'DRAFT_PREVIEW' ? summarise(newest) : null, missing, allowedThemes: this.allowed(categoryId, track, library),
    };
  }

  /** The vendor or staff pick a theme. Strict: a Free plan, a theme of another track and an unknown theme are refused with their codes. */
  async setTheme(vendorId: string, themeId: string, actor: Actor): Promise<SiteSettingsRow> {
    const { categoryId, track, ent } = await this.context(vendorId);
    const f = ent.features['site.themes'];
    resolveTheme({ requested: themeId, categoryId: categoryId ?? '', track: track ?? '', themes: this.themes.listThemes(), defaultId: categoryId ? this.themes.defaultThemeFor(categoryId) : null, entitlement: f ? { state: f.state, enumValue: f.enumValue, upsellText: f.upsellText } : null, strict: true });
    const variant = categoryId ? this.themes.kitApi.variantFor(categoryId) : null;
    const saved = await this.repo.upsertSettings(vendorId, { themeId, variant: typeof variant === 'string' ? variant : variant?.id ?? null });
    await this.repo.recordEvent(vendorId, null, { type: 'THEME_CHANGED', actorType: actor.type, actorId: actor.id, detail: { themeId } }, this.audit.hook(actor, 'site.theme', vendorId, { themeId }));
    return saved;
  }

  /**
   * Staff switch: keep a site out of search whatever the indexing rule says. When a site is live this builds and publishes a new version at once, so what is
   * served matches the switch (the served page carries its robots tag, and the stored snapshot is not edited).
   */
  async setForceNoindex(vendorId: string, on: boolean, actor: Actor): Promise<{ settings: SiteSettingsRow; published: PublicationRow | null }> {
    await this.context(vendorId);
    const saved = await this.repo.upsertSettings(vendorId, { forceNoindex: on });
    await this.repo.recordEvent(vendorId, null, { type: 'NOINDEX_CHANGED', actorType: actor.type, actorId: actor.id, detail: { forceNoindex: on } }, this.audit.hook(actor, 'site.noindex', vendorId, { forceNoindex: on }));
    let published: PublicationRow | null = null;
    if (await this.repo.currentPublication(vendorId)) {
      const built = await this.build.build(vendorId, { actor });
      published = built.publication.status === 'DRAFT_PREVIEW' ? await this.publisher.publish(vendorId, built.publication.id, actor) : built.publication;
    }
    return { settings: saved, published };
  }
}
