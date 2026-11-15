import { isUnsafeSeoText } from '../../site-publish/seo/seo-text';

/** One keyword phrase as the SEO block stores it. Pure; shared by the category keyword sets and the keyword targets. */
export const MAX_KEYWORD_CHARS = 80;

/** One keyword: lower case, single spaces, letters, digits, spaces, hyphens, ampersands and apostrophes only; no price, no markup. Returns null when it is not acceptable. */
export function cleanKeyword(v: unknown): string | null {
  const t = String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t || t.length > MAX_KEYWORD_CHARS || !/^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u.test(t) || isUnsafeSeoText(t)) return null;
  return t;
}
