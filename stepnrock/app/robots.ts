import type { MetadataRoute } from 'next';
import { absUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/cart'] }],
    sitemap: absUrl('/sitemap.xml'),
    host: absUrl(),
  };
}
