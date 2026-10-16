import { SITE_BASE, fetchSiteLite, mayIndex } from '@/lib/site-public';
import { fetchThemePackage } from '@/engine/themepack/site';
import { itemsOf, pageSetOf } from '@/engine/themepack/data';
import type { EngineSiteData } from '@/engine/types';

export const dynamic = 'force-dynamic';

/**
 * sitemap.xml for one vendor host: the home page, every page of the theme the vendor shows (within their plan's page limit), every service/menu/package item page, and the
 * extra pages the vendor published. The form pages and the legal pages are left out (they are not for search). Empty while the site must not be indexed.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ subdomain: string }> }): Promise<Response> {
  const { subdomain } = await params;
  const site = await fetchSiteLite(subdomain);
  const base = `https://${subdomain}.${SITE_BASE}`;
  let urls: string[] = [];
  if (mayIndex(site)) {
    urls = [base + '/'];
    const ref = (site as { themeRef?: { id: string } | null } | null)?.themeRef;
    const pkg = ref ? await fetchThemePackage(ref.id) : null;
    if (pkg) {
      const full = site as unknown as EngineSiteData;
      const set = pageSetOf(full, pkg.manifest, base);
      urls.push(...set.all.map((p) => p.href));
      if (set.itemBase) urls.push(...itemsOf(full, set.itemBase, base).map((i) => i.href));
    } else {
      urls.push(...(site?.cms?.pages ?? []).map((p) => `${base}/p/${p.slug}`));
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(urls)].map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
