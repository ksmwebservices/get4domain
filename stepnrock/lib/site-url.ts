/** The public origin of this site — set per environment with SITE_URL (build arg + runtime env), e.g. the shop's own custom domain
 *  once Suresh points it here. Defaults to the platform subdomain so canonical/OG/sitemap URLs are never another domain's. */
export const SITE_URL = (process.env.SITE_URL || 'https://stepnrock.get4domain.com').replace(/\/+$/, '');

/** Absolute URL for a path on this site ('/about' → 'https://…/about'). */
export function absUrl(path = ''): string {
  return `${SITE_URL}${path.startsWith('/') || path === '' ? path : `/${path}`}`;
}
