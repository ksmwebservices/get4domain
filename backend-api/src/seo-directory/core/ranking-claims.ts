/**
 * SEO block: no ranking promises. Text the PLATFORM writes about a page or a link (templates, staff overrides, backlink anchors, the badge) must never say a business or page is first, best, top
 * or guaranteed, and must never speak about search rank. A business's own name and its own words are not checked here (a real shop may be called "Best Bakery"); only platform-authored text is.
 */
const CLAIM = /\b(best|top|number\s*one|no\.?\s*1|#\s*1|first\s+rank|leading|cheapest|lowest\s+price|guarantee[ds]?|unbeaten|unmatched|rank(?:s|ed|ing|ings)?|page\s*one)\b|#\s*1\b/i;

export const hasRankingClaim = (s: string): boolean => CLAIM.test(String(s ?? ''));
