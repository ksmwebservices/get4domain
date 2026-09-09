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
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
