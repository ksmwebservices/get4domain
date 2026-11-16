import { callApi, guardResponse, notFoundResponse } from '@/lib/v3-public/proxy';
import { useMocks } from '@/lib/v3-public/flag';
import { MOCK_BUSINESS_IDS } from '@/lib/v3-public/mocks';

export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const SRC = /^[A-Za-z]{1,40}$/;
const KW = /^[A-Za-z0-9_-]{1,40}$/;

const redirectTo = (url: string): Response =>
  new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' } });

/**
 * The click-out, reached at /go/{businessId} (middleware rewrites to here when the flag is on and the segment is a business id).
 * It asks the API for the address and answers a redirect, nothing else. The target comes only from the API, which builds it from the stored subdomain.
 * Anything it cannot redirect to is one uniform 404.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const { id } = await ctx.params;
  if (!ID.test(id)) return notFoundResponse();
  const url = new URL(req.url);
  const src = url.searchParams.get('src');
  const kw = url.searchParams.get('kw');
  const q = new URLSearchParams();
  if (src && SRC.test(src)) q.set('src', src);
  if (kw && KW.test(kw)) q.set('kw', kw);

  if (useMocks()) return MOCK_BUSINESS_IDS.includes(id) ? redirectTo(`https://sites.example.invalid/${id}`) : notFoundResponse();

  const r = await callApi(req, `/v3/go/${encodeURIComponent(id)}${q.toString() ? `?${q.toString()}` : ''}`, { method: 'GET', redirect: 'manual' });
  if (!r || r.status < 300 || r.status > 399 || !r.location) return notFoundResponse();
  try {
    const target = new URL(r.location);
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return notFoundResponse();
    return redirectTo(target.toString());
  } catch {
    return notFoundResponse();
  }
}
