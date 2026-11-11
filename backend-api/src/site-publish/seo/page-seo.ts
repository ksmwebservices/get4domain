import { RenderResult } from '../renderer/renderer-loader';
import { loadKit } from '../renderer/renderer-loader';
import { composeDescription, cutAtWord, fitTitle, isUnsafeSeoText, safeSeoText } from './seo-text';

/**
 * The platform SEO layer for one page (docs/v3/V3_S4_RENDERER_PUBLISH.md section 4). The theme never writes SEO; the renderer returns inputs and this
 * layer turns them into the final title, description, canonical, robots, Open Graph, Twitter, hreflang and JSON-LD. Pure: no clock, no network, no randomness.
 * Never a price and never a retired product name in any text (seo-text.ts); `sameAs` only from URLs the vendor supplied; no offers, no reviews, no ratings.
 */
export interface PageSeoArgs {
  rendered: Pick<RenderResult, 'seo' | 'lang'>;
  path: string;
  template: string;
  lang: 'en' | 'ta';
  /** languages enabled for the site; hreflang is written only when there is more than one */
  languages: Array<'en' | 'ta'>;
  indexable: boolean;
  siteUrl: string;
  categoryId: string;
  siteName: string;
  city: string;
  image: string;
  itemName: string;
  items: Array<{ name: string; description?: string; image?: string }>;
  /** the vendor's own words, the source of the description */
  tagline: string;
  about: string;
  /** slice B1: the vendor's own text for this page; used ahead of the generated text, and only when it passes the safety filter */
  override?: { title?: string; description?: string; image?: string };
}
export interface PageSeo {
  title: string; description: string; canonical: string; robots: string; htmlLang: string;
  og: Record<string, string>; twitter: Record<string, string>;
  hreflang: Array<{ lang: string; href: string }>;
  jsonLd: Array<Record<string, unknown>>;
}

export const robotsValue = (indexable: boolean): string => (indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
const httpUrl = (u: unknown): string => (typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u.trim()) ? u.trim() : '');
const DROP_KEYS = new Set(['priceRange', 'offers', 'aggregateRating', 'review', 'reviews', 'price', 'priceCurrency']);

/** Removes anything unsafe from a JSON-LD value: forbidden keys, and any string that carries a price or a banned word. */
function cleanLd(v: unknown): unknown {
  if (typeof v === 'string') return isUnsafeSeoText(v) ? undefined : v;
  if (Array.isArray(v)) return v.map(cleanLd).filter((x) => x !== undefined);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (DROP_KEYS.has(k)) continue;
      const c = cleanLd(x);
      if (c !== undefined && !(Array.isArray(c) && c.length === 0)) out[k] = c;
    }
    return out;
  }
  return v;
}

