/**
 * The scan every model output goes through before it is returned (slice 5.11). Pure. A suggestion that contains a price, a banned word or something that looks like personal data is
 * BLOCKED outright (nothing is returned and the credits are refunded); otherwise it is cleaned and capped in length. It is never auto-published: the vendor accepts it into a draft field.
 */
export type ScanFlag = 'PRICE' | 'BANNED_WORD' | 'EMAIL' | 'PHONE' | 'ID_NUMBER' | 'EMPTY';
export interface ScanResult { ok: boolean; text: string; flags: ScanFlag[] }

const PRICE = [
  /[₹$€£]\s?\d/,
  /\b(?:rs|inr|usd|eur|gbp)\.?\s?\d/i,
  /\d[\d,]*(?:\.\d+)?\s?(?:rupees?|rs|inr|usd|eur|gbp|dollars?|euros?|pounds?)\b/i,
];
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const AADHAAR = /(?<!\d)\d{4}[ -]?\d{4}[ -]?\d{4}(?!\d)/;
const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/;
const CARD = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/;
const DATEISH = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g;
const PHONE = /(?<![\w])\+?\d[\d\s().-]{6,}\d(?![\w])/g;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const digitsOf = (s: string): number => s.replace(/\D/g, '').length;

export function scanOutput(raw: unknown, o: { maxChars: number; bannedWords: readonly string[] }): ScanResult {
  if (typeof raw !== 'string') return { ok: false, text: '', flags: ['EMPTY'] };
  const text = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (!text) return { ok: false, text: '', flags: ['EMPTY'] };
  const flags: ScanFlag[] = [];
  if (PRICE.some((r) => r.test(text))) flags.push('PRICE');
  for (const w of o.bannedWords) { const t = w.trim(); if (t && new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(t)}(?![\\p{L}\\p{N}])`, 'iu').test(text)) { flags.push('BANNED_WORD'); break; } }
  if (EMAIL.test(text)) flags.push('EMAIL');
  if (AADHAAR.test(text) || PAN.test(text) || (CARD.test(text) && digitsOf((text.match(CARD) ?? [''])[0]) >= 13)) flags.push('ID_NUMBER');
  const noDates = text.replace(DATEISH, ' ');
  for (const m of noDates.matchAll(PHONE)) { const d = digitsOf(m[0]); if (d >= 8 && d <= 15) { flags.push('PHONE'); break; } }
  if (flags.length) return { ok: false, text: '', flags };
  let out = text;
  if (out.length > o.maxChars) {
    const cut = out.slice(0, o.maxChars); const sp = cut.lastIndexOf(' ');
    out = (sp > o.maxChars * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '');
  }
  return { ok: true, text: out, flags: [] };
}
