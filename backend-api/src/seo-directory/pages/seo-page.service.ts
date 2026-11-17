import { Injectable } from '@nestjs/common';
import { evaluateListingPageIndexing } from '../../directory/core/indexing';
import { clampPage } from '../../directory/core/search';
import { badgesOf, siteUrlOf } from '../../directory/core/visits';
import { DirectoryRepository, LocationRow } from '../../directory/directory.repository';
import { descendantIds } from '../../directory/directory-views';
import { DirectorySettings } from '../../directory/settings/directory-settings';
import { DirectorySettingsService } from '../../directory/settings/directory-settings.service';
import { SeoKeywordStore } from '../keywords/seo-keyword.store';
import { SeoSettingsService } from '../settings/seo-settings.service';
import {
  BusinessFacts, Card, CLAIM_ANSWER, Crumb, Facet, FaqItem, Link, listNames, NoindexReason, PageModel, paginate, ROBOTS_INDEX, ROBOTS_NOINDEX, breadcrumbList, collectionJsonLd, hoursTextOf, localBusinessJsonLd,
  plural as pluralFn, shortDescription, takeLinks,
} from '../core/page-model';
import { buildDescription, buildH1, buildTitle, cutWords, H1_MAX, SeoVars } from '../core/template-engine';
import { PageSpec, buildPath, canonicalOrigin, clickOutUrl, directoryBase, parsePath, splitTail, withPageNumber } from '../core/url-scheme';
import { publicStateOf } from '../../directory/core/listing-state';
import { loadPlaces, Places, CatInfo } from './places';
import { FacetCounts, ListedBusiness, Scope, SeoDirectoryData } from './seo-directory.data';

export type PageResult = { kind: 'ok'; model: PageModel } | { kind: 'gone' } | { kind: 'notFound' };
/** Staff overrides for one page (keyword targets, slice 5): applied over the template result, still capped. */
export interface PageOverride { title?: string | null; description?: string | null; h1?: string | null; keywordTargetId?: string | null }
export abstract class SeoPageOverrides { abstract forPath(path: string): Promise<PageOverride | null> }

const TTL_MS = 60_000;
const FACET_MAX = 50;
const LINK_MAX = 8;


/** Each place with the number of listed businesses in it and below it. Pure. */
export function rollUp(locs: readonly LocationRow[], byLocation: ReadonlyMap<string, number>): Map<string, number> {
  const by = new Map(locs.map((l) => [l.id, l]));
  const out = new Map<string, number>();
  for (const [id, n] of byLocation) {
    let cur = by.get(id); let guard = 0;
    while (cur && guard++ < 10) { out.set(cur.id, (out.get(cur.id) ?? 0) + n); cur = cur.parentId ? by.get(cur.parentId) : undefined; }
  }
  return out;
}

@Injectable()
export class SeoPageService {
  clock: () => number = () => Date.now();
  private cache: { at: number; v: Places } | null = null;

  constructor(
    private readonly data: SeoDirectoryData, private readonly repo: DirectoryRepository, private readonly settings: DirectorySettingsService,
    private readonly keywords: SeoKeywordStore, private readonly templates: SeoSettingsService, private readonly overrides: SeoPageOverrides,
  ) {}

  invalidate(): void { this.cache = null; }

  private async places(): Promise<Places> {
    const now = this.clock();
    if (this.cache && now - this.cache.at < TTL_MS) return this.cache.v;
    const v = await loadPlaces(this.repo, this.keywords);
    this.cache = { at: now, v };
    return v;
  }

  /** A path to a page model. 404 for anything unknown; 410 for a removed business. */
  async resolve(path: string): Promise<PageResult> {
    const parsed = parsePath(path);
    if (!parsed) return { kind: 'notFound' };
    const pl = await this.places();
    if (parsed.type !== 'cityRest') return this.model(parsed);
    // "/{city}/{rest}": a category on its own, or a category in a locality
    for (const { term, locality } of splitTail(parsed.rest)) {
      const cat = this.catByTerm(pl, term);
      if (!cat) continue;
      return this.model(locality === null ? { type: 'cityCategory', city: parsed.city, term: cat.pluralSlug, page: parsed.page } : { type: 'localityCategory', city: parsed.city, locality, term: cat.pluralSlug, page: parsed.page });
    }
    return { kind: 'notFound' };
  }

