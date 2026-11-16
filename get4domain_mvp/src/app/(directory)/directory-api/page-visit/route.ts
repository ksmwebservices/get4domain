import { callApi, guardResponse } from '@/lib/v3-public/proxy';

export const dynamic = 'force-dynamic';

const TOKEN = /^[A-Za-z0-9_.-]{1,60}$/;
const PATH = /^\/[A-Za-z0-9/_-]{0,298}$/;

const ok = (): Response => Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });

/**
 * The page-visit beacon. The browser sends only the path and the campaign tokens (utm_source, utm_medium, utm_campaign, kw);
 * this handler keeps only tokens that look like tokens, forwards them and always answers ok. No visitor data is read, stored or sent.
 */
export async function POST(req: Request): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { return ok(); }
  const out: Record<string, string> = {};
  if (typeof body.path === 'string' && PATH.test(body.path)) out.path = body.path;
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'kw']) {
    const v = body[k];
    if (typeof v === 'string' && TOKEN.test(v)) out[k] = v;
  }
  if (!out.path || Object.keys(out).length < 2) return ok();
  await callApi(req, '/v3/directory/page-visits', { method: 'POST', body: out });
  return ok();
}
