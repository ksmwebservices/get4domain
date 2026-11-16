import type { Metadata } from 'next';
import { siteConfig } from '@/constants/site';
import type { PageModel } from './types';

/**
 * A page model to Next metadata. Everything comes from the model as given: title (the brand is already in it), description, canonical, robots, hreflang and the prev and next links.
 * Nothing is computed, trimmed or defaulted here, so the page says exactly what the backend decided (noindex while the model says so).
 */
export function modelToMetadata(m: PageModel): Metadata {
  const { meta, page } = m;
  const languages: Record<string, string> = {};
  for (const h of meta.hreflang) languages[h.lang] = h.href;
  return {
    // `absolute` bypasses the root layout's "%s | Get4Domain" template, so the brand is not added a second time.
    title: { absolute: meta.title },
    description: meta.description,
    alternates: { canonical: meta.canonical, ...(Object.keys(languages).length ? { languages } : {}) },
    robots: meta.robots,
    ...(page && (page.prev || page.next) ? { pagination: { ...(page.prev ? { previous: page.prev } : {}), ...(page.next ? { next: page.next } : {}) } } : {}),
    openGraph: { title: meta.title, description: meta.description, url: meta.canonical, siteName: siteConfig.name, type: 'website', locale: 'en_IN', images: [siteConfig.ogImage] },
    twitter: { card: 'summary_large_image', title: meta.title, description: meta.description, images: [siteConfig.ogImage.url] },
  };
}

/** Metadata of a page that is never indexable (claim, account, legal drafts, error states). */
export function noindexMetadata(title: string, description: string): Metadata {
  return { title: { absolute: title }, description, robots: 'noindex, nofollow' };
}

/**
 * JSON-LD to a string that is safe inside a script tag: the characters that can end the tag or break the parser are escaped, so no text in a model can close the script.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** /chennai/plumbers and 3 to /chennai/plumbers/page/3 (page 1 has no suffix). Used only for numbered links; prev and next come from the model. */
export function pagePath(basePath: string, n: number): string {
  const base = basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  return n < 2 ? basePath || '/' : `${base}/page/${n}`;
}

/** The path a model is on without its /page/{n} suffix. */
export function basePathOf(path: string): string {
  const p = path.replace(/\/page\/\d+$/, '');
  return p === '' ? '/' : p;
}
