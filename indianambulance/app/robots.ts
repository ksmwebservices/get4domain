import type { MetadataRoute } from 'next'
import { absUrl } from '@/lib/site-url'
import { getContent } from '@/lib/content'

// read per request: the answer depends on whether the vendor is connected, which can change without a rebuild
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const c = await getContent()
  // a preview and a site that still shows only starter text are kept out of search results
  if (c.connected && c.seo.noindex) return { rules: [{ userAgent: '*', disallow: '/' }] }
  return { rules: [{ userAgent: '*', allow: '/' }], sitemap: absUrl('/sitemap.xml'), host: absUrl() }
}
