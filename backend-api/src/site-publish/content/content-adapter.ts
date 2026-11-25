import { kitCategoryFor } from '../../directory/core/listable-categories';
import { ResolvedEntitlements } from '../../plans/entitlements/entitlement-engine';
import { Kit, loadKit } from '../renderer/renderer-loader';
import { parseFaqLines, parseImageLines } from '../../v3-website/core/item-detail-core';
import { SiteLimits, SourceDocument } from './content-types';

/**
 * Pure mapping from a vendor's source document to the theme kit's renderer input. No business value is invented: names, numbers, addresses, links and
 * prices come only from vendor data. Starter (sample) prices and quotes are not shown as real. Hours stay empty: the legacy document holds free text and
 * the renderer wants structured rows (slice 5.5 supplies them). Platform wording for the visitor (labels, Tamil UI) comes from the renderer itself.
 */
export interface CategoryMap { packs: Record<string, string[]> }
export interface AdapterOptions { categoryId: string; lang: 'en' | 'ta'; year: number; siteBase: string; /** the vendor's canonical host (slice 5.6); absent = <subdomain>.<siteBase> */ primaryHost?: string; customDomain?: string; limits?: SiteLimits; motion?: 'Off' | 'Low' | 'Medium' | 'Rich'; /** slice B2: false on a plan without calls to action (Free): the address is plain text and no directions link is given to the theme (owner rule 2); default true */ directions?: boolean }
export interface RendererInput {
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  vendor: { id: string; unclaimed: boolean };
  host: { siteUrl: string; customDomain: string; allowEmbeds: boolean };
  /** what was cut or skipped, as stable notes (for the build warnings): limit:services, limit:pages ... */
  notes: string[];
}
export interface PlannedPage {
  template: 'home' | 'about' | 'services' | 'gallery' | 'contact' | 'page' | 'item';
  path: string;
  slug: string;
  item?: Record<string, unknown>;
  pageContent?: Record<string, unknown>;
}

export const RESERVED_PAGE_SLUGS = new Set(['book', 'enquire', 'order', 'legal', 'p', 'api', 'about', 'services', 'gallery', 'contact', 'home', 'ta']);
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
/** One line per entry: `title | price | detail` (price and detail optional). At most 40 lines; a line with no title is dropped. */
export function blockEntries(text: string | undefined): Array<{ title: string; price: string; detail: string }> {
  return String(text ?? '').split('\n').map((l) => l.split('|').map((p) => p.trim())).filter((p) => p[0]).slice(0, 40).map((p) => ({ title: p[0], price: p[1] ?? '', detail: p[2] ?? '' }));
}
const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';

/** The kit category for a vendor: its industry or pack key if that is a kit category, else the first category of the legacy pack with that key. */
export function categoryFor(doc: SourceDocument, kit: Kit, map: CategoryMap): string | null {
  for (const key of [doc.vendor.industry, doc.cms?.packKey]) {
    if (!key) continue;
    if (kit.hasCategory(key)) return key;
    const first = map.packs[key]?.[0];
    if (first && kit.hasCategory(first)) return first;
    const fallback = kitCategoryFor(key, (k) => kit.hasCategory(k));   // K1: a catalogue category the kit has no design for uses the kit category of its pack
    if (fallback) return fallback;
  }
  return null;
}

/**
 * B6.1: the neutral kit category of a track, used ONLY when the vendor's own category (a free-text industry such as "handyman", or a catalogue key the kit and its pack map cannot place) matches no kit design.
 * Without it the build stopped with PUBLISH_BLOCKED (CATEGORY) on every attempt and the vendor's retry could never succeed. These are the same pack fallbacks the directory uses (a test checks each against the built kit).
 */
export const TRACK_FALLBACK_CATEGORY: Readonly<Record<string, string>> = { handyman: 'plumber', professional: 'it-consultant', ecommerce: 'electronics-mobile' };

/** The vendor's own kit category when there is one, else the neutral category of the track (when the track is known and the kit has that design), else null. */
export function categoryForTrack(doc: SourceDocument, kit: Kit, map: CategoryMap, track: string | null | undefined): string | null {
  const own = categoryFor(doc, kit, map);
  if (own) return own;
  const fb = track ? TRACK_FALLBACK_CATEGORY[track.toLowerCase()] : undefined;
  return fb && kit.hasCategory(fb) ? fb : null;
}

export function limitsFrom(resolved: ResolvedEntitlements): SiteLimits {
  const lim = (k: string): number | null => (resolved.features[k]?.state === 'LIMITED' || resolved.features[k]?.state === 'ACTIVE' ? resolved.features[k].limit : null);
  return { pages: lim('site.pages'), services: lim('site.services'), gallery: lim('site.gallery'), faqs: lim('site.faqs') };
}

