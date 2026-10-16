import type { EngineSiteData } from '../types';
import contract from './theme-contract.json';

/**
 * The data a theme page is filled with, and the page set of a vendor's site. Everything here comes from the vendor's own site document and the category pack;
 * nothing is invented. Pure functions, no React, so the sitemap and the page router use the same rules.
 */
export const CONTRACT = contract as unknown as {
  contract: number;
  limits: { packageBytes: number; imageBytes: number };
  pageTemplates: string[]; standardSlugs: Record<string, string>; itemPages: string[];
  slots: string[]; repeaters: Record<string, { as: string; fields: string[] }>; tags: string[]; tagAttributes: Record<string, string[]>;
  elements: string[]; attributes: string[]; dataAttributes: string[]; dropWithContent: string[];
};

export interface ManifestPage { slug: string; template: string; title: string; nav?: boolean; navLabel?: string }
export interface ThemeManifest { id: string; name: string; version: number; families: string[]; categories: string[]; pages: ManifestPage[]; itemsPage?: string; cssVars?: Record<string, string> }
export interface ThemePackageData {
  id: string; key: string; version: number; name: string; manifest: ThemeManifest; pages: Record<string, string>; css: string; googleFonts: string[]; assets: { path: string; name: string }[]; previewPath?: string | null;
}

export const slugify = (s: string): string => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const rupees = (p?: string | null): string | undefined => { const t = (p ?? '').trim(); return t ? (/^[₹$]/.test(t) ? t : `₹${t}`) : undefined; };

export interface SiteItem {
  id: string; name: string; description: string; price: string; image: string; category: string; slug: string; href: string;
  duration: string; badge: string; includes: string; location: string; area: string; bedrooms: string; veg: string; tags: string;
}
export interface SiteGroup { name: string; slug: string; count: string; items: SiteItem[] }

type Cf = Record<string, unknown>;
const cfs = (cf: Cf, k: string): string => (typeof cf[k] === 'string' ? (cf[k] as string).trim() : '');

/** The vendor's items with a web address each. A starter price is never shown: the page says "Contact for price". */
export function itemsOf(site: EngineSiteData, itemBase: string | null, base: string): SiteItem[] {
  const used = new Set<string>();
  return site.products.map((p) => {
    const cf = (p.customFields ?? {}) as Cf;
    let slug = slugify(p.name); let n = 2;
    while (used.has(slug)) slug = `${slugify(p.name)}-${n++}`;
    used.add(slug);
    return {
      id: p.id, name: p.name, description: p.description ?? '', price: cf.samplePrice === 'true' ? 'Contact for price' : (rupees(p.price) ?? ''), image: p.image ?? '', category: p.category ?? '', slug,
      href: itemBase ? `${base}/${itemBase}/${slug}` : base, duration: cfs(cf, 'duration'), badge: cfs(cf, 'badge'), includes: cfs(cf, 'includes'), location: cfs(cf, 'location'), area: cfs(cf, 'area'), bedrooms: cfs(cf, 'bedrooms'), veg: cfs(cf, 'veg'), tags: cfs(cf, 'tags'),
    };
  });
}

export function groupsOf(items: SiteItem[]): SiteGroup[] {
  const order: string[] = [];
  for (const i of items) { const c = i.category || 'More'; if (!order.includes(c)) order.push(c); }
  return order.map((name) => { const list = items.filter((i) => (i.category || 'More') === name); return { name, slug: slugify(name), count: String(list.length), items: list }; });
}

interface Extras {
  pagePlan?: { order?: string[]; hidden?: string[] };
  navigation?: { header?: { label: string; target: string }[]; bottom?: { key: string; label: string }[]; primaryLabel?: string };
  [k: string]: unknown;
}
export const extrasOf = (site: EngineSiteData): Extras => ((site.cms as { extras?: Extras } | null)?.extras ?? {}) as Extras;

export interface PageEntry { slug: string; template: string; title: string; navLabel: string; href: string; vendor?: boolean }
export interface PageSet { home: string; standard: PageEntry[]; vendor: PageEntry[]; itemBase: string | null; all: PageEntry[]; limit: number }

