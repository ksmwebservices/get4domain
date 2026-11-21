/**
 * The one canonical address of a page on a vendor's site: the vendor's own host plus the page's own path, never the main host's `/site/<sub>` copy
 * and never the home page for an inner page. `rest` is the catch-all segments after the subdomain ([] = home, ['about'], ['p', 'terms']).
 * Pure so it can be tested without a server (scripts/seo-check.mjs loads this file directly).
 */
export function vendorCanonical(subdomain: string, rest: readonly string[] | undefined, base: string): string {
  const segments = (rest ?? []).filter((s) => s !== '');
  const isHome = segments.length === 0 || (segments.length === 1 && segments[0] === 'home');
  const path = isHome ? '' : `/${segments.map(encodeURIComponent).join('/')}`;
  return `https://${subdomain.toLowerCase()}.${base}${path}`;
}
