/**
 * SEO block slice 2: the URL scheme of the directory pages, as pure functions. Lowercase slugs, no ids.
 *   /                                            home
 *   /state/{state}                               state
 *   /{city}                                      city
 *   /category/{category-slug}                    category index
 *   /{city}/{category-plural-slug}               city + category
 *   /{city}/{category-plural-slug}-in-{locality} locality + category
 *   /pincode/{pincode}/{category-slug}           pincode + category
 *   /business/{slug}                             business profile
 * Pagination is a path suffix, /page/{n}, from page 2 (page 1 has no suffix).
 */
/** Wave 2 (public site gap G11): where the directory home lives on the public site. The model of the home page carries this path, and its canonical follows it. */
export const DIRECTORY_HOME_PATH = '/directory';
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PINCODE = /^[1-9][0-9]{5}$/;
export const MAX_PAGE = 1000;
/** First path segments that are not a city. A city or place whose slug is one of these cannot have its own /{city} page. */
export const RESERVED_SEGMENTS: readonly string[] = ['state', 'category', 'pincode', 'business', 'page', 'v3', 'api', 'admin', 'go', 'sitemap', 'sitemaps', 'robots.txt', 'llms.txt', 'about', 'pricing', 'login', 'signup', 'dashboard',
  // Wave 2 (public site gap G7): the fixed pages of the public site, so a city or place with one of these slugs never claims their address
  'legal', 'claim', 'account', 'directory'];

export type PageSpec =
  | { type: 'home' }
  | { type: 'state'; state: string; page: number }
  | { type: 'city'; city: string; page: number }
  | { type: 'category'; category: string; page: number }
  | { type: 'cityCategory'; city: string; term: string; page: number }
  | { type: 'localityCategory'; city: string; locality: string; term: string; page: number }
  | { type: 'pincodeCategory'; pincode: string; category: string; page: number }
  | { type: 'business'; slug: string };

/** What a path parses to before the places are looked up: "/{city}/{rest}" cannot tell a city+category from a locality+category (the category term may contain "-in-"). */
export type ParsedPath = Exclude<PageSpec, { type: 'cityCategory' } | { type: 'localityCategory' }> | { type: 'cityRest'; city: string; rest: string; page: number };

export const slugify = (s: string): string => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const withPage = (base: string, page: number): string => (page >= 2 ? `${base === '/' ? '' : base}/page/${page}` : base);

export function buildPath(s: PageSpec): string {
  switch (s.type) {
    case 'home': return '/';
    case 'state': return withPage(`/state/${s.state}`, s.page);
    case 'city': return withPage(`/${s.city}`, s.page);
    case 'category': return withPage(`/category/${s.category}`, s.page);
    case 'cityCategory': return withPage(`/${s.city}/${s.term}`, s.page);
    case 'localityCategory': return withPage(`/${s.city}/${s.term}-in-${s.locality}`, s.page);
    case 'pincodeCategory': return withPage(`/pincode/${s.pincode}/${s.category}`, s.page);
    case 'business': return `/business/${s.slug}`;
  }
}

/** The same page with another page number (a business and the home page have none). */
export function withPageNumber(s: PageSpec, page: number): PageSpec { return s.type === 'home' || s.type === 'business' ? s : { ...s, page }; }

/** A path to its parts. null for anything that is not a directory page path (including /page/1, a trailing /page/n with n above the cap, uppercase-only oddities are lowered first). */
export function parsePath(input: unknown): ParsedPath | null {
  let p = String(input ?? '').split('#')[0].split('?')[0].trim().toLowerCase();
  if (!p.startsWith('/') || p.length > 300) return null;
  p = p.replace(/\/+$/, '') || '/';
  const parts = p.split('/').filter(Boolean);
  let page = 1;
  if (parts.length >= 2 && parts[parts.length - 2] === 'page') {
    const n = parts[parts.length - 1];
    if (!/^[0-9]{1,4}$/.test(n)) return null;
    page = Number(n);
    if (page < 2 || page > MAX_PAGE) return null;   // page 1 is the base URL
    parts.length -= 2;
  }
  if (!parts.every((x) => SLUG.test(x) || PINCODE.test(x))) return null;
  const [a, b, c] = parts;
  if (parts.length === 0) return page === 1 ? { type: 'home' } : null;
  if (a === 'state') return parts.length === 2 ? { type: 'state', state: b, page } : null;
  if (a === 'category') return parts.length === 2 ? { type: 'category', category: b, page } : null;
  if (a === 'pincode') return parts.length === 3 && PINCODE.test(b) ? { type: 'pincodeCategory', pincode: b, category: c, page } : null;
  if (a === 'business') return parts.length === 2 && page === 1 ? { type: 'business', slug: b } : null;
  if (a === DIRECTORY_HOME_PATH.slice(1)) return parts.length === 1 && page === 1 ? { type: 'home' } : null;   // the home may be asked for by its own address too
  if (RESERVED_SEGMENTS.includes(a)) return null;
  if (parts.length === 1) return { type: 'city', city: a, page };
  if (parts.length === 2) return { type: 'cityRest', city: a, rest: b, page };
  return null;
}

/** The ways a "{term}-in-{locality}" tail can split, shortest term first. A tail with no "-in-" is only a term. */
export function splitTail(rest: string): Array<{ term: string; locality: string | null }> {
  const out: Array<{ term: string; locality: string | null }> = [{ term: rest, locality: null }];
  let i = rest.indexOf('-in-');
  while (i > 0) { out.push({ term: rest.slice(0, i), locality: rest.slice(i + 4) }); i = rest.indexOf('-in-', i + 1); }
  return out.filter((x) => x.locality === null || x.locality.length > 0);
}

/** The click-out address a card carries (section 3). It lives on the API host and never carries anything but ids and the page context. */
export function clickOutUrl(apiBase: string, businessId: string, o: { src: string; kw?: string | null }): string {
  const q = new URLSearchParams({ src: o.src });
  if (o.kw) q.set('kw', o.kw);
  return `${apiBase.replace(/\/+$/, '')}/v3/go/${encodeURIComponent(businessId)}?${q.toString()}`;
}

/** The one canonical main host: www is not canonical. Returns the origin (no trailing slash), or '' for a value that is not a URL. */
/**
 * Wave 3 Part J: where the directory is served. With DIRECTORY_PUBLIC_BASE_URL set (for example https://directory.get4domain.com) the directory has its OWN host: every canonical, sitemap, breadcrumb, robots
 * and llms URL is built on that origin and the directory home is its root, so no address carries a /directory prefix. With it unset (or not a web address) nothing changes: the origin is the public app
 * origin and the home is served at /directory, as before. Only the origin of the value is used (a path, a query and a www prefix are dropped).
 */
export function directoryBase(env: Record<string, string | undefined>, appOrigin: string): { origin: string; homePath: string; dedicated: boolean } {
  const raw = env.DIRECTORY_PUBLIC_BASE_URL;
  if (typeof raw === 'string' && /^https?:\/\//i.test(raw.trim())) {
    const origin = canonicalOrigin(raw.trim());
    if (origin) return { origin, homePath: '/', dedicated: true };
  }
  return { origin: appOrigin, homePath: DIRECTORY_HOME_PATH, dedicated: false };
}

export function canonicalOrigin(appUrl: string): string {
  try { const u = new URL(appUrl); return `${u.protocol}//${u.hostname.replace(/^www\./i, '')}${u.port ? `:${u.port}` : ''}`; } catch { return ''; }
}
