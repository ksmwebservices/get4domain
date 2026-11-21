import { getCategory } from '@/data/demo-site';
import { closestPack, packById, type SitePack } from './packs';

/**
 * The view model of a vendor site: everything the kit draws, built from the vendor's own data only. Two modes:
 *   "info"  (Free): information only. No e-mail, no WhatsApp, no link of any kind to act on; the phone is plain text. The fields that could be acted on are not even
 *           copied into the view, so no component can leak them.
 *   "live"  (Pro and above): the phone, WhatsApp and e-mail can be used.
 * Sample content (the pack's starter service names, sample reviews and questions) is added only when `sample` is true (previews of a theme), never to a real vendor's page.
 */
export type SiteMode = 'info' | 'live';

export interface ViewItem { name: string; price: string | null; description: string | null; image: string | null }
export interface SiteView {
  mode: SiteMode;
  sample: boolean;
  name: string;
  /** the real category of the business, shown above the name (never the main heading) */
  category: string | null;
  tagline: string | null;
  about: string | null;
  address: string | null;
  phone: string | null;
  /** live only */
  whatsapp: string | null;
  email: string | null;
  hours: string[];
  logo: string | null;
  banner: string | null;
  items: ViewItem[];
  gallery: { src: string; alt: string }[];
  reviews: { quote: string; author: string }[];
  faqs: { q: string; a: string }[];
  /** the label of the main action (Book now, Get a quote, ...) */
  ctaLabel: string;
  /** the vendor's host, for the footer and the manifest (no scheme) */
  host: string | null;
}

