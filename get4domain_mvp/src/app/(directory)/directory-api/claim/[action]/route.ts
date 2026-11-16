import { CLAIM_ACTIONS, handleClaim, type ClaimAction } from '@/lib/v3-public/claim-proxy';
import { guardResponse, notFoundResponse } from '@/lib/v3-public/proxy';

export const dynamic = 'force-dynamic';

const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' };

/** The claim calls of the browser (start, request a code, check the code, set up the account). Answered by the server in one fixed shape; see lib/v3-public/claim-proxy.ts. */
export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const { action } = await ctx.params;
  if (!CLAIM_ACTIONS.includes(action)) return notFoundResponse();
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    body = {};
  }
  const result = await handleClaim(req, action as ClaimAction, body);
  return Response.json(result, { status: 200, headers: HEADERS });
}
