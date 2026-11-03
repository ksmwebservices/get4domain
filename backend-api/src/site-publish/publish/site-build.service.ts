import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { toRenderEntitlements } from '../../plans/entitlements/entitlement-engine';
import { EntitlementsService } from '../../plans/entitlements/entitlements.service';
import { Actor } from '../../plans/admin/audit.service';
import { planError } from '../../plans/plans.errors';
import { categoryFor, limitsFrom, pageArgs, planPages, toRendererInput } from '../content/content-adapter';
import { ContentSource } from '../content/content-source';
import { resolveTheme } from '../content/theme-resolution';
import { ThemeRenderService } from '../renderer/theme-render.service';
import { evaluateIndexing, homeContentOk } from '../seo/indexing-rule';
import { assembleDocument, buildPageSeo } from '../seo/page-seo';
import { buildRobotsTxt, buildSitemap, SitemapEntry } from '../seo/site-files';
import { siteError } from '../site.errors';
import { CSS_BUDGET_BYTES, DEFAULT_SITE_BASE, PAGE_BUDGET_BYTES, clampMotion, contentTypeFor, kitMotion, parseLanguages, sha256, stableJson } from './site-config';
import { SiteAudit } from './site-audit';
import { NewPage, PublicationRow, SiteRepository } from './site.repository';

export interface BuildOptions { themeId?: string; actor: Actor }
export interface BuildResult { publication: PublicationRow; reused: boolean }

/**
 * Renders a vendor's whole site into a DRAFT_PREVIEW publication (docs/v3/V3_S4_RENDERER_PUBLISH.md section 7). Idempotent: if the newest publication was
 * built from the same theme, content and settings it is returned and nothing is written. The renderer is pure and the SEO layer is pure, so two builds of the
 * same inputs are byte-identical. Nothing here publishes anything.
 */
@Injectable()
export class SiteBuildService {
  /** overridable in tests; the year goes into the content because the renderer has no clock */
  clock: () => Date = () => new Date();
  siteBase = process.env.SITE_BASE_DOMAIN || DEFAULT_SITE_BASE;
  budgets = { page: PAGE_BUDGET_BYTES, css: CSS_BUDGET_BYTES };

  constructor(
    private readonly repo: SiteRepository,
    private readonly themes: ThemeRenderService,
    private readonly content: ContentSource,
    @Inject(EntitlementsService) private readonly entitlements: Pick<EntitlementsService, 'resolve'>,
    private readonly audit: SiteAudit,
  ) {}