const t = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** Only http(s) pictures and the platform's own root-relative pictures are kept; never a protocol-relative or script address. */
export const safeImage = (v: unknown): string | null => (typeof v === 'string' && (/^https?:\/\//i.test(v) || /^\/(?!\/)[A-Za-z0-9._\-/]+$/.test(v)) ? v : null);

const PLACEHOLDER_HOURS = /^(opening hours?|hours?|working hours?|business hours?|timings?|add (your )?(opening )?hours?|n\/?a|none|nil|tbd|tba|-+|\.+|null|undefined)$/i;
/** The opening-hours lines: a text, or a list of texts or { day, open/hours } rows. A placeholder ("Opening hours") or an empty value gives no lines, so the line is hidden. */
export function hoursLines(raw: unknown): string[] {
  const out: string[] = [];
  const add = (s: unknown): void => { const x = t(s); if (x && !PLACEHOLDER_HOURS.test(x.replace(/[:\s]+$/, ''))) out.push(x); };
  if (typeof raw === 'string') raw.split(/\r?\n|;/).forEach(add);
  else if (Array.isArray(raw)) {
    for (const r of raw) {
      if (typeof r === 'string') add(r);
      else if (r && typeof r === 'object') {
        const o = r as Record<string, unknown>;
        const day = t(o.day) ?? t(o.label); const when = t(o.hours) ?? t(o.open) ?? t(o.time);
        if (when && !PLACEHOLDER_HOURS.test(when)) out.push(day ? `${day}: ${when}` : when);
      }
    }
  }
  return [...new Set(out)].slice(0, 10);
}

const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
/** Text that repeats one already shown (the same sentence, or one inside the other) is dropped, so a page never says a thing twice. */
export function distinctText(text: string | null, shown: (string | null)[]): string | null {
  if (!text) return null;
  const k = squash(text);
  if (!k) return null;
  for (const s of shown) {
    const o = s ? squash(s) : '';
    if (o && (o === k || (k.length > 20 && o.includes(k)) || (o.length > 20 && k.includes(o) && o.length / k.length > 0.8))) return null;
  }
  return text;
}

/** A readable name for the business's real category: the pack the site was made from, else the industry text when it is a real label, else the main category's name. */
export function categoryLabel(industry: string | null | undefined, packName?: string | null, packKey?: string | null): string | null {
  const ind = t(industry);
  const looksLikeLabel = !!ind && (/\s/.test(ind) || /[A-Z]/.test(ind));
  if (ind && looksLikeLabel) return ind;
  const fromKey = packKey ? packById(packKey)?.name : null;
  const main = ind ? getCategory(ind)?.name ?? closestPack(ind).name : null;
  const generic = main === 'Local business' ? null : main;
  return t(packName) ?? fromKey ?? generic ?? null;
}

/** The page title of a site: "<business name> | <real category> | Get4Domain" (the category is left out when it is the name itself or unknown). */
export function pageTitle(name: string, category: string | null): string {
  const cat = category && squash(category) !== squash(name) ? category : null;
  return [name, cat, 'Get4Domain'].filter(Boolean).join(' | ');
}

export interface SiteSource {
  vendor?: { businessName?: string | null; industry?: string | null; subdomain?: string | null } | null;
  cms?: Record<string, unknown> | null;
  products?: ReadonlyArray<object> | null;
  pack?: { key?: string | null; name?: string | null } | null;
}

/** Sample content for a theme preview: the pack's starter service names, two sample questions and two sample reviews, all marked sample by the caller. */
export function sampleFor(pack: SitePack): { items: ViewItem[]; reviews: { quote: string; author: string }[]; faqs: { q: string; a: string }[]; gallery: { src: string; alt: string }[] } {
  const folder = pack.starterFolder;
  return {
    items: pack.starter.services.map((name, i) => ({ name, price: null, description: null, image: i < 4 ? `/starter/${folder}/g${i + 1}.webp` : null })),
    reviews: [{ quote: 'Sample review: friendly, on time and easy to deal with.', author: 'Sample customer' }, { quote: 'Sample review: clear answers and a fair price.', author: 'Sample customer' }],
    faqs: [{ q: 'How do I get in touch?', a: 'Use the contact details on this page.' }, { q: 'Where are you located?', a: 'The address is in the Find us section.' }],
    gallery: [1, 2, 3, 4].map((n) => ({ src: `/starter/${folder}/g${n}.webp`, alt: `${pack.name} sample picture ${n}` })),
  };
}

/** Builds the view of a site. `pack` is the resolved pack (for the label of the main action and the sample content). */
export function buildSiteView(site: SiteSource, o: { mode: SiteMode; pack: SitePack; sample?: boolean }): SiteView {
  const c = (site.cms ?? {}) as Record<string, unknown>;
  const name = t(c.businessName) ?? t(site.vendor?.businessName) ?? 'This business';
  const live = o.mode === 'live';
  const list = (Array.isArray(site.products) ? site.products : []) as Record<string, unknown>[];
  let items: ViewItem[] = list.filter((p) => p && typeof p.name === 'string' && (p.name as string).trim()).slice(0, 24).map((p) => ({ name: (p.name as string).trim(), price: t(p.price), description: t(p.description), image: safeImage(p.image) }));
  const sample = o.sample === true ? sampleFor(o.pack) : null;
  if (sample && !items.length) items = sample.items;
  const tagline = t(c.tagline);
  const about = distinctText(t(c.about), [tagline, name]);
  // an item's description that only repeats its name adds nothing
  items = items.map((i) => ({ ...i, description: distinctText(i.description, [i.name]) }));
  const imgs = items.map((i) => i.image).filter((x): x is string => !!x);
  // the platform's neutral placeholder banner is not a vendor picture: the theme's own art is drawn instead
  const rawBanner = safeImage(c.banner);
  const banner = rawBanner && !/^\/starter\/generic\//.test(rawBanner) ? rawBanner : null;
  const galleryOwn = [...new Set(imgs)].filter((s) => s !== banner).slice(0, 8).map((src, i) => ({ src, alt: `${name} picture ${i + 1}` }));
  const reviewsOwn = Array.isArray(c.testimonials) ? (c.testimonials as Record<string, unknown>[]).map((r) => ({ quote: t(r?.quote) ?? '', author: t(r?.author) ?? '' })).filter((r) => r.quote).slice(0, 6) : [];
  const faqsOwn = Array.isArray(c.faqs) ? (c.faqs as Record<string, unknown>[]).map((r) => ({ q: t(r?.q) ?? '', a: t(r?.a) ?? '' })).filter((r) => r.q && r.a).slice(0, 8) : [];
  return {
    mode: o.mode, sample: o.sample === true, name,
    category: categoryLabel(site.vendor?.industry, site.pack?.name ?? null, site.pack?.key ?? null),
    tagline, about, address: t(c.address), phone: t(c.phone),
    whatsapp: live ? t(c.whatsapp) : null, email: live ? t(c.email) : null,
    hours: hoursLines(c.hours ?? c.openingHours), logo: safeImage(c.logo), banner,
    items,
    gallery: galleryOwn.length ? galleryOwn : sample && o.sample ? sample.gallery : [],
    reviews: reviewsOwn.length ? reviewsOwn : sample ? sample.reviews : [],
    faqs: faqsOwn.length ? faqsOwn : sample ? sample.faqs : [],
    ctaLabel: o.pack.starter.cta, host: t(site.vendor?.subdomain),
  };
}

/** The view of a Free site from the Free view the renderer builds (information only). */
export function siteViewFromFree(f: { name: string; tagline: string | null; about: string | null; address: string | null; phone: string | null; logo: string | null; banner: string | null; items: ViewItem[]; hours: string[]; industry: string | null; packKey: string | null; host: string | null; category: string | null }, pack: SitePack, sample = false): SiteView {
  const v = buildSiteView({
    vendor: { businessName: f.name, industry: f.industry, subdomain: f.host },
    cms: { businessName: f.name, tagline: f.tagline, about: f.about, address: f.address, phone: f.phone, logo: f.logo, banner: f.banner, hours: f.hours },
    products: f.items as unknown as Array<Record<string, unknown>>, pack: f.packKey ? { key: f.packKey } : null,
  }, { mode: 'info', pack, sample });
  return { ...v, category: f.category ?? v.category };
}
