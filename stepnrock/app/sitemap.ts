import type { MetadataRoute } from 'next';
import { absUrl } from '@/lib/site-url';
import { fetchSiteData, fetchVendorCategories } from '@/lib/site-data';

// Rebuilt at most every 30 s from the live catalogue, so a product added in the dashboard is in the sitemap almost immediately.
export const revalidate = 30;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = ['', '/shop', '/about', '/contact'].map((p) => ({ url: absUrl(p), lastModified: now, changeFrequency: 'weekly', priority: p === '' ? 1 : 0.7 }));
  const site = await fetchSiteData();
  if (!site) return fixed;
  const cats = site.vendor?.id ? (await fetchVendorCategories(site.vendor.id)) ?? [] : [];
  return [
    ...fixed,
    ...cats.map((c) => ({ url: absUrl(`/shop/${encodeURIComponent(c.nameNormalized)}`), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...site.products.map((p) => ({ url: absUrl(`/product/${p.id}`), lastModified: p.createdAt ? new Date(p.createdAt) : now, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
