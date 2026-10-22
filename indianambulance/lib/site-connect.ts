/**
 * site-connect: how a client app that keeps its own design reads its content from the vendor's site document (Website Manager).
 *
 * Copy this file, unchanged, to `<app>/src/lib/site-connect.ts` (or `<app>/lib/site-connect.ts`). A guard fails if a copy differs from this file, so a fix is made once, here.
 *
 *   const site = await getConnected('allwintours');        // null when the API cannot be reached; site.connected is false until the vendor is in connected mode
 *   pickText(site, 'tagline', 'Your Journey, Our Priority')   // the vendor's words; the app's own words only while the vendor never touched the field
 *
 * It reads only the public, published endpoint (GET /cms/site/<subdomain>), with the signed preview token when the visitor is the owner looking at a draft.
 * No secret is ever needed or sent. The answer is cached for a minute and refreshed at once when the owner presses Publish (see revalidate-route.ts).
 */
import { cache } from 'react';
import { headers } from 'next/headers';

export const API_BASE = (process.env.SITE_CONNECT_API || process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com').replace(/\/+$/, '');
/** how long a published answer may be reused if no refresh call arrives (seconds) */
export const REFRESH_SECONDS = 60;

export interface ConnectedItem {
  id: string; name: string; description: string; price: string; image: string; category: string; fields: Record<string, unknown>; order: number;
}
export interface ConnectedQuote { quote: string; author: string; note: string; rating: number | null }
export interface ConnectedPhoto { src: string; alt: string; title: string; category: string }
export interface ConnectedPage { slug: string; title: string; body: string }
export interface SocialLink { key: string; label: string; href: string }

export interface ConnectedSite {
  /** true only when the vendor is in connected mode: otherwise every pick returns the app's own text */
  connected: boolean;
  /** the owner is looking at the draft through a signed preview link */
  preview: boolean;
  subdomain: string;
  values: Record<string, string>;
  /** fields the vendor has changed or cleared at least once */
  edited: Record<string, boolean>;
  extras: Record<string, unknown>;
  social: SocialLink[];
  gallery: ConnectedPhoto[];
  quotes: ConnectedQuote[];
  items: ConnectedItem[];
  pages: ConnectedPage[];
  pagesLimit: number;
  /** false while the site is a draft or shows only starter text: search engines are told not to index it */
  indexable: boolean;
}

const TEXT_KEYS = ['businessName', 'tagline', 'about', 'logo', 'banner', 'favicon', 'ogImage', 'seoTitle', 'seoDesc', 'seoKeywords', 'googleAnalyticsId', 'phone', 'whatsapp', 'email', 'address', 'businessHours', 'facebook', 'instagram', 'linkedin', 'youtube', 'googleMaps'] as const;
const SOCIAL_LABEL: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X', whatsapp: 'WhatsApp', maps: 'Google Maps' };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** A picture address the app can show: a path on our own server becomes a full address. */
export function img(url: string | null | undefined): string {
  const u = str(url);
  if (!u) return '';
  if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
  return u.startsWith('/') ? `${API_BASE}${u}` : u;
}

interface RawSite {
  vendor?: { businessName?: string; subdomain?: string | null };
  cms?: Record<string, unknown> | null;
  products?: { id: string; name: string; description: string | null; price: string | null; image: string | null; category: string | null; customFields: Record<string, unknown> | null }[];
  siteMode?: string; preview?: boolean; indexable?: boolean; pagesLimit?: number;
}

/** Pure: turns the public payload into the shape apps read. Exported for tests. */
export function normaliseSite(raw: RawSite | null, subdomain: string): ConnectedSite | null {
  if (!raw) return null;
  const cms = asObj(raw.cms);
  const ex = asObj(cms.extras);
  const values: Record<string, string> = {};
  for (const k of TEXT_KEYS) values[k] = str(cms[k]);
  const social: SocialLink[] = [];
  const sx = asObj(ex.social);
  const wa = values.whatsapp || values.phone;
  const add = (key: string, href: string, label?: string): void => { if (href) social.push({ key, label: label || SOCIAL_LABEL[key] || key, href }); };
  add('facebook', values.facebook); add('instagram', values.instagram); add('youtube', values.youtube); add('linkedin', values.linkedin); add('x', str(sx.x));
  add('whatsapp', wa ? `https://wa.me/${wa.replace(/\D/g, '')}` : ''); add('maps', values.googleMaps); add('custom', str(sx.customUrl), str(sx.customLabel) || 'Link');
  const gallery: ConnectedPhoto[] = (Array.isArray(cms.portfolio) ? cms.portfolio : []).map((p) => asObj(p)).filter((p) => str(p.src)).map((p) => ({ src: img(str(p.src)), alt: str(p.alt) || str(p.title), title: str(p.title), category: str(p.category) }));
  const quotes: ConnectedQuote[] = (Array.isArray(cms.testimonials) ? cms.testimonials : []).map((t) => asObj(t)).filter((t) => str(t.quote) && str(t.author) && !t.sample).map((t) => ({ quote: str(t.quote), author: str(t.author), note: str(t.note), rating: typeof t.rating === 'number' ? t.rating : null }));
  const items: ConnectedItem[] = (raw.products ?? []).map((p, i) => {
    const cf = asObj(p.customFields);
    return { id: p.id, name: p.name, description: str(p.description), price: str(p.price), image: img(p.image), category: str(p.category), fields: cf, order: typeof cf.order === 'number' ? cf.order : 100000 - i };
  }).sort((a, b) => a.order - b.order);
  const pages: ConnectedPage[] = (Array.isArray(cms.pages) ? cms.pages : []).map((p) => asObj(p)).filter((p) => str(p.slug) && str(p.title)).map((p) => ({ slug: str(p.slug), title: str(p.title), body: str(p.body) }));
  for (const k of ['logo', 'banner', 'favicon', 'ogImage']) values[k] = img(values[k]);
  return {
    connected: raw.siteMode === 'connected', preview: raw.preview === true, subdomain, values, edited: asObj(ex.edited) as Record<string, boolean>, extras: ex, social, gallery, quotes, items, pages,
    pagesLimit: typeof raw.pagesLimit === 'number' ? raw.pagesLimit : 1, indexable: raw.indexable !== false,
  };
}

/** The signed preview token the owner arrived with (the app's middleware copies ?preview= into a header and a cookie). */
async function previewToken(): Promise<string> {
  try { return (await headers()).get('x-g4d-preview') ?? ''; } catch { return ''; }
}

/** Reads the vendor's published site (or their draft, for the owner's preview). One call per request, however many components ask. Never throws. */
export const getConnected = cache(async (subdomain: string): Promise<ConnectedSite | null> => {
  const token = await previewToken();
  try {
    const url = `${API_BASE}/cms/site/${encodeURIComponent(subdomain)}${token ? `?preview=${encodeURIComponent(token)}` : ''}`;
    const res = await fetch(url, token ? { cache: 'no-store' } : { next: { revalidate: REFRESH_SECONDS, tags: [`site:${subdomain}`] } });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: RawSite } & RawSite;
    return normaliseSite((json.data ?? json) as RawSite, subdomain);
  } catch {
    return null;
  }
});

