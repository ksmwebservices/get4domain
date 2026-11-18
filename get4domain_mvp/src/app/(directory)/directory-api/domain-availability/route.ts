import { handleDomainAvailability } from '@/lib/v3-public/domain-availability';
import { guardResponse } from '@/lib/v3-public/proxy';

export const dynamic = 'force-dynamic';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };

/** The hero's "Find a domain or website name": the subdomain and the custom domain answer for one typed name, from GET /v3/public/domain-availability. Never cached. */
export async function GET(req: Request): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const name = new URL(req.url).searchParams.get('name') ?? '';
  return Response.json(await handleDomainAvailability(req, name.slice(0, 253)), { status: 200, headers: HEADERS });
}
