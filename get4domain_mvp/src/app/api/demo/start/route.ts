import { NextResponse } from 'next/server';
import { DEMO_PASS_COOKIE, DEMO_PASS_TTL_SECONDS, signDemoPass } from '@/lib/demo-access';

// Mints a demo access pass for a SIGNED-IN vendor launching a demo tour from their
// dashboard — the "create account → dashboard → visit demo" path. Unlike the public
// OTP flow (/api/demo/verify), there is no 3-visit cap or category-lock here: the caller
// is an authenticated customer previewing the product, not an anonymous prospect. We
// still validate the session against the backend so this can never mint a pass for an
// unauthenticated caller (which would re-open the public-URL hole).
export const runtime = 'nodejs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

interface Body { category?: string }

export async function POST(req: Request): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? '';
  if (!/^bearer\s+.+/i.test(auth)) {
    return NextResponse.json({ ok: false, error: 'Sign in to preview a demo.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const category = body?.category?.trim();
  if (!category) {
    return NextResponse.json({ ok: false, error: 'Missing industry.' }, { status: 400 });
  }

  // Validate the caller's session (backend /auth/refresh is JWT-guarded) before minting.
  try {
    const check = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { Authorization: auth } });
    if (!check.ok) return NextResponse.json({ ok: false, error: 'Your session has expired. Please sign in again.' }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not verify your session. Please try again.' }, { status: 502 });
  }

  const res = NextResponse.json({ ok: true, redirect: `/demo/${category}` });
  res.cookies.set(DEMO_PASS_COOKIE, await signDemoPass(category), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEMO_PASS_TTL_SECONDS,
  });
  return res;
}
