import { CONSENT_TEXT, CONSENT_TEXT_VERSION } from './goals';
import { EventType, categoryOf } from './leadspace.types';
import { PageTheme, TemplateDef, templateFor } from './templates';

/** The fields of a profile that a page is built from (a plain object, so this file needs no database). */
export interface PageSource {
  slug: string; category: string; city: string; serviceArea?: string | null; goal: string; mode: string; templateId: string;
  businessName: string; tagline?: string | null; about?: string | null; address?: string | null; mapsLink?: string | null; heroImage?: string | null;
  services: unknown; offer?: unknown; gallery?: unknown; faqs?: unknown; trust?: unknown; hours?: string | null; existingPageUrl?: string | null;
  verificationStatus: string; noindex: boolean; status: string; reraNumber?: string | null; updatedAt?: Date | string;
}

export interface ServiceItem { name: string; price?: number | string | null; description?: string | null; image?: string | null; /** the vendor's own web address for buying this item (never shown; the page links through our counted redirect) */ buyUrl?: string | null }
export type Block =
  | { type: 'hero'; headline: string; subline: string; image: string | null; primaryButton: string }
  | { type: 'offer'; headline: string; text: string; validUntil: string | null }
  | { type: 'services'; title: string; items: { name: string; priceText: string | null; description: string | null; image: string | null; buyPath: string | null }[] }
  | { type: 'gallery'; images: { src: string; alt: string }[] }
  | { type: 'trust'; items: string[] }
  | { type: 'map'; address: string | null; mapsLink: string | null; area: string | null; hours: string | null }
  | { type: 'faq'; items: { q: string; a: string }[] }
  | { type: 'about'; text: string };

export interface FormField { key: string; label: string; kind: 'text' | 'tel' | 'textarea' | 'date' | 'select' | 'cart'; required: boolean; options?: string[]; hint?: string }
export interface PageModel {
  slug: string; mode: 'TEMPLATE' | 'EXISTING_PAGE'; goal: EventType; templateId: string; theme: PageTheme;
  business: { name: string; city: string; category: string; categoryLabel: string };
  blocks: Block[];
  /** the single thing the page asks of the visitor */
  primaryButton: string;
  /** shown on phones as a bar that stays at the bottom */
  stickyCta: { label: string };
  form: { goal: EventType; fields: FormField[]; submitLabel: string; consentText: string; consentVersion: string };
  disclaimer: string | null;
  rera: string | null;
  seo: { title: string; description: string; canonical: string; robots: string; jsonLd: Record<string, unknown> };
  existingPageUrl: string | null;
  reportUrl: string;
  indexable: boolean;
}

