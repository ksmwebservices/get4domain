import { apiBase } from './config';
import { isV3PublicEnabled, useMocks } from './flag';

/** The answer of every V3 public route handler when the flag is off or the address is unknown: a plain 404 with nothing to learn from. */
export function notFoundResponse(): Response {
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
}

export function guardResponse(): Response | null {
  return isV3PublicEnabled() ? null : notFoundResponse();
}

/** The address the visitor came from, forwarded so that the API rate limits per visitor and not per server. */
export function forwardedFor(req: Request): string | null {
  const v = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
  return v ? v.split(',')[0].trim().slice(0, 64) || null : null;
}

export interface ApiCall { ok: boolean; status: number; json: unknown; location: string | null }

/** A server-to-server call to the API for the public forms and the click-out. null when the API is not configured or cannot be reached. Mock mode never calls it. */
export async function callApi(req: Request, route: string, init: { method: 'GET' | 'POST'; body?: unknown; redirect?: 'manual' | 'follow' }): Promise<ApiCall | null> {
  if (useMocks()) return null;
  const base = apiBase();
  if (!base) return null;
  const ip = forwardedFor(req);
  try {
    const res = await fetch(`${base}${route}`, {
      method: init.method,
      redirect: init.redirect ?? 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
      headers: { accept: 'application/json', ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(ip ? { 'x-forwarded-for': ip } : {}) },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    let json: unknown = null;
    try { json = await res.json(); } catch { json = null; }
    return { ok: res.ok, status: res.status, json, location: res.headers.get('location') };
  } catch {
    return null;
  }
}
