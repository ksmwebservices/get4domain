// What a vendor's own host publishes about itself to search engines: robots.txt and sitemap.xml (industry designs, 15 Oct 2026).
import { siteApiBase } from '@/lib/v3-public/site-state';
export const SITE_BASE = (process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN || 'get4domain.com').toLowerCase();

export interface PublicSiteLite { docV2?: boolean; indexable?: boolean; cms?: { pages?: { slug: string }[] | null } | null }

/** The public site for a subdomain, or null when it does not exist or is still a draft (the API answers 404 for both). Cached for a minute and refreshed on Publish. */
export async function fetchSiteLite(subdomain: string): Promise<PublicSiteLite | null> {
  try {
    const res = await fetch(`${siteApiBase()}/cms/site/${encodeURIComponent(subdomain)}`, { next: { tags: [`site:${subdomain}`], revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as PublicSiteLite;
  } catch { return null; }
}

/** Search engines may index a site only when it is live, on the new Website Manager, and shows content the vendor wrote (not only starter text). */
export const mayIndex = (s: PublicSiteLite | null): boolean => !!s && s.docV2 === true && s.indexable === true;
