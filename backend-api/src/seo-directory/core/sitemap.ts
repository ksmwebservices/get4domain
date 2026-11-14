import { LocationRow } from '../../directory/directory.repository';
import { CatInfo, Places } from '../pages/places';
import { buildPath } from './url-scheme';

/**
 * SEO block slice 4: which directory pages go into the sitemaps, and the XML. Pure. A listing page is included only when it is INDEXABLE by the same rule the page model uses (not thin,
 * not empty); it appears once, as its base URL (page 2 and later are reached by links, not listed). The caller returns nothing at all while directoryPagesIndexable is OFF.
 */
export const SITEMAP_CHUNK = 10_000;

/** One row of the grouped counts of listed businesses: how many, and when the newest changed. */
export interface Stat { locationId: string | null; categoryId: string; pincode: string | null; count: number; lastmod: Date }
export interface SitemapEntry { loc: string; lastmod: Date }
export interface ListingPath { path: string; lastmod: Date }

const by = <T extends { id: string }>(rows: readonly T[]): Map<string, T> => new Map(rows.map((r) => [r.id, r]));

export function enumerateListingPaths(places: Places, stats: readonly Stat[], minBusinesses: number): ListingPath[] {
  const min = Math.max(1, minBusinesses);
  const locs = by(places.locs); const cats = by(places.cats);
  const chainOf = <T extends { id: string; parentId: string | null }>(m: Map<string, T>, id: string | null): T[] => { const out: T[] = []; let cur = id ? m.get(id) : undefined; let g = 0; while (cur && g++ < 10) { out.push(cur); cur = cur.parentId ? m.get(cur.parentId) : undefined; } return out; };
  const acc = new Map<string, { n: number; last: Date; path: string }>();
  const add = (key: string, path: string, n: number, last: Date): void => { const r = acc.get(key); if (r) { r.n += n; if (last > r.last) r.last = last; } else acc.set(key, { n, last, path }); };

  // the one place or category a slug or plural term resolves to (the same choice the page resolver makes), so a page is never listed with another place's counts
  const order = <T extends { sortOrder: number; name: string }>(a: T, b: T): number => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const placeOwner = new Map<string, string>();
  for (const l of [...places.locs].filter((x) => x.kind === 'CITY' || x.kind === 'DISTRICT').sort(order)) if (!placeOwner.has(l.slug)) placeOwner.set(l.slug, l.id);
  const localityOwner = new Map<string, string>();   // `${cityId}|${slug}`
  const termOwner = new Map<string, string>();
  for (const c of [...places.catInfo.values()].sort((a, b) => order(a.row, b.row))) if (!termOwner.has(c.pluralSlug)) termOwner.set(c.pluralSlug, c.row.id);
  const catOwner = new Map<string, string>();
  for (const c of places.catInfo.values()) catOwner.set(c.row.slug, c.row.id);

  for (const s of stats) {
    const locChain: LocationRow[] = chainOf(locs, s.locationId); const catChain: CatInfo[] = chainOf(cats, s.categoryId).map((c) => places.catInfo.get(c.id)).filter((c): c is CatInfo => !!c);
    for (const l of locChain) {
      if (l.kind === 'STATE') add(`s|${l.id}`, buildPath({ type: 'state', state: l.slug, page: 1 }), s.count, s.lastmod);
      if (l.kind === 'CITY' && placeOwner.get(l.slug) === l.id) {
        add(`c|${l.id}`, buildPath({ type: 'city', city: l.slug, page: 1 }), s.count, s.lastmod);
        for (const c of catChain) if (termOwner.get(c.pluralSlug) === c.row.id) add(`cc|${l.id}|${c.row.id}`, buildPath({ type: 'cityCategory', city: l.slug, term: c.pluralSlug, page: 1 }), s.count, s.lastmod);
      }
    }
    const city = locChain.find((l) => l.kind === 'CITY' && placeOwner.get(l.slug) === l.id);
    const loc = locChain[0];
    if (city && loc && loc.kind === 'LOCALITY') {
      const key = `${city.id}|${loc.slug}`; if (!localityOwner.has(key)) localityOwner.set(key, [...places.locs].filter((x) => x.kind === 'LOCALITY' && x.slug === loc.slug && chainOf(locs, x.id).some((a) => a.id === city.id)).sort(order)[0]?.id ?? loc.id);
      if (localityOwner.get(key) === loc.id) for (const c of catChain) if (termOwner.get(c.pluralSlug) === c.row.id) add(`lc|${loc.id}|${c.row.id}`, buildPath({ type: 'localityCategory', city: city.slug, locality: loc.slug, term: c.pluralSlug, page: 1 }), s.count, s.lastmod);
    }
    for (const c of catChain) {
      if (catOwner.get(c.row.slug) === c.row.id) add(`k|${c.row.id}`, buildPath({ type: 'category', category: c.row.slug, page: 1 }), s.count, s.lastmod);
      if (s.pincode && catOwner.get(c.row.slug) === c.row.id) add(`p|${s.pincode}|${c.row.id}`, buildPath({ type: 'pincodeCategory', pincode: s.pincode, category: c.row.slug, page: 1 }), s.count, s.lastmod);
    }
  }
  return [...acc.values()].filter((r) => r.n >= min).map((r) => ({ path: r.path, lastmod: r.last })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

const xml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

/** The XML of one sitemap file. At most SITEMAP_CHUNK urls (the caller slices); an empty list is a valid empty urlset. */
export function buildUrlset(entries: readonly SitemapEntry[]): string {
  const rows = entries.slice(0, SITEMAP_CHUNK).map((e) => `  <url>\n    <loc>${xml(e.loc)}</loc>\n    <lastmod>${e.lastmod.toISOString()}</lastmod>\n  </url>`);
  return `${HEAD}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.length ? `\n${rows.join('\n')}` : ''}\n</urlset>\n`;
}

/** The sitemap index: one entry per chunk. */
export function buildSitemapIndex(entries: readonly SitemapEntry[]): string {
  const rows = entries.map((e) => `  <sitemap>\n    <loc>${xml(e.loc)}</loc>\n    <lastmod>${e.lastmod.toISOString()}</lastmod>\n  </sitemap>`);
  return `${HEAD}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.length ? `\n${rows.join('\n')}` : ''}\n</sitemapindex>\n`;
}

export const chunkCount = (total: number): number => Math.ceil(total / SITEMAP_CHUNK);
export const chunkFile = (n: number): string => `directory-${n}.xml`;
/** "directory-3.xml" to 3; anything else null. */
export function chunkNumber(file: string): number | null { const m = /^directory-([1-9][0-9]{0,5})\.xml$/.exec(String(file ?? '')); return m ? Number(m[1]) : null; }
