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

/** Server-only API_BASE_URL first, then the public name. null when neither is a valid http(s) URL (the pages then show the error state). */
export function apiBase(env: Env = process.env): string | null {
  return clean(env.API_BASE_URL) ?? clean(env.NEXT_PUBLIC_API_BASE_URL);
}

/** The vendor app (a separate Vite app). null when not configured: the screens then say it is not available yet. */
export function vendorAppUrl(env: Env = process.env): string | null {
  return clean(env.NEXT_PUBLIC_VENDOR_APP_URL);
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
