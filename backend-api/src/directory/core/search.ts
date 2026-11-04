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
