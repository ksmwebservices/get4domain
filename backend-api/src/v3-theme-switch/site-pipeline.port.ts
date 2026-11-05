import { HttpException, Injectable } from '@nestjs/common';
import { toRenderEntitlements } from '../plans/entitlements/entitlement-engine';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { Actor } from '../plans/admin/audit.service';
import { categoryFor, limitsFrom, pageArgs, planPages, toRendererInput } from '../site-publish/content/content-adapter';
import { ContentSource } from '../site-publish/content/content-source';
import { resolveTheme } from '../site-publish/content/theme-resolution';
import { DEFAULT_SITE_BASE, clampMotion, kitMotion } from '../site-publish/publish/site-config';
import { PublishService } from '../site-publish/publish/publish.service';
import { SiteBuildService } from '../site-publish/publish/site-build.service';
import { SiteSettingsService } from '../site-publish/publish/site-settings.service';
import { SiteRepository } from '../site-publish/publish/site.repository';
import { ThemeRenderService } from '../site-publish/renderer/theme-render.service';
import { usedFieldsOfTemplates } from './core/theme-switch-core';

export type Eligibility = { ok: true } | { ok: false; code: string; message: string };
export interface SiteSnapshot { storedThemeId: string | null; publishedThemeId: string | null; hasPublished: boolean }
export interface FieldUse { contentFields: string[]; usedFields: string[] | null }
export interface PreviewResult extends FieldUse { html: string; css: string; warnings: string[] }

/**
 * The theme switch's one door to the site slice (5.4): what is stored and published now, whether a theme may be used, a render that stores nothing, applying a theme through the existing settings, build and
 * publish services (a new publication snapshot; the previous one stays, so rollback stays possible), and restoring the stored theme after a lapse. The real adapter below uses those services unchanged.
 */
export abstract class SitePipelinePort {
  abstract snapshot(vendorId: string): Promise<SiteSnapshot>;
  abstract eligibility(vendorId: string, themeId: string): Promise<Eligibility>;
  abstract preview(vendorId: string, themeId: string): Promise<PreviewResult>;
  abstract fieldsFor(vendorId: string, themeId: string): Promise<FieldUse>;
  /** stores the theme, then (when the site is live) builds and publishes a new snapshot. Returns the publication, or null when the site was never published. */
  abstract apply(vendorId: string, themeId: string, actor: Actor): Promise<{ publicationId: string | null }>;
  /** puts the stored theme back (undo of a failed apply) */
  abstract setStored(vendorId: string, themeId: string | null): Promise<void>;
  /** after a lapse and a renewal: when the stored theme is not the one published, rebuild and publish it. Null when there is nothing to restore. */
  abstract restore(vendorId: string, actor: Actor): Promise<{ publicationId: string; themeId: string } | null>;
}

const safeCode = (e: unknown): { code: string; message: string } => {
  if (e instanceof HttpException) { const b = e.getResponse() as { code?: string; message?: string | string[] }; return { code: typeof b?.code === 'string' ? b.code : 'THEME_NOT_ALLOWED', message: Array.isArray(b?.message) ? b.message.join(' ') : String(b?.message ?? e.message) }; }
  return { code: 'THEME_NOT_ALLOWED', message: 'That theme cannot be used.' };
};

@Injectable()
export class SitePublishPipeline extends SitePipelinePort {
  constructor(
    private readonly repo: SiteRepository, private readonly themes: ThemeRenderService, private readonly content: ContentSource, private readonly entitlements: EntitlementsService,
    private readonly settings: SiteSettingsService, private readonly build: SiteBuildService, private readonly publisher: PublishService,
  ) { super(); }

  private async context(vendorId: string) {
    const doc = await this.content.load(vendorId); if (!doc) return null;
    const kit = this.themes.kitApi; const categoryId = categoryFor(doc, kit, kit.categoryMap());
    return { doc, kit, categoryId, track: categoryId ? kit.categoryById(categoryId).track : null, ent: await this.entitlements.resolve(vendorId) };
  }

  async snapshot(vendorId: string): Promise<SiteSnapshot> {
    const [s, cur] = await Promise.all([this.repo.getSettings(vendorId), this.repo.currentPublication(vendorId)]);
    return { storedThemeId: s?.themeId ?? null, publishedThemeId: cur?.themeId ?? null, hasPublished: !!cur };
  }

