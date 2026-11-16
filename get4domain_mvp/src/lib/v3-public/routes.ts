/**
 * The fixed top-level paths the V3 public site owns. With the flag off the middleware answers a plain 404 for them before anything renders.
 * The directory addresses (/{city} and the rest) are decided by the directory gate (gate.ts) before any page runs.
 */
export const V3_PUBLIC_PREFIXES: readonly string[] = ['/directory', '/claim', '/legal', '/account', '/sitemaps'];

/** The internal page the directory gate rewrites an existing directory address to. */
export const V3_PAGES_ROOT = '/directory-pages';
/** Set by the middleware (only while the flag is on) on requests for V3 public routes. The root layout reads it to leave out the site-wide JSON-LD. */
export const V3_ROUTE_HEADER = 'x-v3-route';

/** The internal handler that answers /robots.txt while the flag is on (reached only by the middleware rewrite). */
export const V3_ROBOTS_ROUTE = '/directory-robots';

/** Paths that exist only as rewrite targets: a visitor typing them gets a 404 (the rewrite runs after the middleware, so it is not affected). */
export function isInternalOnlyPath(pathname: string): boolean {
  return pathname === V3_PAGES_ROOT || pathname.startsWith(`${V3_PAGES_ROOT}/`) || pathname === V3_ROBOTS_ROUTE;
}

/** True when this path belongs to a fixed V3 public route (the segment itself, or anything below it, or a handler such as /directory-go). */
export function isV3PublicPath(pathname: string): boolean {
  return V3_PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}-`));
}

/**
 * The first path segments the live site already answers (route folders of src/app, the marketing group, and the redirects in next.config.ts).
 * The directory gate never looks at these. A test compares this list with the folders of src/app, so a new live route cannot be forgotten.
 */
export const LIVE_SEGMENTS: ReadonlySet<string> = new Set([
  'about', 'admin', 'admin-team', 'api', 'book-demo', 'cart', 'checkout', 'contact', 'customer', 'd', 'dashboard', 'demo', 'digital-growth', 'domain-app', 'domain-campaign',
  'engine', 'features', 'go', 'how-it-works', 'industries', 'leadspace', 'login', 'ls', 'managed-services', 'offline', 'order-success', 'pay', 'portfolio', 'pricing',
  'privacy-policy', 'products', 'quote', 'refund-policy', 'register', 'robots.txt', 'site', 'sitemap.xml', 'support', 'talk-to-sales', 'templates', 'terms',
  'theme-local-test', 'theme-pack', 'theme-preview', 'visit-demo',
]);

const SEGMENT = /^[A-Za-z0-9-]{1,80}$/;

/**
 * The directory address a request path could be, or null when the directory gate must leave it alone: a live route, one of the fixed V3 routes, or something that cannot be a directory address.
 */
export function directoryCandidate(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || parts.length > 5) return null;
  if (LIVE_SEGMENTS.has(parts[0].toLowerCase()) || isV3PublicPath(pathname) || isInternalOnlyPath(pathname)) return null;
  if (!parts.every((p) => SEGMENT.test(p))) return null;
  return `/${parts.join('/')}`;
}
