/**
 * The pure core of slice 5.21 (trust and safety): no clock, no database, no randomness. It decides:
 *   1. how a value is normalised before it is hashed into the block list (`normaliseBlockValue`),
 *   2. which prohibited phrases a text contains (`matchProhibited`): table-driven, whole-phrase, case-blind; it only REPORTS, it never blocks,
 *   3. how a UPI payee name is compared with the business and owner names (`comparePayeeName`),
 *   4. the plain notice a taken-down site shows (`TAKEDOWN_NOTICE_HTML`),
 *   5. the status moves of a report and of a proof.
 * No phrase, threshold or limit is invented here: the prohibited-term table starts empty and staff fill it.
 */
export type BlockKind = 'PHONE' | 'EMAIL' | 'DOMAIN' | 'UPI' | 'NAME';
export const BLOCK_KINDS: readonly BlockKind[] = ['PHONE', 'EMAIL', 'DOMAIN', 'UPI', 'NAME'];
export type ProofKind = 'GST' | 'UDYAM' | 'SHOP_LICENCE' | 'PROFESSIONAL_REGISTRATION' | 'OTHER';
export const PROOF_KINDS: readonly ProofKind[] = ['GST', 'UDYAM', 'SHOP_LICENCE', 'PROFESSIONAL_REGISTRATION', 'OTHER'];
export type ProofStatus = 'SUBMITTED' | 'CHECKED' | 'MISMATCH';
export type ReportStatus = 'NEW' | 'LOOKING' | 'CLOSED';
export type ReportSubject = 'LISTING' | 'SITE';

/** Collapses spaces, lower-cases, strips accents and punctuation: the one form a name or a phrase is compared in. */
export function foldText(v: string): string {
  return String(v ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

/** The canonical form of a value for the block list, or null when it is not a usable value of that kind. */
export function normaliseBlockValue(kind: BlockKind, raw: string): string | null {
  const v = String(raw ?? '').trim();
  if (!v || v.length > 300) return null;
  switch (kind) {
    case 'PHONE': { const d = v.replace(/\D/g, ''); if (d.length < 10) return null; return d.slice(-10); }
    case 'EMAIL': { const e = v.toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null; }
    case 'DOMAIN': {
      const h = v.toLowerCase().replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].split(':')[0].replace(/^www\./, '').replace(/\.$/, '');
      return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(h) ? h : null;
    }
    case 'UPI': { const u = v.toLowerCase(); return /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/.test(u) ? u : null; }
    case 'NAME': { const n = foldText(v); return n.length >= 2 ? n : null; }
    default: return null;
  }
}

export interface ProhibitedTermRow { term: string; category: string; enabled: boolean }
export interface ProhibitedMatch { term: string; category: string }

/** Stored form of a phrase: folded, single-spaced. */
export const normaliseTerm = (t: string): string => foldText(t);

/** The enabled phrases found in the texts, each once, in table order. A phrase matches only as whole words, so "cat" is not found in "category". */
export function matchProhibited(texts: readonly string[], terms: readonly ProhibitedTermRow[]): ProhibitedMatch[] {
  const hay = ` ${texts.map((t) => foldText(t)).filter(Boolean).join(' | ')} `;
  if (hay.trim() === '') return [];
  const out: ProhibitedMatch[] = []; const seen = new Set<string>();
  for (const t of terms) {
    if (!t.enabled) continue;
    const needle = normaliseTerm(t.term);
    if (!needle || seen.has(needle)) continue;
    if (hay.includes(` ${needle} `)) { seen.add(needle); out.push({ term: needle, category: t.category }); }
  }
  return out;
}

export type PayeeVerdict = 'MATCH' | 'MISMATCH' | 'UNKNOWN';
/**
 * Compares a UPI payee name with the business name and the owner names. MATCH when the payee equals a name, or one holds the other as whole words (a payee "Sri Murugan Stores" for the business
 * "Murugan Stores"). UNKNOWN when there is no payee name to compare. Never blocks anything: the caller raises an alert on MISMATCH.
 */
export function comparePayeeName(payeeName: string | null | undefined, names: readonly string[]): PayeeVerdict {
  const payee = foldText(payeeName ?? '');
  const known = names.map(foldText).filter(Boolean);
  if (!payee || !known.length) return 'UNKNOWN';
  const holds = (a: string, b: string): boolean => ` ${a} `.includes(` ${b} `);
  return known.some((n) => n === payee || holds(payee, n) || holds(n, payee)) ? 'MATCH' : 'MISMATCH';
}

const REPORT_NEXT: Readonly<Record<ReportStatus, readonly ReportStatus[]>> = { NEW: ['LOOKING', 'CLOSED'], LOOKING: ['NEW', 'CLOSED'], CLOSED: ['LOOKING'] };
export const canMoveReport = (from: ReportStatus, to: ReportStatus): boolean => REPORT_NEXT[from].includes(to);

/** Staff may move a proof to CHECKED or MISMATCH (and back to either); only the vendor's own new submission puts it back to SUBMITTED. */
export const STAFF_PROOF_STATUSES: readonly ProofStatus[] = ['CHECKED', 'MISMATCH'];

/**
 * What a taken-down site serves instead of its pages: a plain notice with no business content, no form and no link (owner rule 6: the Legal takedown is the one way a site is hidden besides the vendor's own
 * request). The wording is deliberately neutral; counsel may replace it.
 */
export const TAKEDOWN_NOTICE_HTML = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Not available</title></head><body><main><h1>This page is not available</h1><p>It has been removed.</p></main></body></html>';