export function buildPageSeo(a: PageSeoArgs): PageSeo {
  const kit = loadKit();
  const cat = kit.categoryById(a.categoryId);
  const r = a.rendered.seo;
  const home = a.template === 'home';
  const label = cat.label;

  const pageTitle = home ? '' : String(r.title ?? '').split(' | ')[0];
  const title = fitTitle([...(a.override?.title ? [a.override.title] : []), ...(home ? [r.title, `${a.siteName} | ${label}`, a.siteName] : [r.title, `${pageTitle} | ${a.siteName}`, pageTitle || a.siteName, a.siteName])]);

  const fallbackDesc = `${a.siteName} - ${label}${a.city ? ` - ${a.city}` : ''}`;
  const itemText = a.template === 'item' ? a.items.find((x) => x.name === a.itemName)?.description ?? '' : '';
  const parts = a.template === 'about' ? [a.about, a.tagline] : a.template === 'item' ? [itemText, a.tagline] : [a.tagline, a.about];
  const own = a.override?.description && !isUnsafeSeoText(a.override.description) ? a.override.description : '';
  const descCandidates = [composeDescription(parts), cutAtWord(r.description ?? '', 160)];
  const description = own || (descCandidates.find((c) => c.length >= 50 && !isUnsafeSeoText(c))
    ?? descCandidates.find((c) => c.length > 0 && !isUnsafeSeoText(c))
    ?? safeSeoText(fallbackDesc, a.siteName));

  const canonical = r.canonical;
  const robots = robotsValue(a.indexable);
  const multi = a.languages.length > 1;
  const hreflang = multi ? r.hreflang.filter((h) => httpUrl(h.href)) : [];
  const image = httpUrl(a.override?.image || a.image);
  const og: Record<string, string> = {
    'og:type': 'website', 'og:site_name': a.siteName, 'og:title': title, 'og:description': description, 'og:url': canonical, 'og:locale': a.lang === 'ta' ? 'ta_IN' : 'en_IN',
  };
  if (multi) og['og:locale:alternate'] = a.lang === 'ta' ? 'en_IN' : 'ta_IN';
  if (image) og['og:image'] = image;
  const twitter: Record<string, string> = { 'twitter:card': image ? 'summary_large_image' : 'summary', 'twitter:title': title, 'twitter:description': description };
  if (image) twitter['twitter:image'] = image;

  // JSON-LD: the renderer's category subtype, cleaned; sameAs only http(s) profile URLs; then breadcrumbs; then the page's own items
  const biz = cleanLd({ ...(r.structuredData as Record<string, unknown>) }) as Record<string, unknown>;
  if (Array.isArray(biz.sameAs)) { const same = [...new Set((biz.sameAs as unknown[]).map(httpUrl).filter(Boolean))]; if (same.length) biz.sameAs = same; else delete biz.sameAs; }
  const jsonLd: Array<Record<string, unknown>> = [biz];
  const base = a.siteUrl.replace(/\/+$/, '');
  const crumbs: Array<{ name: string; item: string }> = [{ name: a.siteName, item: `${base}${a.lang === 'ta' ? '/ta' : '/'}`.replace(/\/\/$/, '/') }];
  if (!home) {
    if (a.template === 'item') crumbs.push({ name: label.length ? safeSeoText(pageTitle || label, label) : label, item: `${base}${a.lang === 'ta' ? '/ta' : ''}/services` });
    crumbs.push({ name: safeSeoText(a.itemName || pageTitle, a.siteName), item: canonical });
    jsonLd.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) });
  } else {
    jsonLd.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: a.siteName, item: crumbs[0].item }] });
  }
  const itemType = cat.track === 'ecommerce' ? 'Product' : 'Service';
  if (a.template === 'services' && a.items.length) {
    jsonLd.push({
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: a.items.map((it, i) => cleanLd({ '@type': 'ListItem', position: i + 1, item: { '@type': itemType, name: it.name, description: it.description ? cutAtWord(it.description, 200) : undefined } })),
    });
  }
  if (a.template === 'item' && a.itemName) {
    const it = a.items.find((x) => x.name === a.itemName);
    jsonLd.push(cleanLd({ '@context': 'https://schema.org', '@type': itemType, name: a.itemName, description: it?.description ? cutAtWord(it.description, 300) : undefined, image: httpUrl(it?.image) || undefined, ...(itemType === 'Service' ? { provider: { '@type': 'LocalBusiness', name: a.siteName } } : { brand: { '@type': 'Brand', name: a.siteName } }) }) as Record<string, unknown>);
  }
  return { title, description, canonical, robots, htmlLang: a.rendered.lang, og, twitter, hreflang, jsonLd };
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ldText = (o: unknown): string => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** The complete HTML document: the platform-written head around the theme's body. Every dynamic value is escaped; JSON-LD is serialised so it cannot close its script. */
export function assembleDocument(p: { seo: PageSeo; bodyHtml: string; cssHref: string; favicon?: string }): string {
  const s = p.seo;
  const lines = [
    '<!doctype html>', `<html lang="${esc(s.htmlLang)}">`, '<head>', '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(s.title)}</title>`, `<meta name="description" content="${esc(s.description)}">`, `<link rel="canonical" href="${esc(s.canonical)}">`, `<meta name="robots" content="${esc(s.robots)}">`,
    ...s.hreflang.map((h) => `<link rel="alternate" hreflang="${esc(h.lang)}" href="${esc(h.href)}">`),
    ...Object.entries(s.og).map(([k, v]) => `<meta property="${esc(k)}" content="${esc(v)}">`),
    ...Object.entries(s.twitter).map(([k, v]) => `<meta name="${esc(k)}" content="${esc(v)}">`),
    ...(p.favicon && httpUrl(p.favicon) ? [`<link rel="icon" href="${esc(p.favicon)}">`] : []),
    `<link rel="stylesheet" href="${esc(p.cssHref)}">`,
    ...s.jsonLd.map((b) => `<script type="application/ld+json">${ldText(b)}</script>`),
    '</head>', '<body>', p.bodyHtml, '</body>', '</html>', '',
  ];
  return lines.join('\n');
}
