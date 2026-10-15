import type { EngineSiteData, ThemeTokens } from '../types';
import type { BottomNavItem, EnquiryTab, KitItem, KitSection, KitSiteModel } from '../kit/model';
import themesJson from '../kit/site-themes.json';
import { activeDesign, buildDesignModel } from './design-build';

/**
 * The new public renderer's model builder: a vendor's site is its Website Manager content + the category pack (section order, wording, layouts) + a theme.
 * Nothing here invents content. A field that is empty is either hidden or shown as the pack's plain default wording (never a stock photo, a made-up
 * testimonial, a made-up number or a made-up person). Every field the editor offers is rendered somewhere on the page.
 */
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

interface ThemeRow { id: string; label: string; mode: 'light' | 'dark'; bg: string; fg: string; surface: string; border: string; muted: string; accent: string; accentFg: string; accent2: string; display: 'serif' | 'sans'; radius: string }
export const SITE_THEMES: Record<string, ThemeTokens & { label: string }> = Object.fromEntries((themesJson as ThemeRow[]).map((t) => [t.id, {
  label: t.label, bg: t.bg, fg: t.fg, surface: t.surface, border: t.border, muted: t.muted, accent: t.accent, accentFg: t.accentFg, accent2: t.accent2,
  fontDisplay: t.display === 'serif' ? SERIF : SANS, fontBody: SANS, radius: t.radius, mode: t.mode,
}]));
export const SITE_THEME_LIST = (themesJson as ThemeRow[]).map((t) => ({ id: t.id, label: t.label, mode: t.mode, accent: t.accent, bg: t.bg, fg: t.fg }));

export const VARIANTS = {
  hero: ['overlay', 'split', 'panel'], about: ['split', 'centered', 'columns'], services: ['rows', 'cards', 'menu', 'tiles'],
  gallery: ['mosaic', 'grid', 'strip'], testimonials: ['cards', 'quote', 'list'], contact: ['card', 'split', 'minimal'],
} as const;

export interface PackConfigLite {
  keywords?: string[]; goal: string; ctaLabel: string; sections: string[];
  item: { kind: string; noun: string; nounPlural: string };
  defaults: { tagline: string; about: string; headline: string; subline: string; trust: string[]; faq: { q: string; a: string }[] };
  themeKey: string; layouts: Record<string, string>; seoType: string;
  /** industry designs: the flow family, the category's designs and the default one */
  family?: string; designs?: unknown[]; defaultDesign?: string;
}

/** Used when no pack matches the vendor yet: short, plain, true of any business. */
export const NEUTRAL_PACK: PackConfigLite = {
  goal: 'ENQUIRY', ctaLabel: 'Get in touch', sections: ['hero', 'services', 'about', 'gallery', 'testimonials', 'contact'],
  item: { kind: 'service', noun: 'service', nounPlural: 'services' },
  defaults: { tagline: '{business}', about: '', headline: '{business}', subline: 'Tell us what you need and we will get back to you.', trust: [], faq: [] },
  themeKey: 'clean-teal', layouts: { hero: 'overlay', about: 'split', services: 'cards', gallery: 'mosaic', testimonials: 'cards', contact: 'card' }, seoType: 'LocalBusiness',
};

export const fillText = (t: string, v: { business: string; city: string; phone?: string }): string => {
  let s = t;
  if (!v.city) s = s.replace(/\s+(in|at|near)\s+\{city\}/g, '').replace(/\{city\}/g, '');
  return s.replace(/\{business\}/g, v.business).replace(/\{city\}/g, v.city).replace(/\{phone\}/g, v.phone ?? '').replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
};

const priceStr = (p?: string | null): string | undefined => {
  if (!p) return undefined;
  const t = p.trim();
  return t ? (/^[₹$]/.test(t) ? t : `₹${t}`) : undefined;
};
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const BOOKING = new Set(['BOOKING', 'APPOINTMENT', 'SITE_VISIT']);

const bn = (label: string, icon: string, href: string, emphasis = false): BottomNavItem => ({ label, icon, href, emphasis });

