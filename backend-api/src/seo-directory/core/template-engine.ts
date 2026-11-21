import { isUnsafeSeoText } from '../../site-publish/seo/seo-text';

/**
 * SEO block slice 1: filling the page templates. Pure: no clock, no network, no randomness.
 * A template is filled only when EVERY placeholder it names has a value; otherwise the next, shorter template is tried, and the last resort is the brand, so a title is never blank.
 */
export const BRAND = 'Get4Domain';
export const BRAND_DOMAIN = 'get4domain.com';
export const BRAND_SUFFIX = ` | ${BRAND}`;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;
export const H1_MAX = 120;

export const SEO_PLACEHOLDERS = ['category', 'categoryPlural', 'locality', 'city', 'state', 'pincode', 'count', 'vendorName', 'pageName', 'services'] as const;
export type SeoPlaceholder = (typeof SEO_PLACEHOLDERS)[number];
export type SeoVars = Partial<Record<SeoPlaceholder, string | number | null | undefined>>;

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();
const TOKEN = /\{([A-Za-z]+)\}/g;

export function placeholdersIn(template: string): string[] { return [...String(template ?? '').matchAll(TOKEN)].map((m) => m[1]); }

/** The filled text, or null when a placeholder has no value (an empty or missing value is "no value"; the number 0 is a value). */
export function fillTemplate(template: string, vars: SeoVars): string | null {
  let missing = false;
  const out = String(template ?? '').replace(TOKEN, (_m, key: string) => {
    const v = (vars as Record<string, unknown>)[key];
    const text = typeof v === 'number' ? String(v) : typeof v === 'string' ? squash(v) : '';
    if (!text) missing = true;
    return text;
  });
  return missing ? null : squash(out);
}

/** Capitalises each word except small joining words (not the first). "pumps and motors supplier" becomes "Pumps and Motors Supplier". */
const SMALL = new Set(['and', 'of', 'in', 'the', 'for', 'a', 'an', 'to', 'on', 'at', 'by', 'or']);
export function titleCase(s: string): string {
  return squash(String(s ?? '')).split(' ').map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

/** Cuts at a word boundary with no ellipsis (a title keeps its keywords), dropping dangling separators. Text that fits is unchanged. */
export function cutWords(text: string, max: number): string {
  const t = squash(text);
  if (t.length <= max) return t;
  if (max <= 0) return '';
  const head = t.slice(0, max + 1).replace(/\s+\S*$/, '');
  return (head && head.length <= max ? head : t.slice(0, max)).replace(/[\s,;:|\-–—&]+$/u, '');
}

export interface TitleOptions { /** the page number; from 2 the title carries " - Page N" before the brand */ page?: number; /** false for a vendor site whose canonical host is a custom domain (the suffix is not forced) */ brand?: boolean; max?: number }

/**
 * The title: the first candidate that fills AND fits whole (keyword part + " - Page N" + " | Get4Domain") within `max`. If none fits, the shortest filled candidate is cut at a word
 * boundary so the page marker and the brand stay (owner addition 8a and 8b). Nothing filled at all: the brand.
 */
export function buildTitle(candidates: readonly string[], vars: SeoVars, o: TitleOptions = {}): string {
  const max = o.max ?? TITLE_MAX;
  const pageTail = o.page && o.page >= 2 ? ` - Page ${Math.floor(o.page)}` : '';
  const tail = `${pageTail}${o.brand === false ? '' : BRAND_SUFFIX}`;
  const filled = candidates.map((c) => fillTemplate(c, vars)).filter((x): x is string => !!x && !isUnsafeSeoText(x));
  if (!filled.length) return o.brand === false ? `${BRAND}${pageTail}` : `${BRAND}${pageTail}`.slice(0, max);
  const fits = filled.find((f) => f.length + tail.length <= max);
  if (fits) return `${fits}${tail}`;
  const room = max - tail.length;
  const shortest = [...filled].sort((a, b) => a.length - b.length)[0];
  const cut = cutWords(shortest, room) || shortest.slice(0, Math.max(room, 1));
  return `${cut}${tail}`.slice(0, max);
}

/** The description: the first filled candidate within `max`; else the shortest filled one cut at a word boundary (ending with a full stop); else a brand sentence. */
export function buildDescription(candidates: readonly string[], vars: SeoVars, max = DESCRIPTION_MAX): string {
  const filled = candidates.map((c) => fillTemplate(c, vars)).filter((x): x is string => !!x && !isUnsafeSeoText(x));
  const fits = filled.find((f) => f.length <= max);
  if (fits) return fits;
  if (filled.length) {
    const shortest = [...filled].sort((a, b) => a.length - b.length)[0];
    return `${cutWords(shortest.replace(/[.\s]+$/u, ''), max - 1)}.`;
  }
  return `Find local businesses, addresses, services and websites on ${BRAND} at ${BRAND_DOMAIN}.`;
}

/** The H1: the first filled candidate (cut at a word boundary if needed); else the brand. No brand suffix. */
export function buildH1(candidates: readonly string[], vars: SeoVars, max = H1_MAX): string {
  const filled = candidates.map((c) => fillTemplate(c, vars)).filter((x): x is string => !!x && !isUnsafeSeoText(x));
  return filled.length ? cutWords(filled[0], max) : BRAND;
}
