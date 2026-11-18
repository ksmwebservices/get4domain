import { Inject, Injectable } from '@nestjs/common';
import { evaluateListingPageIndexing } from './core/indexing';
import { badgesOf, siteStateOf, siteUrlOf } from './core/visits';
import { asPincode, categoriesForToken, CategoryTerms, categoryTerms, clampPage, mergeSponsored, nameRank, normaliseQuery, parseSuggestTypes, resolvePlaceText, SUGGEST_MAX } from './core/search';
import { BusinessRow, CategoryRow, DirectoryRepository, KeywordRow, LocationRow } from './directory.repository';
import {
  categoryTree, descendantIds, locationPath, locationTree, PublicBusinessView, PublicListItem, PublicSponsoredItem, publicBusinessView, resolveCategory, resolveLocation, sponsoredItem, TreeNode, ViewContext,
} from './directory-views';
import { DirectorySettings } from './settings/directory-settings';
import { DirectorySettingsService } from './settings/directory-settings.service';

const TREE_TTL_MS = 60_000;

/** Owner rule 6: a suspended listing is still listed, as the Free listing-only site it has become. Shown as the claimed or unclaimed listing it is; the stored status is not changed. */
const shownAs = (b: BusinessRow): BusinessRow => (b.status === 'SUSPENDED' ? { ...b, status: b.claimedAt ? 'CLAIMED' : 'UNCLAIMED' } : b);

