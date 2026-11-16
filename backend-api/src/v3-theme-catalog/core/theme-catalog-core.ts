/**
 * The theme catalogue per pack (Wave 3 Part H). PURE: no database, no Nest, no clock, no price (a price is data and is read elsewhere).
 *
 * How the V3 theme library works (existing, slice 5.4 and 5.16d, unchanged here):
 *  - every business starts with the Standard theme assigned to its kind of business (the DEFAULT of a category), on every plan;
 *  - a paid plan has the theme LIBRARY (the plan feature site.themes with the value "library"): any theme designed for the business's track;
 *  - one switch is included; every later switch is the Theme Switch Service fee from the price book, paid from wallet credit (and a PENDING fee is never a number).
 * This file only decides what is LISTED for a pack and what one business may apply now, and why not.
 */
export interface ThemeLite { id: string; name: string; tier: string; tracks: string[]; categories: string[] }
export type ThemeAccess = 'DEFAULT' | 'LIBRARY';
export type NotAllowedReason = 'PLAN_REQUIRED' | 'NOT_FOR_YOUR_BUSINESS';

export interface PackThemes { matchedBy: 'CATEGORY' | 'TRACK' | 'NONE'; themes: ThemeLite[] }

/**
 * The themes for a pack: those designed for at least one of the pack's categories; when the theme kit names none of them (the kit covers fewer kinds of business than the packs do), those designed
 * for the tracks the pack's categories need. Sorted by name then id so the answer never changes between calls.
 */
export function themesForPack(themes: readonly ThemeLite[], packCategoryKeys: readonly string[], packTracks: readonly string[]): PackThemes {
  const cats = new Set(packCategoryKeys);
  const byCategory = themes.filter((t) => t.categories.some((c) => cats.has(c)));
  const sort = (xs: ThemeLite[]): ThemeLite[] => [...xs].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (byCategory.length) return { matchedBy: 'CATEGORY', themes: sort(byCategory) };
  const tracks = new Set(packTracks.map((t) => t.toLowerCase()));
  const byTrack = themes.filter((t) => t.tracks.some((x) => tracks.has(x.toLowerCase())));
  return byTrack.length ? { matchedBy: 'TRACK', themes: sort(byTrack) } : { matchedBy: 'NONE', themes: [] };
}

/** A theme is the DEFAULT when it is the Standard theme of some category of the pack (every plan has it), otherwise it belongs to the paid LIBRARY. */
export const accessOf = (themeId: string, defaultIds: ReadonlySet<string>): ThemeAccess => (defaultIds.has(themeId) ? 'DEFAULT' : 'LIBRARY');

export interface ApplyContext {
  /** the theme ids this business may apply now (the site status answers it: the default on Free, the library for its track on a paid plan) */
  allowedIds: ReadonlySet<string>;
  /** the business's track (handyman, professional, ecommerce), or null when unknown */
  track: string | null;
  /** true when the plan carries the theme library */
  onLibrary: boolean;
}

/** May this business apply this theme, and if not, why: the plan, or the theme was not designed for its kind of business. */
export function applyState(theme: ThemeLite, ctx: ApplyContext): { allowed: boolean; reason: NotAllowedReason | null } {
  if (ctx.allowedIds.has(theme.id)) return { allowed: true, reason: null };
  const trackOk = ctx.track !== null && theme.tracks.some((t) => t.toLowerCase() === ctx.track!.toLowerCase());
  if (!trackOk) return { allowed: false, reason: 'NOT_FOR_YOUR_BUSINESS' };
  return { allowed: false, reason: ctx.onLibrary ? 'NOT_FOR_YOUR_BUSINESS' : 'PLAN_REQUIRED' };
}

export interface ThemeFeeView { pricePaise: number | null; priceStatus: 'SET' | 'PENDING'; taxNote: 'Before GST'; priceNote?: string }
/** The fee line a screen shows: a number only when the price book has an approved price; a PENDING fee is never a number and is shown as such. */
export function feeLine(f: ThemeFeeView): { priceStatus: 'SET' | 'PENDING'; pricePaise: number | null; taxNote: 'Before GST'; purchasable: boolean } {
  const set = f.priceStatus === 'SET' && typeof f.pricePaise === 'number' && Number.isInteger(f.pricePaise) && f.pricePaise > 0;
  return { priceStatus: set ? 'SET' : 'PENDING', pricePaise: set ? f.pricePaise : null, taxNote: 'Before GST', purchasable: set };
}
