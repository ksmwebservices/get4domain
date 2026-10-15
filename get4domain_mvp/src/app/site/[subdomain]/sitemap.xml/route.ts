import { SITE_BASE, fetchSiteLite, mayIndex } from '@/lib/site-public';

export const dynamic = 'force-dynamic';

/** sitemap.xml for one vendor host: the home page and the extra pages the vendor published. Empty while the site must not be indexed. */
export async function GET(_req: Request, { params }: { params: Promise<{ subdomain: string }> }): Promise<Response> {
  const { subdomain } = await params;
  const site = await fetchSiteLite(subdomain);
  const base = `https://${subdomain}.${SITE_BASE}`;
  const urls = mayIndex(site) ? [base + '/', ...(site?.cms?.pages ?? []).map((p) => `${base}/p/${p.slug}`)] : [];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
