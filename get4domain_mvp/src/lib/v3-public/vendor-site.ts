import { apiBase } from './config';
import { useMocks } from './flag';
import { mockVendorAnswer } from './vendor-site-mocks';

/**
 * The V3 vendor website, served by host. The backend stores complete pages (SEO head, JSON-LD, backlink block, sitemap, robots, llms) and answers
 * GET /v3/public/site/by-host?host=&path=&lang= ; this app only relays that answer. It never re-renders, edits or adds to a stored page, so noindex states,
 * Free (listing only) rules and takedowns are exactly the backend's. Mock mode (the default) answers from fixtures and never touches the network.
 */
export type VendorPage =
  | { kind: 'page'; body: string; contentType: string; etag: string | null; robots: string | null; lang: string | null; cacheControl: string | null }
  | { kind: 'not-modified'; etag: string | null; cacheControl: string | null }
  | { kind: 'redirect'; status: 301 | 302; location: string }
  | { kind: 'notice'; html: string }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

const TIMEOUT_MS = 4000;

/** A redirect target the API gave: an https address with a host and no credentials. Anything else is not followed. */
export function safeLocation(value: string | null | undefined): string | null {
  try {
    const u = new URL(String(value ?? ''));
    if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export interface VendorFetchOptions { ifNoneMatch?: string | null; forwardedFor?: string | null }

/** The published page (or platform file) of the vendor behind `host`, for `path`. */
export async function fetchVendorPage(host: string, path: string, o: VendorFetchOptions = {}): Promise<VendorPage> {
  if (useMocks()) return fromMock(mockVendorAnswer(host, path, o.ifNoneMatch));
  const base = apiBase();
  if (!base) return { kind: 'unavailable' };
  try {
    const res = await fetch(`${base}/v3/public/site/by-host?host=${encodeURIComponent(host)}&path=${encodeURIComponent(path)}&lang=`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: '*/*', ...(o.ifNoneMatch ? { 'if-none-match': o.ifNoneMatch } : {}), ...(o.forwardedFor ? { 'x-forwarded-for': o.forwardedFor } : {}) },
    });
    const cacheControl = res.headers.get('cache-control');
    if (res.status === 200) {
      return { kind: 'page', body: await res.text(), contentType: res.headers.get('content-type') ?? 'text/html; charset=utf-8', etag: res.headers.get('etag'), robots: res.headers.get('x-robots-tag'), lang: res.headers.get('content-language'), cacheControl };
    }
    if (res.status === 304) return { kind: 'not-modified', etag: res.headers.get('etag'), cacheControl };
    if (res.status === 301 || res.status === 302) {
      const location = safeLocation(res.headers.get('location'));
      return location ? { kind: 'redirect', status: res.status, location } : { kind: 'unavailable' };
    }
    if (res.status === 451) return { kind: 'notice', html: await res.text() };
    if (res.status === 404) return { kind: 'not-found' };
    return { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

function fromMock(a: ReturnType<typeof mockVendorAnswer>): VendorPage {
  switch (a.status) {
    case 200: return { kind: 'page', body: a.body, contentType: a.contentType, etag: a.etag, robots: a.robots, lang: a.lang, cacheControl: a.cacheControl };
    case 304: return { kind: 'not-modified', etag: a.etag, cacheControl: a.cacheControl };
    case 301: case 302: return { kind: 'redirect', status: a.status, location: a.location };
    case 451: return { kind: 'notice', html: a.body };
    case 404: return { kind: 'not-found' };
    default: return { kind: 'unavailable' };
  }
}

// ── Does V3 own this host? (middleware: V3 first, then the V2 renderer for a host V3 does not know) ──

interface Memo { at: number; owns: boolean }
const memo = new Map<string, Memo>();
const MAX_MEMO = 500;
const TTL_MS = 60_000;

/**
 * True when the backend has a published V3 site (or a redirect, or a takedown notice) for the host. Only a plain not-found means "not V3".
 * A backend that cannot answer counts as V3 (the visitor gets a 503, not another system's 404). Remembered for a minute, except an unavailable answer.
 */
export async function vendorOwnsHost(host: string, forwardedFor?: string | null, now: () => number = Date.now): Promise<boolean> {
  const key = host.toLowerCase();
  const hit = memo.get(key);
  if (hit && now() - hit.at < TTL_MS) return hit.owns;
  const r = await fetchVendorPage(key, '/', { forwardedFor });
  const owns = r.kind !== 'not-found';
  if (r.kind !== 'unavailable') {
    if (memo.size >= MAX_MEMO) { const first = memo.keys().next(); if (!first.done) memo.delete(first.value); }
    memo.set(key, { at: now(), owns });
  }
  return owns;
}

/** Forget what was remembered (tests). */
export function resetVendorMemo(): void { memo.clear(); }

// ── The response ──

export interface VendorResponseParts { status: number; headers: Record<string, string>; body: string | null }

/** Shown when the site cannot be fetched: kind, noindex, and no phone, email, WhatsApp or form. */
export const NOT_AVAILABLE_HTML =
  '<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>This website is not available right now</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem"><main><h1>This website is not available right now</h1><p>Please try again in a few minutes.</p></main></body></html>';

const NOINDEX = 'noindex, nofollow';

/** The answer to send for a fetched page. A stored page is relayed unchanged; everything this app writes itself is plain, uncached and noindex. */
export function vendorResponseParts(r: VendorPage, method: string = 'GET'): VendorResponseParts {
  const head = method === 'HEAD';
  switch (r.kind) {
    case 'page': {
      const headers: Record<string, string> = { 'content-type': r.contentType, 'cache-control': r.cacheControl ?? 'public, max-age=60', 'x-content-type-options': 'nosniff' };
      if (r.etag) headers.etag = r.etag;
      if (r.lang) headers['content-language'] = r.lang;
      if (r.robots) headers['x-robots-tag'] = r.robots;
      return { status: 200, headers, body: head ? null : r.body };
    }
    case 'not-modified': {
      const headers: Record<string, string> = { 'cache-control': r.cacheControl ?? 'public, max-age=60' };
      if (r.etag) headers.etag = r.etag;
      return { status: 304, headers, body: null };
    }
    case 'redirect': return { status: r.status, headers: { location: r.location, 'cache-control': 'public, max-age=300' }, body: null };
    case 'notice': return { status: 451, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': NOINDEX }, body: head ? null : r.html };
    case 'not-found': return { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': NOINDEX }, body: head ? null : 'Not found' };
    default: return { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': NOINDEX, 'retry-after': '120' }, body: head ? null : NOT_AVAILABLE_HTML };
  }
}
