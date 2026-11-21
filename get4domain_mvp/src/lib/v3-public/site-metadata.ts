import type { Metadata } from 'next';
import { siteConfig } from '@/constants/site';
import { brandedTitle } from '@/lib/metadata';
import { baseDomain, originFor, readHostConfig } from './hostnames';

/** The canonical origin of the main site, from MAIN_HOST. null when it is not set (no canonical is written then: nothing is guessed). */
export function mainOrigin(): string | null {
  const base = baseDomain(readHostConfig());
  return base ? originFor(base) : null;
}

/** The directory origin from DIRECTORY_HOST, or null. */
export function directoryOrigin(): string | null {
  const d = readHostConfig().directory;
  return d ? originFor(d) : null;
}

/** The canonical address of a path on the main host ("/" is the origin with one slash). */
export function canonicalFor(path: string): string | null {
  const origin = mainOrigin();
  return origin ? `${origin}${path === '/' ? '/' : path}` : null;
}

/** Metadata of a commercial public page: its own canonical on the main host, indexable (or not), no production address in the code. */
export function siteMetadata(o: { title: string; description: string; path: string; noindex?: boolean }): Metadata {
  const canonical = canonicalFor(o.path);
  // a title that already starts with the brand (the home title) is used as written; the others get " | Get4Domain" when that fits in 60 characters
  const title = /^Get4Domain\b/.test(o.title) ? o.title : brandedTitle(o.title);
  return {
    title: { absolute: title },
    description: o.description,
    alternates: canonical ? { canonical } : undefined,
    robots: o.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title, description: o.description, type: 'website', siteName: siteConfig.name, locale: 'en_IN', images: [siteConfig.ogImage], ...(canonical ? { url: canonical } : {}) },
    twitter: { card: 'summary_large_image', title, description: o.description, images: [siteConfig.ogImage.url] },
  };
}
