import type { MetadataRoute } from 'next'
import { absUrl } from '@/lib/site-url'
import { getContent } from '@/lib/content'

// read per request: the answer depends on whether the vendor is connected, which can change without a rebuild
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const c = await getContent()
  // a preview or a site that still shows only starter text stays out of the sitemap
  if (c.connected && c.seo.noindex) return []
  const now = new Date()
  return [
    { url: absUrl('/'), lastModified: now, changeFrequency: 'monthly', priority: 1 },
    ...c.pages.map((p) => ({ url: absUrl(`/p/${p.slug}`), lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 })),
  ]
}
