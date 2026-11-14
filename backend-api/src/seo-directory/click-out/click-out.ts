/**
 * SEO block slice 3: pure rules of the click-out (GET /v3/go/{businessId}). The redirect target is built ONLY from the stored subdomain label and our own base domain, then checked here,
 * so no query string, header or id from the caller can ever become part of the address (no open redirect).
 */
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
