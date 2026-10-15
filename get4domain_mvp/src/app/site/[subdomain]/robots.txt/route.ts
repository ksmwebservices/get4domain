import { SITE_BASE, fetchSiteLite, mayIndex } from '@/lib/site-public';

export const dynamic = 'force-dynamic';

/** robots.txt for one vendor host: closed while the site is a draft, unclaimed, or only starter content; open once the vendor has published real content. */
export async function GET(_req: Request, { params }: { params: Promise<{ subdomain: string }> }): Promise<Response> {
  const { subdomain } = await params;
  const open = mayIndex(await fetchSiteLite(subdomain));
  const body = open
    ? `User-agent: *\nAllow: /\n\nSitemap: https://${subdomain}.${SITE_BASE}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
