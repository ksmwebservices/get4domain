import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { EntitlementsService } from '../../plans/entitlements/entitlements.service';
import { Actor } from '../../plans/admin/audit.service';
import { planError } from '../../plans/plans.errors';
import { categoryFor, toRendererInput, limitsFrom } from '../content/content-adapter';
import { ContentSource } from '../content/content-source';
import { SourceDocument } from '../content/content-types';
import { resolveTheme } from '../content/theme-resolution';
import { ThemeRenderService } from '../renderer/theme-render.service';
import { evaluateIndexing, homeContentOk, Readiness, readiness } from '../seo/indexing-rule';
import { B3SettingsService } from '../../b3-settings/b3-settings.service';
import { SiteLifecycle } from './site-lifecycle';
import { MissingField } from '../site.errors';
import { PublishService } from './publish.service';
import { SiteAudit } from './site-audit';
import { DEFAULT_SITE_BASE } from './site-config';
import { SiteBuildService } from './site-build.service';
import { PublicationRow, SiteRepository, SiteSettingsRow } from './site.repository';

export interface PublicationSummary { id: string; version: number; status: string; themeId: string; indexable: boolean; languages: string; warnings: string[]; createdAt: string; publishedAt: string | null; rolledBackFromVersion: number | null }
export interface SiteStatus extends Readiness {
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
  private readonly logger = new Logger(SiteSettingsService.name);
  constructor(
    private readonly repo: SiteRepository,
    private readonly themes: ThemeRenderService,
    private readonly content: ContentSource,
    @Inject(EntitlementsService) private readonly entitlements: Pick<EntitlementsService, 'resolve'>,
    private readonly build: SiteBuildService,
    private readonly publisher: PublishService,
    private readonly audit: SiteAudit,
    /** seeded-site lifecycle and the staff indexing setting (slice 5.13a): absent = the site was never seeded */
    @Optional() private readonly lifecycle?: SiteLifecycle,
    @Optional() @Inject(B3SettingsService) private readonly b3?: Pick<B3SettingsService, 'get'>,
  ) {}

  private async context(vendorId: string): Promise<{ doc: SourceDocument; categoryId: string | null; track: string | null; ent: Awaited<ReturnType<Pick<EntitlementsService, 'resolve'>['resolve']>> }> {
    const doc = await this.content.load(vendorId);
    if (!doc) throw new NotFoundException(planError('UNKNOWN_VENDOR', 'That vendor does not exist.'));
    const kit = this.themes.kitApi;
    const categoryId = categoryFor(doc, kit, kit.categoryMap());
    return { doc, categoryId, track: categoryId ? kit.categoryById(categoryId).track : null, ent: await this.entitlements.resolve(vendorId) };
  }

  private allowed(vendorId: string, categoryId: string | null, track: string | null, library: boolean): string[] {
    if (!categoryId || !track) return [];
    const def = this.themes.defaultThemeFor(categoryId);
    return library ? this.themes.listThemes(vendorId).filter((t) => t.tracks.includes(track)).map((t) => t.id) : def ? [def] : [];
  }

  /** What still keeps this site out of search engines, by the indexing rule, from the facts as they are now. The one place that decides it: the site page and the sites list both ask here. */
  private async indexing(vendorId: string, c: Awaited<ReturnType<SiteSettingsService['context']>>, s: SiteSettingsRow | null): Promise<{ missing: MissingField[]; isSeeded: boolean }> {
    const { doc, categoryId, ent } = c;
    const input = categoryId ? toRendererInput(doc, { categoryId, lang: 'en', year: 2000, siteBase: process.env.SITE_BASE_DOMAIN || DEFAULT_SITE_BASE, limits: limitsFrom(ent) }) : null;
    const seededState = this.lifecycle ? await this.lifecycle.lifecycleOf(vendorId) : null;
    const isSeeded = seededState === 'SEEDED' || seededState === 'INVITED';
    const b3 = isSeeded && this.b3 ? await this.b3.get() : null;
    const missing = evaluateIndexing({
      businessName: doc.cms?.businessName || doc.vendor.businessName, categoryId, claimed: doc.claimed, verifiedContact: doc.claimed, address: String(doc.cms?.address ?? ''),
      serviceAreas: ((input?.content.areas as unknown[]) ?? []).length, homeContent: input ? homeContentOk(input.content as never) : false, forceNoindex: s?.forceNoindex ?? false,
      ...(isSeeded ? { seeded: { mode: b3?.seededSiteIndexingMode ?? 'OFF', qualityOk: this.lifecycle ? await this.lifecycle.qualityOk(vendorId) : false } } : {}),
    }).missing;
    return { missing, isSeeded };
  }

