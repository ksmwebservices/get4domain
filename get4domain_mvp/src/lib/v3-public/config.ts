/** Where the public site finds the API, the vendor app and its own canonical origin. Names only: nothing is hard-coded and there is no production fallback. */
type Env = Record<string, string | undefined>;

const clean = (v: string | undefined): string | null => {
  const t = (v ?? '').trim().replace(/\/+$/, '');
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:' ? t : null;
  } catch {
    return null;
  }
};

/**
 * The address the server asks, read when the request runs: the container's INTERNAL_API_URL first, then API_BASE_URL, then the public names (NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_API_URL,
 * which are fixed at build time) as the last fallback. null when none is a valid http(s) URL (the pages then show the error state); there is no production default here.
 */
export function apiBase(env: Env = process.env): string | null {
  return clean(env.INTERNAL_API_URL) ?? clean(env.API_BASE_URL) ?? clean(env.NEXT_PUBLIC_API_BASE_URL) ?? clean(env.NEXT_PUBLIC_API_URL);
}

/** The vendor app (a separate Vite app). null when not configured: the screens then say it is not available yet. */
export function vendorAppUrl(env: Env = process.env): string | null {
  const explicit = clean(env.NEXT_PUBLIC_VENDOR_APP_URL);
  if (explicit) return explicit;
  // Slice 6 host names: the business app is APP_HOST (a host name only). Local development hosts use http.
  const h = (env.APP_HOST ?? '').trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/.test(h)) return null;
  return `${h === 'localhost' || h.endsWith('.localhost') ? 'http' : 'https'}://${h}`;
}

/** The canonical origin for sitemap and robots lines. The www host is never canonical. */
export function siteOrigin(env: Env = process.env): string | null {
  const v = clean(env.V3_PUBLIC_SITE_ORIGIN);
  if (!v) return null;
  const u = new URL(v);
  return `${u.protocol}//${u.hostname.replace(/^www\./i, '')}${u.port ? `:${u.port}` : ''}`;
}

/** Seconds a page model may be served from the Next data cache when the API says nothing. */
export function defaultRevalidate(env: Env = process.env): number {
  const n = Number(env.V3_PUBLIC_REVALIDATE_SECONDS);
  return Number.isFinite(n) && n >= 10 && n <= 86400 ? Math.floor(n) : 300;
}
