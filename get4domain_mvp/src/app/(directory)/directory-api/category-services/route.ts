import { guardResponse } from '@/lib/v3-public/proxy';
import { handleCategoryServices } from '@/lib/v3-public/register-proxy';

export const dynamic = 'force-dynamic';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };

/** The starter services of one category for the register form's chips: `{ services: string[] }`, empty when the API has none or cannot be read. Names only. */
export async function GET(req: Request): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const key = new URL(req.url).searchParams.get('key') ?? '';
  return Response.json(await handleCategoryServices(key), { status: 200, headers: HEADERS });
}
