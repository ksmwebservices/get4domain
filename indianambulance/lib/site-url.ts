/** The public origin of this site: set per environment with SITE_URL (build arg + runtime env), e.g. the business's own domain once it points at this server.
 *  Defaults to the platform subdomain so canonical / Open Graph / sitemap URLs are never another domain's. */
export const SITE_URL = (process.env.SITE_URL || 'https://indianambulance.get4domain.com').replace(/\/+$/, '')

/** Absolute URL for a path on this site ('/p/x' becomes 'https://host/p/x'). */
export function absUrl(path = ''): string {
  return `${SITE_URL}${path.startsWith('/') || path === '' ? path : `/${path}`}`
}
