import type { MetadataRoute } from 'next';
import { serviceSlugs } from '@/lib/services';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: '/', lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: '/services', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    ...serviceSlugs.map((slug) => ({ url: `/services/${slug}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.8 })),
  ];
}
