/** Pure search rules for the public directory (slice 5.7): query normalisation, a safe prefix tsquery, paging caps, relevance for the in-memory twin, and sponsored merging. */
const MAX_TEXT = 80;
const MAX_TOKENS = 8;

export function normaliseQuery(input: unknown): { text: string; tokens: string[] } {
  const raw = typeof input === 'string' ? input : '';
  const text = raw.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT).trim();
  const tokens = text ? text.split(' ').slice(0, MAX_TOKENS) : [];
  return { text: tokens.join(' '), tokens };
}

/** `plumb:* & chen:*`: only letters and digits reach the database function, so the text can never add operators. */
export function toPrefixTsQuery(tokens: readonly string[]): string {
  return tokens.map((t) => t.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).map((t) => `${t}:*`).join(' & ');
}

export function clampPage(page: unknown, pageSize: unknown, maxPageSize: number, defaultPageSize: number): { page: number; pageSize: number; skip: number } {
  const p = Number.isFinite(Number(page)) && Number(page) >= 1 ? Math.min(Math.floor(Number(page)), 1000) : 1;
  const sRaw = Number.isFinite(Number(pageSize)) && Number(pageSize) >= 1 ? Math.floor(Number(pageSize)) : defaultPageSize;
  const s = Math.min(sRaw, maxPageSize);
  return { page: p, pageSize: s, skip: (p - 1) * s };
}

/** Relevance used by the in-memory twin (the database uses ts_rank and trigram similarity): every word must match; a name hit counts 3, a category hit 2, a description hit 1. */
export function scoreMatch(tokens: readonly string[], b: { name: string; description: string; category: string }): number {
  if (!tokens.length) return 0;
  const name = b.name.toLowerCase(); const cat = b.category.toLowerCase(); const desc = b.description.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    const s = name.includes(t) ? 3 : cat.includes(t) ? 2 : desc.includes(t) ? 1 : 0;
    if (s === 0) return 0;
    score += s;
  }
  return score;
}

/**
 * Organic results keep their order. Sponsored items are inserted at FIXED positions: the first before the first organic item, then one after every `every` organic items.
 * A sponsored item without a label is refused: it can never be shown unlabelled.
 */
export function mergeSponsored<O extends { id: string; sponsored: false }, S extends { id: string; sponsored: true; label: string }>(organic: readonly O[], sponsored: readonly S[], every: number): Array<O | S> {
  for (const s of sponsored) if (!s.label || !s.label.trim()) throw new Error('a sponsored item must carry its label');
  const out: Array<O | S> = [];
  const gap = Math.max(1, Math.floor(every));
  let si = 0;
  for (let i = 0; i < organic.length; i++) {
    if (i % gap === 0 && si < sponsored.length) out.push(sponsored[si++]);
    out.push(organic[i]);
  }
  if (organic.length === 0 && sponsored.length) out.push(sponsored[0]);
  return out;
}

// ── B3.5: what a text search matches, typed places, suggestions ────────────────────────────────────────────────────────────────────

const words = (s: string): string[] => normaliseQuery(s).tokens;

/** Every word a category answers to: its own name, its parents' names (so a family word finds its categories) and the staff-reviewed keywords (singular, plural, synonyms, specialisations). */
export interface CategoryTermsInput { id: string; name: string; slug: string; ancestors: readonly string[]; keywords?: { singular?: string; plural?: string; synonyms?: readonly string[]; specialisations?: readonly string[] } | null }
export interface CategoryTerms { id: string; own: string[]; all: string[] }
export function categoryTerms(c: CategoryTermsInput): CategoryTerms {
  const own = [...new Set([...words(c.name), ...words(c.slug.replace(/-/g, ' '))])];
  const kw = c.keywords ? [c.keywords.singular ?? '', c.keywords.plural ?? '', ...(c.keywords.synonyms ?? []), ...(c.keywords.specialisations ?? [])].flatMap((x) => words(String(x))) : [];
  const parents = c.ancestors.flatMap((a) => words(a));
  return { id: c.id, own, all: [...new Set([...own, ...kw, ...parents])] };
}
/** A word matches a category when it is the start of one of its words (two letters at least, so one letter never matches everything). */
export const categoriesForToken = (token: string, cats: readonly CategoryTerms[]): string[] =>
  token.length < 2 ? [] : cats.filter((c) => c.all.some((w) => w.startsWith(token))).map((c) => c.id);

/** Typed place text: every typed word must start one of the words of the place and its parents, and the place's own name must carry at least one typed word. An exact name wins alone. Capped. */
export interface PlaceRowLite { id: string; parentId: string | null; name: string; slug: string }
export function resolvePlaceText(rows: readonly PlaceRowLite[], input: unknown, cap = 20): PlaceRowLite[] {
  const typed = words(String(input ?? '').replace(/[,/]+/g, ' '));
  if (!typed.length) return [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const chain = (r: PlaceRowLite): PlaceRowLite[] => { const out: PlaceRowLite[] = []; let cur: PlaceRowLite | undefined = r; let g = 0; while (cur && g++ < 10) { out.push(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined; } return out; };
  const full = typed.join(' ');
  const exact = rows.filter((r) => words(r.name).join(' ') === full || r.slug === full.replace(/ /g, '-'));
  if (exact.length) return exact.slice(0, cap);
  const hits = rows.filter((r) => {
    const pathWords = chain(r).flatMap((p) => words(p.name));
    const own = words(r.name);
    return typed.every((t) => pathWords.some((w) => w.startsWith(t))) && typed.some((t) => own.some((w) => w.startsWith(t)));
  });
  return hits.slice(0, cap);
}

/** A six digit postal code typed as the place. */
export const asPincode = (input: unknown): string | null => { const t = String(input ?? '').trim(); return /^[1-9][0-9]{5}$/.test(t) ? t : null; };

/** A safe prefix for a LIKE query: letters, digits and spaces only, so no wildcard can come from the visitor. */
export const likePrefix = (text: string): string => `${text.replace(/[^\p{L}\p{N} ]/gu, '')}%`;

export const SUGGEST_MAX = 8;
export const SUGGEST_TYPES = ['category', 'place', 'business'] as const;
export type SuggestType = (typeof SUGGEST_TYPES)[number];
export function parseSuggestTypes(input: unknown): SuggestType[] {
  const asked = String(input ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const ok = SUGGEST_TYPES.filter((t) => asked.includes(t));
  return ok.length ? ok : [...SUGGEST_TYPES];
}
/** Rank a name against the typed text: whole-name start, then a word start, then a word anywhere; lower is better, null = no match. */
export function nameRank(name: string, text: string): number | null {
  const n = words(name).join(' '); if (!text) return null;
  if (n.startsWith(text)) return 0;
  const tokens = text.split(' ');
  if (tokens.every((t) => n.split(' ').some((w) => w.startsWith(t)))) return 1;
  return null;
}
