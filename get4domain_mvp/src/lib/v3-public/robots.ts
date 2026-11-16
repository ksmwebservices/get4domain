/**
 * robots.txt for the main site while the V3 public site is on. The existing rules (src/app/robots.ts) are kept exactly as they are; the only additions are the directory
 * Disallow lines and one directory Sitemap line, and only when the backend says the directory pages are indexable. Pure text work, no framework import.
 */
export interface RobotsRule { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[]; crawlDelay?: number }
export interface RobotsInput { rules: RobotsRule | RobotsRule[]; sitemap?: string | string[]; host?: string }

export interface DirectoryRobots { indexable: boolean; disallow: string[] }

const list = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/**
 * What the backend robots text says. The backend writes a Sitemap line only while the directory pages are indexable, so that line is the signal;
 * the Disallow lines (click-out, internal search, sort and filter URLs) are taken from its text so that the backend stays the one source of them.
 */
export function parseDirectoryRobots(text: string | null | undefined): DirectoryRobots {
  const body = String(text ?? '');
  const indexable = /^\s*sitemap\s*:/im.test(body);
  const disallow: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*disallow\s*:\s*(\S.*?)\s*$/i.exec(line);
    // "Disallow: /" alone would close the whole site; it is never taken over.
    if (m && m[1] !== '/' && !disallow.includes(m[1])) disallow.push(m[1]);
  }
  return { indexable, disallow };
}

/** The existing robots object as text, with the directory additions in every group (a crawler with its own group ignores the catch-all group) and the directory sitemap line. */
export function robotsToText(base: RobotsInput, dir: DirectoryRobots, directorySitemap: string | null): string {
  const add = dir.indexable ? dir.disallow : [];
  const rules = Array.isArray(base.rules) ? base.rules : [base.rules];
  const blocks = rules.map((r) => {
    const lines: string[] = [];
    for (const ua of list(r.userAgent)) lines.push(`User-Agent: ${ua}`);
    for (const a of list(r.allow)) lines.push(`Allow: ${a}`);
    const have = list(r.disallow);
    for (const d of have) lines.push(`Disallow: ${d}`);
    for (const d of add) if (!have.includes(d)) lines.push(`Disallow: ${d}`);
    if (typeof r.crawlDelay === 'number') lines.push(`Crawl-delay: ${r.crawlDelay}`);
    return lines.join('\n');
  });
  const sitemaps = [...list(base.sitemap)];
  if (dir.indexable && directorySitemap && !sitemaps.includes(directorySitemap)) sitemaps.push(directorySitemap);
  const tail: string[] = [...sitemaps.map((s) => `Sitemap: ${s}`)];
  if (base.host) tail.push(`Host: ${base.host}`);
  return `${blocks.join('\n\n')}\n${tail.length ? `\n${tail.join('\n')}\n` : ''}`;
}

/**
 * robots.txt of the directory host: the backend text as written (named crawler groups, Allow, its Disallow lines), except that the Sitemap line is rewritten to this host.
 * The backend writes a Sitemap line only while the directory pages are indexable, so no line in means no line out. Any Host: line is dropped. The result never mentions another host.
 */
export function directoryHostRobots(backendText: string, directoryOrigin: string): string {
  const body = String(backendText ?? '');
  const hadSitemap = /^\s*sitemap\s*:/im.test(body);
  const kept = body.split(/\r?\n/).filter((l) => !/^\s*(sitemap|host)\s*:/i.test(l));
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  const out = kept.join('\n');
  return `${out}\n${hadSitemap ? `\nSitemap: ${directoryOrigin}/sitemaps/directory-index.xml\n` : ''}`;
}

/** The directory sitemap file names: the index and numbered chunks. Anything else is not served. */
export function sitemapRoute(file: string): string | null {
  if (file === 'directory-index.xml') return '/v3/directory/sitemaps/index.xml';
  const m = /^directory-([1-9]\d{0,3})\.xml$/.exec(file);
  return m ? `/v3/directory/sitemaps/directory-${m[1]}.xml` : null;
}
