import { NextResponse, type NextRequest } from 'next/server';
import { getCategory, resolveDemoQuery } from '@/data/demo-site';

// Demo sub-category keyword resolution. A bare /demo/<keyword> that isn't a real
// category (e.g. /demo/dental, /demo/cloud-kitchen, /demo/dentist) is redirected to
// the canonical /demo/<category>/<sub> URL. Runs before routing/caching, so it works
// for on-demand (non-prerendered) keyword paths where an in-page redirect can't.
export function middleware(req: NextRequest): NextResponse {
  const m = req.nextUrl.pathname.match(/^\/demo\/([^/]+)\/?$/);
  if (!m) return NextResponse.next();

  const seg = decodeURIComponent(m[1]).toLowerCase();
  if (getCategory(seg)) return NextResponse.next(); // real category (or alias) → render as-is

  const r = resolveDemoQuery(seg);
  if (!r) return NextResponse.next(); // unknown → let the page return 404

  const url = req.nextUrl.clone();
  url.pathname = r.subId === 'general' ? `/demo/${r.categoryId}` : `/demo/${r.categoryId}/${r.subId}`;
  return NextResponse.redirect(url, 307);
}

export const config = { matcher: '/demo/:path*' };
