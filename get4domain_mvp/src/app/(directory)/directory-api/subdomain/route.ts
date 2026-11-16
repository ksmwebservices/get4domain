import { guardResponse } from '@/lib/v3-public/proxy';
import { handleSubdomainCheck } from '@/lib/v3-public/register-proxy';

export const dynamic = 'force-dynamic';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };

/** Live availability of a site address while the visitor types: `{ state }` only (available, taken, reserved, invalid, short, unknown). */
export async function GET(req: Request): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const slug = new URL(req.url).searchParams.get('slug') ?? '';
  return Response.json(await handleSubdomainCheck(req, slug.slice(0, 80)), { status: 200, headers: HEADERS });
}
