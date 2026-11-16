import robots from '@/app/robots';
import { fetchText } from '@/lib/v3-public/api';
import { siteOrigin } from '@/lib/v3-public/config';
import { guardResponse } from '@/lib/v3-public/proxy';
import { parseDirectoryRobots, robotsToText, type RobotsInput } from '@/lib/v3-public/robots';

export const dynamic = 'force-dynamic';

/**
 * /robots.txt while the flag is on (the middleware rewrites to here; with the flag off the existing robots.ts answers on its own and this does not exist).
 * The existing rules are used as they are. Only when the backend says the directory pages are indexable are the directory Disallow lines and the directory Sitemap line added.
 */
export async function GET(): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const backend = await fetchText('/v3/directory/robots.txt');
  const dir = parseDirectoryRobots(backend && backend.status === 200 ? backend.body : null);
  const origin = siteOrigin();
  const text = robotsToText(robots() as unknown as RobotsInput, dir, origin ? `${origin}/sitemaps/directory-index.xml` : null);
  return new Response(text, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
