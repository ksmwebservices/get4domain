import { classifyHost, type HostClass, type HostConfig, originFor, readHostConfig } from './hostnames';
import { isV3PublicEnabled } from './flag';
import { LIVE_SEGMENTS } from './routes';

/**
 * Which host a request is for, and what the middleware does about it. Pure: no framework import, so every host class can be tested.
 *
 * Active only while V3_PUBLIC_ENABLED is on AND MAIN_HOST is set. Otherwise the decision is null and the middleware behaves exactly as before
 * (flag off: nothing changes; flag on with no host names: the earlier single-host behaviour).
 *
 *   main (canonical)  marketing stays. `/directory` and `/directory/...` go permanently (308) to the directory host, without the prefix.
 *   main (www)        308 to the canonical main host, same path and query.
 *   directory         `/` is the directory home (internal rewrite, no prefix in the public address). `/directory...` goes (308) to the same address without the prefix.
 *                     Marketing and other live routes are a real 404 here; the directory, claim, account, legal, sitemap, robots and click-out addresses are served.
 *   vendor-site       passes (the vendor site handler, Step 4).
 *   reserved          app, admin, api, media and reserved labels are never handled by this app: a plain 404.
 *   unknown           a plain 404, never the marketing page.
 */
export type HostDecision =
  | { action: 'pass'; host: HostClass['kind'] }
  | { action: 'redirect'; to: string; status: 308 }
  | { action: 'rewrite'; pathname: string }
  | { action: 'not-found'; host: HostClass['kind'] };

export interface HostRequest {
  host: string | null | undefined;
  pathname: string;
  search?: string;
  /** Tells a business id from a campaign slug in `/go/{segment}` (the live campaign page owns the slugs). */
  isBusinessId?: (segment: string) => boolean;
}

/** The internal page that renders the directory home (reached on the directory host by a rewrite from `/`). */
export const DIRECTORY_HOME_ROUTE = '/directory';

/**
 * The commercial public pages that replace live pages on the main host while the host layer is on. The live pages are not edited: these exact addresses are rewritten to the
 * pages under /v3-site (and /login to the Slice 4 sign-in). Sub-paths (/industries/travel and the rest) and every other live address are untouched.
 */
const MAIN_PAGES: Readonly<Record<string, string>> = {
  '/': '/v3-site', '/pricing': '/v3-site/pricing', '/register': '/v3-site/register', '/how-it-works': '/v3-site/how-it-works', '/industries': '/v3-site/industries',
  '/features': '/v3-site/features', '/about': '/v3-site/about', '/contact': '/v3-site/contact', '/login': '/account/login',
};
const REFERRAL_PATH = /^\/r\/([A-Za-z0-9_-]{1,64})\/?$/;

export function mainPageTarget(pathname: string): string | null {
  const key = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (Object.prototype.hasOwnProperty.call(MAIN_PAGES, key)) return MAIN_PAGES[key];
  const m = REFERRAL_PATH.exec(pathname);
  return m ? `/v3-site/r/${m[1]}` : null;
}

/** The internal address of the directory sitemap index (served by the sitemaps handler). */
export const DIRECTORY_SITEMAP_ROUTE = '/sitemaps/directory-index.xml';

/** The address of the directory home for a link on a directory page: `/` once the host layer is on (the directory has its own host), `/directory` before. */
export function directoryHomeHref(cfg: HostConfig = readHostConfig(), env: Record<string, string | undefined> = process.env): string {
  return hostRoutingActive(cfg, env) ? '/' : DIRECTORY_HOME_ROUTE;
}

/** Live route segments that stay reachable on the directory host. Every other live (marketing) route is a 404 there. */
const DIRECTORY_HOST_LIVE_OK: ReadonlySet<string> = new Set(['go', 'robots.txt', 'sitemap.xml']);

/** True while the host layer is on: the flag AND a main host. */
export function hostRoutingActive(cfg: HostConfig = readHostConfig(), env: Record<string, string | undefined> = process.env): boolean {
  return isV3PublicEnabled(env) && !!cfg.main;
}

const firstSegment = (pathname: string): string => pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';

/** `/directory/chennai/plumbers` to `/chennai/plumbers`; `/directory` to `/`. null when the path is not under the prefix. */
export function stripDirectoryPrefix(pathname: string): string | null {
  if (pathname === DIRECTORY_HOME_ROUTE || pathname === `${DIRECTORY_HOME_ROUTE}/`) return '/';
  return pathname.startsWith(`${DIRECTORY_HOME_ROUTE}/`) ? pathname.slice(DIRECTORY_HOME_ROUTE.length) : null;
}

/** The decision for one request, or null when the host layer is not active. */
export function decideHost(req: HostRequest, cfg: HostConfig = readHostConfig(), env: Record<string, string | undefined> = process.env): HostDecision | null {
  if (!hostRoutingActive(cfg, env)) return null;
  const cls = classifyHost(req.host, cfg);
  const search = req.search ?? '';
  const { pathname } = req;

  switch (cls.kind) {
    case 'main': {
      const base = cfg.main!.replace(/^www\./, '');
      if (!cls.canonical) return { action: 'redirect', to: `${originFor(base)}${pathname}${search}`, status: 308 };
      const rest = stripDirectoryPrefix(pathname);
      if (rest !== null && cfg.directory) return { action: 'redirect', to: `${originFor(cfg.directory)}${rest}${search}`, status: 308 };
      // The directory sitemaps list directory-host addresses, so they are answered on the directory host only.
      if (firstSegment(pathname) === 'sitemaps') return { action: 'not-found', host: 'main' };
      const page = mainPageTarget(pathname);
      if (page) return { action: 'rewrite', pathname: page };
      return { action: 'pass', host: 'main' };
    }
    case 'directory': {
      const rest = stripDirectoryPrefix(pathname);
      if (rest !== null) return { action: 'redirect', to: `${originFor(cfg.directory!)}${rest}${search}`, status: 308 };
      if (pathname === '/') return { action: 'rewrite', pathname: DIRECTORY_HOME_ROUTE };
      // The directory's own sitemap: /sitemap.xml here is the directory index (the backend's robots text names /sitemap.xml). The main host's /sitemap.xml is untouched.
      if (pathname === '/sitemap.xml') return { action: 'rewrite', pathname: DIRECTORY_SITEMAP_ROUTE };
      const seg = firstSegment(pathname);
      if (LIVE_SEGMENTS.has(seg) && !DIRECTORY_HOST_LIVE_OK.has(seg)) return { action: 'not-found', host: 'directory' };
      if (seg === 'go' && req.isBusinessId) {
        const m = /^\/go\/([^/]+)\/?$/.exec(pathname);
        if (!m || !req.isBusinessId(m[1])) return { action: 'not-found', host: 'directory' };
      }
      return { action: 'pass', host: 'directory' };
    }
    case 'vendor-site': return { action: 'pass', host: 'vendor-site' };
    case 'reserved': return { action: 'not-found', host: 'reserved' };
    default: return { action: 'not-found', host: 'unknown' };
  }
}
