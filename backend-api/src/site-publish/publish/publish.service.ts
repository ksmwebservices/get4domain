import { ConflictException, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { EntitlementsService } from '../../plans/entitlements/entitlements.service';
import { Actor } from '../../plans/admin/audit.service';
import { planError } from '../../plans/plans.errors';
import { categoryFor } from '../content/content-adapter';
import { ContentSource } from '../content/content-source';
import { resolveTheme } from '../content/theme-resolution';
import { ThemeRenderService } from '../renderer/theme-render.service';
import { BLOCKING_MISSING } from '../seo/indexing-rule';
import { MissingField, siteError } from '../site.errors';
import { BLOCKING_WARNING, PAGE_BUDGET_BYTES } from './site-config';
import { SiteAudit } from './site-audit';
import { PublicationRow, SiteRepository } from './site.repository';
import { AcceptanceGuard } from '../../terms/terms-ports';
import { ProhibitedScanPort } from '../../v3-trust/trust.ports';

/** The readable text of a stored page: tags, scripts and styles removed, entities left as they are (the scan folds punctuation away). */
const textOfHtml = (html: string): string => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** The documents a vendor has accepted before a published site may carry calls to action (slice 5.15). */
const CTA_TERMS = ['VENDOR_TERMS', 'ACCEPTABLE_USE', 'DATA_PROCESSING'] as const;

const blocked = (missing: MissingField[]): ConflictException => new ConflictException(siteError('PUBLISH_BLOCKED', 'This site cannot be published yet.', { missing }));

/**
 * Publishing and rolling back (docs/v3/V3_S4_RENDERER_PUBLISH.md section 7). Both run in one transaction under a per-vendor advisory lock (in the repository):
 * the checks below run inside it, the previous PUBLISHED row becomes SUPERSEDED, and an audit row and a site event are written with the change.
 * "Publish" only means the snapshot becomes the one the read API serves. Nothing is exposed on any host.
 */
@Injectable()
export class PublishService {
  clock: () => Date = () => new Date();

  constructor(
    private readonly repo: SiteRepository,
    private readonly themes: ThemeRenderService,
    private readonly content: ContentSource,
    @Inject(EntitlementsService) private readonly entitlements: Pick<EntitlementsService, 'resolve'>,
    private readonly audit: SiteAudit,
    @Optional() @Inject(AcceptanceGuard) private readonly acceptance?: AcceptanceGuard,
    /** slice 5.21: looks at what was just published; never blocks and never throws */
    @Optional() @Inject(ProhibitedScanPort) private readonly scan?: ProhibitedScanPort,
  ) {}

  /** Re-checks a snapshot against the vendor as they are NOW: hard minimums, renderer warnings, size, the plan (theme and Tamil) and the staff noindex switch. */
  private async revalidate(vendorId: string, p: PublicationRow, opts: { forPublish: boolean }): Promise<void> {
    const problems: MissingField[] = [];
    for (const m of p.missingFieldsJson) if (BLOCKING_MISSING.includes(m.code)) problems.push(m);
    if (opts.forPublish) for (const w of p.warningsJson) if (BLOCKING_WARNING.test(w)) problems.push({ code: 'RENDER_WARNING', label: w });
    for (const pg of await this.repo.pagesOf(p.id)) if (pg.html.startsWith('<!doctype html>') && pg.bytes > PAGE_BUDGET_BYTES) problems.push({ code: 'PAGE_TOO_LARGE', label: `The page ${pg.path} is over the size limit` });

    const doc = await this.content.load(vendorId);
    const ent = await this.entitlements.resolve(vendorId);
    const kit = this.themes.kitApi;
    const categoryId = doc ? categoryFor(doc, kit, kit.categoryMap()) : null;
    if (doc && categoryId) {
      const f = ent.features['site.themes'];
      const r = resolveTheme({
        requested: p.themeId, categoryId, track: kit.categoryById(categoryId).track, themes: this.themes.listThemes(), defaultId: this.themes.defaultThemeFor(categoryId),
        entitlement: f ? { state: f.state, enumValue: f.enumValue, upsellText: f.upsellText } : null, strict: false,
      });
      if (r.themeId !== p.themeId) problems.push({ code: 'THEME_NOT_ALLOWED', label: 'Your plan no longer allows this theme' });
    }
    if (p.languages.split(',').includes('ta') && ent.features['site.language_ta']?.state !== 'ACTIVE') problems.push({ code: 'LANGUAGE_LOCKED', label: 'Your plan no longer includes the Tamil site' });
    if (p.indexable && (await this.repo.getSettings(vendorId))?.forceNoindex) problems.push({ code: 'FORCE_NOINDEX', label: 'Search engines are switched off for this site: build it again first' });
    if (problems.length) throw blocked(problems);
  }

  async publish(vendorId: string, publicationId: string, actor: Actor): Promise<PublicationRow> {
    // A Pro vendor's published site carries the call-to-action slots: the current terms must be accepted first. A Free (or lapsed, or suspended) site has none, so nothing is asked.
    if (this.acceptance && (await this.entitlements.resolve(vendorId)).features['site.cta']?.state === 'ACTIVE') await this.acceptance.require(vendorId, CTA_TERMS);
    const row = await this.repo.publish(vendorId, publicationId, {
      now: this.clock(),
      validate: (p) => this.revalidate(vendorId, p, { forPublish: true }),
      event: { type: 'PUBLISHED', actorType: actor.type, actorId: actor.id, detail: { publicationId } },
      audit: this.audit.hook(actor, 'site.publish', vendorId, { publicationId }),
    });
    await this.scanPublished(vendorId, row.id);
    return row;
  }

  /** Owner rule 11 and slice 5.21: the published text is looked at for prohibited phrases. A match raises an alert; it never blocks the publish, which has already happened. */
  private async scanPublished(vendorId: string, publicationId: string): Promise<void> {
    if (!this.scan) return;
    try { await this.scan.scan(vendorId, 'PUBLISH', (await this.repo.pagesOf(publicationId)).filter((pg) => pg.html.startsWith('<!doctype html>')).map((pg) => textOfHtml(pg.html))); } catch { /* a scan fault never undoes a publish */ }
  }

  /** Republishes an older snapshot as a new version. Needs the plan feature site.revisions. */
  async rollback(vendorId: string, toVersion: number, actor: Actor): Promise<PublicationRow> {
    const ent = await this.entitlements.resolve(vendorId);
    const f = ent.features['site.revisions'];
    if (f?.state !== 'ACTIVE') throw new ForbiddenException(planError('FEATURE_LOCKED', 'Going back to an earlier version needs a plan with version history.', { feature: 'site.revisions', upsellText: f?.upsellText ?? null }));
    return this.repo.rollback(vendorId, toVersion, {
      now: this.clock(), actor,
      validate: (src) => this.revalidate(vendorId, src, { forPublish: false }),
      event: (newVersion) => ({ type: 'ROLLED_BACK', actorType: actor.type, actorId: actor.id, detail: { toVersion, newVersion } }),
      audit: this.audit.hook(actor, 'site.rollback', vendorId, { toVersion }),
    });
  }
}
