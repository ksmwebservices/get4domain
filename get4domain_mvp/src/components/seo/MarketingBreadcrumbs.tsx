'use client';

import { usePathname } from 'next/navigation';
import { SEO_ROUTES } from '@/config/seo-routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';

/**
 * Emits BreadcrumbList JSON-LD for every marketing page that is listed in src/config/seo-routes.ts.
 * Rendered once from the marketing layout (it is server-rendered into the HTML like any client component).
 * Skipped for: home (no trail), unlisted pages (cart, checkout, quote, redirects), and /industries/[id],
 * whose page emits its own trail through the same builder because it needs the industry's real name.
 */
export default function MarketingBreadcrumbs() {
  const pathname = usePathname() ?? '';
  const route = SEO_ROUTES[pathname];
  if (!route || pathname === '/') return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd([{ name: route.label, path: pathname }])) }}
    />
  );
}
