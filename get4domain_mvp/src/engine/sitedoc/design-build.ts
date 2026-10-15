import type { EngineSiteData, ThemeTokens } from '../types';
import type { BottomNavItem, EnquiryTab, KitItem, KitSection, KitSiteModel } from '../kit/model';
import vocab from './design-vocab.json';
import { SITE_THEMES, VARIANTS, type PackConfigLite } from './build';

/**
 * The design-driven builder (industry designs, 15 Oct 2026). A design is DATA inside the category pack: an ordered list of sections, each with a layout, plus style
 * tokens. This turns the vendor's own content + that design into the page. Nothing here writes business text: headline, items, questions, steps and the rest come from
 * the vendor's site (seeded from the category's starter content at creation, and editable). An empty field hides its section.
 */
export interface DesignSection { type: string; variant: string; enabled?: boolean }
export interface DesignLite {
  key: string; name: string; enabled?: boolean; themeKey: string; font: string; radius: string; button: string; nav: string; footer: string; actionBar: string;
  sections: DesignSection[];
}
export interface ExtrasLite {
  headline?: string; subline?: string; ctaLabel?: string; announcement?: string; announcementLink?: string;
  trust?: string[]; faq?: { q: string; a: string }[]; steps?: { title: string; desc?: string }[]; stats?: { value: string; label: string }[];
  team?: { name: string; role?: string; note?: string; image?: string }[]; beforeAfter?: { before: string; after: string; caption?: string }[];
  sample?: Record<string, boolean>;
}

export const DESIGN_VOCAB = vocab as { sections: Record<string, string[]>; fonts: string[]; radius: string[]; buttons: string[]; nav: string[]; footer: string[]; actionBar: string[]; families: string[] };

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const FONT: Record<string, string> = {
  serif: SERIF, sans: SANS,
  humanist: "'Trebuchet MS', 'Segoe UI', Candara, Verdana, sans-serif",
  classic: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
};
const RADIUS: Record<string, string> = { sharp: '2px', soft: '8px', round: '18px' };

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const BOOKING = new Set(['BOOKING', 'APPOINTMENT', 'SITE_VISIT']);
const RESERVED_META = new Set(['tags', 'veg', 'sample', 'sampleprice', 'website-manager-backfill']);
const priceStr = (p?: string | null): string | undefined => { const t = (p ?? '').trim(); return t ? (/^[₹$]/.test(t) ? t : `₹${t}`) : undefined; };

/** Opening hours text -> rows ("Mon to Sat, 9 am to 6 pm; Sun closed" becomes two rows). */
export function hoursRows(text: string | null | undefined): { label: string; value: string }[] {
  const parts = (text ?? '').split(/\n|;/).map((p) => p.trim()).filter(Boolean);
  const rows: { label: string; value: string }[] = [];
  for (const p of parts) {
    const m = p.match(/^([A-Za-z][A-Za-z .&-]{1,24}?)[:,\s]+(\d.*|closed.*|open.*|by appointment.*)$/i);
    rows.push(m ? { label: m[1].trim(), value: m[2].trim() } : { label: 'Hours', value: p });
  }
  return rows.slice(0, 8);
}

/** The design in use: the vendor's pick if it is one of the category's enabled designs, else the category's default. */
export function activeDesign(site: EngineSiteData, pack: PackConfigLite): DesignLite | null {
  const designs = ((pack as { designs?: DesignLite[] }).designs ?? []).filter((d) => d && d.enabled !== false);
  if (!designs.length) return null;
  const want = (site.cms as { designKey?: string | null } | null)?.designKey;
  const def = (pack as { defaultDesign?: string }).defaultDesign;
  return designs.find((d) => d.key === want) ?? designs.find((d) => d.key === def) ?? designs[0];
}

export function designTheme(design: DesignLite, site: EngineSiteData): ThemeTokens & { label: string } {
  const chosen = site.cms?.layout?.themeKey;
  const key = chosen && SITE_THEMES[chosen] ? chosen : SITE_THEMES[design.themeKey] ? design.themeKey : 'clean-teal';
  return { ...SITE_THEMES[key], radius: RADIUS[design.radius] ?? SITE_THEMES[key].radius, fontDisplay: FONT[design.font] ?? SITE_THEMES[key].fontDisplay };
}

