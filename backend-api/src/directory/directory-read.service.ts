import { Inject, Injectable } from '@nestjs/common';
import { evaluateListingPageIndexing } from './core/indexing';
import { badgesOf, siteStateOf, siteUrlOf } from './core/visits';
import { clampPage, mergeSponsored, normaliseQuery } from './core/search';
import { BusinessRow, CategoryRow, DirectoryRepository, LocationRow } from './directory.repository';
import {
  categoryTree, descendantIds, locationPath, locationTree, PublicBusinessView, PublicListItem, PublicSponsoredItem, publicBusinessView, resolveCategory, resolveLocation, sponsoredItem, TreeNode, ViewContext,
} from './directory-views';
import { DirectorySettings } from './settings/directory-settings';
import { DirectorySettingsService } from './settings/directory-settings.service';

const TREE_TTL_MS = 60_000;

/** Owner rule 6: a suspended listing is still listed, as the Free listing-only site it has become. Shown as the claimed or unclaimed listing it is; the stored status is not changed. */
const shownAs = (b: BusinessRow): BusinessRow => (b.status === 'SUSPENDED' ? { ...b, status: b.claimedAt ? 'CLAIMED' : 'UNCLAIMED' } : b);

export interface ListQuery { location?: string; category?: string; q?: string; page?: unknown; pageSize?: unknown }
export interface ListResult { items: PublicListItem[]; page: number; pageSize: number; total: number; filters: { location: string | null; category: string | null; q: string }; indexable: boolean }

/**
 * The public, read-only side of the directory. Never exposes an email, an owner name, an internal id, a vendor id or a staff field, and shows an UNCLAIMED business's private data
 * to nobody (see publicBusinessView). Organic order is relevance, then name; sponsored items are inserted at fixed positions and always carry their label.
 */
@Injectable()
export class DirectoryReadService {
  clock: () => Date = () => new Date();
  private trees: { at: number; loc: LocationRow[]; cat: CategoryRow[] } | null = null;

  constructor(private readonly repo: DirectoryRepository, @Inject(DirectorySettingsService) private readonly settings: Pick<DirectorySettingsService, 'get'>) {}

  invalidate(): void { this.trees = null; }

  private async loadTrees(): Promise<{ loc: LocationRow[]; cat: CategoryRow[] }> {
    const now = this.clock().getTime();
    if (!this.trees || now - this.trees.at >= TREE_TTL_MS) this.trees = { at: now, loc: await this.repo.listLocations(), cat: await this.repo.listCategories() };
    return this.trees;
  }

  async locations(): Promise<TreeNode[]> { return locationTree((await this.loadTrees()).loc); }
  async categories(): Promise<TreeNode[]> { return categoryTree((await this.loadTrees()).cat); }

  /** The business own site: its subdomain address (never a custom domain: the directory links the subdomain), its state and badges. One query for many businesses. */
  private async siteContexts(businesses: BusinessRow[]): Promise<Map<string, NonNullable<ViewContext['site']>>> {
    const out = new Map<string, NonNullable<ViewContext['site']>>();
    const ids = [...new Set(businesses.map((b) => b.vendorId).filter((x): x is string => !!x))];
    const facts = await this.repo.siteFacts(ids, this.clock());
    const base = process.env.SITE_BASE_DOMAIN || 'get4domain.com';
    for (const b of businesses) {
      const f = b.vendorId ? facts.get(b.vendorId) ?? null : null;
      out.set(b.id, { siteUrl: siteUrlOf(f, base), siteState: siteStateOf(b.status, f), badges: badgesOf(b.status, f) });
    }
    return out;
  }

  private async context(b: BusinessRow, withExtras: boolean, t: { loc: LocationRow[]; cat: CategoryRow[] }, site?: ViewContext['site']): Promise<ViewContext> {
    const cat = t.cat.find((c) => c.id === b.categoryId) ?? null;
    return { site, category: cat ? { slug: cat.slug, name: cat.name } : null, location: locationPath(t.loc, b.locationId), services: withExtras ? await this.repo.getServices(b.id) : [], media: withExtras ? await this.repo.getMedia(b.id) : [] };
  }

