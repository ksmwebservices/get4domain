/**
 * Text rules for everything the platform writes into the head of a page (titles, descriptions, Open Graph, structured data). Pure.
 *  - No rupee price in any form (a symbol, "Rs", "INR", "rupees", "999/month"): prices live in the page body only, never in SEO text.
 *  - No retired product names (Workspace, BOS, LeadSpace) and no old tagline.
 * A string that breaks a rule is replaced by its fallback; it is never edited into something that merely looks different.
 */
const PRICE = /₹|\bRs\.?\s*\d|\bINR\s*\d|\d[\d,]*\s*rupees?\b|\d[\d,]*\s*\/\s*(?:mo|month|yr|year)\b/i;
const BANNED = /Workspace|\bBOS\b|LeadSpace|Identity Partner|Online Identity|Business Operating System/i;

export const isUnsafeSeoText = (s: string): boolean => PRICE.test(s) || BANNED.test(s);

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** The text if it is non-empty and safe, else the fallback. */
export function safeSeoText(text: string | null | undefined, fallback: string): string {
  const t = squash(String(text ?? ''));
  return t && !isUnsafeSeoText(t) ? t : fallback;
}

/** Cuts at a word boundary and adds an ellipsis; text that already fits is returned unchanged. */
export function cutAtWord(text: string, max: number): string {
  const t = squash(text);
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1).replace(/\s+\S*$/, '');
  return `${head || t.slice(0, max - 1)}…`;
}

/**
 * A meta description from the vendor's own sentences: split into sentences, repeats dropped (case-insensitive), any sentence with a price or a banned word
 * skipped, joined in order while it fits `max` characters, one full stop at the end. Returns '' when nothing usable is left (the caller then falls back).
 */
export function composeDescription(parts: string[], max = 160): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of parts.flatMap((p) => squash(String(p ?? '')).split(/(?<=[.!?।])\s+/))) {
    const sentence = s.replace(/[.!?\s]+$/u, '').trim();
    const key = sentence.toLowerCase();
    if (!sentence || seen.has(key) || isUnsafeSeoText(sentence)) continue;
    seen.add(key);
    const next = [...out, sentence].join('. ') + '.';
    if (next.length > max) { if (out.length === 0) out.push(cutAtWord(sentence, max - 1).replace(/…$/, '')); break; }
    out.push(sentence);
  }
  return out.length ? `${out.join('. ')}.` : '';
}

/** The first safe candidate that fits `max` characters; else the first safe candidate cut at a word; else the last candidate cut. */
export function fitTitle(candidates: string[], max = 60): string {
  const cleaned = candidates.map(squash).filter(Boolean);
  const safe = cleaned.filter((c) => !isUnsafeSeoText(c));
  const fits = safe.find((c) => c.length <= max);
  if (fits) return fits;
  return cutAtWord(safe[0] ?? cleaned[cleaned.length - 1] ?? '', max);
}
