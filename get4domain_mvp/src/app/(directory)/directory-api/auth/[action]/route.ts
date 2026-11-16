import { AUTH_ACTIONS, handleAuth, type AuthAction } from '@/lib/v3-public/auth-proxy';
import { guardResponse, notFoundResponse } from '@/lib/v3-public/proxy';

export const dynamic = 'force-dynamic';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' };

/** Sign in, sign up and password reset request, answered by the server in one fixed shape. Nothing is stored and no token is passed back to the page. */
export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const { action } = await ctx.params;
  if (!AUTH_ACTIONS.includes(action)) return notFoundResponse();
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  return Response.json(await handleAuth(req, action as AuthAction, body), { status: 200, headers: HEADERS });
}