export function splitAddress(address: string): { city: string; pin: string } {
  const pin = /\b(\d{6})\b/.exec(address)?.[1] ?? '';
  const last = address.split(',').pop() ?? '';
  const city = last.replace(/\b\d{6}\b/g, '').trim();
  return { city: /\d/.test(city) || city.length > 40 ? '' : city, pin };
}

const cut = <T>(list: T[], limit: number | null, name: string, notes: string[]): T[] => {
  if (limit === null || list.length <= limit) return list;
  notes.push(`limit:${name}`);
  return list.slice(0, limit);
};

export function toRendererInput(doc: SourceDocument, o: AdapterOptions): RendererInput {
  const kit = loadKit();
  const cat = kit.categoryById(o.categoryId);
  const cms = doc.cms;
  const notes: string[] = [];
  const name = str(cms?.businessName) || doc.vendor.businessName;
  const phone = str(cms?.phone) || str(doc.vendor.phone);
  const email = o.directions === false ? '' : str(cms?.email) || doc.vendor.email;   // S1.2: a Free site (no calls to action) never prints an e-mail address, not even the owner's login e-mail it used to fall back to
  const address = str(cms?.address);
  const sp = splitAddress(address);
  const ex = cms?.extras ?? {};
  const city = str(ex.city) || sp.city; const pin = str(ex.pin) || sp.pin;   // slice B2: a written location names its own city and pincode
  const siteUrl = o.primaryHost ? `https://${o.primaryHost}` : doc.vendor.subdomain ? `https://${doc.vendor.subdomain}.${o.siteBase}` : '';
  const waDigits = str(cms?.whatsapp || phone).replace(/\D/g, '');
  const lim = o.limits ?? { pages: null, services: null, gallery: null, faqs: null };

  const detailOf = new Map((ex.itemDetails ?? []).map((d) => [d.itemId, d]));
  const itemsAll = doc.items.filter((i) => i.active).map((i) => {
    const slug = `${slugify(i.name)}-${slugify(i.id).slice(-6)}`;
    const d = detailOf.get(i.id);
    const gallery = parseImageLines(d?.images); const faqs = parseFaqLines(d?.faqs);
    return { id: i.id, slug, name: str(d?.title) || i.name, description: str(d?.summary) || str(i.description), summary: str(d?.summary), details: str(d?.details), gallery: gallery.ok ? gallery.rows : [], faqs: faqs.ok ? faqs.rows : [], status: str(d?.status), price: str(d?.price) || (i.samplePrice ? '' : str(i.price)), image: str(i.image), href: `/services/${slug}`, badge: '', category: str(i.category), duration: '', tags: '', includes: '', location: '', area: str(d?.area), bedrooms: '', veg: '' };
  });
  const items = cut(itemsAll, lim.services, 'services', notes);
  const gallery = cut((cms?.portfolio ?? []).map((g) => ({ src: str(g.src), alt: str(g.alt) || name, title: str(g.title) })), lim.gallery, 'gallery', notes);
  const faqs = cut((ex.faq ?? []).map((f) => ({ q: str(f.q), a: str(f.a) })), lim.faqs, 'faqs', notes);
  const extraPages = (cms?.pages ?? []).filter((p) => p.slug && !RESERVED_PAGE_SLUGS.has(slugify(p.slug)));
  const pages = cut(extraPages, lim.pages, 'pages', notes).map((p) => ({ slug: slugify(p.slug), title: str(p.title), body: str(p.body), intro: str(p.intro), href: `/${slugify(p.slug)}` }));

  const sample = kit.sampleContent(o.categoryId, { lang: o.lang }) as { terms?: Record<string, string>; site?: { name?: string }; about?: { title?: string } };
  const kitTerms = sample.terms;   // platform wording from the kit, in the page language
  // the About heading: the kit's own wording for the language ("About X" / "X பற்றி") with the vendor's name in place of the sample name
  const aboutTitle = sample.site?.name && sample.about?.title?.includes(sample.site.name) ? sample.about.title.replace(sample.site.name, name) : name;
  const content: Record<string, unknown> = {
    category: o.categoryId, lang: o.lang,
    site: { name, tagline: str(cms?.tagline), logo: str(cms?.logo), logoAlt: `${name} logo`, favicon: str(cms?.favicon), year: o.year, url: siteUrl },
    hero: { title: str(ex.headline) || str(cms?.tagline) || name, badge: str(ex.announcement), subtitle: str(ex.subline) || str(cms?.tagline), image: str(cms?.banner), imageAlt: str(ex.heroImageAlt) || name, cta: '' },
    about: { title: aboutTitle, text: str(cms?.about), ownerName: str(ex.ownerName), organisation: str(ex.organisation), established: str(ex.established), image: str(ex.aboutImage), imageAlt: str(ex.aboutImage) ? str(ex.aboutImageAlt) || name : '' },
    contact: {
      phone, phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '', whatsapp: str(cms?.whatsapp) || phone, whatsappHref: waDigits.length >= 10 ? `https://wa.me/${waDigits}` : '',
      email, address, city, area: '', pin, mapUrl: o.directions === false ? '' : str(cms?.googleMaps),
    },
    hours: (cms?.hours ?? []).map((h) => ({ day: str(h.day), open: str(h.open), close: str(h.close), closed: h.closed === true })),
    social: { googleBusiness: str(ex.googleBusiness), instagram: str(cms?.instagram), facebook: str(cms?.facebook), youtube: str(cms?.youtube), linkedin: str(cms?.linkedin), x: str(ex.social?.x), custom: str(ex.social?.customUrl), customLabel: str(ex.social?.customLabel), maps: o.directions === false ? '' : str(cms?.googleMaps), whatsapp: waDigits.length >= 10 ? `https://wa.me/${waDigits}` : '' },
    cta: { label: str(ex.ctaLabel) || cat.ctaPrimary, href: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '/contact', secondaryLabel: '', secondaryHref: '' },
    ...(kitTerms ? { terms: kitTerms } : {}),
    items, groups: (ex.groups ?? []).map((g) => ({ id: slugify(g.name), name: str(g.name) })), offers: (ex.offers ?? []).map((x) => ({ title: str(x.title), detail: str(x.detail) })), team: (ex.team ?? []).map((t) => ({ id: slugify(t.name), name: str(t.name), role: str(t.role), note: str(t.note), image: str(t.image) })),
    testimonials: (cms?.testimonials ?? []).filter((t) => !t.sample && !(t.proOnly && o.directions === false)).map((t) => ({ quote: str(t.quote), author: str(t.author), note: str(t.note) })),
    faqs, gallery,
    steps: (ex.steps ?? []).map((s, i) => ({ n: i + 1, title: str(s.title), desc: str(s.desc) })),
    trust: (ex.trust ?? []).map((t) => ({ text: str(t) })),
    stats: (ex.stats ?? []).map((s) => ({ value: str(s.value), label: str(s.label) })),
    areas: (ex.areas ?? []).map((a) => ({ id: slugify(a.name), name: str(a.name) })), credentials: (ex.credentials ?? []).map((c) => ({ title: str(c.title), detail: str(c.detail) })), blocks: (ex.blocks ?? []).map((b) => ({ key: slugify(b.key), title: str(b.title), items: blockEntries(b.entries) })), videos: [],
    products: cat.track === 'ecommerce' ? items : [],
    pages,
    ...(doc.reviewUrl && o.directions !== false ? { reviews: { writeUrl: doc.reviewUrl } } : {}),   // slice B3: the kit's Write a review button, Pro only
  };
  const settings: Record<string, unknown> = { ...(doc.rendererSettings ?? {}), ...(o.motion ? { motionIntensity: o.motion } : {}) };
  return { content, settings, vendor: { id: doc.vendor.id, unclaimed: !doc.claimed }, host: { siteUrl, customDomain: o.customDomain ?? '', allowEmbeds: false }, notes };
}

