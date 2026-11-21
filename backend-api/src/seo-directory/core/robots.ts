/**
 * SEO block slice 4: the robots.txt of the main site, as text the Next.js site serves. Pure.
 * Everything stays crawlable on purpose; what is disallowed is only the click-out route, internal search results and sort or filter query URLs (they add nothing a crawler should index).
 * Noindex is expressed in the page and its header, not here: a page a crawler is not allowed to fetch can never show its noindex (the lesson of SEO-0).
 * The Sitemap line appears only when the directory pages are indexable.
 */
export const DIRECTORY_DISALLOW: readonly string[] = [
  '/go/', '/v3/go/', '/search', '/*?*q=', '/*?*query=', '/*?*sort=', '/*?*order=', '/*?*filter=', '/*?*page=',
];

/**
 * A group per crawler is written explicitly (the owner wants many search and AI bots named), and the catch-all group last. The disallow rules are repeated in the named group because a
 * crawler that has its own group ignores the catch-all group entirely.
 */
export function buildDirectoryRobots(o: { crawlers: readonly string[]; indexable: boolean; sitemapUrl: string }): string {
  const rules = ['Allow: /', ...DIRECTORY_DISALLOW.map((d) => `Disallow: ${d}`)].join('\n');
  const named = o.crawlers.length ? `${o.crawlers.map((c) => `User-agent: ${c}`).join('\n')}\n${rules}\n\n` : '';
  return `${named}User-agent: *\n${rules}\n${o.indexable && o.sitemapUrl ? `\nSitemap: ${o.sitemapUrl}\n` : ''}`;
}
