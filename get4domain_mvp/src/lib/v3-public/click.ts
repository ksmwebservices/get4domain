/**
 * The click-out. The page model gives the API-host address (`.../v3/go/{businessId}?src=..`). A page never links to it, and never to a business site: it links to our own `/go/{id}`, which proxies to the API and redirects.
 */
const GO = /\/v3\/go\/([A-Za-z0-9_-]{1,64})(?:\?([^#]*))?$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUID = /^c[a-z0-9]{20,30}$/;
const MOCK_ID = /^b-\d{3,6}$/;

/**
 * Does a /go/{segment} look like a business id rather than the live campaign slug that already owns /go/[slug]?
 * The backend does not document the id format (gap G3), so this accepts a uuid or a cuid, and the fixture ids only in mock mode.
 */
export function looksLikeBusinessId(segment: string, mocks: boolean): boolean {
  return UUID.test(segment) || CUID.test(segment) || (mocks && MOCK_ID.test(segment));
}

export interface ClickOut { id: string; src: string | null; kw: string | null }

export function parseVisitUrl(visitUrl: string | null | undefined): ClickOut | null {
  if (!visitUrl) return null;
  const m = GO.exec(String(visitUrl));
  if (!m) return null;
  const q = new URLSearchParams(m[2] ?? '');
  const src = q.get('src');
  const kw = q.get('kw');
  return { id: m[1], src: src && /^[A-Za-z]{1,40}$/.test(src) ? src : null, kw: kw && /^[A-Za-z0-9_-]{1,40}$/.test(kw) ? kw : null };
}

/** The same-origin link a card carries, or null when there is nothing to visit. */
export function goHref(visitUrl: string | null | undefined): string | null {
  const c = parseVisitUrl(visitUrl);
  if (!c) return null;
  const q = new URLSearchParams();
  if (c.src) q.set('src', c.src);
  if (c.kw) q.set('kw', c.kw);
  const qs = q.toString();
  return `/go/${encodeURIComponent(c.id)}${qs ? `?${qs}` : ''}`;
}
