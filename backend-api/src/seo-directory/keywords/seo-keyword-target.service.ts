import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DirectorySettingsService } from '../../directory/settings/directory-settings.service';
import { Actor } from '../../plans/admin/audit.service';
import { generateKeywordPlan, KeywordPlan } from '../core/keyword-plan';
import { checkTarget, pickOverride, planTargetImport, TargetImportPlan, TargetInput, TargetRow, targetKey, targetsToCsv } from '../core/keyword-target';
import { buildTrackedLink, LinkInput } from '../core/link-builder';
import { PageOverride, SeoPageOverrides } from '../pages/seo-page.service';
import { SeoAudit } from '../seo-audit';
import { seoError } from '../seo-directory.errors';
import { SeoSitemapService } from '../sitemaps/seo-sitemap.service';
import { SeoKeywordStore } from './seo-keyword.store';
import { SeoKeywordTargetStore, TargetListQuery } from './seo-keyword-target.store';

const OVERRIDE_TTL_MS = 60_000;
const OVERRIDE_CACHE_MAX = 5000;
const bad = (m: string): BadRequestException => new BadRequestException(seoError('SEO_INVALID', m));
const auditView = (r: TargetRow | null): unknown => (r ? { keyword: r.keyword, path: r.path, status: r.status, priority: r.priority, titleOverride: r.titleOverride, descriptionOverride: r.descriptionOverride, h1Override: r.h1Override } : null);

/** The page service reads staff overrides here: the ACTIVE targets of the exact page, the best one wins. Cached for a minute (and dropped by every write) so a page render adds no query. */
@Injectable()
export class DbPageOverrides extends SeoPageOverrides {
  clock: () => number = () => Date.now();
  private cache = new Map<string, { at: number; v: PageOverride | null }>();
  constructor(private readonly store: SeoKeywordTargetStore) { super(); }
  invalidate(): void { this.cache.clear(); }
  async forPath(path: string): Promise<PageOverride | null> {
    const now = this.clock(); const hit = this.cache.get(path);
    if (hit && now - hit.at < OVERRIDE_TTL_MS) return hit.v;
    const pick = pickOverride(await this.store.forPath(path));
    const v: PageOverride | null = pick ? { title: pick.title, description: pick.description, h1: pick.h1, keywordTargetId: pick.id } : null;
    if (this.cache.size >= OVERRIDE_CACHE_MAX) this.cache.clear();
    this.cache.set(path, { at: now, v });
    return v;
  }
}

/**
 * Keyword targets: which keyword a directory page is aimed at, and (for an ACTIVE target) the title, description and H1 staff wrote for it. Every staff write leaves an audit row and drops
 * the page-override cache. Nothing here deletes a row: a target that is no longer wanted is PAUSED.
 */
@Injectable()
export class SeoKeywordTargetService {
  constructor(
    private readonly store: SeoKeywordTargetStore, private readonly audit: SeoAudit, private readonly sitemaps: SeoSitemapService, private readonly keywords: SeoKeywordStore,
    private readonly directory: DirectorySettingsService, private readonly overrides: DbPageOverrides,
  ) {}

  list(q: TargetListQuery): Promise<{ items: TargetRow[]; total: number }> { return this.store.list(q); }

  async get(id: string): Promise<TargetRow> {
    const r = await this.store.get(String(id ?? '').slice(0, 40));
    if (!r) throw new NotFoundException(seoError('SEO_NOT_FOUND', 'That keyword target does not exist.'));
    return r;
  }

  async create(raw: Record<string, unknown>, actor: Actor): Promise<TargetRow> {
    const c = checkTarget(raw);
    if (!c.ok) throw bad(c.problem);
    const row = await this.store.create({ ...c.value, source: 'STAFF' }, actor.id);
    if (!row) throw new ConflictException(seoError('SEO_DUPLICATE', 'That keyword already has a target for that page.'));
    await this.audit.record(actor, 'seo.keyword_target.create', 'seo_keyword_target', row.id, null, auditView(row));
    this.overrides.invalidate();
    return row;
  }

