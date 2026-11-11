import { isUnsafeSeoText } from '../../site-publish/seo/seo-text';

/**
 * The wording check (pure). Owner rule 4: we promise promotion effort, not ranking, leads or sales, and the same goes for what a vendor writes about itself
 * in the places a search engine or a visitor reads first. A vendor's own text is REFUSED when it promises a result or a ranking; nothing is rewritten.
 *
 *  - `strict: false` (page body text): only the promises are refused. A price in a body paragraph is the vendor's own business.
 *  - `strict: true` (SEO text, testimonials, anything that reaches the page head or is presented as a customer's words): promises, a rupee price in any form
 *    and the retired product names are refused (the same rules as the SEO safety filter in `seo-text.ts`).
 *
 * The result carries a stable reason code only. The text itself is never returned, so a caller cannot put it in a log by accident.
 */
export type WordingResult = { ok: true } | { ok: false; reason: 'PROMISE' | 'PRICE_OR_NAME' };

const OUTCOME = '(?:rank\\w*|first\\s+page|top\\s*(?:\\d+|spot|rank\\w*)|number\\s*(?:1|one)|#\\s*1|leads?|sales|results?|traffic|enquir\\w+|bookings?|revenue|customers)';
const PROMISES: readonly RegExp[] = [
  new RegExp(`\\b(?:guarantee[sd]?|assured|promise[sd]?|ensure[sd]?)\\b[^.!?]{0,40}\\b${OUTCOME}\\b`, 'i'),
  new RegExp(`\\b${OUTCOME}\\b[^.!?]{0,40}\\b(?:guarantee[sd]?|assured|promise[sd]?)\\b`, 'i'),
  /\b(?:number\s*(?:1|one)|no\.?\s*1)\b/i,
  /(?:^|\s)#\s*1\b/,
  /\bfirst\s+page\s+(?:of|on)\s+google\b/i,
  /\btop\s+(?:ranking|rank|spot|position)\b/i,
  /\brank(?:ed|ing|s)?\s+(?:#\s*)?(?:1|first|top|number)\b/i,
  /\b100\s*%\s*(?:guarantee\w*|results?|success|sure)/i,
];

export function checkWording(text: string, o: { strict?: boolean } = {}): WordingResult {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return { ok: true };
  if (PROMISES.some((p) => p.test(t))) return { ok: false, reason: 'PROMISE' };
  if ((o.strict ?? true) && isUnsafeSeoText(t)) return { ok: false, reason: 'PRICE_OR_NAME' };
  return { ok: true };
}
