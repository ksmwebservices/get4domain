import { NextResponse, type NextRequest } from 'next/server';
import { getCategory, resolveDemoQuery, canonicalIndustryId } from '@/data/demo-site';
import { DEMO_PASS_COOKIE, verifyDemoPass } from '@/lib/demo-access';
import { FEATURES, resolveLegacyRoute } from '@/lib/nav.generated';
import { looksLikeBusinessId } from '@/lib/v3-public/click';
import { isV3PublicEnabled, useMocks } from '@/lib/v3-public/flag';
import { isInternalOnlyPath, isV3PublicPath, V3_HEADER, V3_ROBOTS_ROUTE } from '@/lib/v3-public/routes';

/**
 * Dashboard v2: an OLD dashboard address (e.g. /dashboard/my-products, /dashboard/domain-app/billing) goes to its new home with a 308,
 * query string kept — but ONLY for a vendor whose browser carries the g4d_nav_v2 cookie (set by the v2 shell). Everyone else keeps the old
 * dashboard untouched. The shell repeats this check in the browser, so a missing cookie only costs one client-side hop.
 */
function legacyDashboardRedirect(req: NextRequest): NextResponse {
  if (req.cookies.get('g4d_nav_v2')?.value !== '1') return NextResponse.next();
  const to = resolveLegacyRoute(FEATURES, req.nextUrl.pathname, req.nextUrl.search);
  if (!to) return NextResponse.next();
  const url = req.nextUrl.clone();
  const [path, query] = to.split('?');
  url.pathname = path;
  url.search = query ? `?${query}` : '';
  return NextResponse.redirect(url, 308);
}

// Server-side demo gate (dispatch 28-Aug-2026). Runs before any /demo/* content is
// served, so demo websites can NEVER render from a direct URL, bookmark or shared link
// — not even briefly. The only way in is the OTP flow (which sets a signed, httpOnly,
// category-scoped pass via /api/demo/verify). No valid pass → redirect to the
// verification entry; a pass for a different (locked) category → the entry re-checks
// and diverts to /talk-to-sales.
// A vendor's own address (<name>.get4domain.com) is served by the shared site renderer at /site/<name>. Only hosts that nginx actually sends to this app reach
// here, so a vendor whose address still points at its own hand-written app is untouched until nginx is changed for it. The main sites are never rewritten.
const SITE_BASE = (process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN || 'get4domain.com').toLowerCase();
const RESERVED_HOSTS = new Set(['www', 'app', 'api', 'gapi', 'admin', 'mail', 'cdn', 'static', 'staging', 'demo']);
function vendorHostRewrite(req: NextRequest): NextResponse | null {
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0];
  if (!host.endsWith(`.${SITE_BASE}`)) return null;
  const sub = host.slice(0, -(SITE_BASE.length + 1));
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(sub) || RESERVED_HOSTS.has(sub)) return null;
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/site/') || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/uploads')) return null;
  const url = req.nextUrl.clone();
  url.pathname = `/site/${sub}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

/**
 * V3 public site: /go/{businessId} is the directory click-out, but /go/[slug] is already a live campaign page. With V3_PUBLIC_ENABLED off this returns null at once and nothing changes.
 * With it on, only a segment that looks like a business id (not a campaign slug) is rewritten to the click-out handler; every other /go/ address still reaches the live page.
 */
function v3ClickOutRewrite(req: NextRequest): NextResponse | null {
  if (!isV3PublicEnabled()) return null;
  const m = /^\/go\/([^/]+)\/?$/.exec(req.nextUrl.pathname);
  if (!m || !looksLikeBusinessId(m[1], useMocks())) return null;
  const url = req.nextUrl.clone();
  url.pathname = `/directory-go/${m[1]}`;
  return NextResponse.rewrite(url);
}

/**
 * The directory has no route of its own at the root. next.config has a fallback rewrite (it runs only for an address that no page, file or other route matched) that
 * sends such an address to the directory page, but only for a request carrying this header. Only this middleware sets it, and only while the flag is on; it also
 * removes a copy sent by a visitor. With the flag off the rewrite never matches, so an unknown address is the same 404 it always was.
 */
function v3PassThrough(req: NextRequest): NextResponse {
  const on = isV3PublicEnabled();
  if (!on && !req.headers.has(V3_HEADER)) return NextResponse.next();
  const headers = new Headers(req.headers);
  if (on) headers.set(V3_HEADER, '1');
  else headers.delete(V3_HEADER);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const rewritten = vendorHostRewrite(req);
  if (rewritten) return rewritten;
  const { pathname } = req.nextUrl;
  if (!isV3PublicEnabled() && isV3PublicPath(pathname)) {
    // Flag off: the fixed V3 public addresses do not exist. A plain 404 here, before any page renders, is a real HTTP 404.
    return new NextResponse('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  }
  // The internal page behind the directory fallback is only ever reached by the rewrite below (which runs after this), never by a visitor typing the address.
  if (isInternalOnlyPath(pathname)) {
    return new NextResponse('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  }
  // Flag on: /robots.txt of the main host is answered by the handler that adds the directory lines (the existing robots.ts stays as it is and answers while the flag is off).
  if (pathname === '/robots.txt' && isV3PublicEnabled()) {
    const url = req.nextUrl.clone();
    url.pathname = V3_ROBOTS_ROUTE;
    return NextResponse.rewrite(url);
  }
  const clickOut = v3ClickOutRewrite(req);
  if (clickOut) return clickOut;
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return legacyDashboardRedirect(req);
  const parts = pathname.split('/').filter(Boolean); // ['demo', <cat>, ...]
  if (parts[0] !== 'demo' || parts.length < 2) return v3PassThrough(req);

  const seg = decodeURIComponent(parts[1]).toLowerCase();

  // Canonicalize a bare sub-category keyword (/demo/dental → /demo/clinic/dental) first;
  // the redirected path is gated on its next pass through this middleware.
  if (!getCategory(seg)) {
    const r = resolveDemoQuery(seg);
    if (!r) return NextResponse.next(); // unknown → let the page 404
    const url = req.nextUrl.clone();
    url.pathname = r.subId === 'general' ? `/demo/${r.categoryId}` : `/demo/${r.categoryId}/${r.subId}`;
    return NextResponse.redirect(url, 307);
  }

  const canonical = canonicalIndustryId(seg);
  const pass = await verifyDemoPass(req.cookies.get(DEMO_PASS_COOKIE)?.value);
  if (pass && canonicalIndustryId(pass.category) === canonical) return NextResponse.next();

  // No / wrong pass → verification entry (carries the intended demo path).
  const entry = req.nextUrl.clone();
  entry.pathname = '/visit-demo';
  entry.search = `?to=${encodeURIComponent(pathname)}`;
  const gated = NextResponse.redirect(entry, 307);
  // Tell crawlers this gate redirect is not indexable. /demo/ is intentionally NOT disallowed in robots.txt
  // yet, so Google can fetch these URLs and see this header and the page-level noindex.
  gated.headers.set('X-Robots-Tag', 'noindex');
  return gated;
}

// the host rewrite needs every page path (not files, not framework paths); the demo and dashboard checks above still only act on their own paths
// robots.txt and sitemap.xml are matched too, so a vendor's own host answers them for itself (the main host passes straight through)
export const config = { matcher: ['/((?!_next/|api/|.*\\..*).*)', '/robots.txt', '/sitemap.xml'] };
