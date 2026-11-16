import type { Metadata } from 'next';
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
  return {
    title: { absolute: brandedTitle(o.title) },
    description: o.description,
    alternates: canonical ? { canonical } : undefined,
    robots: o.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title: brandedTitle(o.title), description: o.description, type: 'website', ...(canonical ? { url: canonical } : {}) },
  };
}