  async eligibility(vendorId: string, themeId: string): Promise<Eligibility> {
    const c = await this.context(vendorId);
    if (!c || !c.categoryId || !c.track) return { ok: false, code: 'THEME_NOT_ALLOWED', message: 'This business has no category yet, so its theme cannot be changed.' };
    const f = c.ent.features['site.themes'];
    try {
      resolveTheme({ requested: themeId, categoryId: c.categoryId, track: c.track, themes: this.themes.listThemes(), defaultId: this.themes.defaultThemeFor(c.categoryId), entitlement: f ? { state: f.state, enumValue: f.enumValue, upsellText: f.upsellText } : null, strict: true });
      return { ok: true };
    } catch (e) { return { ok: false, ...safeCode(e) }; }
  }

  async fieldsFor(vendorId: string, themeId: string): Promise<FieldUse> {
    const c = await this.context(vendorId);
    if (!c || !c.categoryId) return { contentFields: [], usedFields: null };
    const base = toRendererInput(c.doc, { categoryId: c.categoryId, lang: 'en', year: 2000, siteBase: process.env.SITE_BASE_DOMAIN || DEFAULT_SITE_BASE, limits: limitsFrom(c.ent) });
    const contentFields = Object.entries(base.content as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)).map(([k]) => k);
    let used: string[] | null = null;
    try { used = [...usedFieldsOfTemplates(Object.values(this.themes.getTheme(themeId).theme.templates).map((t) => String(t)))]; } catch { used = null; }
    return { contentFields, usedFields: used };
  }

  /** Renders the home page of the target theme with the vendor's own content and returns it. Nothing is written anywhere. */
  async preview(vendorId: string, themeId: string): Promise<PreviewResult> {
    const c = await this.context(vendorId);
    if (!c || !c.categoryId) return { html: '', css: '', warnings: ['CATEGORY'], contentFields: [], usedFields: null };
    const s = await this.repo.getSettings(vendorId);
    const motion = kitMotion(clampMotion(s?.motionIntensity ?? 'LOW', c.ent.level));
    const base = toRendererInput(c.doc, { categoryId: c.categoryId, lang: 'en', year: new Date().getUTCFullYear(), siteBase: process.env.SITE_BASE_DOMAIN || DEFAULT_SITE_BASE, limits: limitsFrom(c.ent), motion });
    const theme = this.themes.getTheme(themeId);
    const home = planPages(base.content, Object.keys(theme.theme.templates)).find((p) => p.path === '/');
    if (!home) return { html: '', css: '', warnings: ['NO_HOME_PAGE'], contentFields: [], usedFields: null };
    const args = pageArgs(base.content, home);
    const rendered = this.themes.render(themeId, { page: args.page, content: args.content, settings: base.settings, vendor: base.vendor, host: base.host, entitlements: toRenderEntitlements(c.ent, false) });
    const fields = await this.fieldsFor(vendorId, themeId);
    return { html: rendered.html, css: [theme.theme.css.tokens, theme.theme.css.base, theme.theme.css.motion, theme.theme.css.print].filter(Boolean).join('\n'), warnings: [...rendered.warnings], ...fields };
  }

  async apply(vendorId: string, themeId: string, actor: Actor): Promise<{ publicationId: string | null }> {
    await this.settings.setTheme(vendorId, themeId, actor);
    if (!(await this.repo.currentPublication(vendorId))) return { publicationId: null };
    const built = await this.build.build(vendorId, { actor });
    const pub = built.publication.status === 'DRAFT_PREVIEW' ? await this.publisher.publish(vendorId, built.publication.id, actor) : built.publication;
    return { publicationId: pub.id };
  }

  async setStored(vendorId: string, themeId: string | null): Promise<void> { await this.repo.upsertSettings(vendorId, { themeId }); }

  async restore(vendorId: string, actor: Actor): Promise<{ publicationId: string; themeId: string } | null> {
    const snap = await this.snapshot(vendorId);
    if (!snap.hasPublished || !snap.storedThemeId || snap.storedThemeId === snap.publishedThemeId) return null;
    const built = await this.build.build(vendorId, { actor });
    if (built.publication.themeId !== snap.storedThemeId) return null;   // the stored theme still cannot be used (the plan has not come back): nothing to restore yet
    const pub = built.publication.status === 'DRAFT_PREVIEW' ? await this.publisher.publish(vendorId, built.publication.id, actor) : built.publication;
    return { publicationId: pub.id, themeId: snap.storedThemeId };
  }
}