  async list(q: ListQuery): Promise<ListResult> {
    const s: DirectorySettings = await this.settings.get();
    const t = await this.loadTrees();
    const { page, pageSize, skip } = clampPage(q.page, q.pageSize, s.directoryPageSizeMax, s.directoryPageSizeDefault);
    const loc = q.location ? resolveLocation(t.loc, String(q.location)) : null;
    const cat = q.category ? resolveCategory(t.cat, String(q.category)) : null;
    const norm = normaliseQuery(q.q);
    const empty = (): ListResult => ({ items: [], page, pageSize, total: 0, filters: { location: q.location ? String(q.location).slice(0, 100) : null, category: q.category ? String(q.category).slice(0, 100) : null, q: norm.text }, indexable: false });
    if ((q.location && !loc) || (q.category && !cat)) return empty();   // an unknown filter is an empty result, not an error and not "everything"
    const scope = { ...(loc ? { locationIds: descendantIds(t.loc, loc.id) } : {}), ...(cat ? { categoryIds: descendantIds(t.cat, cat.id) } : {}) };
    const { items, total } = await this.repo.search({ tokens: norm.tokens, text: norm.text, ...scope, skip, take: pageSize });
    const organic: PublicBusinessView[] = [];
    const shownItems = items.map(shownAs);
    const sitesOf = await this.siteContexts(shownItems);
    for (const b of shownItems) organic.push(publicBusinessView(b, await this.context(b, false, t, sitesOf.get(b.id))));
    let merged: PublicListItem[] = organic;
    if (page === 1 && organic.length) {
      const wanted = Math.ceil(organic.length / s.directorySponsoredEvery);
      const placements = await this.repo.activePlacements(this.clock(), scope, wanted);
      const onPage = new Set(organic.map((o) => o.slug));
      const sponsored: PublicSponsoredItem[] = [];
      const sponsoredSites = await this.siteContexts(placements.map((p) => p.business));
      for (const p of placements) if (!onPage.has(p.business.slug)) sponsored.push(sponsoredItem(publicBusinessView(p.business, await this.context(p.business, false, t, sponsoredSites.get(p.business.id))), p.placement));
      const out = mergeSponsored(organic.map((o) => ({ ...o, id: o.slug, sponsored: false as const })), sponsored.map((x) => ({ ...x, id: x.slug, sponsored: true as const })), s.directorySponsoredEvery);
      merged = out.map((x) => { const { id: _id, ...rest } = x; return rest as PublicListItem; });
    }
    const whole = loc || cat ? await this.repo.countPublic(scope) : total;
    return { items: merged, page, pageSize, total, filters: { location: loc ? loc.slug : null, category: cat ? cat.slug : null, q: norm.text }, indexable: !norm.text && evaluateListingPageIndexing(whole, s.directoryThinPageMinBusinesses).indexable };
  }

  /** null = unknown or not public (draft, suspended): the same answer. `gone` = removed: the API answers 410. */
  async detail(slug: string): Promise<{ gone: true } | { gone: false; business: PublicBusinessView } | null> {
    const key = String(slug ?? '').trim().toLowerCase().slice(0, 80);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key)) return null;
    const b = await this.repo.getBusinessBySlug(key);
    if (!b) return null;
    if (b.status === 'REMOVED') return { gone: true };
    if (b.status !== 'CLAIMED' && b.status !== 'UNCLAIMED' && b.status !== 'SUSPENDED') return null;
    const shown = shownAs(b);
    const t = await this.loadTrees();
    return { gone: false, business: publicBusinessView(shown, await this.context(shown, shown.status === 'CLAIMED', t, (await this.siteContexts([shown])).get(shown.id))) };
  }

  /** Paged business URLs for the sitemap: indexable and public only (removed, suspended, draft and noindex businesses never appear). */
  async sitemapData(page: unknown, pageSize: unknown): Promise<{ items: Array<{ slug: string; lastmod: string }>; page: number; pageSize: number; total: number }> {
    const s = await this.settings.get();
    const p = clampPage(page, pageSize, Math.max(s.directoryPageSizeMax, 100), 100);
    const { items, total } = await this.repo.sitemapPage(p.skip, p.pageSize);
    return { items: items.map((i) => ({ slug: i.slug, lastmod: i.updatedAt.toISOString() })), page: p.page, pageSize: p.pageSize, total };
  }
}
