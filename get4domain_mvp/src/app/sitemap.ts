import type { MetadataRoute } from 'next';
import { SEO_ROUTES, INDUSTRY_IDS, INDUSTRY_PAGE } from '@/config/seo-routes';
import { isV3PublicEnabled } from '@/lib/v3-public/flag';
import { publishedIndustries } from '@/lib/v3-public/industries';
import { mainOrigin } from '@/lib/v3-public/site-metadata';

const BASE = 'https://get4domain.com';

// Read per request so the V3 flag (a runtime value) decides whether the landing pages are listed. With the flag off the answer is byte for byte the earlier one.
export const dynamic = 'force-dynamic';

// Demo-site URLs (/demo/...) are deliberately NOT listed: they sit behind the OTP gate and are noindex.
// `lastModified` comes from src/config/seo-routes.ts (a content-updated date), never from the build time.
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = Object.entries(SEO_ROUTES).map(([path, r]) => ({
    url: path === '/' ? BASE : `${BASE}${path}`,
    lastModified: new Date(`${r.updated}T00:00:00Z`),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const industryPages = INDUSTRY_IDS.map((id) => ({
    url: `${BASE}/industries/${id}`,
    lastModified: new Date(`${INDUSTRY_PAGE.updated}T00:00:00Z`),
    changeFrequency: INDUSTRY_PAGE.changeFrequency,
    priority: INDUSTRY_PAGE.priority,
  }));

  // the V3 industry landing pages: only with the flag on and a main host (canonical addresses are on that host); flag off leaves the file exactly as it was
  const origin = isV3PublicEnabled() ? mainOrigin() : null;
  const packPages = origin
    ? publishedIndustries().map((p) => ({
        url: `${origin}/industries/${p.slug}`,
        lastModified: new Date(`${INDUSTRY_PAGE.updated}T00:00:00Z`),
        changeFrequency: INDUSTRY_PAGE.changeFrequency,
        priority: INDUSTRY_PAGE.priority,
      }))
    : [];

  return [...staticPages, ...industryPages, ...packPages];
}