type Variants = typeof VARIANTS;
/** A vendor's own layout pick for a slot wins over the design's, but only when it is a layout that slot has. */
function pickVariant(site: EngineSiteData, slot: keyof Variants, designVariant: string, allowed: readonly string[]): string {
  const own = site.cms?.layout?.[slot];
  return own && (VARIANTS[slot] as readonly string[]).includes(own) && allowed.includes(own) ? own : designVariant;
}

function enquiryTabs(goal: string, cta: string): EnquiryTab[] {
  if (BOOKING.has(goal)) return [{ key: 'book', label: cta, icon: 'CalendarCheck', action: { intent: 'engine.enquiry', label: cta, kind: 'booking' }, fields: ['choice', 'date', 'message'], submitLabel: cta }];
  return [{ key: 'enquiry', label: cta, icon: 'MessageSquare', action: { intent: 'engine.enquiry', label: cta, kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel: cta }];
}

export function buildDesignModel(site: EngineSiteData, pack: PackConfigLite, design: DesignLite): KitSiteModel {
  const cms = site.cms;
  const ex = ((cms as { extras?: ExtrasLite | null } | null)?.extras ?? {}) as ExtrasLite;
  const name = (cms?.businessName || site.vendor.businessName || '').trim();
  const phone = cms?.phone?.trim() || undefined;
  const parts = (cms?.address ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const city = parts.length === 1 ? (parts[0].length <= 40 ? parts[0] : '') : parts.length ? (/^\d{5,6}$/.test(parts[parts.length - 1]) ? parts[parts.length - 2] ?? '' : parts[parts.length - 1]) : '';
  // no render-time stock text: an empty field stays empty (the starter content is copied into the vendor's own site at creation)
  const tagline = cms?.tagline?.trim() || '';
  const aboutText = cms?.about?.trim() || '';
  const wa = (cms?.whatsapp || cms?.phone || '').trim() || undefined;
  const hours = cms?.businessHours?.trim() || undefined;
  const cta = ex.ctaLabel?.trim() || pack.ctaLabel;
  const brand = {
    name, tagline, about: aboutText, logo: cms?.logo?.trim() || undefined, phone, whatsapp: wa, email: cms?.email?.trim() || undefined,
    address: cms?.address?.trim() || undefined, businessHours: hours,
    facebook: cms?.facebook?.trim() || undefined, instagram: cms?.instagram?.trim() || undefined, linkedin: cms?.linkedin?.trim() || undefined,
    youtube: cms?.youtube?.trim() || undefined, googleMaps: cms?.googleMaps?.trim() || undefined,
  };

  // the catalogue is the vendor's own items and nothing else; a starter item's price is hidden by the server and shown as "Contact for price"
  const items: KitItem[] = site.products.map((p) => {
    const cf = (p.customFields ?? {}) as Record<string, unknown>;
    const meta = Object.entries(cf).filter(([k, val]) => !RESERVED_META.has(k.toLowerCase()) && typeof val === 'string' && (val as string).trim()).slice(0, 4).map(([k, val]) => ({ label: k.replace(/[_-]/g, ' '), value: val as string }));
    const tags = typeof cf.tags === 'string' && cf.tags.trim() ? cf.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    const veg = cf.veg === 'veg' || cf.veg === 'nonveg' || cf.veg === 'egg' ? (cf.veg as 'veg' | 'nonveg' | 'egg') : undefined;
    const price = cf.samplePrice === 'true' ? 'Contact for price' : priceStr(p.price);
    return { id: p.id, title: p.name, subtitle: p.category || undefined, price, image: p.image || undefined, desc: p.description || undefined, tags, meta: meta.length ? meta : undefined, veg };
  });
  const categories = [...new Set(items.map((i) => i.subtitle).filter((c): c is string => !!c))];
  const gallery = (cms?.portfolio ?? []).map((g) => g.src).filter(Boolean);
  const quotes = (cms?.testimonials ?? []).filter((t) => t.quote && t.author && !(t as { sample?: boolean }).sample);
  const noun = pack.item.nounPlural;

  const sections: KitSection[] = [];
  const nav: { href: string; label: string }[] = [];
  const bottom: BottomNavItem[] = [{ label: 'Home', icon: 'home', href: '#top' }];
  const addNav = (href: string, label: string): void => { if (!nav.some((n) => n.href === href)) nav.push({ href, label }); };
  const teamLabel = pack.family === 'courses' ? 'Teachers' : 'Team';
  const priceLabel = pack.family === 'courses' ? 'Fees' : 'Pricing';
  const hoursList = hoursRows(hours);
  const heroLines = [...(phone ? [`Call ${phone}`] : []), ...hoursList.slice(0, 2).map((r) => `${r.label}: ${r.value}`), ...(city ? [city] : [])];

  for (const spec of design.sections) {
    if (spec.enabled === false) continue;
    const t = spec.type;
    if (t === 'announce') {
      const text = ex.announcement?.trim();
      if (text) sections.push({ type: 'announce', variant: spec.variant as 'strip' | 'accent' | 'ticker', text, href: ex.announcementLink?.trim() || undefined });
    } else if (t === 'hero') {
      const whatsapp = wa ? { label: 'WhatsApp us', href: `https://wa.me/${wa.replace(/\D/g, '')}` } : undefined;
      const first = aboutText ? aboutText.split(/\n/)[0].slice(0, 220) : '';
      sections.push({
        type: 'hero', variant: pickVariant(site, 'hero', spec.variant, ['overlay', 'split', 'panel', 'center', 'card']) as 'overlay',
        headline: ex.headline?.trim() || cms?.tagline?.trim() || name, subline: ex.subline?.trim() || first,
        image: cms?.banner?.trim() || '', imageAlt: `${name}${city ? `, ${city}` : ''}`, ctaPrimary: { label: cta, href: '#enquiry' }, ctaSecondary: whatsapp,
        card: { title: BOOKING.has(pack.goal) ? 'Book with us' : 'Talk to us', lines: heroLines },
      });
    } else if (t === 'trust') {
      if (ex.trust?.length) sections.push({ type: 'trust', variant: spec.variant as 'icons', items: ex.trust.filter(Boolean) });
    } else if (t === 'items') {
      if (!items.length) continue;
      const v2 = pickVariant(site, 'services', spec.variant, ['rows', 'cards', 'menu', 'tiles', ...(spec.variant.includes('-') ? [spec.variant] : [])]);
      const common = { id: 'services', eyebrow: cap(noun), title: `Our ${noun}`, items };
      if (v2.startsWith('catalog-')) sections.push({ type: 'catalog', ...common, variant: v2.slice(8) as 'grid', categories });
      else if (v2.startsWith('package-')) sections.push({ type: 'packages', ...common, variant: v2.slice(8) as 'cards' });
      else if (v2.startsWith('menu-')) sections.push({ type: 'menu', ...common, variant: v2.slice(5) as 'twocol', categories });
      else if (v2 === 'index') sections.push({ type: 'featureIndex', id: 'services', eyebrow: cap(noun), title: `Our ${noun}`, items: items.slice(0, 8).map((i) => ({ label: i.title, blurb: i.desc ?? '' })) });
      else sections.push({ type: 'showcase', ...common, variant: v2 as 'cards' });
      addNav('#services', cap(noun)); bottom.push({ label: cap(noun).slice(0, 10), icon: 'services', href: '#services' });
    } else if (t === 'about') {
      if (aboutText) { sections.push({ type: 'about', id: 'about', variant: pickVariant(site, 'about', spec.variant, ['split', 'centered', 'columns']) as 'split', eyebrow: 'About', title: `About ${name}`, text: aboutText, image: gallery[0] }); addNav('#about', 'About'); }
    } else if (t === 'pricing') {
      const priced = items.filter((i) => i.price);
      if (priced.length) { sections.push({ type: 'pricing', id: 'pricing', variant: spec.variant as 'table', eyebrow: priceLabel, title: `${priceLabel} at a glance`, items: priced.slice(0, 6) }); addNav('#pricing', priceLabel); }
    } else if (t === 'process') {
      if (ex.steps?.length) sections.push({ type: 'steps', id: 'process', variant: spec.variant as 'cards', eyebrow: 'How it works', title: 'How it works', items: ex.steps.filter((s) => s.title).map((s) => ({ title: s.title, desc: s.desc })) });
    } else if (t === 'stats') {
      if (ex.stats?.length) sections.push({ type: 'stats', variant: spec.variant as 'band', items: ex.stats.filter((s) => s.value && s.label) });
    } else if (t === 'team') {
      if (ex.team?.length) { sections.push({ type: 'people', id: 'team', variant: spec.variant as 'cards', eyebrow: teamLabel, title: `Meet the ${teamLabel.toLowerCase()}`, items: ex.team.filter((m) => m.name) }); addNav('#team', teamLabel); }
    } else if (t === 'gallery') {
      if (gallery.length) { sections.push({ type: 'gallery', id: 'gallery', variant: pickVariant(site, 'gallery', spec.variant, ['mosaic', 'grid', 'strip']) as 'mosaic', eyebrow: 'Gallery', title: `${name}: our work`, images: gallery }); addNav('#gallery', 'Gallery'); }
    } else if (t === 'beforeAfter') {
      if (ex.beforeAfter?.length) { sections.push({ type: 'beforeAfter', id: 'results', variant: spec.variant as 'pair', eyebrow: 'Results', title: 'Before and after', items: ex.beforeAfter.filter((b) => b.before && b.after) }); addNav('#results', 'Results'); }
    } else if (t === 'testimonials') {
      if (quotes.length) sections.push({ type: 'testimonials', id: 'reviews', variant: pickVariant(site, 'testimonials', spec.variant, ['cards', 'quote', 'list']) as 'cards', eyebrow: 'Customers', title: 'What our customers say', items: quotes.map((q) => ({ quote: q.quote, author: q.author, note: q.note })) });
    } else if (t === 'faq') {
      if (ex.faq?.length) { sections.push({ type: 'faq', id: 'faq', variant: spec.variant as 'accordion', eyebrow: 'Good to know', title: 'Common questions', items: ex.faq.filter((f) => f.q && f.a) }); addNav('#faq', 'Questions'); }
    } else if (t === 'hours') {
      if (hoursList.length) sections.push({ type: 'hours', id: 'hours', variant: spec.variant as 'table', eyebrow: 'Opening hours', title: 'When to find us', rows: hoursList });
    } else if (t === 'cta') {
      sections.push({ type: 'cta', id: 'cta', variant: spec.variant as 'band', title: tagline, label: cta });
    } else if (t === 'enquiry') {
      sections.push({ type: 'enquiry', id: 'enquiry', variant: spec.variant as 'panel', eyebrow: 'Get in touch', title: cta, sub: 'Send us your details and we will get back to you.', tabs: enquiryTabs(pack.goal, cta) });
      addNav('#enquiry', 'Contact');
    } else if (t === 'contact') {
      sections.push({ type: 'contact', id: 'contact', variant: pickVariant(site, 'contact', spec.variant, ['card', 'split', 'minimal']) as 'card', eyebrow: 'Contact', title: 'Find us' });
    }
  }
  for (const p of cms?.pages ?? []) addNav(`/site/${site.vendor.subdomain ?? ''}/p/${p.slug}`, p.title);
  bottom.push({ label: cta.length > 12 ? 'Contact' : cta, icon: 'book', href: '#enquiry', emphasis: true });

  return {
    brand, theme: designTheme(design, site), choices: items.map((i) => i.title), choiceLabel: cap(pack.item.noun), nav, bottomNav: bottom.slice(0, 5),
    primaryCta: { intent: 'engine.enquiry', label: cta, kind: BOOKING.has(pack.goal) ? 'booking' : 'enquiry' }, sections,
    style: { button: design.button as 'solid', nav: design.nav as 'bar', footer: design.footer as 'columns', actionBar: design.actionBar as 'tabs' },
  };
}
