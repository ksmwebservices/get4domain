import { headers } from 'next/headers';
import { classifyHost, readHostConfig } from '@/lib/v3-public/hostnames';
import { guardResponse } from '@/lib/v3-public/proxy';
import { publishedIndustries } from '@/lib/v3-public/industries';
import { LEGAL_PAGE_PATHS } from '@/lib/v3-public/legal-paths';
import { mainOrigin } from '@/lib/v3-public/site-metadata';

// Read per request: the V3 flag and the host names are runtime values. The live sitemap.ts stays prerendered and untouched.
export const dynamic = 'force-dynamic';

/** The sitemap of the industry landing pages. Flag off, or no main host: a plain 404 (the file does not exist). Listed in robots.txt only in the same case it is served. */
export async function GET(): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const origin = mainOrigin();
  // dotted paths skip the middleware, so the host is checked here: only the canonical main host serves it (never the directory host, a vendor host or www)
  const cls = classifyHost((await headers()).get('host'), readHostConfig());
  if (!origin || cls.kind !== 'main' || !cls.canonical) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  const urls = publishedIndustries().map((p) => `<url>\n<loc>${origin}/industries/${p.slug}</loc>\n<changefreq>monthly</changefreq>\n<priority>0.85</priority>\n</url>`).join('\n');
  // the policy pages (dispatch D1) are listed here too: this is the sitemap that exists only with the flag on, so the live sitemap.xml stays byte for byte as it was
  const legal = LEGAL_PAGE_PATHS.map((p) => `<url>\n<loc>${origin}${p}</loc>\n<changefreq>yearly</changefreq>\n<priority>0.4</priority>\n</url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}${legal ? `\n${legal}` : ''}\n</urlset>\n`;
  return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