  private catByTerm(pl: Places, term: string): CatInfo | null {
    const all = [...pl.catInfo.values()].sort((a, b) => a.row.sortOrder - b.row.sortOrder || a.row.name.localeCompare(b.row.name));
    return all.find((c) => c.pluralSlug === term) ?? all.find((c) => c.singularSlug === term) ?? all.find((c) => c.row.slug === term) ?? null;
  }
  private placeBySlug(pl: Places, slug: string, kinds: string[], under?: LocationRow): LocationRow | null {
    const pool = under ? new Set(descendantIds(pl.locs, under.id)) : null;
    return pl.locs.filter((l) => l.slug === slug && kinds.includes(l.kind) && (!pool || pool.has(l.id))).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))[0] ?? null;
  }
  private ancestors(pl: Places, id: string | null): LocationRow[] {
    const out: LocationRow[] = []; let cur = id ? pl.locs.find((l) => l.id === id) : undefined; let g = 0;
    while (cur && g++ < 10) { out.unshift(cur); cur = cur.parentId ? pl.locs.find((l) => l.id === cur!.parentId) : undefined; }
    return out;
  }

  async model(spec: PageSpec): Promise<PageResult> {
    const [s, tpl, pl] = await Promise.all([this.settings.get(), this.templates.templates(), this.places()]);
    const base = directoryBase(process.env, canonicalOrigin(await this.settings.readPublicAppUrl()));   // Wave 3 Part J: the directory's own host when DIRECTORY_PUBLIC_BASE_URL is set
    const origin = base.origin;
    const mainOrigin = canonicalOrigin(await this.settings.readPublicAppUrl());   // Wave 4: the brand (first crumb, the Get4Domain WebSite and Organization) stays on the MAIN host even when the directory has its own
    const { page, pageSize, skip } = clampPage('page' in spec ? spec.page : 1, undefined, s.directoryPageSizeMax, s.directoryPageSizeDefault);
    const path = buildPath(spec);
    const ctx = { s, tpl, pl, origin, mainOrigin, page, pageSize, skip, path, homePath: base.homePath };
    switch (spec.type) {
      case 'home': return this.home(spec, ctx);
      case 'business': return this.business(spec, ctx);
      default: return this.listing(spec, ctx);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────── shared pieces
  private robots(indexable: boolean): string { return indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX; }

  private listingIndexing(s: DirectorySettings, total: number): { indexable: boolean; reason: NoindexReason | null } {
    if (!s.directoryPagesIndexable) return { indexable: false, reason: 'FLAG_OFF' };
    if (total === 0) return { indexable: false, reason: 'EMPTY' };
    const t = evaluateListingPageIndexing(total, s.directoryThinPageMinBusinesses);
    return t.indexable ? { indexable: true, reason: null } : { indexable: false, reason: 'THIN' };
  }

  private async cards(items: ListedBusiness[], ctx: Ctx, srcType: string, kw: string | null): Promise<Card[]> {
    const facts = await this.repo.siteFacts([...new Set(items.map((b) => b.vendorId).filter((x): x is string => !!x))], new Date(this.clock()));
    const base = process.env.SITE_BASE_DOMAIN || 'get4domain.com'; const api = process.env.PUBLIC_API_URL ?? '';
    return items.map((b) => {
      const f = b.vendorId ? facts.get(b.vendorId) ?? null : null;
      const hasSite = !!siteUrlOf(f, base);
      const status = b.status === 'SUSPENDED' ? (b.claimed ? 'CLAIMED' : 'UNCLAIMED') : b.status;   // owner rule 6: a suspended listing is still shown as the listing it is
      const info = ctx.pl.catInfo.get(b.categoryId); const loc = b.locationId ? ctx.pl.locs.find((l) => l.id === b.locationId) : null;
      return {
        name: b.name, slug: b.slug, profilePath: buildPath({ type: 'business', slug: b.slug }), locality: loc?.name ?? null, category: info?.singular ?? null, description: shortDescription(b.descriptionText),
        claimed: b.claimed, verified: badgesOf(status, f).includes('VERIFIED'), hoursText: b.claimed ? hoursTextOf(b.hours) : null, imageUrl: b.claimed ? b.imageUrl : null,
        visitUrl: hasSite ? clickOutUrl(api, b.id, { src: srcType, kw }) : null, listingOnly: !hasSite,
      };
    });
  }

  /** The brand crumb is the MAIN site's home; every other crumb is a directory page, so it is built on the directory origin. With no separate directory host the two origins are the same. */
  private crumbsOf(ctx: Pick<Ctx, 'origin' | 'mainOrigin'>, items: Array<{ name: string; path: string }>): Crumb[] {
    return [{ name: 'Get4Domain', path: '/', url: `${ctx.mainOrigin}/` }, ...items.map((c) => ({ ...c, url: `${ctx.origin}${c.path}` }))];
  }

  private faq(parts: { count?: number; countQ?: string; countA?: string; listQ?: string; listA?: string; claim: boolean }): FaqItem[] {
    const out: FaqItem[] = [];
    if (parts.countQ && parts.countA) out.push({ question: parts.countQ, answer: parts.countA });
    if (parts.listQ && parts.listA) out.push({ question: parts.listQ, answer: parts.listA });
    if (parts.claim) out.push({ question: 'How do I claim a listing?', answer: CLAIM_ANSWER });
    return out;
  }

  private async finish(spec: PageSpec, ctx: Ctx, m: Omit<PageModel, 'meta' | 'h1' | 'path' | 'type' | 'page' | 'jsonLd'> & { over?: PageOverride | null; vars: SeoVars; templateType: keyof Ctx['tpl']; total: number; indexing: { indexable: boolean; reason: NoindexReason | null }; jsonLdExtra?: Array<Record<string, unknown>>; collection?: boolean; paged?: boolean }): Promise<PageResult> {
    const t = ctx.tpl[m.templateType]; const n = ctx.page;
    const over = m.over !== undefined ? m.over : await this.overrides.forPath(buildPath(withPageNumber(spec, 1)));
    const descCands = (over?.description ? [over.description] : t.description).map((c) => (n >= 2 ? `${c.replace(/[.\s]+$/u, '')}. Page ${n}.` : c));
    const title = over?.title ? buildTitle([over.title], {}, { page: n }) : buildTitle(t.title, m.vars, { page: n });
    const description = buildDescription(descCands, m.vars);
    const h1Base = over?.h1 ? buildH1([over.h1], {}) : buildH1(t.h1, m.vars);
    const h1 = n >= 2 ? `${cutWords(h1Base, H1_MAX - ` - Page ${n}`.length)} - Page ${n}` : h1Base;   // the page marker always fits inside the H1 cap
    const canonical = `${ctx.origin}${ctx.path}`;
    const pagination = m.paged ? paginate(spec, m.total, ctx.pageSize, n, ctx.origin) : null;
    const jsonLd: Array<Record<string, unknown>> = [
      ...(m.collection ? [collectionJsonLd({ name: h1, description, url: canonical, origin: ctx.origin, mainOrigin: ctx.mainOrigin, cards: m.cards, firstPosition: ctx.skip + 1 })] : []),
      ...(m.jsonLdExtra ?? []), breadcrumbList(m.breadcrumbs),
    ];
    const { over: _o, vars: _v, templateType: _t, total: _tot, indexing, jsonLdExtra: _j, collection: _c, paged: _p, ...rest } = m;
    return { kind: 'ok', model: { type: spec.type, path: ctx.path, page: pagination, meta: { title, description, canonical, robots: this.robots(indexing.indexable), indexable: indexing.indexable, noindexReason: indexing.reason, hreflang: [] }, h1, jsonLd, ...rest } };
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────── home
  private async home(spec: PageSpec, ctx: Ctx): Promise<PageResult> {
    const f = await this.data.facets({});
    const total = [...f.byCategory.values()].reduce((a, b) => a + b, 0);
    const rolled = rollUp(ctx.pl.locs, f.byLocation);
    const cities = ctx.pl.locs.filter((l) => l.kind === 'CITY' && (rolled.get(l.id) ?? 0) > 0).sort((a, b) => (rolled.get(b.id) ?? 0) - (rolled.get(a.id) ?? 0) || a.name.localeCompare(b.name));
    const cats = this.topCategories(ctx.pl, f.byCategory);
    const cityLinks: Link[] = takeLinks(cities.map((c) => ({ name: c.name, path: buildPath({ type: 'city', city: c.slug, page: 1 }), count: rolled.get(c.id) })), FACET_MAX);
    const catLinks: Link[] = takeLinks(cats.map((c) => ({ name: c.info.plural, path: buildPath({ type: 'category', category: c.info.row.slug, page: 1 }), count: c.n })), FACET_MAX);
    const intro = total ? `Get4Domain lists ${total} ${pluralFn(total, 'business', 'businesses')}${cityLinks.length ? ` in ${cityLinks.length} ${pluralFn(cityLinks.length, 'city', 'cities')}` : ''}, with their addresses, services and websites.` : 'Get4Domain is a directory of local businesses and their websites.';
    // G11: the directory home is served at /directory, so its model and its canonical say /directory (the site root is the marketing home)
    return this.finish(spec, { ...ctx, path: ctx.homePath }, {
      vars: { count: total }, templateType: 'home', total, indexing: { indexable: ctx.s.directoryPagesIndexable, reason: ctx.s.directoryPagesIndexable ? null : 'FLAG_OFF' }, intro, breadcrumbs: this.crumbsOf(ctx, []),
      cards: [], facets: [{ kind: 'city', items: cityLinks }, { kind: 'category', items: catLinks }], related: { nearbyLocalities: [], relatedCategories: [], parents: [] },
      faq: this.faq({ countQ: total ? 'How many businesses are listed on Get4Domain?' : undefined, countA: total ? `${total} ${pluralFn(total, 'business is', 'businesses are')} listed on Get4Domain.` : undefined, listQ: cityLinks.length ? 'Which cities are covered?' : undefined, listA: cityLinks.length ? `${listNames(cityLinks.map((c) => c.name), 8)}.` : undefined, claim: true }),
      jsonLdExtra: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Get4Domain', url: ctx.mainOrigin, publisher: { '@type': 'Organization', name: 'Get4Domain', url: ctx.mainOrigin } }], collection: false, paged: false,
    });
  }

  private topCategories(pl: Places, byCategory: ReadonlyMap<string, number>): Array<{ info: CatInfo; n: number }> {
    return [...byCategory].map(([id, n]) => ({ info: pl.catInfo.get(id), n })).filter((x): x is { info: CatInfo; n: number } => !!x.info).sort((a, b) => b.n - a.n || a.info.plural.localeCompare(b.info.plural));
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────── the listing pages
  private async listing(spec: Exclude<PageSpec, { type: 'home' } | { type: 'business' }>, ctx: Ctx): Promise<PageResult> {
    const { pl } = ctx;
    let scope: Scope = {}; let state: LocationRow | null = null; let city: LocationRow | null = null; let locality: LocationRow | null = null; let cat: CatInfo | null = null; let pincode: string | undefined;
    if (spec.type === 'state') { state = this.placeBySlug(pl, spec.state, ['STATE']); if (!state) return { kind: 'notFound' }; scope = { locationIds: descendantIds(pl.locs, state.id) }; }
    if (spec.type === 'city' || spec.type === 'cityCategory' || spec.type === 'localityCategory') {
      city = this.placeBySlug(pl, spec.city, ['CITY', 'DISTRICT']); if (!city) return { kind: 'notFound' };
      scope = { locationIds: descendantIds(pl.locs, city.id) };
      if (spec.type === 'localityCategory') { locality = this.placeBySlug(pl, spec.locality, ['LOCALITY'], city); if (!locality) return { kind: 'notFound' }; scope = { locationIds: [locality.id] }; }
    }
    if (spec.type === 'category' || spec.type === 'pincodeCategory') { const row = pl.cats.find((c) => c.slug === spec.category); cat = row ? pl.catInfo.get(row.id) ?? null : null; if (!cat) return { kind: 'notFound' }; }
    if (spec.type === 'cityCategory' || spec.type === 'localityCategory') { cat = this.catByTerm(pl, spec.term); if (!cat) return { kind: 'notFound' }; if (cat.pluralSlug !== spec.term) return { kind: 'notFound' }; }
    if (cat) scope = { ...scope, categoryIds: descendantIds(pl.cats, cat.row.id) };
    if (spec.type === 'pincodeCategory') { pincode = spec.pincode; scope = { ...scope, pincode }; }

    const { items, total } = await this.data.businesses(scope, ctx.skip, ctx.pageSize);
    if (ctx.page > 1 && ctx.skip >= total) return { kind: 'notFound' };
    if (spec.type === 'pincodeCategory' && total === 0) return { kind: 'notFound' };   // never an endless space of empty pincode pages
    const facets = await this.data.facets(scope);
    // the siblings of a locality are counted at the city, not inside the page's own locality: city + this category (localities) and city alone (related categories)
    let cityWide: { withCat: FacetCounts; allCats: FacetCounts } | null = null;
    if ((spec.type === 'cityCategory' || spec.type === 'localityCategory') && city && cat) {
      const cityIds = descendantIds(pl.locs, city.id);
      cityWide = { withCat: spec.type === 'cityCategory' ? facets : await this.data.facets({ locationIds: cityIds, categoryIds: descendantIds(pl.cats, cat.row.id) }), allCats: await this.data.facets({ locationIds: cityIds }) };
    }
    const cityName = city?.name ?? (pincode ? this.cityOfPincode(pl, items) : undefined);
    const vars: SeoVars = { count: total, ...(cat ? { categoryPlural: cat.plural, category: cat.singular } : {}), ...(locality ? { locality: locality.name } : {}), ...(cityName ? { city: cityName } : {}), ...(state ? { state: state.name } : {}), ...(pincode ? { pincode } : {}) };
    const built = this.buildFacets(spec, ctx, { city, cat, locality, state, facets, scope, cityWide });
    const crumbs = this.crumbs(spec, ctx, { city, cat, locality, state, cityName });
    const indexing = this.listingIndexing(ctx.s, total);
    const over = await this.overrides.forPath(buildPath(withPageNumber(spec, 1)));
    const kw: string | null = over?.keywordTargetId ?? null;   // slice 5: the click-out of a card names the keyword target of this page
    return this.finish(spec, ctx, {
      over, vars, templateType: spec.type, total, indexing,
      intro: this.intro(spec, { total, cat, locality, city, state, pincode, built }), breadcrumbs: crumbs, cards: await this.cards(items, ctx, spec.type, kw), facets: built.facets,
      related: { nearbyLocalities: built.nearby, relatedCategories: built.relatedCats, parents: crumbs.slice(0, -1).map((c) => ({ name: c.name, path: c.path })) },
      faq: this.listingFaq(spec, { total, cat, locality, city, state, pincode, built }), collection: true, paged: true,
    });
  }

  private cityOfPincode(pl: Places, items: ListedBusiness[]): string | undefined {
    const withLoc = items.find((b) => b.locationId); if (!withLoc) return undefined;
    const chain = this.ancestors(pl, withLoc.locationId);
    return (chain.find((l) => l.kind === 'CITY') ?? chain.find((l) => l.kind === 'DISTRICT'))?.name;
  }

  private crumbs(spec: PageSpec, ctx: Ctx, o: { city: LocationRow | null; cat: CatInfo | null; locality: LocationRow | null; state: LocationRow | null; cityName?: string }): Crumb[] {
    const items: Array<{ name: string; path: string }> = [];
    if (o.state) items.push({ name: o.state.name, path: buildPath({ type: 'state', state: o.state.slug, page: 1 }) });
    if (o.city) items.push({ name: o.city.name, path: buildPath({ type: 'city', city: o.city.slug, page: 1 }) });
    if (spec.type === 'category') items.push({ name: o.cat!.plural, path: buildPath({ type: 'category', category: o.cat!.row.slug, page: 1 }) });
    if (spec.type === 'cityCategory' || spec.type === 'localityCategory') items.push({ name: `${o.cat!.plural} in ${o.city!.name}`, path: buildPath({ type: 'cityCategory', city: o.city!.slug, term: o.cat!.pluralSlug, page: 1 }) });
    if (spec.type === 'localityCategory') items.push({ name: `${o.cat!.plural} in ${o.locality!.name}`, path: buildPath({ type: 'localityCategory', city: o.city!.slug, locality: o.locality!.slug, term: o.cat!.pluralSlug, page: 1 }) });
    if (spec.type === 'pincodeCategory') { items.push({ name: o.cat!.plural, path: buildPath({ type: 'category', category: o.cat!.row.slug, page: 1 }) }); items.push({ name: `${o.cat!.plural} in ${spec.pincode}`, path: buildPath({ type: 'pincodeCategory', pincode: spec.pincode, category: o.cat!.row.slug, page: 1 }) }); }
    return this.crumbsOf(ctx, items);
  }

  private buildFacets(spec: PageSpec, ctx: Ctx, o: { city: LocationRow | null; cat: CatInfo | null; locality: LocationRow | null; state: LocationRow | null; facets: FacetCounts; scope: Scope; cityWide: { withCat: FacetCounts; allCats: FacetCounts } | null }): { facets: Facet[]; nearby: Link[]; relatedCats: Link[]; localityNames: string[]; cityNames: string[]; catNames: string[] } {
    const { pl } = ctx; const f = o.facets; const rolled = rollUp(pl.locs, (o.cityWide ?? { withCat: f }).withCat.byLocation);
    const out: Facet[] = []; let nearby: Link[] = []; let relatedCats: Link[] = [];
    const placesWith = (kind: string, under: LocationRow | null): LocationRow[] => {
      const pool = under ? new Set(descendantIds(pl.locs, under.id)) : null;
      return pl.locs.filter((l) => l.kind === kind && (!pool || pool.has(l.id)) && (rolled.get(l.id) ?? 0) > 0).sort((a, b) => (rolled.get(b.id) ?? 0) - (rolled.get(a.id) ?? 0) || a.name.localeCompare(b.name));
    };
    const cats = this.topCategories(pl, f.byCategory).filter((c) => c.info.row.parentId !== null || !pl.cats.some((x) => x.parentId === c.info.row.id));
    let localityNames: string[] = []; let cityNames: string[] = []; let catNames: string[] = [];
    if (spec.type === 'state') { const cs = placesWith('CITY', o.state); cityNames = cs.map((c) => c.name); out.push({ kind: 'city', items: takeLinks(cs.map((c) => ({ name: c.name, path: buildPath({ type: 'city', city: c.slug, page: 1 }), count: rolled.get(c.id) })), FACET_MAX) }); }
    if (spec.type === 'city') {
      catNames = cats.map((c) => c.info.plural);
      out.push({ kind: 'category', items: takeLinks(cats.map((c) => ({ name: c.info.plural, path: buildPath({ type: 'cityCategory', city: o.city!.slug, term: c.info.pluralSlug, page: 1 }), count: c.n })), FACET_MAX) });
    }
    if (spec.type === 'category') {
      const cs = placesWith('CITY', null); cityNames = cs.map((c) => c.name);
      out.push({ kind: 'city', items: takeLinks(cs.map((c) => ({ name: c.name, path: buildPath({ type: 'cityCategory', city: c.slug, term: o.cat!.pluralSlug, page: 1 }), count: rolled.get(c.id) })), FACET_MAX) });
    }
    if (spec.type === 'cityCategory' || spec.type === 'localityCategory') {
      // localities of the city that have this category (counts are for this category because the scope carries it); the page's own locality is not a link to itself
      const base = o.city!; const here = o.locality?.id;
      const locs = placesWith('LOCALITY', base).filter((l) => l.id !== here);
      const links = locs.map((l) => ({ name: l.name, path: buildPath({ type: 'localityCategory', city: base.slug, locality: l.slug, term: o.cat!.pluralSlug, page: 1 }), count: rolled.get(l.id) }));
      if (spec.type === 'cityCategory') { localityNames = placesWith('LOCALITY', base).map((l) => l.name); out.push({ kind: 'locality', items: takeLinks(links, FACET_MAX) }); }
      nearby = takeLinks(links, LINK_MAX);
    }
    if (spec.type === 'localityCategory' && o.facets.byPincode.size) out.push({ kind: 'pincode', items: takeLinks([...o.facets.byPincode].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([pin, n]) => ({ name: pin, path: buildPath({ type: 'pincodeCategory', pincode: pin, category: o.cat!.row.slug, page: 1 }), count: n })), FACET_MAX) });
    if (o.cat && o.cat.row.parentId && o.cityWide && (spec.type === 'cityCategory' || spec.type === 'localityCategory')) {
      const have = o.cityWide.allCats.byCategory;
      const sibs = pl.cats.filter((c) => c.parentId === o.cat!.row.parentId && c.id !== o.cat!.row.id && (have.get(c.id) ?? 0) > 0).map((c) => pl.catInfo.get(c.id)).filter((c): c is CatInfo => !!c);
      relatedCats = takeLinks(sibs.slice(0, LINK_MAX).map((c) => ({ name: c.plural, path: buildPath({ type: 'cityCategory', city: o.city!.slug, term: c.pluralSlug, page: 1 }) })), LINK_MAX);
    }
    return { facets: out.filter((x) => x.items.length), nearby, relatedCats, localityNames, cityNames, catNames };
  }

  private intro(spec: PageSpec, o: { total: number; cat: CatInfo | null; locality: LocationRow | null; city: LocationRow | null; state: LocationRow | null; pincode?: string; built: { nearby: Link[]; cityNames: string[]; catNames: string[]; localityNames: string[] } }): string {
    const n = o.total; const noun = o.cat ? (n === 1 ? o.cat.singular : o.cat.plural) : pluralFn(n, 'business', 'businesses');
    const where = o.locality ? `${o.locality.name}, ${o.city!.name}` : o.pincode ? o.pincode : o.city ? o.city.name : o.state ? o.state.name : '';
    const head = n === 0 ? `There are no ${o.cat ? o.cat.plural : 'businesses'}${where ? ` listed in ${where}` : ' listed'} on Get4Domain yet.` : `Get4Domain lists ${n} ${noun}${where ? ` in ${where}` : ''}, with ${pluralFn(n, 'its', 'their')} address${n === 1 ? '' : 'es'}, services and website${n === 1 ? '' : 's'} where available.`;
    const tail = o.built.nearby.length ? ` Nearby areas with ${o.cat!.plural}: ${listNames(o.built.nearby.map((l) => l.name))}.` : spec.type === 'state' && o.built.cityNames.length ? ` Cities covered: ${listNames(o.built.cityNames)}.` : spec.type === 'city' && o.built.catNames.length ? ` Categories listed: ${listNames(o.built.catNames)}.` : spec.type === 'category' && o.built.cityNames.length ? ` Cities covered: ${listNames(o.built.cityNames)}.` : '';
    return `${head}${tail}`;
  }

  private listingFaq(spec: PageSpec, o: { total: number; cat: CatInfo | null; locality: LocationRow | null; city: LocationRow | null; state: LocationRow | null; pincode?: string; built: { nearby: Link[]; cityNames: string[]; catNames: string[]; localityNames: string[] } }): FaqItem[] {
    const n = o.total; if (n === 0) return this.faq({ claim: true });
    const what = o.cat ? o.cat.plural : 'businesses'; const where = o.locality ? `${o.locality.name}, ${o.city!.name}` : o.pincode ? o.pincode : o.city?.name ?? o.state?.name ?? '';
    const verb = n === 1 ? 'is' : 'are';
    let listQ: string | undefined; let listA: string | undefined;
    if (spec.type === 'cityCategory' && o.built.localityNames.length) { listQ = `Which areas of ${o.city!.name} have ${what}?`; listA = `${listNames(o.built.localityNames, 8)}.`; }
    else if (spec.type === 'localityCategory' && o.built.nearby.length) { listQ = `Which nearby areas also have ${what}?`; listA = `${listNames(o.built.nearby.map((l) => l.name), 8)}.`; }
    else if (spec.type === 'city' && o.built.catNames.length) { listQ = `Which categories are listed in ${o.city!.name}?`; listA = `${listNames(o.built.catNames, 8)}.`; }
    else if ((spec.type === 'state' || spec.type === 'category') && o.built.cityNames.length) { listQ = 'Which cities are covered?'; listA = `${listNames(o.built.cityNames, 8)}.`; }
    return this.faq({ countQ: `How many ${what} are listed${where ? ` in ${where}` : ''}?`, countA: `${n} ${what === 'businesses' && n === 1 ? 'business' : what} ${verb} listed on Get4Domain${where ? ` in ${where}` : ''}.`, listQ, listA, claim: true });
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────── a business profile
  private async business(spec: Extract<PageSpec, { type: 'business' }>, ctx: Ctx): Promise<PageResult> {
    const b = await this.data.businessBySlug(spec.slug);
    if (!b) return { kind: 'notFound' };
    if (b.status === 'REMOVED') return { kind: 'gone' };
    if (b.status === 'DRAFT') return { kind: 'notFound' };
    const { pl } = ctx;
    const chain = this.ancestors(pl, b.locationId);
    const loc = chain.find((l) => l.kind === 'LOCALITY') ?? null; const city = chain.find((l) => l.kind === 'CITY') ?? chain.find((l) => l.kind === 'DISTRICT') ?? null;
    const info = pl.catInfo.get(b.categoryId) ?? null;
    const facts = await this.repo.siteFacts(b.vendorId ? [b.vendorId] : [], new Date(this.clock()));
    const f = b.vendorId ? facts.get(b.vendorId) ?? null : null;
    const hasSite = !!siteUrlOf(f, process.env.SITE_BASE_DOMAIN || 'get4domain.com');
    const shown = b.status === 'SUSPENDED' ? (b.claimed ? 'CLAIMED' : 'UNCLAIMED') : b.status;
    const verified = badgesOf(shown, f).includes('VERIFIED');
    let indexing: { indexable: boolean; reason: NoindexReason | null } = { indexable: true, reason: null };
    if (!ctx.s.directoryPagesIndexable) indexing = { indexable: false, reason: 'FLAG_OFF' };
    else if (b.status === 'SUSPENDED') indexing = { indexable: false, reason: 'SUSPENDED' };
    else if (!b.indexable) indexing = { indexable: false, reason: shown === 'UNCLAIMED' && !ctx.s.directoryIndexUnclaimed ? 'UNCLAIMED' : 'NOT_INDEXABLE' };
    const url = `${ctx.origin}${ctx.path}`;
    const factsOut: BusinessFacts = {
      name: b.name, claimed: b.claimed, verified, category: info?.singular ?? null, locality: loc?.name ?? null, city: city?.name ?? null, description: shortDescription(b.descriptionText, 300),
      address: b.claimed ? { street: [b.address.line1, b.address.line2].filter(Boolean).join(', ') || undefined, locality: loc?.name, city: city?.name, pincode: b.pincode ?? b.address.pin } : null,
      geo: b.claimed ? b.geo : null, hoursText: b.claimed ? hoursTextOf(b.hours) : null, imageUrl: b.claimed ? b.imageUrl : null,
      visitUrl: hasSite ? clickOutUrl(process.env.PUBLIC_API_URL ?? '', b.id, { src: 'business' }) : null, listingOnly: !hasSite,
      listingState: publicStateOf(b.claimed, hasSite), businessId: b.id, services: b.claimed ? await this.data.servicesOf(b.id) : [],
    };
    const crumbItems: Array<{ name: string; path: string }> = [];
    if (city) crumbItems.push({ name: city.name, path: buildPath({ type: 'city', city: city.slug, page: 1 }) });
    if (city && info) crumbItems.push({ name: `${info.plural} in ${city.name}`, path: buildPath({ type: 'cityCategory', city: city.slug, term: info.pluralSlug, page: 1 }) });
    if (city && info && loc) crumbItems.push({ name: `${info.plural} in ${loc.name}`, path: buildPath({ type: 'localityCategory', city: city.slug, locality: loc.slug, term: info.pluralSlug, page: 1 }) });
    crumbItems.push({ name: b.name, path: ctx.path });
    const crumbs = this.crumbsOf(ctx, crumbItems);
    const where = loc && city ? `${loc.name}, ${city.name}` : city?.name ?? '';
    const intro = `${b.name} is listed on Get4Domain${info ? ` as ${info.singular}` : ''}${where ? ` in ${where}` : ''}.${factsOut.description ? ` ${factsOut.description}` : ''}`;
    return this.finish(spec, ctx, {
      vars: { vendorName: b.name, ...(info ? { category: info.singular } : {}), ...(loc ? { locality: loc.name } : {}), ...(city ? { city: city.name } : {}) }, templateType: 'business', total: 1, indexing, intro, breadcrumbs: crumbs,
      cards: [], facets: [], related: { nearbyLocalities: [], relatedCategories: [], parents: crumbs.slice(0, -1).map((c) => ({ name: c.name, path: c.path })) }, faq: b.claimed ? [] : this.faq({ claim: true }),
      business: factsOut, jsonLdExtra: [localBusinessJsonLd(factsOut, url, ctx.mainOrigin)], collection: false, paged: false,
    });
  }
}

interface Ctx { s: DirectorySettings; tpl: Awaited<ReturnType<SeoSettingsService['templates']>>; pl: Places; origin: string; mainOrigin: string; page: number; pageSize: number; skip: number; path: string; homePath: string }

/** No staff override at all: what the page tests (and any build without the keyword target tables) use. The module provides DbPageOverrides. */
@Injectable()
export class NoPageOverrides extends SeoPageOverrides { async forPath(): Promise<PageOverride | null> { return null; } }
