import type { MetadataRoute } from 'next';
import { SEO_ROUTES, INDUSTRY_IDS, INDUSTRY_PAGE } from '@/config/seo-routes';

const BASE = 'https://get4domain.com';

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

  return [...staticPages, ...industryPages];
}