/** The words each category answers to (name, parents, staff-reviewed keywords): built with the trees, so a search never reads the keyword table per request. */
function buildTerms(cat: readonly CategoryRow[], kw: readonly KeywordRow[]): CategoryTerms[] {
  const byId = new Map(cat.map((c) => [c.id, c]));
  const kwBySlug = new Map(kw.map((k) => [k.categorySlug, k]));
  return cat.map((c) => {
    const ancestors: string[] = []; let cur = c.parentId ? byId.get(c.parentId) : undefined; let g = 0;
    while (cur && g++ < 10) { ancestors.push(cur.name); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    return categoryTerms({ id: c.id, name: c.name, slug: c.slug, ancestors, keywords: kwBySlug.get(c.slug) ?? null });
  });
}

export interface ListQuery { location?: string; category?: string; q?: string; page?: unknown; pageSize?: unknown }
export interface ListResult { items: PublicListItem[]; page: number; pageSize: number; total: number; filters: { location: string | null; category: string | null; q: string; /** B3.5: typed place text that matched no place */ locationUnknown?: boolean }; indexable: boolean }
export interface SuggestResult { q: string; categories: Array<{ slug: string; name: string; kind: 'category' | 'subcategory'; parent: string | null }>; places: Array<{ slug: string; name: string; kind: string; path: string; label: string }>; businesses: Array<{ id: string; slug: string; name: string; category: string | null; city: string | null }> }

/**
 * The public, read-only side of the directory. Never exposes an email, an owner name, an internal id, a vendor id or a staff field, and shows an UNCLAIMED business's private data
 * to nobody (see publicBusinessView). Organic order is relevance, then name; sponsored items are inserted at fixed positions and always carry their label.
 */
@Injectable()
export class DirectoryReadService {
  clock: () => Date = () => new Date();
  private trees: { at: number; loc: LocationRow[]; cat: CategoryRow[]; terms: CategoryTerms[] } | null = null;

  constructor(private readonly repo: DirectoryRepository, @Inject(DirectorySettingsService) private readonly settings: Pick<DirectorySettingsService, 'get'>) {}

  invalidate(): void { this.trees = null; }

  private async loadTrees(): Promise<{ loc: LocationRow[]; cat: CategoryRow[]; terms: CategoryTerms[] }> {
    const now = this.clock().getTime();
    if (!this.trees || now - this.trees.at >= TREE_TTL_MS) {
      const [loc, cat, kw] = await Promise.all([this.repo.listLocations(), this.repo.listCategories(), this.repo.listCategoryKeywords()]);
      this.trees = { at: now, loc, cat, terms: buildTerms(cat, kw) };
    }
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
    // B3.5: the place is a slug path as before, or typed text ("Adyar", "Adyar Chennai"), or a six digit postal code
    const typed = q.location ? String(q.location).trim() : '';
    const pincode = typed ? asPincode(typed) : null;
    let loc = typed && !pincode ? resolveLocation(t.loc, typed) : null;
    let locIds: string[] | null = loc ? descendantIds(t.loc, loc.id) : null;
    let locSlug: string | null = loc ? loc.slug : null;
    if (typed && !pincode && !loc) {
      const hits = resolvePlaceText(t.loc, typed);
      if (hits.length) { locIds = [...new Set(hits.flatMap((h) => descendantIds(t.loc, h.id)))]; locSlug = hits.length === 1 ? hits[0].slug : typed.slice(0, 100); loc = hits[0] as LocationRow; }
    }
    const cat = q.category ? resolveCategory(t.cat, String(q.category)) : null;
    const norm = normaliseQuery(q.q);
    const placeUnknown = !!typed && !pincode && !loc;
    const empty = (): ListResult => ({ items: [], page, pageSize, total: 0, filters: { location: typed ? typed.slice(0, 100) : null, category: q.category ? String(q.category).slice(0, 100) : null, q: norm.text, ...(placeUnknown ? { locationUnknown: true } : {}) }, indexable: false });
    if (placeUnknown || (q.category && !cat)) return empty();   // an unknown filter is an empty result, not an error and not "everything"
    const scope = { ...(locIds ? { locationIds: locIds } : {}), ...(pincode ? { pincode } : {}), ...(cat ? { categoryIds: descendantIds(t.cat, cat.id) } : {}) };
    const tokenCategoryIds = norm.tokens.map((tk) => categoriesForToken(tk, t.terms).flatMap((id) => descendantIds(t.cat, id)));
    const { items, total } = await this.repo.search({ tokens: norm.tokens, text: norm.text, tokenCategoryIds, ...scope, skip, take: pageSize });
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
      // the merge keys on the slug; the views themselves (which now carry the business id) are put back untouched
      const original = new Map<string, PublicListItem>([...organic, ...sponsored].map((v) => [v.slug, v]));
      merged = out.map((x) => original.get(x.id)!);
    }
    const whole = loc || cat || pincode ? await this.repo.countPublic(scope) : total;
    return { items: merged, page, pageSize, total, filters: { location: pincode ?? locSlug, category: cat ? cat.slug : null, q: norm.text }, indexable: !norm.text && evaluateListingPageIndexing(whole, s.directoryThinPageMinBusinesses).indexable };
  }

  /**
   * B3.5: suggestions while typing: categories (with sub categories and their keywords), places and business names, at most 8 of each. Categories and places come from the cached trees
   * (no query); business names are one indexed prefix query. Public data only; the text is normalised first and never reaches SQL as anything but a parameter.
   */
  async suggest(qIn: unknown, typesIn: unknown, limitIn: unknown): Promise<SuggestResult> {
    const norm = normaliseQuery(qIn);
    const types = parseSuggestTypes(typesIn);
    const n = Number(limitIn); const limit = Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), SUGGEST_MAX) : SUGGEST_MAX;
    const out: SuggestResult = { q: norm.text, categories: [], places: [], businesses: [] };
    if (norm.text.length < 2) return out;
    const t = await this.loadTrees();
    if (types.includes('category')) {
      const byId = new Map(t.cat.map((c) => [c.id, c]));
      const ranked = t.cat.map((c) => { const terms = t.terms.find((x) => x.id === c.id); const r = nameRank(c.name, norm.text) ?? (terms && norm.tokens.every((tk) => terms.all.some((w) => w.startsWith(tk))) ? 2 : null); return r === null ? null : { c, r }; }).filter((x): x is { c: CategoryRow; r: number } => !!x);
      ranked.sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name));
      out.categories = ranked.slice(0, limit).map(({ c }) => ({ slug: c.slug, name: c.name, kind: c.parentId ? 'subcategory' as const : 'category' as const, parent: c.parentId ? byId.get(c.parentId)?.name ?? null : null }));
    }
    if (types.includes('place')) {
      const hits = t.loc.map((l) => { const r = nameRank(l.name, norm.text); return r === null ? null : { l, r }; }).filter((x): x is { l: LocationRow; r: number } => !!x);
      hits.sort((a, b) => a.r - b.r || locationPath(t.loc, a.l.id).length - locationPath(t.loc, b.l.id).length || a.l.name.localeCompare(b.l.name));
      out.places = hits.slice(0, limit).map(({ l }) => { const path = locationPath(t.loc, l.id); return { slug: l.slug, name: l.name, kind: l.kind, path: path.map((p) => p.slug).join('/'), label: path.slice(-2).reverse().map((p) => p.name).join(', ') }; });
    }
    if (types.includes('business')) {
      const rows = await this.repo.suggestBusinesses(norm.text, limit);
      out.businesses = rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, category: r.categoryName, city: r.city }));
    }
    return out;
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
