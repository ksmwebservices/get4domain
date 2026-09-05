import { NextResponse } from 'next/server';
import { DEMO_PASS_COOKIE, DEMO_PASS_TTL_SECONDS, signDemoPass } from '@/lib/demo-access';

// The ONLY place a demo access pass is minted. It re-runs the real OTP verification
// server-to-server (so the pass can't be forged without a valid code) and applies the
// category-lock + 3-visit cap, then sets a signed httpOnly cookie the middleware trusts.
export const runtime = 'nodejs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

interface Body { name?: string; phone?: string; code?: string; category?: string; sub?: string; to?: string }

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.phone || !body.code || !body.category) {
    return NextResponse.json({ ok: false, error: 'Missing name, phone or code.' }, { status: 400 });
  }
  const phone = body.phone.replace(/\D/g, '').slice(-10);
  const category = body.category;
  const to = typeof body.to === 'string' && body.to.startsWith('/demo/') ? body.to : `/demo/${category}`;

  // 1. Verify OTP + record the CRM lead (backend consumes the one-time code).
  const verifyRes = await fetch(`${API_BASE}/leads/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: body.name || 'Guest', phone, industry: category, code: body.code }),
  }).catch(() => null);
  if (!verifyRes || !verifyRes.ok) {
    const msg = (await verifyRes?.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json({ ok: false, error: msg?.message || 'Invalid or expired code.' }, { status: 401 });
  }

  // 2. Category-lock + 3-visit cap (server-enforced). A tracking hiccup must not block a verified visitor.
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
    /* allow */
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
