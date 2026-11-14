import type { Metadata } from 'next';
import { siteConfig } from '@/constants/site';

interface PageMetadataOptions {
  title: string;
  description?: string;
  keywords?: string[];
  /** Path of the page, e.g. '/about'. Used for the self canonical and og:url. */
  path?: string;
  /** Keep the page out of the index (cart, checkout and similar). */
  noindex?: boolean;
}

const TITLE_LIMIT = 60;

/** "<title> | Get4Domain" when that fits in 60 characters, otherwise the bare title (never truncated). */
export function brandedTitle(title: string): string {
  const withBrand = `${title} | ${siteConfig.name}`;
  return withBrand.length <= TITLE_LIMIT ? withBrand : title;
}

export function createPageMetadata({
  title,
  description,
  keywords,
  path = '',
  noindex = false,
}: PageMetadataOptions): Metadata {
  const url = `${siteConfig.url}${path}`;
  const fullTitle = brandedTitle(title);

  return {
    // `absolute` bypasses the root layout's "%s | Get4Domain" template so the brand
    // isn't appended twice (was producing "… | Get4Domain | Get4Domain").
    title: { absolute: fullTitle },
    description,
    keywords: keywords ?? siteConfig.keywords,
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
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}
