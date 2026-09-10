import type { MetadataRoute } from 'next';
import { SITE, PRODUCTS } from '@/data/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/products', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/technology', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    // In-site Coming Soon pages for not-yet-launched products (NextBOS, HiDude).
    ...PRODUCTS.filter((p) => p.comingSoon).map((p) => ({
      path: `/products/${p.slug}`, priority: 0.6, changeFrequency: 'monthly' as const,
    })),
  ];
  return routes.map((r) => ({
    url: `${SITE.url}${r.path === '/' ? '' : r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
