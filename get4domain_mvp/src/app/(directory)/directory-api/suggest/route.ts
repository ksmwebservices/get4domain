import { fetchTrees } from '@/lib/v3-public/portal-search';
import { guardResponse } from '@/lib/v3-public/proxy';

export const dynamic = 'force-dynamic';

const BASE = { 'x-robots-tag': 'noindex, nofollow' };

/** The place and category lists the search box filters as the visitor types. The backend has no suggestions route, so the browser gets the two trees once (cached) and filters them itself. Empty lists when the API cannot answer: the search still works without suggestions. */
export async function GET(): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const r = await fetchTrees();
  if (r.kind !== 'ok') return Response.json({ places: [], categories: [] }, { status: 200, headers: { ...BASE, 'cache-control': 'no-store' } });
  return Response.json(r.data, { status: 200, headers: { ...BASE, 'cache-control': 'public, max-age=300' } });
}
