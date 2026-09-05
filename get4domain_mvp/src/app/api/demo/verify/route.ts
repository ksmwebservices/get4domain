import { NextResponse } from 'next/server';
import { DEMO_PASS_COOKIE, DEMO_PASS_TTL_SECONDS, signDemoPass } from '@/lib/demo-access';

// Mints the demo access pass AFTER the client has completed OTP verification.
//
// IMPORTANT (regression fix 28-Aug-2026): OTP request AND verify are done client-side
// (browser → backend), because the backend OTP store is IN-MEMORY per instance —
// requesting the code from the browser and verifying it from THIS server would hit a
// different backend instance and never find the code. So this route does NOT re-verify
// the OTP; it only runs the DB-backed category-lock + 3-visit cap and sets the signed
// httpOnly pass cookie the middleware trusts.
export const runtime = 'nodejs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

interface Body { phone?: string; category?: string; sub?: string; to?: string }

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.phone || !body.category) {
    return NextResponse.json({ ok: false, error: 'Missing phone or category.' }, { status: 400 });
  }
  const phone = body.phone.replace(/\D/g, '').slice(-10);
  const category = body.category;
  const to = typeof body.to === 'string' && body.to.startsWith('/demo/') ? body.to : `/demo/${category}`;

  // Category-lock + 3-visit cap (DB-backed → instance-independent). Only an EXPLICIT
  // deny diverts to sales; a network hiccup never blocks an already-verified visitor.
  try {
    const visitRes = await fetch(`${API_BASE}/leads/demo/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, category, sub: body.sub }),
    });
    if (visitRes.ok) {
      const j = (await visitRes.json()) as { data?: VisitResult } & VisitResult;
      const r = j.data ?? j;
      if (r && r.allowed === false) {
        return NextResponse.json({ ok: false, redirect: `/talk-to-sales?reason=${r.reason}&cat=${encodeURIComponent(r.lockedCategory ?? category)}` });
      }
    }
  } catch {
    /* allow — the client-side OTP verification is the gate */
  }

  const res = NextResponse.json({ ok: true, redirect: to });
  res.cookies.set(DEMO_PASS_COOKIE, await signDemoPass(category), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEMO_PASS_TTL_SECONDS,
  });
  return res;
}

interface VisitResult { allowed: boolean; reason: string; lockedCategory: string | null; count: number }
