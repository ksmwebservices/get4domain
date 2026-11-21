import { apiBase, defaultRevalidate } from './config';
import { useMocks } from './flag';
import { deriveListingState } from './claim';
import { MOCK_DIRECTORY_ROBOTS, MOCK_TOKEN_MAIL_OFF, MOCK_TOKEN_OK, mockBacklinkBlock, mockListing, mockPage, mockSearch, mockSitemap } from './mocks';
import type { BacklinkBlock, ClaimSearchItem, ClaimStatusResult, Fetched, PageModel } from './types';

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

export async function getJson<T>(url: string, revalidate: number): Promise<Fetched<T>> {
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
  if (useMocks()) {
    if (route.endsWith('/robots.txt')) return { status: 200, body: MOCK_DIRECTORY_ROBOTS, contentType: 'text/plain; charset=utf-8' };
    const xml = mockSitemap(route);
    return xml ? { status: 200, body: xml, contentType: 'application/xml; charset=utf-8' } : { status: 404, body: '', contentType: '' };
  }
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

/** The backlink block of a listed business, or null when there is none (or in any failure: the block is optional, the page never waits on it). */
export async function fetchBacklinkBlock(businessId: string): Promise<BacklinkBlock | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(businessId)) return null;
  if (useMocks()) return mockBacklinkBlock(businessId);
  const base = apiBase();
  if (!base) return null;
  const r = await getJson<BacklinkBlock>(`${base}/v3/directory/backlink-block/${encodeURIComponent(businessId)}`, defaultRevalidate());
  return r.kind === 'ok' ? r.data : null;
}

interface RawListItem { slug?: string; name?: string; claimed?: boolean; category?: { name?: string } | null; location?: { name?: string; path?: Array<{ name?: string }> } | null; siteUrl?: string | null; siteState?: string | null }
interface RawList { items?: RawListItem[] }

/** The claim search: businesses by name and city. Only identifying facts are kept; the API also sends a phone number for claimed businesses and that is dropped here. */
export async function searchBusinesses(name: string, city: string): Promise<Fetched<ClaimSearchItem[]>> {
  const n = name.trim().slice(0, 120);
  const c = city.trim().slice(0, 80);
  if (!n && !c) return { kind: 'ok', data: [] };
  if (useMocks()) return { kind: 'ok', data: mockSearch(n, c) };
  const base = apiBase();
  if (!base) return { kind: 'error', status: null };
  const q = new URLSearchParams({ pageSize: '10' });
  if (n) q.set('q', n);
  if (c) q.set('location', c);
  const r = await getJson<RawList>(`${base}/v3/directory/businesses?${q.toString()}`, 60);
  if (r.kind !== 'ok') return r;
  const items = (r.data.items ?? []).filter((i) => i.slug && i.name).map((i): ClaimSearchItem => ({
    slug: String(i.slug), name: String(i.name), category: i.category?.name ?? null, claimed: !!i.claimed,
    place: i.location ? (i.location.path?.length ? i.location.path.map((p) => p.name).filter(Boolean).join(', ') : i.location.name ?? null) : null,
    state: deriveListingState({ claimed: !!i.claimed, siteState: i.siteState, siteUrl: i.siteUrl }),
  }));
  return { kind: 'ok', data: items };
}

/** One listing by slug for the start screen (the same public detail the claim search uses). */
export async function fetchListing(slug: string): Promise<Fetched<ClaimSearchItem>> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { kind: 'notFound' };
  if (useMocks()) {
    const m = mockListing(slug);
    return m ? { kind: 'ok', data: m } : { kind: 'notFound' };
  }
  const base = apiBase();
  if (!base) return { kind: 'error', status: null };
  const r = await getJson<RawListItem>(`${base}/v3/directory/businesses/${encodeURIComponent(slug)}`, 60);
  if (r.kind !== 'ok') return r;
  const i = r.data;
  return { kind: 'ok', data: {
    slug, name: String(i.name ?? slug), category: i.category?.name ?? null, claimed: !!i.claimed,
    place: i.location ? (i.location.path?.length ? i.location.path.map((p) => p.name).filter(Boolean).join(', ') : i.location.name ?? null) : null,
    state: deriveListingState({ claimed: !!i.claimed, siteState: i.siteState, siteUrl: i.siteUrl }),
  } };
}

/** Is this claim link still usable? Never cached: the answer changes the moment the link is used. */
export async function fetchClaimStatus(token: string): Promise<Fetched<ClaimStatusResult>> {
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(token)) return { kind: 'notFound' };
  if (useMocks()) {
    return token === MOCK_TOKEN_OK || token === MOCK_TOKEN_MAIL_OFF
      ? { kind: 'ok', data: { valid: true, businessName: 'Sri Murugan Plumbing', expiresAt: '2099-01-01T00:00:00.000Z' } }
      : { kind: 'notFound' };
  }
  const base = apiBase();
  if (!base) return { kind: 'error', status: null };
  try {
    const res = await fetch(`${base}/v3/claim/${encodeURIComponent(token)}/status`, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' } });
    if (res.status === 404) return { kind: 'notFound' };
    if (!res.ok) return { kind: 'error', status: res.status };
    return { kind: 'ok', data: unwrap<ClaimStatusResult>(await res.json()) };
  } catch {
    return { kind: 'error', status: null };
  }
}
