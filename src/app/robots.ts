import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/api/',
          '/login',
          '/register',
          '/_next/',
        ],
      },
    ],
    sitemap: 'https://get4domain.in/sitemap.xml',
    host: 'https://get4domain.in',
  };
}
