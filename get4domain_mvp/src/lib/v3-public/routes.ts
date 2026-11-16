/**
 * The fixed top-level paths the V3 public site owns. With the flag off the middleware answers a plain 404 for them before anything renders:
 * the live root layout streams its loading shell first, so a notFound() thrown inside a page would otherwise still be sent as HTTP 200.
 * The directory catch-all has no fixed prefix; it gets its real status from incremental static rendering instead (see the catch-all page).
 */
export const V3_PUBLIC_PREFIXES: readonly string[] = ['/directory', '/claim', '/legal', '/account', '/sitemaps'];

/** The internal page the directory fallback rewrite points at, and the request header that arms that rewrite (set only by the middleware, only while the flag is on). */
export const V3_PAGES_ROOT = '/directory-pages';
export const V3_HEADER = 'x-v3-public';

/** True when this path belongs to a fixed V3 public route (the segment itself, or anything below it, or a handler such as /directory-go). */
export function isV3PublicPath(pathname: string): boolean {
  return V3_PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}-`));
}
