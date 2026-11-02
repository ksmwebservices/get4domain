import type { Metadata } from 'next';
import { siteConfig } from '@/constants/site';

interface PageMetadataOptions {
  title: string;
  description?: string;
  /** The page's own absolute path, e.g. '/pricing'. Required: the canonical address is built from it, and a missing one used to canonicalise the page to the home page. */
  path: string;
  /** Keep a private or transactional page out of search results. */
  noIndex?: boolean;
}

export function createPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: PageMetadataOptions): Metadata {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error(`createPageMetadata: "path" is required and must start with "/" (got ${JSON.stringify(path)})`);
  }
  const url = `${siteConfig.url}${path}`;
  const fullTitle = `${title} | ${siteConfig.name}`;

  return {
    // `absolute` bypasses the root layout's "%s | Get4Domain" template so the brand
    // isn't appended twice (was producing "… | Get4Domain | Get4Domain").
    title: { absolute: fullTitle },
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: siteConfig.name,
      type: 'website',
      locale: 'en_IN',
      // Next REPLACES (does not deep-merge) openGraph per page, so the shared image
      // MUST be set here or every page using this helper loses its link-preview image.
      images: [siteConfig.ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [siteConfig.ogImage.url],
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}