const baseUrl = (): string => (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://get4domain.com').replace(/\/+$/, '');
export const pageUrl = (slug: string): string => {
  const d = process.env.LEADSPACE_BASE_DOMAIN;
  return d ? `https://${slug}.${d}` : `${baseUrl()}/ls/${slug}`;
};

const fill = (s: string, p: { business: string; city: string }): string => s.replace(/\{business\}/g, p.business).replace(/\{city\}/g, p.city);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const priceText = (p: ServiceItem['price']): string | null => {
  if (p === null || p === undefined || p === '') return null;
  if (typeof p === 'number') return Number.isFinite(p) && p > 0 ? `Rs ${p.toLocaleString('en-IN')}` : null;
  const s = String(p).trim();
  return s ? (/^\d+(\.\d+)?$/.test(s) ? `Rs ${Number(s).toLocaleString('en-IN')}` : s.slice(0, 40)) : null;
};
const clip = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}...`);

/** Which fields the goal asks for. Enquiry: name, phone, message. Booking and appointment: date, time slot, service. Site visit: date, property. Cart order: items, address, notes. */
export function formFields(goal: EventType, t: TemplateDef, serviceNames: string[]): FormField[] {
  const who: FormField[] = [
    { key: 'name', label: 'Your name', kind: 'text', required: true },
    { key: 'phone', label: 'Mobile number', kind: 'tel', required: true, hint: 'We send a code to this number on WhatsApp.' },
  ];
  switch (goal) {
    case 'ENQUIRY': return [...who, { key: 'message', label: 'Your message', kind: 'textarea', required: true, hint: t.messageHint }];
    case 'BOOKING':
    case 'APPOINTMENT': return [...who,
      { key: 'service', label: 'Service', kind: 'select', required: true, options: serviceNames.length ? serviceNames : ['Other'] },
      { key: 'date', label: 'Date', kind: 'date', required: true },
      { key: 'time', label: 'Time slot', kind: 'select', required: true, options: t.slots },
      { key: 'notes', label: 'Anything we should know?', kind: 'textarea', required: false }];
    case 'SITE_VISIT': return [...who,
      { key: 'property', label: 'Property or project', kind: 'select', required: true, options: serviceNames.length ? serviceNames : ['Other'] },
      { key: 'date', label: 'Visit date', kind: 'date', required: true },
      { key: 'time', label: 'Preferred time', kind: 'select', required: false, options: t.slots },
      { key: 'notes', label: 'Anything we should know?', kind: 'textarea', required: false }];
    case 'CART_ORDER': return [...who,
      { key: 'items', label: 'Your items', kind: 'cart', required: true },
      { key: 'address', label: 'Delivery address', kind: 'textarea', required: true },
      { key: 'notes', label: 'Notes for the shop', kind: 'textarea', required: false }];
  }
}

/** schema.org type per trade. Regulated trades use their specific subtype; everything else is a LocalBusiness. The phone is deliberately not published: leads come through the form. */
function jsonLd(p: PageSource, url: string, description: string, items: { name: string; priceText: string | null; price: number | null }[]): Record<string, unknown> {
  const reg = categoryOf(p.category)?.regulated;
  const type = reg === 'realEstate' ? 'RealEstateAgent' : reg === 'clinic' ? 'MedicalClinic' : reg === 'advocate' ? 'LegalService' : 'LocalBusiness';
  const out: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': type, name: p.businessName, url, description,
    areaServed: { '@type': 'City', name: p.city },
    address: { '@type': 'PostalAddress', addressLocality: p.city, addressCountry: 'IN' },
    ...(p.heroImage ? { image: p.heroImage } : {}),
    ...(p.hours ? { openingHours: p.hours } : {}),
  };
  const priced = items.filter((i) => i.price !== null);
  if (priced.length) out.hasOfferCatalog = { '@type': 'OfferCatalog', name: 'Services', itemListElement: priced.slice(0, 20).map((i) => ({ '@type': 'Offer', priceCurrency: 'INR', price: i.price, itemOffered: { '@type': 'Service', name: i.name } })) };
  return out;
}

export function buildPage(p: PageSource): PageModel {
  const cat = categoryOf(p.category);
  const t = templateFor(p.category);
  const goal = (p.goal as EventType) || 'ENQUIRY';
  const ctx = { business: p.businessName, city: p.city };
  const services = arr<ServiceItem>(p.services).filter((s) => s && String(s.name ?? '').trim());
  const serviceView = services.map((s, i) => ({ name: String(s.name).slice(0, 120), priceText: priceText(s.price), description: s.description ? clip(String(s.description), 240) : null, image: s.image ?? null, buyPath: s.buyUrl ? `/ls/${p.slug}/go/${i}` : null }));
  const names = serviceView.map((s) => s.name);
  const primaryButton = t.cta[goal];
  const indexable = p.status === 'PUBLISHED' && p.verificationStatus === 'VERIFIED' && !p.noindex;
  const url = pageUrl(p.slug);
  const description = clip(p.tagline ? `${p.tagline}. ${fill(t.subline, ctx)}` : fill(t.subline, ctx), 158);
  const model: PageModel = {
    slug: p.slug, mode: p.mode === 'EXISTING_PAGE' ? 'EXISTING_PAGE' : 'TEMPLATE', goal, templateId: t.id, theme: t.theme,
    business: { name: p.businessName, city: p.city, category: p.category, categoryLabel: cat?.label ?? p.category },
    blocks: [], primaryButton, stickyCta: { label: primaryButton },
    form: { goal, fields: formFields(goal, t, names), submitLabel: primaryButton, consentText: CONSENT_TEXT, consentVersion: CONSENT_TEXT_VERSION },
    disclaimer: t.disclaimer ?? null,
    rera: cat?.regulated === 'realEstate' && p.reraNumber ? p.reraNumber : null,
    seo: {
      title: clip(`${p.businessName} | ${cat?.label ?? 'Local business'} in ${p.city}`, 60), description, canonical: url,
      robots: indexable ? 'index,follow,max-image-preview:large' : 'noindex,nofollow',
      jsonLd: jsonLd(p, url, description, services.map((s) => ({ name: String(s.name), priceText: priceText(s.price), price: typeof s.price === 'number' && s.price > 0 ? s.price : null }))),
    },
    existingPageUrl: p.existingPageUrl ?? null, reportUrl: `${baseUrl()}/ls/${p.slug}?report=1`, indexable,
  };
  // Existing-page mode adds only the purpose layer: the button, the form and the sticky bar. No content blocks, nothing rewritten.
  if (model.mode === 'EXISTING_PAGE') return model;

  const offer = (p.offer && typeof p.offer === 'object' ? p.offer : null) as { headline?: string; text?: string; validUntil?: string } | null;
  const gallery = arr<{ src?: string; alt?: string } | string>(p.gallery).map((g) => (typeof g === 'string' ? { src: g, alt: p.businessName } : { src: String(g?.src ?? ''), alt: String(g?.alt ?? p.businessName) })).filter((g) => /^https?:\/\//.test(g.src) || g.src.startsWith('/'));
  const trust = arr<string>(p.trust).map(String).filter(Boolean);
  const faqs = arr<{ q?: string; a?: string }>(p.faqs).filter((f) => f?.q && f?.a).map((f) => ({ q: String(f.q), a: String(f.a) }));
  const starter = t.starterServices.map((n) => ({ name: n, priceText: null as string | null, description: null as string | null, image: null as string | null, buyPath: null as string | null }));

  model.blocks.push({ type: 'hero', headline: fill(t.headline, ctx), subline: p.tagline ? `${p.tagline}. ${fill(t.subline, ctx)}` : fill(t.subline, ctx), image: p.heroImage ?? null, primaryButton });
  if (offer && (offer.headline || offer.text)) model.blocks.push({ type: 'offer', headline: String(offer.headline ?? 'Offer'), text: String(offer.text ?? ''), validUntil: offer.validUntil ?? null });
  model.blocks.push({ type: 'services', title: goal === 'CART_ORDER' ? 'Choose what you want' : 'What we do', items: serviceView.length ? serviceView : starter });
  if (p.about) model.blocks.push({ type: 'about', text: clip(p.about, 900) });
  if (gallery.length) model.blocks.push({ type: 'gallery', images: gallery.slice(0, 12) });
  model.blocks.push({ type: 'trust', items: trust.length ? trust : t.trust });
  // Contact details are never published: enquiries come through us. Only the areas served and the hours are shown (no address, no map link, no phone, no e-mail).
  if (p.serviceArea || p.hours) model.blocks.push({ type: 'map', address: null, mapsLink: null, area: p.serviceArea ?? null, hours: p.hours ?? null });
  model.blocks.push({ type: 'faq', items: (faqs.length ? faqs : t.faqs).map((f) => ({ q: fill(f.q, ctx), a: fill(f.a, ctx) })) });
  return model;
}
