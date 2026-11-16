/**
 * SEO block slice 3: pure rules of the click-out (GET /v3/go/{businessId}). The redirect target is built ONLY from the stored subdomain label and our own base domain, then checked here,
 * so no query string, header or id from the caller can ever become part of the address (no open redirect).
 */
/**
 * The id in `/v3/go/{id}` (Wave 2, public site gap G3). It is the directory business id, which the database makes with cuid(): the letter c and 24 lower case letters or digits, 25 characters in all. A uuid is
 * the other shape the public site accepts. The public site treats a `/go/{segment}` as a click-out ONLY when the segment has one of these two shapes, and `/go/{slug}` is the campaign page, so a campaign slug
 * must never have either shape: `campaignSlugSafe` guarantees it where slugs are made. (The route itself still looks any id up and answers one uniform 404, so older or fixture ids keep working.)
 */
export const CLICK_OUT_ID = /^(?:c[a-z0-9]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export const isClickOutId = (v: unknown): boolean => typeof v === 'string' && CLICK_OUT_ID.test(v);
/** A campaign page slug that can never be mistaken for a click-out id: one that has the shape of an id gets a fixed suffix. */
export const campaignSlugSafe = (slug: string): string => (isClickOutId(slug) ? `${slug}-page` : slug);

export const CLICK_PAGE_TYPES = ['home', 'state', 'city', 'category', 'cityCategory', 'localityCategory', 'pincodeCategory', 'business'] as const;
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const KW = /^[A-Za-z0-9_-]{1,40}$/;
const HOST = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/;

/** The page context the link carries. An unknown page type is recorded as "other"; a keyword target id that does not look like one is dropped. */
export function clickContext(src: unknown, kw: unknown): { pageType: string; keywordTargetId: string | null } {
  const s = typeof src === 'string' ? src : '';
  return { pageType: (CLICK_PAGE_TYPES as readonly string[]).includes(s) ? s : 'other', keywordTargetId: typeof kw === 'string' && KW.test(kw) ? kw : null };
}

/**
 * The address a visitor is sent to: `url` must be exactly https://{label}.{baseDomain}/ plus the attribution query, where label is ONE valid DNS label (no dots, no slashes, no
 * credentials, no port). Anything else returns null and the route answers 404. Custom domains can never pass: the host has to end with our base domain.
 */
export function safeSubdomainUrl(url: string, baseDomain: string): string | null {
  const base = String(baseDomain ?? '').toLowerCase();
  if (!HOST.test(base)) return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) return null;
  const host = u.hostname.toLowerCase();
  if (!host.endsWith(`.${base}`)) return null;
  const label = host.slice(0, -(base.length + 1));
  if (!LABEL.test(label)) return null;
  return u.toString();
}