  async build(vendorId: string, opts: BuildOptions): Promise<BuildResult> {
    const doc = await this.content.load(vendorId);
    if (!doc) throw new NotFoundException(planError('UNKNOWN_VENDOR', 'That vendor does not exist.'));
    const kit = this.themes.kitApi;
    const categoryId = categoryFor(doc, kit, kit.categoryMap());
    if (!categoryId) throw new ConflictException(siteError('PUBLISH_BLOCKED', 'This business has no category yet, so its site cannot be built.', { missing: [{ code: 'CATEGORY', label: 'The business needs a category' }] }));
    const cat = kit.categoryById(categoryId);

    const settings = await this.repo.getSettings(vendorId);
    const ent = await this.entitlements.resolve(vendorId);
    const notes: string[] = [];
    const themeFeature = ent.features['site.themes'];
    const resolved = resolveTheme({
      requested: opts.themeId ?? settings?.themeId ?? null, categoryId, track: cat.track, themes: this.themes.listThemes(), defaultId: this.themes.defaultThemeFor(categoryId),
      entitlement: themeFeature ? { state: themeFeature.state, enumValue: themeFeature.enumValue, upsellText: themeFeature.upsellText } : null, strict: opts.themeId !== undefined,
    });
    notes.push(...resolved.notes);
    const theme = this.themes.getTheme(resolved.themeId);

    const langs = parseLanguages(settings?.language, ent.features['site.language_ta']?.state === 'ACTIVE');
    notes.push(...langs.notes);
    const motion = kitMotion(clampMotion(settings?.motionIntensity ?? 'LOW', ent.level));
    const limits = limitsFrom(ent);
    const renderEnt = toRenderEntitlements(ent, false);
    const year = this.clock().getUTCFullYear();

    const base = toRendererInput(doc, { categoryId, lang: 'en', year, siteBase: this.siteBase, limits, motion });
    notes.push(...base.notes.map((n) => n));
    const siteName = String((base.content.site as { name: string }).name);
    const contact = base.content.contact as { address: string; city: string };
    const indexing = evaluateIndexing({
      businessName: siteName, categoryId, claimed: doc.claimed, verifiedContact: doc.claimed, address: contact.address, serviceAreas: ((base.content.areas as unknown[]) ?? []).length,
      homeContent: homeContentOk(base.content as never), forceNoindex: settings?.forceNoindex ?? false,
    });

    // hashes: what the output depends on, so an unchanged site is recognised without rendering
    const contentHash = sha256(stableJson({ doc, categoryId, year, limits, motion, siteBase: this.siteBase }));
    const settingsHash = sha256(stableJson({ themeId: resolved.themeId, languages: langs.languages, motion, renderEnt, indexable: indexing.indexable, missing: indexing.missing.map((m) => m.code) }));
    const newest = await this.repo.newestPublication(vendorId);
    if (newest && newest.themeHash === theme.hash && newest.contentHash === contentHash && newest.settingsHash === settingsHash && newest.themeId === resolved.themeId) return { publication: newest, reused: true };

    // render every page of every language
    const pages: NewPage[] = [];
    const warnings = new Set<string>(notes);
    const templates = Object.keys(theme.theme.templates);
    const sitemap: SitemapEntry[] = [];
    const canon = new Map<string, string>();
    const siteUrl = String(base.host.siteUrl);
    for (const lang of langs.languages) {
      const input = lang === 'en' ? base : toRendererInput(doc, { categoryId, lang, year, siteBase: this.siteBase, limits, motion });
      for (const p of planPages(input.content, templates)) {
        const args = pageArgs(input.content, p);
        const rendered = this.themes.render(resolved.themeId, { page: args.page, content: args.content, settings: input.settings, vendor: input.vendor, host: input.host, entitlements: renderEnt });
        for (const w of rendered.warnings) warnings.add(w);
        const seo = buildPageSeo({
          rendered, path: p.path, template: p.template, lang, languages: langs.languages, indexable: indexing.indexable, siteUrl, categoryId, siteName, city: contact.city,
          image: doc.cms?.banner ?? '', itemName: p.item ? String((p.item as { name: string }).name) : '', items: (input.content.items as Array<{ name: string; description: string; image: string }>) ?? [],
          tagline: String(doc.cms?.tagline ?? ''), about: String(doc.cms?.about ?? ''),
        });
        const html = assembleDocument({ seo, bodyHtml: rendered.html, cssHref: '/assets/site.css', favicon: doc.cms?.favicon ?? undefined });
        const bytes = Buffer.byteLength(html);
        const path = lang === 'ta' ? `/ta${p.path === '/' ? '' : p.path}` : p.path;
        if (bytes > this.budgets.page) throw new UnprocessableEntityException(siteError('SITE_BUDGET_EXCEEDED', `The page ${path} is ${Math.round(bytes / 1024)} KB, over the ${Math.round(this.budgets.page / 1024)} KB limit. Shorten its text or remove photos.`));
        pages.push({ path, lang, html, seoJson: { title: seo.title, description: seo.description, canonical: seo.canonical, robots: seo.robots, template: p.template }, bytes, sha256: sha256(html) });
        canon.set(`${lang}:${p.path}`, seo.canonical);
      }
    }
    for (const p of planPages(base.content, templates)) {
      const en = canon.get(`en:${p.path}`); if (!en) continue;
      const ta = canon.get(`ta:${p.path}`);
      sitemap.push({ loc: en, ...(ta ? { alternates: [{ lang: 'en-IN', href: en }, { lang: 'ta-IN', href: ta }] } : {}) });
    }
    const css = [theme.theme.css.tokens, theme.theme.css.base, theme.theme.css.motion, theme.theme.css.print].filter(Boolean).join('\n');
    if (Buffer.byteLength(css) > this.budgets.css) throw new UnprocessableEntityException(siteError('SITE_BUDGET_EXCEEDED', 'The theme stylesheet is over the allowed size.'));
    const files: Array<[string, string]> = [['/assets/site.css', css], ['/sitemap.xml', buildSitemap(sitemap, indexing.indexable)], ['/robots.txt', buildRobotsTxt(indexing.indexable, `${siteUrl}/sitemap.xml`)]];
    for (const [path, text] of files) pages.push({ path, lang: 'en', html: text, seoJson: { contentType: contentTypeFor(path) }, bytes: Buffer.byteLength(text), sha256: sha256(text) });

    const row = await this.repo.createPublication(
      {
        vendorId, themeId: resolved.themeId, themeHash: theme.hash, contentHash, settingsHash, indexable: indexing.indexable, indexHeader: pages.find((x) => x.path === '/')?.seoJson.robots as string ?? 'noindex, nofollow',
        missingFieldsJson: indexing.missing, warningsJson: [...warnings], languages: langs.languages.join(','), totalBytes: pages.reduce((n, x) => n + x.bytes, 0), createdByType: opts.actor.type, createdById: opts.actor.id,
      },
      pages,
      { type: 'BUILT', actorType: opts.actor.type, actorId: opts.actor.id, detail: { themeId: resolved.themeId, pages: pages.length, indexable: indexing.indexable } },
      this.audit.hook(opts.actor, 'site.build', vendorId, { themeId: resolved.themeId, pages: pages.length, indexable: indexing.indexable }),
    );
    return { publication: row, reused: false };
  }
}
