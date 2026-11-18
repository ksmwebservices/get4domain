import { getJson, unwrap } from './api';
import { apiBase, defaultRevalidate } from './config';
import { useMocks } from './flag';
import { mockList, mockTrees } from './mocks';
import type { Fetched, RawBusiness, RawBusinessList, TreeNode } from './types';

/**
 * The one directory search of the portal (dispatch J1). The home page box and the directory box use the same component, the same resolver and the same route.
 * It builds on what the backend has: GET /v3/directory/businesses?q=&location=&category=&page= (the text matches name and description by word prefix; place and category are exact slugs)
 * and the two trees GET /v3/directory/locations and /categories. Everything the backend cannot do yet (category, services and keywords inside the text match, suggestions, free place text,
 * near me, open now) is listed in the J1 report as a backend request and is NOT imitated here.
 */
export interface Place { slug: string; path: string; name: string; label: string; depth: number; kind: string | null }
export interface Cat { slug: string; name: string; parent: string | null }
export interface Trees { places: Place[]; categories: Cat[] }

/** Lower case, letters and digits only, one space between words. The same shape the backend uses for the text. */
export function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

/** The tree of places as a flat list: the address path (`tamil-nadu/chennai/adyar`), the name, and a label that reads "Adyar, Chennai". */
export function flattenPlaces(nodes: readonly TreeNode[]): Place[] {
  const out: Place[] = [];
  const walk = (list: readonly TreeNode[], slugs: string[], names: string[]): void => {
    for (const n of list) {
      if (!n.slug || !n.name) continue;
      const s = [...slugs, n.slug];
      const nm = [n.name, ...names];
      out.push({ slug: n.slug, path: s.join('/'), name: n.name, label: nm.slice(0, 2).join(', '), depth: s.length, kind: n.kind ?? null });
      walk(n.children ?? [], s, nm);
    }
  };
  walk(nodes, [], []);
  return out;
}

export function flattenCategories(nodes: readonly TreeNode[]): Cat[] {
  const out: Cat[] = [];
  const walk = (list: readonly TreeNode[], parent: string | null): void => {
    for (const n of list) {
      if (!n.slug || !n.name) continue;
      out.push({ slug: n.slug, name: n.name, parent });
      walk(n.children ?? [], n.slug);
    }
  };
  walk(nodes, null);
  return out;
}

export function treesFrom(places: readonly TreeNode[], categories: readonly TreeNode[]): Trees {
  return { places: flattenPlaces(places), categories: flattenCategories(categories) };
}

/** Typed word forms that mean the same category: "dentist" and "dentists", "mobile shop" and "mobile shops". */
function forms(n: string): string[] {
  const out = new Set([n]);
  if (n.endsWith('es')) out.add(n.slice(0, -2));
  if (n.endsWith('s')) out.add(n.slice(0, -1));
  out.add(`${n}s`);
  out.add(`${n}es`);
  return [...out];
}

export function matchCategory(trees: Trees, text: string): Cat | null {
  const n = normalize(text);
  if (!n) return null;
  const want = new Set(forms(n));
  return trees.categories.find((c) => want.has(normalize(c.name)) || want.has(normalize(c.slug))) ?? null;
}

export function matchPlace(trees: Trees, text: string): Place | null {
  const n = normalize(text);
  if (!n) return null;
  const hits = trees.places.filter((p) => normalize(p.name) === n || normalize(p.slug) === n || normalize(p.label) === n || normalize(p.label.split(', ').reverse().join(' ')) === n);
  return hits.sort((a, b) => a.depth - b.depth)[0] ?? null;
}

export interface SearchInput { what?: string; where?: string; c?: string; l?: string }
export interface Resolved {
  /** the text sent as q: empty when the typed words were a category name */
  q: string;
  category: Cat | null;
  place: Place | null;
  /** a place was typed that the place tree does not have: the search answers with no results instead of guessing (an unknown place is an empty result at the backend too) */
  unknownPlace: boolean;
  what: string;
  where: string;
}

/**
 * Typed text to the filters the backend understands. A picked suggestion (c, l) wins; otherwise the typed words become a category when they are a category name (plural or not),
 * and a place when they are a place name; whatever is left of the words is the text query. A place that is not in the tree is reported, never turned into "everywhere".
 */
export function resolveSearch(trees: Trees | null, input: SearchInput): Resolved {
  const what = (input.what ?? '').trim().slice(0, 120);
  const where = (input.where ?? '').trim().slice(0, 120);
  const t: Trees = trees ?? { places: [], categories: [] };
  const pickedCat = input.c ? t.categories.find((c) => c.slug === input.c) ?? null : null;
  const pickedPlace = input.l ? t.places.find((p) => p.path === input.l) ?? null : null;
  const category = pickedCat ?? (what ? matchCategory(t, what) : null);
  const place = pickedPlace ?? (where ? matchPlace(t, where) : null);
  // with no place tree (the API did not answer) a typed place cannot be judged: it is not reported as unknown
  const unknownPlace = !!where && !place && t.places.length > 0;
  return { q: category ? '' : normalize(what), category, place, unknownPlace, what, where };
}