  /** Edit. A field that is given replaces the stored one; an empty text clears an override (the only place a value is cleared). The keyword and path never change: make a new target. */
  async update(id: string, raw: Record<string, unknown>, actor: Actor): Promise<TargetRow> {
    const before = await this.get(id);
    for (const k of ['keyword', 'path'] as const) if (raw[k] !== undefined && String(raw[k]) !== before[k]) throw bad(`${k}: cannot change; create a new target instead`);
    const merged: Record<string, unknown> = { keyword: before.keyword, path: before.path, status: before.status, priority: before.priority, titleOverride: before.titleOverride, descriptionOverride: before.descriptionOverride, h1Override: before.h1Override, notes: before.notes, source: before.source };
    for (const k of ['status', 'priority', 'titleOverride', 'descriptionOverride', 'h1Override', 'notes'] as const) if (raw[k] !== undefined) merged[k] = raw[k];
    const c = checkTarget(merged);
    if (!c.ok) throw bad(c.problem);
    const patch: Partial<TargetInput> = { status: c.value.status, priority: c.value.priority, titleOverride: c.value.titleOverride, descriptionOverride: c.value.descriptionOverride, h1Override: c.value.h1Override, notes: c.value.notes };
    const after = await this.store.update(before.id, patch, actor.id);
    if (!after) throw new NotFoundException(seoError('SEO_NOT_FOUND', 'That keyword target does not exist.'));
    await this.audit.record(actor, 'seo.keyword_target.update', 'seo_keyword_target', after.id, auditView(before), auditView(after));
    this.overrides.invalidate();
    return after;
  }

  /** CSV import: a DRY RUN unless apply is true. Idempotent. One problem anywhere blocks the whole apply, and an apply is one transaction. */
  async importCsv(csv: string, o: { apply: boolean }, actor: Actor): Promise<TargetImportPlan & { applied: boolean }> {
    const existing = new Map((await this.store.all()).map((r) => [targetKey(r.keyword, r.path), r]));
    const plan = planTargetImport(csv, existing);
    const applied = o.apply && !plan.problems.length && (plan.create.length > 0 || plan.update.length > 0);
    if (applied) {
      await this.store.importApply({ create: plan.create, update: plan.update }, actor.id);
      await this.audit.record(actor, 'seo.keyword_target.import', 'seo_keyword_target', null, null, { created: plan.create.length, updated: plan.update.length, unchanged: plan.unchanged });
      this.overrides.invalidate();
    }
    return { ...plan, applied };
  }

  async exportCsv(status?: string): Promise<string> { return targetsToCsv(await this.store.all(status)); }

  /** The keyword plan: PLANNED rows for every listed city + category and locality + category page, as a CSV staff edit and import back. Nothing is stored by generating it. */
  async plan(): Promise<KeywordPlan & { csv: string }> {
    const [listing, kws] = await Promise.all([this.sitemaps.listing(), this.keywords.all()]);
    const synonyms = new Map(kws.filter((k) => k.synonyms.length).map((k) => [k.categorySlug, k.synonyms]));
    const plan = generateKeywordPlan(listing, { synonyms });
    return { ...plan, csv: targetsToCsv(plan.rows) };
  }

  /** The tracked link for a page. A keyword target id, when given, must exist and be for the same page. */
  async link(i: LinkInput): Promise<{ url: string; path: string }> {
    const r = buildTrackedLink(await this.directory.readPublicAppUrl(), i);
    if (!r.ok) throw bad(r.problem);
    if (i.keywordTargetId) {
      const t = await this.store.get(String(i.keywordTargetId).slice(0, 40));
      if (!t) throw bad('keywordTargetId: no such keyword target');
      if (t.path !== r.path) throw bad('keywordTargetId: that target is for another page');
    }
    return { url: r.url, path: r.path };
  }
}
