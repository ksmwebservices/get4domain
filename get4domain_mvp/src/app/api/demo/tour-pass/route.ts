import { NextResponse } from 'next/server';
import { DEMO_PASS_COOKIE, DEMO_PASS_TTL_SECONDS, signDemoPass } from '@/lib/demo-access';
import { canonicalIndustryId } from '@/data/demo-site';

// Mints a demo access pass for an ALREADY-VERIFIED sandbox tour session, WITHOUT a
// second OTP. A demo/sandbox vendor reached the dashboard only by passing OTP
// (book-demo / visit-demo), so re-gating "View Website" is pure friction and caused a
// redirect loop once the 45-min pass expired while the dashboard session lived on.
//
// Security: the gate still fully protects cold/anonymous visitors — this route mints a
// pass ONLY when the caller presents a token the BACKEND accepts as a sandbox vendor
// (verified via GET /auth/me; a forged/expired token 401s and gets nothing). The pass is
// scoped to the vendor's OWN industry read from that authenticated record — never a
// client-supplied category — so it can't be used to unlock other categories' demos.
export const runtime = 'nodejs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

export async function POST(req: Request): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  // Validate the token against the backend and read the caller's OWN vendor record.
  interface Me { industry?: string | null; isSandbox?: boolean }
  let me: Me | null = null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: auth } });
    if (!res.ok) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    const j = (await res.json()) as { data?: Me } & Me;
    me = j?.data ?? j;
  } catch {
    return NextResponse.json({ ok: false, error: 'Verification unavailable' }, { status: 502 });
  }

  // Only sandbox/demo sessions get the auto-pass. A real vendor's public site is a
  // separate concern and must not gain a free demo-category pass here.
  if (!me?.isSandbox) {
    return NextResponse.json({ ok: false, error: 'Not a demo session' }, { status: 403 });
  }

  const category = canonicalIndustryId((me.industry ?? '').toLowerCase());
  if (!category) {
    return NextResponse.json({ ok: false, error: 'No demo industry for this session' }, { status: 400 });
  }

  const out = NextResponse.json({ ok: true, redirect: `/demo/${category}` });
  out.cookies.set(DEMO_PASS_COOKIE, await signDemoPass(category), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEMO_PASS_TTL_SECONDS,
  });
  return out;
}
