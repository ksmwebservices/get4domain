const xml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export interface SitemapEntry { loc: string; alternates?: Array<{ lang: string; href: string }> }

/** sitemap.xml from the published page list. A site that is not indexable lists nothing (an empty urlset): it must not ask to be crawled for indexing. */
export function buildSitemap(entries: SitemapEntry[], indexable: boolean): string {
  const head = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">';
  if (!indexable) return `${head}\n</urlset>\n`;
  const rows = entries.map((e) => `  <url>\n    <loc>${xml(e.loc)}</loc>${(e.alternates ?? []).map((a) => `\n    <xhtml:link rel="alternate" hreflang="${xml(a.lang)}" href="${xml(a.href)}"/>`).join('')}\n  </url>`);
  return `${head}\n${rows.join('\n')}\n</urlset>\n`;
}

/**
 * robots.txt: everything stays crawlable on purpose. A noindex page that crawlers are told not to fetch can never show its noindex tag (the lesson of SEO-0),
 * so noindex is expressed in the page and header, not here. The Sitemap line appears only when the site is indexable.
 */
export function buildRobotsTxt(indexable: boolean, sitemapUrl: string): string {
  return `User-agent: *\nAllow: /\n${indexable ? `\nSitemap: ${sitemapUrl}\n` : ''}`;
}
