import { getSubcategory, resolveDemoQuery } from '@/data/demo-site';
import { closestPack, packById, type SitePack } from './packs';
import { DEFAULT_THEME_ID, FLAGSHIPS, GENERAL_THEME, flagshipId, themeById, type KitTheme, type Target, type TargetLevel } from './themes';

/**
 * Which theme draws a vendor's site. The rule, in this order:
 *   1. a theme that targets the vendor's SUB category (most specific),
 *   2. else one that targets its CATEGORY,
 *   3. else one that targets its MAIN category,
 *   4. else the flagship of the CLOSEST industry pack,
 *   5. else the safe default theme.
 * Several themes may target the same level: the vendor's own choice wins if it is one of them, else the theme marked as default, else the one with the lowest id
 * (so the answer never depends on list order).
 */
export interface Ref { id?: string; slug?: string }
export interface ThemeContext { main?: Ref; category?: Ref; sub?: Ref }
export type MatchedLevel = 'sub' | 'category' | 'main' | 'pack' | 'default';
export interface Resolution { theme: KitTheme; level: MatchedLevel; /** the themes that were candidates at the winning level */ candidates: string[]; pack: SitePack }

const key = (v: string | undefined): string => String(v ?? '').trim().toLowerCase();
function refMatches(ref: Ref | undefined, t: Target): boolean {
  if (!ref) return false;
  const have = [key(ref.id), key(ref.slug)].filter(Boolean);
  const want = [key(t.id), key(t.slug)].filter(Boolean);
  return have.some((h) => want.includes(h));
}
const byId = (a: KitTheme, b: KitTheme): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Picks one of several candidate themes: the vendor's choice, else the default, else the lowest id. */
export function pickCandidate(cands: readonly KitTheme[], chosenId?: string | null): KitTheme {
  const sorted = [...cands].sort(byId);
  const chosen = chosenId ? sorted.find((t) => t.id === key(chosenId)) : undefined;
  return chosen ?? sorted.find((t) => t.isDefault) ?? sorted[0];
}

/** The pack that is the closest to a context: from the main category, else the category, else the sub's parent. */
export function packOfContext(ctx: ThemeContext): SitePack {
  return packById(ctx.main?.id) ?? packById(ctx.main?.slug) ?? closestPack(`${ctx.category?.id ?? ''} ${ctx.category?.slug ?? ''}`) ?? closestPack('');
}

export function resolveTheme(ctx: ThemeContext, themes: readonly KitTheme[] = FLAGSHIPS, chosenId?: string | null): Resolution {
  const pool = themes.length ? themes : FLAGSHIPS;
  const pack = packOfContext(ctx);
  const levels: [TargetLevel, MatchedLevel, Ref | undefined][] = [['sub', 'sub', ctx.sub], ['category', 'category', ctx.category], ['main', 'main', ctx.main]];
  for (const [tl, ml, ref] of levels) {
    const cands = pool.filter((t) => t.targets.some((tg) => tg.level === tl && refMatches(ref, tg)));
    if (cands.length) return { theme: pickCandidate(cands, chosenId), level: ml, candidates: cands.map((t) => t.id).sort(), pack };
  }
  const closest = pack.id === 'general' ? [] : pool.filter((t) => t.pack === pack.id);
  if (closest.length) return { theme: pickCandidate(closest, chosenId), level: 'pack', candidates: closest.map((t) => t.id).sort(), pack };
  const flag = themeById(flagshipId(pack.id), pool) ?? themeById(DEFAULT_THEME_ID, pool) ?? GENERAL_THEME;
  return { theme: flag, level: 'default', candidates: [flag.id], pack };
}

/** Backend category keys that sit under a main category of the data (the others are their own main category). */
const CATEGORY_PARENT: Record<string, string> = { advocate: 'professional', freelancer: 'professional', 'home-services': 'homeservices', general: 'general' };

interface SiteLike {
  vendor?: { industry?: string | null; subCategory?: string | null; subcategory?: string | null } | null;
  pack?: { key?: string | null } | null;
  cms?: { tagline?: string | null } | null;
}

/**
 * The category context of a vendor's site data: its category is the category-pack key the site was made from; its main category is that category's parent, else the
 * pack matched from the industry text; its sub category is the one the vendor stored, else one the industry words name inside the main category.
 */
export function contextOf(site: SiteLike | null | undefined): ThemeContext {
  const industry = String(site?.vendor?.industry ?? '').trim();
  const packKey = key(site?.pack?.key ?? undefined);
  const ctx: ThemeContext = {};
  if (packKey) ctx.category = { id: packKey, slug: packKey };
  const parent = packKey ? CATEGORY_PARENT[packKey] ?? (packById(packKey)?.id) : undefined;
  const main = parent ? packById(parent) : industry ? closestPack(industry) : null;
  if (main && main.id !== 'general') ctx.main = { id: main.id, slug: main.id };
  else if (parent === 'general') ctx.main = undefined;
  const storedSub = key(site?.vendor?.subCategory ?? site?.vendor?.subcategory ?? undefined);
  if (storedSub) ctx.sub = { id: storedSub.split('/').pop(), slug: storedSub.includes('/') ? storedSub : ctx.main?.id ? `${ctx.main.id}/${storedSub}` : storedSub };
  else if (ctx.main?.id && industry) {
    const hit = resolveDemoQuery(industry);
    if (hit && hit.categoryId === ctx.main.id && hit.subId && getSubcategory(hit.categoryId, hit.subId).id !== 'general') ctx.sub = { id: hit.subId, slug: `${hit.categoryId}/${hit.subId}` };
  }
  return ctx;
}

/** The theme for a site's data: the context, the available themes and the vendor's choice. */
export function themeForSite(site: SiteLike | null | undefined, themes: readonly KitTheme[] = FLAGSHIPS, chosenId?: string | null): Resolution {
  return resolveTheme(contextOf(site), themes, chosenId);
}
