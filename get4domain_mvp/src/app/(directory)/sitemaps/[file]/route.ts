import { fetchText } from '@/lib/v3-public/api';
import { guardResponse, notFoundResponse } from '@/lib/v3-public/proxy';
import { sitemapRoute } from '@/lib/v3-public/robots';

export const dynamic = 'force-dynamic';

/**
 * The directory sitemap index (/sitemaps/directory-index.xml) and its chunks (/sitemaps/directory-{n}.xml), served as the backend writes them.
 * Only while the flag is on. The existing /sitemap.xml is not touched. The backend answers an empty set while the directory pages are not indexable, and a 404 beyond the last chunk.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const route = sitemapRoute((await ctx.params).file);
  if (!route) return notFoundResponse();
  const r = await fetchText(route);
  if (!r || r.status === 404) return notFoundResponse();
  if (r.status !== 200) return new Response('Unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
  return new Response(r.body, { status: 200, headers: { 'content-type': r.contentType || 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex' } });
}
