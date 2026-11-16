import { apiBase, defaultRevalidate } from './config';
import { useMocks } from './flag';
import { mockPage } from './mocks';
import type { Fetched, PageModel } from './types';

/**
 * The typed server-side client of the directory API. Mock mode (the default) returns fixtures and never touches the network; real mode calls the API unchanged.
 * Server use only: no token, no cookie and no visitor data is ever sent.
 */
const TIMEOUT_MS = 4000;

interface Stored { etag: string; body: unknown }
const etags = new Map<string, Stored>();
const MAX_ETAGS = 500;

function remember(url: string, etag: string | null, body: unknown): void {
  if (!etag) return;
  if (etags.size >= MAX_ETAGS) { const first = etags.keys().next(); if (!first.done) etags.delete(first.value); }
  etags.set(url, { etag, body });
}

/** The API wraps JSON in { success, statusCode, data }; the page-model routes may answer the bare model. Both are accepted. */
export function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json && 'success' in json) return (json as { data: T }).data;
  return json as T;
}

/** The seconds the API allows a response to be reused (Cache-Control max-age), or the default. */
export function revalidateFrom(cacheControl: string | null, fallback: number): number {
  const m = /max-age=(\d{1,7})/.exec(cacheControl ?? '');
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

async function getJson<T>(url: string, revalidate: number): Promise<Fetched<T>> {
  const known = etags.get(url);
  const call = (conditional: boolean): Promise<Response> =>
    fetch(url, {
      headers: { accept: 'application/json', ...(conditional && known ? { 'if-none-match': known.etag } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(conditional ? { next: { revalidate } } : { cache: 'no-store' as const }),
    });
  try {
    let res = await call(true);
    if (res.status === 304) {
      if (known) return { kind: 'ok', data: known.body as T };
      res = await call(false); // the cache answered 304 but this process has no body: ask again, unconditionally
    }
    if (res.status === 404) return { kind: 'notFound' };
    if (res.status === 410) return { kind: 'gone' };
    if (!res.ok) return { kind: 'error', status: res.status };
    const data = unwrap<T>(await res.json());
    remember(url, res.headers.get('etag'), data);
    return { kind: 'ok', data };
  } catch {
    return { kind: 'error', status: null };
  }
}

/** A path such as /chennai/plumbers/page/2 to its page model. 404 and 410 are results, not exceptions; everything else is the error state. */
export async function fetchPageModel(path: string): Promise<Fetched<PageModel>> {
  if (useMocks()) {
    const r = mockPage(path);
    return r.kind === 'ok' ? { kind: 'ok', data: r.model } : r;
  }
  const base = apiBase();
  if (!base) return { kind: 'error', status: null };
  return getJson<PageModel>(`${base}/v3/directory/pages/resolve?path=${encodeURIComponent(path)}`, defaultRevalidate());
}

/** The raw text body of a backend route (sitemaps, robots, llms). null for 404, undefined for any other failure. */
export async function fetchText(route: string): Promise<{ status: number; body: string; contentType: string } | null> {
  if (useMocks()) return null;
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: defaultRevalidate() } });
    if (!res.ok) return { status: res.status, body: '', contentType: '' };
    return { status: 200, body: await res.text(), contentType: res.headers.get('content-type') ?? 'text/plain' };
  } catch {
    return null;
  }
}
