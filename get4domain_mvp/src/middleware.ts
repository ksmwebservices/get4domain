import { NextResponse, type NextRequest } from 'next/server';
import { getCategory, resolveDemoQuery, canonicalIndustryId } from '@/data/demo-site';
import { DEMO_PASS_COOKIE, verifyDemoPass } from '@/lib/demo-access';
import { FEATURES, resolveLegacyRoute } from '@/lib/nav.generated';
import { looksLikeBusinessId } from '@/lib/v3-public/click';
import { isV3PublicEnabled, useMocks } from '@/lib/v3-public/flag';
import { gateBody, gateDirectory } from '@/lib/v3-public/gate';
import { decideHost } from '@/lib/v3-public/host-routing';
import { isInternalOnlyPath, isV3PublicPath, isVendorPlatformFilePath, V3_PAGES_ROOT, V3_ROBOTS_ROUTE, V3_ROUTE_HEADER, V3_VENDOR_SITE_ROOT } from '@/lib/v3-public/routes';
import { vendorOwnsHost } from '@/lib/v3-public/vendor-site';
import { forwardedFor } from '@/lib/v3-public/proxy';

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
 * V3 public site, flag on only (with the flag off this returns at once and nothing changes). Two jobs:
 *  1. Mark requests for V3 public routes with a header, so the root layout leaves out its site-wide JSON-LD for them.
 *  2. The directory gate: an address that could be a directory address (not a live route) is checked with the directory API before any page runs, and the real status is
 *     answered here: 404 or 410 with noindex, 503 if the API cannot answer, otherwise a rewrite to the directory page. (The live root loading.tsx sends a page's status before
 *     the page runs, so a page cannot do this itself.)
 */
async function v3Directory(req: NextRequest): Promise<NextResponse> {
  if (!isV3PublicEnabled()) return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.set(V3_ROUTE_HEADER, '1');
  const { pathname } = req.nextUrl;
  if (isV3PublicPath(pathname)) return NextResponse.next({ request: { headers } });
  if (req.method !== 'GET' && req.method !== 'HEAD') return NextResponse.next();
  const g = await gateDirectory(pathname);
  if (g.kind === 'pass') return NextResponse.next();
  if (g.kind === 'status') {
    return new NextResponse(req.method === 'HEAD' ? null : gateBody(g.status), {
      status: g.status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': g.status === 503 ? 'no-store' : 'public, max-age=60' },
    });
  }
  const url = req.nextUrl.clone();
  url.pathname = `${V3_PAGES_ROOT}${g.path}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

const plainNotFound = (): NextResponse => new NextResponse('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });

/**
 * One-domain host layer (Slice 6). Null, and so no change at all, unless V3_PUBLIC_ENABLED is on AND MAIN_HOST is set (see host-routing.ts).
 * Otherwise it answers for the whole request: a redirect, a plain 404 (unknown, reserved, app, admin, api, media hosts and the marketing routes on the directory host),
 * the directory home rewrite, or passes with the class of host so the later steps know whether the vendor-site rewrite and the directory gate apply.
 */
function hostLayer(req: NextRequest): { done: NextResponse } | { host: string } | null {
  const d = decideHost({
    host: req.headers.get('host'), pathname: req.nextUrl.pathname, search: req.nextUrl.search,
    proto: req.headers.get('x-forwarded-proto') ?? undefined, isBusinessId: (s) => looksLikeBusinessId(s, useMocks()),
  });
  if (!d) return null;
  if (d.action === 'not-found') return { done: plainNotFound() };
  if (d.action === 'redirect') return { done: NextResponse.redirect(d.to, d.status) };
  if (d.action === 'rewrite') {
    const headers = new Headers(req.headers);
    headers.set(V3_ROUTE_HEADER, '1');
    const url = req.nextUrl.clone();
    url.pathname = d.pathname;
    return { done: NextResponse.rewrite(url, { request: { headers } }) };
  }
  return { host: d.host };
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const layer = hostLayer(req);
  if (layer && 'done' in layer) return layer.done;
  const hostKind = layer?.host ?? null;
  // A V3 vendor website: the backend's stored page, relayed. V3 is asked first; a host V3 does not know goes on to the V2 renderer below, so V2 vendors keep working until cutover.
  let v3Owns = false;
  if (hostKind === 'vendor-site') {
    const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0];
    v3Owns = await vendorOwnsHost(host, forwardedFor(req));
    if (v3Owns) {
      const url = req.nextUrl.clone();
      url.pathname = `${V3_VENDOR_SITE_ROOT}${req.nextUrl.pathname === '/' ? '' : req.nextUrl.pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  // /llms.txt and /assets/ reach this function only because of the widened matcher, for a V3 vendor host. For anything else they are served exactly as before (no middleware).
  if (isVendorPlatformFilePath(req.nextUrl.pathname)) return NextResponse.next();
  // Host layer on: only a vendor host reaches the vendor-site rewrite (the directory host must never become /site/directory).
  const rewritten = hostKind === null || hostKind === 'vendor-site' ? vendorHostRewrite(req) : null;
  if (rewritten) return rewritten;
  const { pathname } = req.nextUrl;
  if (!isV3PublicEnabled() && isV3PublicPath(pathname)) {
    // Flag off: the fixed V3 public addresses do not exist. A plain 404 here, before any page renders, is a real HTTP 404.
    return new NextResponse('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  }
  // The internal page behind the directory gate is only ever reached by the gate's rewrite (which runs after this), never by a visitor typing the address.
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
  // Host layer on: the main host keeps marketing and never serves directory addresses (they are on the directory host), so no directory gate there.
  if (parts[0] !== 'demo' || parts.length < 2) return hostKind === 'main' && !isV3PublicPath(pathname) ? NextResponse.next() : v3Directory(req);

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
// /llms.txt and /assets/:path* are matched only so a V3 vendor host can answer them from its stored site; the middleware returns at once for them on every other host and with the flag off
export const config = { matcher: ['/((?!_next/|api/|.*\\..*).*)', '/robots.txt', '/sitemap.xml', '/llms.txt', '/assets/:path*'] };
