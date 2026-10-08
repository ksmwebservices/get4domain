import { NextResponse, type NextRequest } from 'next/server';
import { getCategory, resolveDemoQuery, canonicalIndustryId } from '@/data/demo-site';
import { DEMO_PASS_COOKIE, verifyDemoPass } from '@/lib/demo-access';
import { FEATURES, resolveLegacyRoute } from '@/lib/nav.generated';

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
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return legacyDashboardRedirect(req);
  const parts = pathname.split('/').filter(Boolean); // ['demo', <cat>, ...]
  if (parts[0] !== 'demo' || parts.length < 2) return NextResponse.next();

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
  return NextResponse.redirect(entry, 307);
}

export const config = { matcher: ['/demo/:path*', '/dashboard/:path*'] };
