/**
 * Copy to `<app>/src/middleware.ts` (or `<app>/middleware.ts`). Opening the site with ?preview=<token> (the owner's "Preview my site") shows the draft: the token is kept in a
 * short-lived cookie so every page the owner opens next also shows it, and handed to the page code as a header (see getConnected). Everyone else is untouched.
 */
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest): NextResponse {
  const q = req.nextUrl.searchParams.get('preview');
  const token = q || req.cookies.get('g4d_preview')?.value || '';
  if (!token || !/^[A-Za-z0-9._-]{10,300}$/.test(token)) return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.set('x-g4d-preview', token);
  const res = NextResponse.next({ request: { headers } });
  // Website Manager shows the preview in a frame on another address; a cookie is only sent inside such a frame when it is Secure and SameSite=None (https only)
  const secure = (req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')) === 'https';
  if (q) res.cookies.set('g4d_preview', q, { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', maxAge: 30 * 60, path: '/' });
  return res;
}

export const config = { matcher: ['/((?!_next/|api/|.*\\..*).*)'] };
