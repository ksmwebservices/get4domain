import type { Metadata } from 'next';
import { MANIFEST_PATH, ICON_PATH } from './pwa';

/**
 * The head identity of a vendor page, one function for every renderer so no page can miss a part of it:
 *   title        "<page title> | <vendor name> | <category> in <city>"  (home page: "<vendor name> | <category> in <city>")
 *   description  the vendor's own business description, else a sentence built only from the vendor's own data (no claim is invented), 70 to 160 characters when there is enough to say
 *   favicon      the vendor's own icon route (the logo, or an initials icon when there is no logo), also the Apple touch icon and the web app manifest
 *   canonical    exactly one, absolute, on the vendor's canonical host: <name>.<base domain> (the backend sends no custom-domain field today, so the subdomain is always used)
 *   Open Graph   title, description, url, image (the vendor's share picture, else banner, else logo, else the icon route)
 * Pure: no fetch, no framework state.
 */
export interface HeadSite {
  vendor?: { businessName?: string | null; industry?: string | null } | null;
  cms?: { businessName?: string | null; tagline?: string | null; about?: string | null; address?: string | null; seoDesc?: string | null; seoKeywords?: string | null; logo?: string | null; banner?: string | null; ogImage?: string | null; phone?: string | null } | null;
}
export interface HeadInput {
  site: HeadSite;
  subdomain: string;
  /** the vendor-host path of this page: '' or '/' for home, '/p/news', '/about' (never a /site/<name> path) */
  path: string;
  /** the page's own title ('About', 'Contact'); empty on the home page */
  pageTitle?: string | null;
  /** text that describes this page, used when the vendor wrote none for it */
  pageDescription?: string | null;
  /** the real category label ('Dental clinic'), from categoryLabel() */
  category: string | null;
  baseDomain: string;
  noindex?: boolean;
  /** the share picture of a page that has its own (an item), else the vendor's */
  image?: string | null;
}

const STATES = new Set(['andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'new delhi', 'jammu and kashmir', 'ladakh', 'puducherry', 'chandigarh', 'india']);
const squash = (v: string): string => v.toLowerCase().replace(/[^a-z0-9]+/g, '');
const clean = (v: string | null | undefined): string => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * The city of a vendor, from the address the vendor wrote (the backend has no city field): the last comma part that is not a postcode, a state or the country. null when it cannot be told,
 * and then the title and sentence simply leave "in <city>" out. Never a guess from the category.
 */
export function cityOf(address: string | null | undefined): string | null {
  const parts = clean(address).split(',').map((p) => p.replace(/\b\d{5,6}\b/g, '').replace(/[-–]\s*$/, '').trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (STATES.has(p.toLowerCase()) || /\d/.test(p)) continue; // a state, the country, or a part with a number (a street or flat) is not the city
    return p.length <= 40 ? p : null;
  }
  return null;
}

/** "<category> in <city>", or just the category when the city is unknown; null when there is no real category. */
export function descriptor(category: string | null, city: string | null, name: string): string | null {
  const cat = category && squash(category) !== squash(name) ? clean(category) : null;
  if (cat && city) return `${cat} in ${city}`;
  return cat;
}

/** The title of a page: "<page title> | <vendor name> | <descriptor>"; the home page leaves the page title out. */
export function headTitle(name: string, desc: string | null, page?: string | null): string {
  const p = clean(page);
  return [p && squash(p) !== squash(name) ? p : null, name, desc].filter(Boolean).join(' | ');
}

const cut = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const at = slice.lastIndexOf(' ');
  return `${(at > max * 0.6 ? slice.slice(0, at) : slice).replace(/[\s,;:.-]+$/, '')}…`;
};

/**
 * The meta description. The vendor's own text wins (its SEO description, then its business description / about). Otherwise a sentence from the vendor's own fields only:
 * name, category, city, tagline. Cut at a word, 160 characters at most.
 */
export function headDescription(site: HeadSite, name: string, desc: string | null, pageDescription?: string | null): string {
  const own = clean(site.cms?.seoDesc) || clean(pageDescription) || clean(site.cms?.about);
  if (own) return cut(own, 160);
  const tag = clean(site.cms?.tagline);
  const base = desc ? `${name} is a ${desc}.` : `${name}: official website.`;
  const text = tag && squash(tag) !== squash(name) ? `${base} ${tag}${/[.!?]$/.test(tag) ? '' : '.'}` : base;
  return cut(text, 160);
}

const absolute = (u: string | null | undefined, origin: string): string | null => {
  const t = clean(u);
  if (!t || /\/starter\//.test(t) || /\.svg(\?|$)/i.test(t)) return null; // the platform's placeholder pictures and SVGs are not share pictures
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('/')) return `${origin}${t}`;
  return null; // a data: URI or a bare word is not a usable share address
};

export const canonicalOrigin = (subdomain: string, baseDomain: string): string => `https://${subdomain}.${baseDomain}`;
export const canonicalUrl = (subdomain: string, baseDomain: string, path: string): string => {
  const p = `/${clean(path).replace(/^\/+/, '').replace(/\/+$/, '')}`;
  return `${canonicalOrigin(subdomain, baseDomain)}${p === '/' ? '' : p}`;
};

export function buildHead(i: HeadInput): Metadata {
  const { site } = i;
  const name = clean(site.cms?.businessName) || clean(site.vendor?.businessName);
  const origin = canonicalOrigin(i.subdomain, i.baseDomain);
  const city = cityOf(site.cms?.address);
  const desc = descriptor(i.category, city, name);
  const title = headTitle(name, desc, i.pageTitle);
  const description = headDescription(site, name, desc, i.pageDescription);
  const url = canonicalUrl(i.subdomain, i.baseDomain, i.path);
  const icon = (s: number): string => `${ICON_PATH}?s=${s}`;
  const share = absolute(i.image, origin) ?? absolute(site.cms?.ogImage, origin) ?? absolute(site.cms?.banner, origin) ?? absolute(site.cms?.logo, origin) ?? `${origin}${icon(512)}`;
  return {
    title: { absolute: title },
    description,
    ...(clean(site.cms?.seoKeywords) ? { keywords: clean(site.cms?.seoKeywords) } : {}),
    manifest: MANIFEST_PATH,
    appleWebApp: { capable: true, title: name.slice(0, 30), statusBarStyle: 'default' },
    icons: { icon: [{ url: icon(192), sizes: '192x192', type: 'image/png' }, { url: icon(32), sizes: '32x32', type: 'image/png' }], apple: icon(180) },
    alternates: { canonical: url },
    openGraph: { title, description, type: 'website', url, siteName: name, locale: 'en_IN', images: [{ url: share, alt: name }] },
    twitter: { card: 'summary_large_image', title, description, images: [share] },
    ...(i.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