/**
 * The text rule for every field: while the vendor has not connected, or never touched the field and it is empty, the app keeps its own words (so a day-one connected page equals
 * today's page). The moment the vendor has a value, it is theirs; if they cleared it, it stays empty.
 */
export function pickText(site: ConnectedSite | null, key: string, fallback: string): string {
  if (!site || !site.connected) return fallback;
  const v = site.values[key] ?? str(site.extras[key]);
  if (v) return v;
  return site.edited[key] ? '' : fallback;
}

/** The same rule for a list the vendor edits as a whole (quotes, pictures, vendor pages). */
export function pickList<T>(site: ConnectedSite | null, key: string, mine: T[], fallback: T[]): T[] {
  if (!site || !site.connected) return fallback;
  if (mine.length) return mine;
  return site.edited[key] ? [] : fallback;
}

/** Items of one group (a product category the app lists separately). Once the vendor has any item at all, the lists come from their items only. */
export function pickItems(site: ConnectedSite | null, group: string, fallback: ConnectedItem[]): ConnectedItem[] {
  if (!site || !site.connected) return fallback;
  if (site.items.length === 0) return fallback;
  const g = group.trim().toLowerCase();
  return site.items.filter((i) => i.category.trim().toLowerCase() === g);
}

/** Social links the visitor should see: only the ones filled in. `fallback` (the app's own, for apps that already show some) is used until the vendor first edits a link. */
export function pickSocial(site: ConnectedSite | null, fallback: SocialLink[]): SocialLink[] {
  if (!site || !site.connected) return fallback;
  const own = site.social.filter((s) => s.key !== 'whatsapp' && s.key !== 'maps');
  const sx = asObj(site.extras.social);
  const touched = ['facebook', 'instagram', 'youtube', 'linkedin', 'googleMaps'].some((k) => site.edited[k]) || !!str(sx.x) || !!str(sx.customUrl);
  return own.length || touched ? site.social : fallback;
}

export interface SeoOut { title: string; description: string; keywords: string; image: string; noindex: boolean }
/** Title, description, share picture and the index flag for the page. */
export function seoOf(site: ConnectedSite | null, fallback: { title: string; description: string; keywords?: string; image?: string }): SeoOut {
  const noindex = !!site && site.connected && (site.preview || !site.indexable);
  return {
    title: pickText(site, 'seoTitle', fallback.title), description: pickText(site, 'seoDesc', fallback.description), keywords: pickText(site, 'seoKeywords', fallback.keywords ?? ''),
    image: pickText(site, 'ogImage', fallback.image ?? ''), noindex,
  };
}

/** Plain paragraphs from a block of text (a blank line starts a new one). */
export const paragraphs = (text: string): string[] => text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
