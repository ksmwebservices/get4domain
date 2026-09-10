import type { Metadata } from 'next';
import { siteConfig } from '@/constants/site';

interface PageMetadataOptions {
  title: string;
  description?: string;
  keywords?: string[];
  path?: string;
}

export function createPageMetadata({
  title,
  description,
  keywords,
  path = '',
}: PageMetadataOptions): Metadata {
  const url = `${siteConfig.url}${path}`;
  const fullTitle = `${title} | ${siteConfig.name}`;

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
    robots: {
      index: true,
      follow: true,
    },
  };
}