/** The pages of the site, in a stable order, for the templates the chosen theme has: five standard pages, the vendor's own pages, then one page per item. */
export function planPages(content: Record<string, unknown>, templates: string[]): PlannedPage[] {
  const has = (t: string): boolean => templates.includes(t);
  const out: PlannedPage[] = [];
  for (const [template, path] of [['home', '/'], ['about', '/about'], ['services', '/services'], ['gallery', '/gallery'], ['contact', '/contact']] as const) {
    if (has(template)) out.push({ template, path, slug: template });
  }
  if (has('page')) {
    for (const p of (content.pages as Array<{ slug: string; title: string; body: string; intro?: string }>) ?? []) out.push({ template: 'page', path: `/${p.slug}`, slug: p.slug, pageContent: { title: p.title, intro: p.intro ?? '', body: p.body, slug: p.slug } });
  }
  if (has('item')) {
    for (const i of (content.items as Array<{ slug: string }>) ?? []) out.push({ template: 'item', path: `/services/${i.slug}`, slug: i.slug, item: i as unknown as Record<string, unknown> });
  }
  return out;
}

/** The renderer `page` argument and content for one planned page. */
export function pageArgs(content: Record<string, unknown>, p: PlannedPage): { page: string | { slug: string; template?: string; item?: unknown; parent?: string }; content: Record<string, unknown> } {
  if (p.template === 'item') return { page: { slug: 'item', item: p.item, parent: 'services' }, content };
  if (p.template === 'page') return { page: { slug: p.slug, template: 'page' }, content: { ...content, page: p.pageContent } };
  return { page: p.template, content };
}
