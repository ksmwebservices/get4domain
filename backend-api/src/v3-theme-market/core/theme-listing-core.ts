import { CATALOGUE_CATEGORIES } from '../../directory/core/catalogue-categories';
import { KIT_ONLY_PACK, PACK_KIT_FALLBACK } from '../../directory/core/listable-categories';
import type { ThemeRow } from '../theme-market.store';
import { PACK_KEYS } from './theme-package-core';

/**
 * How a theme is described in the marketplace listing (TM1 M5). PURE: no database, no Nest, no clock. One shape for the library themes (which carry no marketplace block) and the marketplace themes, so a
 * filter works the same on both. Nothing here is a count, a rating, a ranking or a popularity: a listing is sorted by name and says only what the theme is designed for.
 */
export interface MarketTheme {
  key: string; name: string; description: string | null; tier: string; premium: boolean; starter: boolean; source: 'LIBRARY' | 'MARKETPLACE';
  tracks: string[]; packs: string[]; addons: string[]; capabilities: string[]; tags: string[]; catalogueCategories: string[]; kitCategories: string[]; version: number | null;
}
export interface ListingFilter { pack?: string; category?: string; addon?: string; capability?: string; tag?: string; tier?: string; starter?: boolean; q?: string }

const CATALOGUE_IDS_BY_PACK: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const p of PACK_KEYS) m.set(p, new Set());
  for (const c of CATALOGUE_CATEGORIES) m.get(c.pack)?.add(c.id);
  for (const [id, p] of Object.entries(KIT_ONLY_PACK)) m.get(p)?.add(id);
  return m;
})();
const ALL_KNOWN_IDS: ReadonlySet<string> = new Set([...CATALOGUE_CATEGORIES.map((c) => c.id), ...Object.keys(KIT_ONLY_PACK)]);

/**
 * A library theme has no marketplace block, so what it is designed for is read from its kit categories: a pack is listed when the theme was designed for a category of that pack (the catalogue's own,
 * plus the four kit-only ones) or for the kit category the pack's site is drawn from. A library theme claims no add-on, capability or combination tag: it never said it draws one.
 */
export function libraryMeta(m: { id: string; name: string; description?: string | null; tier: string; tracks: string[]; categories: string[] }): MarketTheme {
  const packs = PACK_KEYS.filter((p) => m.categories.some((c) => CATALOGUE_IDS_BY_PACK.get(p)?.has(c)) || (PACK_KIT_FALLBACK[p] !== undefined && m.categories.includes(PACK_KIT_FALLBACK[p])));
  return { key: m.id, name: m.name, description: m.description ?? null, tier: m.tier, premium: m.tier === 'Premium', starter: false, source: 'LIBRARY', tracks: m.tracks, packs, addons: [], capabilities: [], tags: [], catalogueCategories: m.categories.filter((c) => ALL_KNOWN_IDS.has(c)), kitCategories: m.categories, version: null };
}

export function rowMeta(r: ThemeRow): MarketTheme {
  return { key: r.key, name: r.name, description: r.description, tier: r.tier, premium: r.tier === 'Premium', starter: r.starter, source: 'MARKETPLACE', tracks: r.tracks, packs: r.packs, addons: r.addons, capabilities: r.capabilities, tags: r.tags, catalogueCategories: r.catalogueCategories, kitCategories: r.kitCategories, version: r.version };
}

/** A theme matches when it satisfies EVERY filter given. `category` is a catalogue id: the theme must list it, or (when it lists none, as the library themes do not) be designed for the pack that owns it. */
export function matches(t: MarketTheme, f: ListingFilter): boolean {
  if (f.pack && !t.packs.includes(f.pack)) return false;
  if (f.addon && !t.addons.includes(f.addon)) return false;
  if (f.capability && !t.capabilities.includes(f.capability)) return false;
  if (f.tag && !t.tags.includes(f.tag)) return false;
  if (f.tier && t.tier !== f.tier) return false;
  if (typeof f.starter === 'boolean' && t.starter !== f.starter) return false;
  if (f.category) {
    const owner = CATALOGUE_CATEGORIES.find((c) => c.id === f.category)?.pack ?? KIT_ONLY_PACK[f.category];
    const direct = t.catalogueCategories.includes(f.category);
    const viaPack = t.source === 'LIBRARY' && !!owner && t.packs.includes(owner);   // a library theme names kit categories only; the pack of the category is the honest match
    if (!direct && !viaPack) return false;
  }
  if (f.q) { const q = f.q.toLowerCase(); if (!t.name.toLowerCase().includes(q) && !t.key.includes(q)) return false; }
  return true;
}

export const byName = (a: { name: string; key: string }, b: { name: string; key: string }): number => a.name.localeCompare(b.name) || a.key.localeCompare(b.key);
export const isKnownCategory = (id: string): boolean => ALL_KNOWN_IDS.has(id);

/** Where a generated preview of a theme for a pack is served for a given audience. A path only: never a file name, never a vendor. */
export const previewPath = (audience: 'me' | 'public', key: string, pack: string | undefined): string => `/v3/${audience === 'me' ? 'me' : 'public'}/theme-market/themes/${encodeURIComponent(key)}/preview${pack ? `?pack=${encodeURIComponent(pack)}` : ''}`;
