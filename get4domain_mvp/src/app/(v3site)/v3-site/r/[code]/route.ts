import { guardResponse } from '@/lib/v3-public/proxy';
import { checkReferral, REFERRAL_TARGET_NEUTRAL, REFERRAL_TARGET_VALID, referralCodeOk, referralCookieHeader } from '@/lib/v3-public/referral';

export const dynamic = 'force-dynamic';

const BASE = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' };

/**
 * /r/{code} (the main-host rewrite sends it here). A valid code: a first-party cookie that holds the code only, then on to register. An unknown, disabled or unreadable code, or
 * an API that cannot answer: no cookie, and the neutral page (the code is not repeated anywhere). The Location is relative so the request scheme never matters.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const { code } = await ctx.params;
  const neutral = new Response(null, { status: 302, headers: { ...BASE, location: REFERRAL_TARGET_NEUTRAL } });
  if (!referralCodeOk(code)) return neutral;
  const r = await checkReferral(code);
  if (r.kind !== 'ok' || !r.data.valid) return neutral;
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const dev = host === 'localhost' || host.endsWith('.localhost');
  const headers = new Headers({ ...BASE, location: REFERRAL_TARGET_VALID });
  headers.append('set-cookie', referralCookieHeader(code, !dev));
  return new Response(null, { status: 302, headers });
}
