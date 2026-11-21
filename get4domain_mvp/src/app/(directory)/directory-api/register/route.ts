import { guardResponse } from '@/lib/v3-public/proxy';
import { handleRegister } from '@/lib/v3-public/register-proxy';

export const dynamic = 'force-dynamic';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' };

/** Self-service registration for the browser: one fixed answer shape (ok, field errors by key, one general key, a one-time handoff code). No token, no API sentence reaches the page. */
export async function POST(req: Request): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  return Response.json(await handleRegister(req, body), { status: 200, headers: HEADERS });
}