/** Suggestions for the text typed so far: names that start with it first, then names that contain it. At most `limit` of each kind. */
export function suggest(trees: Trees, text: string, limit = 6): { categories: Cat[]; places: Place[] } {
  const n = normalize(text);
  if (!n) return { categories: [], places: [] };
  const rank = <T extends { name: string }>(list: readonly T[]): T[] => {
    const starts = list.filter((x) => normalize(x.name).startsWith(n));
    const has = list.filter((x) => !normalize(x.name).startsWith(n) && normalize(x.name).includes(n));
    return [...starts, ...has].slice(0, limit);
  };
  return { categories: rank(trees.categories), places: rank(trees.places) };
}

/** Both trees, for the suggestions and for turning typed text into filters. Mock mode answers from the fixtures. */
export async function fetchTrees(): Promise<Fetched<Trees>> {
  if (useMocks()) { const m = mockTrees(); return { kind: 'ok', data: treesFrom(m.places, m.categories) }; }
  const base = apiBase();
  if (!base) return { kind: 'error', status: null };
  const [a, b] = await Promise.all([
    getJson<unknown>(`${base}/v3/directory/locations`, defaultRevalidate()),
    getJson<unknown>(`${base}/v3/directory/categories`, defaultRevalidate()),
  ]);
  if (a.kind !== 'ok') return a;
  if (b.kind !== 'ok') return b;
  const arr = (x: unknown): TreeNode[] => { const v = unwrap<unknown>(x); return Array.isArray(v) ? (v as TreeNode[]) : []; };
  return { kind: 'ok', data: treesFrom(arr(a.data), arr(b.data)) };
}

export interface ResultItem {
  slug: string; name: string; description: string | null; claimed: boolean; verified: boolean; sponsored: boolean; sponsoredLabel: string | null;
  category: string | null; place: string | null; siteUrl: string | null; listingOnly: boolean; profilePath: string;
}
export interface SearchResult { items: ResultItem[]; page: number; pageSize: number; total: number; totalPages: number }

export const RESULTS_PER_PAGE = 12;

/** A raw business to a card. A site address is kept only when it is an http(s) address; a listing without one is shown as listing only. */
export function toResultItem(b: RawBusiness): ResultItem | null {
  if (!b.slug || !b.name) return null;
  const path = b.location?.path?.map((p) => p.name).filter(Boolean) ?? [];
  const place = path.length ? path.slice(-2).reverse().join(', ') : b.location?.name ?? null;
  const siteUrl = typeof b.siteUrl === 'string' && /^https?:\/\//.test(b.siteUrl) ? b.siteUrl : null;
  return {
    slug: b.slug, name: b.name, description: b.description ?? null, claimed: !!b.claimed, verified: !!b.badges?.some((x) => /verified/i.test(x)),
    sponsored: !!b.sponsored, sponsoredLabel: b.sponsored ? b.label ?? null : null,
    category: b.category?.name ?? null, place, siteUrl, listingOnly: !siteUrl, profilePath: `/business/${b.slug}`,
  };
}

/** Run the directory search for resolved filters. An unknown place is an empty result without a call. 404 and 410 cannot happen on this route; any failure is an error state. */
export async function searchDirectory(r: Resolved, pageNumber: number): Promise<Fetched<SearchResult>> {
  const page = Number.isFinite(pageNumber) && pageNumber >= 1 ? Math.min(Math.floor(pageNumber), 1000) : 1;
  const empty: SearchResult = { items: [], page, pageSize: RESULTS_PER_PAGE, total: 0, totalPages: 1 };
  if (r.unknownPlace) return { kind: 'ok', data: empty };
  let raw: RawBusinessList;
  if (useMocks()) {
    raw = mockList(r.q, r.place?.path ?? '', r.category?.slug ?? '', page, RESULTS_PER_PAGE);
  } else {
    const base = apiBase();
    if (!base) return { kind: 'error', status: null };
    const q = new URLSearchParams({ page: String(page), pageSize: String(RESULTS_PER_PAGE) });
    if (r.q) q.set('q', r.q);
    if (r.place) q.set('location', r.place.path);
    if (r.category) q.set('category', r.category.slug);
    const res = await getJson<RawBusinessList>(`${base}/v3/directory/businesses?${q.toString()}`, 60);
    if (res.kind !== 'ok') return res.kind === 'notFound' || res.kind === 'gone' ? { kind: 'ok', data: empty } : res;
    raw = res.data;
  }
  const items = (raw.items ?? []).map(toResultItem).filter((x): x is ResultItem => x !== null);
  const total = Number.isFinite(raw.total) ? Number(raw.total) : items.length;
  return { kind: 'ok', data: { items, page, pageSize: RESULTS_PER_PAGE, total, totalPages: Math.max(1, Math.ceil(total / RESULTS_PER_PAGE)) } };
}

/** The address of a results page for these inputs (kept short: only what was given). */
export function searchQueryString(i: SearchInput & { page?: number }): string {
  const q = new URLSearchParams();
  if (i.what) q.set('what', i.what);
  if (i.where) q.set('where', i.where);
  if (i.c) q.set('c', i.c);
  if (i.l) q.set('l', i.l);
  if (i.page && i.page > 1) q.set('page', String(i.page));
  const s = q.toString();
  return s ? `?${s}` : '';
}