function enquiryTabs(goal: string, cta: string): EnquiryTab[] {
  if (BOOKING.has(goal)) return [{ key: 'book', label: cta, icon: 'CalendarCheck', action: { intent: 'engine.enquiry', label: cta, kind: 'booking' }, fields: ['choice', 'date', 'message'], submitLabel: cta }];
  return [{ key: 'enquiry', label: cta, icon: 'MessageSquare', action: { intent: 'engine.enquiry', label: cta, kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel: cta }];
}

export function resolveLayout(site: EngineSiteData, pack: PackConfigLite): { themeKey: string; hero: string; about: string; services: string; gallery: string; testimonials: string; contact: string } {
  const chosen = site.cms?.layout ?? {};
  const pick = (slot: keyof typeof VARIANTS): string => {
    const v = chosen[slot] || pack.layouts?.[slot];
    return (VARIANTS[slot] as readonly string[]).includes(v) ? v : (VARIANTS[slot][0] as string);
  };
  const themeKey = chosen.themeKey && SITE_THEMES[chosen.themeKey] ? chosen.themeKey : SITE_THEMES[pack.themeKey] ? pack.themeKey : 'clean-teal';
  return { themeKey, hero: pick('hero'), about: pick('about'), services: pick('services'), gallery: pick('gallery'), testimonials: pick('testimonials'), contact: pick('contact') };
}

export function packOf(site: EngineSiteData): PackConfigLite {
  const c = site.pack?.config as PackConfigLite | undefined;
  return c && Array.isArray(c.sections) && c.defaults ? c : NEUTRAL_PACK;
}

export function buildSiteDocModel(site: EngineSiteData): KitSiteModel {
  const cms = site.cms;
  const pack = packOf(site);
  // a category with designs: the design decides the sections and their layouts
  const design = activeDesign(site, pack);
  if (design) return buildDesignModel(site, pack, design);
  const lay = resolveLayout(site, pack);
  const name = (cms?.businessName || site.vendor.businessName || '').trim();
  const phone = cms?.phone?.trim() || undefined;
  const city = (cms?.address ?? '').split(',').slice(-2, -1)[0]?.trim() ?? '';
  const v = { business: name, city, phone };
  const tagline = cms?.tagline?.trim() || fillText(pack.defaults.tagline, v);
  const aboutText = cms?.about?.trim() || fillText(pack.defaults.about, v);
  const wa = (cms?.whatsapp || cms?.phone || '').trim() || undefined;
  const hours = cms?.businessHours?.trim() || undefined;
  const brand = {
    name, tagline, about: aboutText, logo: cms?.logo?.trim() || undefined, phone, whatsapp: wa, email: cms?.email?.trim() || undefined,
    address: cms?.address?.trim() || undefined, businessHours: hours,
    facebook: cms?.facebook?.trim() || undefined, instagram: cms?.instagram?.trim() || undefined, linkedin: cms?.linkedin?.trim() || undefined,
    youtube: cms?.youtube?.trim() || undefined, googleMaps: cms?.googleMaps?.trim() || undefined,
  };

  // the catalogue is the vendor's own products and nothing else
  const items: KitItem[] = site.products.map((p) => {
    const cf = p.customFields ?? {};
    const meta = Object.entries(cf).filter(([k, val]) => k !== 'tags' && k !== 'website-manager-backfill' && typeof val === 'string' && val.trim()).slice(0, 4).map(([k, val]) => ({ label: k.replace(/[_-]/g, ' '), value: val as string }));
    const tags = typeof cf.tags === 'string' && cf.tags.trim() ? cf.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    return { id: p.id, title: p.name, subtitle: p.category || undefined, price: priceStr(p.price), image: p.image || undefined, desc: p.description || undefined, tags, meta: meta.length ? meta : undefined };
  });
  const gallery = (cms?.portfolio ?? []).map((g) => g.src).filter(Boolean);
  const quotes = (cms?.testimonials ?? []).filter((t) => t.quote && t.author);
  const noun = pack.item.nounPlural;

  const cta = pack.ctaLabel;
  const sections: KitSection[] = [];
  const nav: { href: string; label: string }[] = [];
  const bottom: BottomNavItem[] = [bn('Home', 'home', '#top')];
  const addNav = (href: string, label: string): void => { nav.push({ href, label }); };

  for (const s of pack.sections) {
    if (s === 'hero') {
      const whatsapp = wa ? { label: 'WhatsApp us', href: `https://wa.me/${wa.replace(/\D/g, '')}` } : undefined;
      sections.push({ type: 'hero', variant: lay.hero as 'overlay' | 'split' | 'panel', headline: cms?.tagline?.trim() || fillText(pack.defaults.headline, v), subline: cms?.about?.trim() ? cms.about.trim().split(/\n/)[0].slice(0, 220) : fillText(pack.defaults.subline, v), image: cms?.banner?.trim() || '', ctaPrimary: { label: cta, href: '#enquiry' }, ctaSecondary: whatsapp });
    } else if (s === 'services' && items.length) {
      sections.push({ type: 'showcase', id: 'services', variant: lay.services as 'rows' | 'cards' | 'menu' | 'tiles', eyebrow: cap(noun), title: `Our ${noun}`, items });
      addNav('#services', cap(noun)); bottom.push(bn(cap(noun), 'services', '#services'));
    } else if (s === 'about' && aboutText) {
      sections.push({ type: 'about', id: 'about', variant: lay.about as 'split' | 'centered' | 'columns', eyebrow: 'About', title: `About ${name}`, text: aboutText, points: pack.defaults.trust.length ? pack.defaults.trust.map((t) => fillText(t, v)) : undefined });
      addNav('#about', 'About');
    } else if (s === 'gallery' && gallery.length) {
      sections.push({ type: 'gallery', id: 'gallery', variant: lay.gallery as 'mosaic' | 'grid' | 'strip', eyebrow: 'Gallery', title: 'Our work', images: gallery });
      addNav('#gallery', 'Gallery');
    } else if (s === 'testimonials' && quotes.length) {
      sections.push({ type: 'testimonials', id: 'reviews', variant: lay.testimonials as 'cards' | 'quote' | 'list', eyebrow: 'Customers', title: 'What our customers say', items: quotes.map((q) => ({ quote: q.quote, author: q.author, note: q.note })) });
    } else if (s === 'faq' && pack.defaults.faq.length) {
      sections.push({ type: 'faq', id: 'faq', eyebrow: 'Good to know', title: 'Common questions', items: pack.defaults.faq.map((f) => ({ q: fillText(f.q, v), a: fillText(f.a, v) })) });
    } else if (s === 'contact') {
      sections.push({ type: 'enquiry', id: 'enquiry', eyebrow: 'Get in touch', title: cta, sub: 'Send us your details and we will get back to you.', tabs: enquiryTabs(pack.goal, cta) });
      sections.push({ type: 'contact', id: 'contact', variant: lay.contact as 'card' | 'split' | 'minimal', eyebrow: 'Contact', title: 'Find us' });
      addNav('#enquiry', 'Contact');
    }
  }
  // extra pages the vendor wrote
  for (const p of cms?.pages ?? []) addNav(`/site/${site.vendor.subdomain ?? ''}/p/${p.slug}`, p.title);
  bottom.push(bn(cta.length > 12 ? 'Contact' : cta, 'book', '#enquiry', true));

  const choiceLabel = cap(pack.item.noun);
  return {
    brand, theme: SITE_THEMES[lay.themeKey], choices: items.map((i) => i.title), choiceLabel, nav, bottomNav: bottom.slice(0, 5),
    primaryCta: { intent: 'engine.enquiry', label: cta, kind: BOOKING.has(pack.goal) ? 'booking' : 'enquiry' }, sections,
  };
}

/** A vendor-written page (title and text) in the same theme, with the hero as a plain heading. */
export function buildPageModel(site: EngineSiteData, page: { slug: string; title: string; body: string }): KitSiteModel {
  const base = buildSiteDocModel(site);
  return {
    ...base,
    nav: [{ href: `/site/${site.vendor.subdomain ?? ''}`, label: 'Home' }, ...base.nav.filter((n) => n.href.startsWith('/site/'))],
    sections: [
      { type: 'hero', variant: 'panel', headline: page.title, subline: '', image: '', ctaPrimary: { label: base.primaryCta.label, href: '#enquiry' } },
      { type: 'about', id: 'page', variant: 'centered', eyebrow: base.brand.name, title: page.title, text: page.body },
      ...base.sections.filter((s) => s.type === 'enquiry' || s.type === 'contact'),
    ],
  };
}

/** schema.org JSON-LD for a site, from the pack's search-engine type and the vendor's own details. */
export function jsonLdFor(site: EngineSiteData, url: string): Record<string, unknown> {
  const cms = site.cms; const pack = packOf(site);
  const name = (cms?.businessName || site.vendor.businessName || '').trim();
  const same = [cms?.facebook, cms?.instagram, cms?.linkedin, cms?.youtube].filter((x): x is string => !!x && !!x.trim());
  return {
    '@context': 'https://schema.org', '@type': pack.seoType || 'LocalBusiness', name, url,
    ...(cms?.about ? { description: cms.about.slice(0, 300) } : {}), ...(cms?.logo ? { logo: cms.logo, image: cms?.banner || cms.logo } : cms?.banner ? { image: cms.banner } : {}),
    ...(cms?.phone ? { telephone: cms.phone } : {}), ...(cms?.email ? { email: cms.email } : {}), ...(cms?.address ? { address: cms.address } : {}),
    ...(cms?.businessHours ? { openingHours: cms.businessHours } : {}), ...(same.length ? { sameAs: same } : {}), areaServed: 'IN',
    // the vendor's items, by name only: a starter price is never published
    ...(site.products.length ? { hasOfferCatalog: { '@type': 'OfferCatalog', name: pack.item.nounPlural, itemListElement: site.products.slice(0, 12).map((p) => ({ '@type': 'Offer', itemOffered: { '@type': pack.item.kind === 'product' ? 'Product' : 'Service', name: p.name, ...(p.description ? { description: p.description.slice(0, 200) } : {}) } })) } } : {}),
  };
}
