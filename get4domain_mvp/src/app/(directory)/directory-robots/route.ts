import { headers } from 'next/headers';
import robots from '@/app/robots';
import { fetchText } from '@/lib/v3-public/api';
import { siteOrigin } from '@/lib/v3-public/config';
import { hostRoutingActive } from '@/lib/v3-public/host-routing';
import { classifyHost, originFor, readHostConfig } from '@/lib/v3-public/hostnames';
import { guardResponse } from '@/lib/v3-public/proxy';
import { directoryHostRobots, parseDirectoryRobots, robotsToText, type RobotsInput } from '@/lib/v3-public/robots';

export const dynamic = 'force-dynamic';

const text = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': status === 200 ? 'public, max-age=300' : 'no-store' } });

/**
 * /robots.txt while the flag is on (the middleware rewrites to here; with the flag off the existing robots.ts answers on its own and this does not exist).
 * Answers per host once the host layer is active (flag on and MAIN_HOST set):
 *   directory host  the backend text as written, with its Sitemap line pointing at the directory host's own sitemap index (none while the pages are not indexable)
 *   main host       the existing rules and the existing main sitemaps only; no directory lines
 * With no host names configured it keeps the earlier single-host behaviour: the existing rules plus the directory additions.
 */
export async function GET(): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const cfg = readHostConfig();
  const h = await headers();
  if (hostRoutingActive(cfg)) {
    const cls = classifyHost(h.get('host'), cfg);
    if (cls.kind === 'directory') {
      const backend = await fetchText('/v3/directory/robots.txt');
      // No backend answer: a 503 (crawlers pause and retry) is safer than guessing rules for a host that is meant to be indexed.
      if (!backend || backend.status !== 200) return text('Unavailable', 503);
      return text(directoryHostRobots(backend.body, originFor(cfg.directory!)));
    }
    if (cls.kind === 'main') return text(robotsToText(robots() as unknown as RobotsInput, { indexable: false, disallow: [] }, null));
    return text('Not found', 404);
  }
  const backend = await fetchText('/v3/directory/robots.txt');
  const dir = parseDirectoryRobots(backend && backend.status === 200 ? backend.body : null);
  const origin = siteOrigin();
  return text(robotsToText(robots() as unknown as RobotsInput, dir, origin ? `${origin}/sitemaps/directory-index.xml` : null));
}