  /** The `indexable` of status() on its own, for one row of the sites list. Null when it cannot be worked out for that business: one broken record must not break the whole list. */
  async indexableOf(vendorId: string, settings: SiteSettingsRow | null): Promise<boolean | null> {
    try {
      const { missing } = await this.indexing(vendorId, await this.context(vendorId), settings);
      return readiness(missing, false, null).indexable;
    } catch (e) {
      this.logger.warn(`indexing check failed for vendor ${vendorId}: ${e instanceof Error ? e.name : 'error'}`);
      return null;
    }
  }

  async status(vendorId: string): Promise<SiteStatus> {
    const context = await this.context(vendorId);
    const { categoryId, track, ent } = context;
    const s = await this.repo.getSettings(vendorId);
    const f = ent.features['site.themes'];
    const library = f?.state === 'ACTIVE' && f.enumValue === 'library';
    const { missing, isSeeded } = await this.indexing(vendorId, context, s);
    const resolved = categoryId && track ? resolveTheme({ requested: s?.themeId ?? null, categoryId, track, themes: this.themes.listThemes(vendorId, s?.themeId ?? null), defaultId: this.themes.defaultThemeFor(categoryId), entitlement: f ? { state: f.state, enumValue: f.enumValue, upsellText: f.upsellText } : null, strict: false }).themeId : null;
    const newest = await this.repo.newestPublication(vendorId);
    const current = await this.repo.currentPublication(vendorId);
    return {
      settings: { themeId: s?.themeId ?? null, language: s?.language ?? 'en', variant: s?.variant ?? null, motionIntensity: s?.motionIntensity ?? 'LOW', forceNoindex: s?.forceNoindex ?? false },
      themeId: resolved, current: summarise(current), preview: newest && newest.status === 'DRAFT_PREVIEW' ? summarise(newest) : null, missing, allowedThemes: this.allowed(vendorId, categoryId, track, library),
      ...readiness(missing, isSeeded, current ? current.indexable : null),
    };
  }

  /**
   * B2.1: the vendor's stored theme, or, when none is stored yet, the default theme of the vendor's category, saved now (so the first call of the website manager never stops at "choose a theme").
   * Null only when the business has no category the library has a design for. Never replaces a stored choice.
   */
  async ensureTheme(vendorId: string): Promise<string | null> {
    const { categoryId } = await this.context(vendorId);
    const stored = (await this.repo.getSettings(vendorId))?.themeId ?? null;
    if (stored) return stored;
    const def = categoryId ? this.themes.defaultThemeFor(categoryId) : null;
    if (!categoryId || !def) return null;
    const variant = this.themes.kitApi.variantFor(categoryId);
    await this.repo.upsertSettings(vendorId, { themeId: def, variant: typeof variant === 'string' ? variant : variant?.id ?? null });
    return def;
  }

  /** The vendor or staff pick a theme. Strict: a Free plan, a theme of another track and an unknown theme are refused with their codes. */
  async setTheme(vendorId: string, themeId: string, actor: Actor): Promise<SiteSettingsRow> {
    const { categoryId, track, ent } = await this.context(vendorId);
    const f = ent.features['site.themes'];
    resolveTheme({ requested: themeId, categoryId: categoryId ?? '', track: track ?? '', themes: this.themes.listThemes(vendorId), defaultId: categoryId ? this.themes.defaultThemeFor(categoryId) : null, entitlement: f ? { state: f.state, enumValue: f.enumValue, upsellText: f.upsellText } : null, strict: true });
    const variant = categoryId ? this.themes.kitApi.variantFor(categoryId) : null;
    const saved = await this.repo.upsertSettings(vendorId, { themeId, variant: typeof variant === 'string' ? variant : variant?.id ?? null });
    await this.repo.recordEvent(vendorId, null, { type: 'THEME_CHANGED', actorType: actor.type, actorId: actor.id, detail: { themeId } }, this.audit.hook(actor, 'site.theme', vendorId, { themeId }));
    return saved;
  }

  /**
   * Staff assign a theme to a business (Website Manager lane A): the plan rules apply to a public theme exactly as in setTheme; a theme made privately for this business is always allowed.
   * The reason is recorded. When the site is live it is built and published at once, so the visitor sees the new theme.
   */
  async assignTheme(vendorId: string, themeId: string, reason: string, actor: Actor): Promise<{ settings: SiteSettingsRow; published: PublicationRow | null }> {
    const saved = await this.setTheme(vendorId, themeId, actor);
    await this.repo.recordEvent(vendorId, null, { type: 'THEME_CHANGED', actorType: actor.type, actorId: actor.id, detail: { themeId, assigned: true, reason } }, this.audit.hook(actor, 'site.theme.assign', vendorId, { themeId, reason }));
    let published: PublicationRow | null = null;
    if (await this.repo.currentPublication(vendorId)) {
      const built = await this.build.build(vendorId, { actor });
      published = built.publication.status === 'DRAFT_PREVIEW' ? await this.publisher.publish(vendorId, built.publication.id, actor) : built.publication;
    }
    return { settings: saved, published };
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