/**
 * The pages of a vendor's site: the home page, then the theme's standard pages and the pages the vendor wrote, up to the plan's limit (LeadSpace 1, Essentials 5, Pro 25;
 * the home page counts as one). The vendor's own pages always count first; the standard pages fill what is left, in the vendor's order. Item pages and the popup flow
 * pages never count.
 */
export function pageSetOf(site: EngineSiteData, manifest: ThemeManifest, base: string): PageSet {
  const limit = Math.max(1, (site as { pagesLimit?: number }).pagesLimit ?? 5);
  const vendorPages = (((site.cms as { pages?: { slug: string; title: string }[] } | null)?.pages) ?? []).slice(0, Math.max(0, limit - 1));
  const room = Math.max(0, limit - 1 - vendorPages.length);
  const plan = extrasOf(site).pagePlan ?? {};
  const hidden = new Set(plan.hidden ?? []);
  let std = manifest.pages.filter((p) => !hidden.has(p.slug));
  if (plan.order?.length) { const rank = (s: string): number => { const i = plan.order!.indexOf(s); return i < 0 ? 999 : i; }; std = [...std].sort((a, b) => rank(a.slug) - rank(b.slug)); }
  // when the plan has room for fewer pages than the theme has, the contact page and the page that lists the items are kept first, then the rest in order
  if (std.length > room) {
    const must = std.filter((p) => p.template === 'contact' || p.slug === manifest.itemsPage).slice(0, room);
    const more = std.filter((p) => !must.includes(p)).slice(0, room - must.length);
    std = std.filter((p) => must.includes(p) || more.includes(p));
  }
  const standard: PageEntry[] = std.slice(0, room).map((p) => ({ slug: p.slug, template: p.template, title: p.title, navLabel: p.navLabel || p.title, href: `${base}/${p.slug}` }));
  const vendor: PageEntry[] = vendorPages.map((p) => ({ slug: p.slug, template: 'page', title: p.title, navLabel: p.title, href: `${base}/p/${p.slug}`, vendor: true }));
  const itemsPage = manifest.itemsPage && standard.some((p) => p.slug === manifest.itemsPage) ? manifest.itemsPage : null;
  return { home: base, standard, vendor, itemBase: itemsPage, all: [...standard, ...vendor], limit };
}

export type Route =
  | { kind: 'home' } | { kind: 'page'; entry: PageEntry } | { kind: 'item'; item: SiteItem; entry: PageEntry } | { kind: 'vendor'; entry: PageEntry; body: string }
  | { kind: 'flow'; flow: 'book' | 'enquire' | 'order' } | { kind: 'legal'; which: 'privacy' | 'terms' } | { kind: 'notfound' };

export function resolveRoute(rest: string[], set: PageSet, items: SiteItem[], site: EngineSiteData): Route {
  if (rest.length === 0 || (rest.length === 1 && rest[0] === 'home')) return { kind: 'home' };
  const [a, b] = rest;
  if (rest.length === 1 && (a === 'book' || a === 'enquire' || a === 'order')) return { kind: 'flow', flow: a };
  if (rest.length === 2 && a === 'legal' && (b === 'privacy' || b === 'terms')) return { kind: 'legal', which: b };
  if (rest.length === 2 && a === 'p') {
    const e = set.vendor.find((p) => p.slug === b);
    const page = (((site.cms as { pages?: { slug: string; body: string }[] } | null)?.pages) ?? []).find((p) => p.slug === b);
    return e && page ? { kind: 'vendor', entry: e, body: page.body } : { kind: 'notfound' };
  }
  if (rest.length === 1) { const e = set.standard.find((p) => p.slug === a); return e ? { kind: 'page', entry: e } : { kind: 'notfound' }; }
  if (rest.length === 2 && set.itemBase === a) {
    const item = items.find((i) => i.slug === b);
    const entry = set.standard.find((p) => p.slug === a);
    return item && entry ? { kind: 'item', item, entry } : { kind: 'notfound' };
  }
  return { kind: 'notfound' };
}

export const pageTitle = (entry: PageEntry): string => cap(entry.title);
