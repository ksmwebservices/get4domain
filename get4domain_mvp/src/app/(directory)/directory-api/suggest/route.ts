import { fetchSuggest, SUGGEST_TYPES, type SuggestType } from '@/lib/v3-public/portal-search';
import { guardResponse } from '@/lib/v3-public/proxy';

export const dynamic = 'force-dynamic';

const BASE = { 'x-robots-tag': 'noindex, nofollow' };

/**
 * Suggestions while the visitor types: businesses, categories (with sub categories) and places from the backend's suggest route, at most 8 of each.
 * `?q=` is the typed text, `?type=` an optional comma list of business, category, place. An API that cannot answer is a 502 with `{ error: true }`, so the box can say so instead of showing an empty list as if nothing matched.
 */
export async function GET(req: Request): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const u = new URL(req.url);
  const types = (u.searchParams.get('type') ?? '').split(',').map((t) => t.trim()).filter((t): t is SuggestType => (SUGGEST_TYPES as readonly string[]).includes(t));
  const r = await fetchSuggest((u.searchParams.get('q') ?? '').slice(0, 80), types.length ? types : SUGGEST_TYPES);
  if (r.kind !== 'ok') return Response.json({ error: true }, { status: 502, headers: { ...BASE, 'cache-control': 'no-store' } });
  return Response.json(r.data, { status: 200, headers: { ...BASE, 'cache-control': 'no-store' } });
}
