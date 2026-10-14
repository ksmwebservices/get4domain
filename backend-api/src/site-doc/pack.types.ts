import { SITE_THEME_KEYS, SITE_VARIANTS } from './site-doc.constants';

/**
 * A Category Pack: everything needed to generate a website for one kind of business, as DATA. Adding a category is creating one of these in the admin screen,
 * never a code change. Placeholders {business}, {city} and {phone} in the default text are filled from the vendor's company details.
 */
export const PACK_GOALS = ['ENQUIRY', 'BOOKING', 'APPOINTMENT', 'SITE_VISIT', 'CART_ORDER'] as const;
export const PACK_SECTIONS = ['hero', 'services', 'about', 'gallery', 'testimonials', 'faq', 'contact'] as const;
export const PACK_ITEM_KINDS = ['product', 'package', 'service', 'room', 'treatment', 'case', 'listing'] as const;
export const SEO_TYPES = ['LocalBusiness', 'Store', 'MedicalClinic', 'BeautySalon', 'TravelAgency', 'Restaurant', 'RealEstateAgent', 'LegalService', 'EducationalOrganization', 'ProfessionalService', 'HealthAndBeautyBusiness', 'AutoRepair', 'LodgingBusiness', 'SportsActivityLocation', 'GeneralContractor'] as const;

export type PackGoal = (typeof PACK_GOALS)[number];
export type PackSection = (typeof PACK_SECTIONS)[number];

export interface PackConfig {
  /** words that match a vendor's industry or category to this pack */
  keywords: string[];
  goal: PackGoal;
  /** the label of the main button */
  ctaLabel: string;
  /** which sections appear and in what order */
  sections: PackSection[];
  /** what the vendor lists: product, package, service, room, treatment, case or listing */
  item: { kind: (typeof PACK_ITEM_KINDS)[number]; noun: string; nounPlural: string };
  defaults: {
    tagline: string; about: string; headline: string; subline: string;
    trust: string[]; faq: { q: string; a: string }[];
  };
  themeKey: string;
  layouts: { hero: string; about: string; services: string; gallery: string; testimonials: string; contact: string };
  /** schema.org type for search engines */
  seoType: string;
  /** prompts AI Studio uses for the first text and picture ideas */
  aiPrompts: { about: string; tagline: string; images: string };
}

const isStr = (v: unknown, max = 600): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Plain-sentence validation of a pack the admin typed. Returns the problems (empty = fine). */
export function validatePack(c: unknown): string[] {
  const p: string[] = [];
  const o = (c && typeof c === 'object' ? c : {}) as Partial<PackConfig>;
  if (!Array.isArray(o.keywords) || o.keywords.length === 0 || !o.keywords.every((k) => isStr(k, 60))) p.push('Add at least one keyword (for example "salon, beauty parlour") so vendors can be matched to this pack.');
  if (!(PACK_GOALS as readonly string[]).includes(String(o.goal))) p.push(`Choose what visitors do: ${PACK_GOALS.join(', ')}.`);
  if (!isStr(o.ctaLabel, 40)) p.push('Write the label of the main button (up to 40 characters).');
  if (!Array.isArray(o.sections) || o.sections.length === 0 || !o.sections.every((s) => (PACK_SECTIONS as readonly string[]).includes(s))) p.push(`Choose the sections and their order from: ${PACK_SECTIONS.join(', ')}.`);
  else if (!o.sections.includes('hero') || !o.sections.includes('contact')) p.push('A site needs at least the hero and contact sections.');
  if (!o.item || !(PACK_ITEM_KINDS as readonly string[]).includes(String(o.item.kind)) || !isStr(o.item.noun, 30) || !isStr(o.item.nounPlural, 30)) p.push('Say what the business lists (kind, singular and plural), for example service, services.');
  const d = o.defaults;
  if (!d || !isStr(d.tagline, 200) || !isStr(d.about, 2000) || !isStr(d.headline, 160) || !isStr(d.subline, 300)) p.push('Write the default tagline, about text, headline and sub-line.');
  if (d && (!Array.isArray(d.trust) || d.trust.length > 8 || !d.trust.every((t) => isStr(t, 100)))) p.push('Trust points: up to 8 short lines.');
  if (d && (!Array.isArray(d.faq) || d.faq.length > 12 || !d.faq.every((f) => f && isStr(f.q, 200) && isStr(f.a, 800)))) p.push('Questions: up to 12, each with an answer.');
  if (!(SITE_THEME_KEYS as readonly string[]).includes(String(o.themeKey))) p.push('Choose one of the listed themes.');
  const L = (o.layouts ?? {}) as Record<string, string>;
  for (const [slot, allowed] of Object.entries(SITE_VARIANTS)) if (!(allowed as readonly string[]).includes(String(L[slot]))) p.push(`Choose a ${slot} layout from: ${allowed.join(', ')}.`);
  if (!(SEO_TYPES as readonly string[]).includes(String(o.seoType))) p.push('Choose the search-engine type of business.');
  const a = o.aiPrompts;
  if (!a || !isStr(a.about, 600) || !isStr(a.tagline, 300) || !isStr(a.images, 600)) p.push('Write the three AI Studio prompts (about text, tagline, picture ideas).');
  return p;
}

export const fillPlaceholders = (t: string, v: { business: string; city: string; phone?: string }): string =>
  t.replace(/\{business\}/g, v.business).replace(/\{city\}/g, v.city || 'your city').replace(/\{phone\}/g, v.phone ?? '').replace(/\s{2,}/g, ' ').trim();
