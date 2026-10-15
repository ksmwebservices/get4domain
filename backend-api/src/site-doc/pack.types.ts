import { SITE_THEME_KEYS, SITE_VARIANTS } from './site-doc.constants';
import { DesignSpec, FAMILIES, FamilyKey, VOCAB, validateDesign } from './families';

/**
 * A Category Pack: everything needed to generate a website for one kind of business, as DATA. Adding a category is creating one of these in the admin screen,
 * never a code change. Placeholders {business}, {city} and {phone} in the default text are filled from the vendor's company details.
 */
export const PACK_GOALS = ['ENQUIRY', 'BOOKING', 'APPOINTMENT', 'SITE_VISIT', 'CART_ORDER'] as const;
export const PACK_SECTIONS = ['hero', 'services', 'about', 'gallery', 'testimonials', 'faq', 'contact'] as const;
export const PACK_ITEM_KINDS = ['product', 'package', 'service', 'room', 'treatment', 'case', 'listing'] as const;
export const SEO_TYPES = ['LocalBusiness', 'Store', 'MedicalClinic', 'BeautySalon', 'TravelAgency', 'Restaurant', 'RealEstateAgent', 'LegalService', 'EducationalOrganization', 'ProfessionalService', 'HealthAndBeautyBusiness', 'AutoRepair', 'LodgingBusiness', 'SportsActivityLocation', 'GeneralContractor', 'HomeAndConstructionBusiness', 'MovingCompany'] as const;

export type PackGoal = (typeof PACK_GOALS)[number];
export type PackSection = (typeof PACK_SECTIONS)[number];

/** The starter content a new site of this category starts with. All of it is SAMPLE: copied into the vendor's own site, marked sample, editable. */
export interface StarterSeed {
  headline: string; subline: string; tagline: string; about: string; announce: string; cta: string;
  trust: string[];
  steps: { title: string; desc: string }[];
  quotes: { quote: string; author: string }[];
  items: { title: string; desc: string; price: string; category: string; fields: Record<string, string> }[];
  faq: { q: string; a: string }[];
  motif: string; hue: number;
  images: { hero: string; gallery: string[] };
  itemKind?: string;
}

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
  /** Industry designs (15 Oct 2026): the flow family, exactly four enabled designs, the one new vendors start with, and the starter content */
  family?: FamilyKey;
  designs?: DesignSpec[];
  defaultDesign?: string;
  seed?: StarterSeed;
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
  if (o.family !== undefined || o.designs !== undefined || o.seed !== undefined) p.push(...validateDesigns(o));
  return p;
}

/** The industry-designs part of a pack: the family, exactly four enabled designs, a default among them, and the starter content. */
export function validateDesigns(o: Partial<PackConfig>): string[] {
  const p: string[] = [];
  if (!o.family || !(VOCAB.families as string[]).includes(o.family) || !FAMILIES[o.family]) { p.push(`Choose the kind of business flow: ${VOCAB.families.join(', ')}.`); return p; }
  const designs = Array.isArray(o.designs) ? o.designs : [];
  const on = designs.filter((d) => d && d.enabled !== false);
  if (on.length !== 4) p.push(`A category needs exactly 4 designs switched on (it has ${on.length}).`);
  const keys = new Set<string>();
  for (const d of designs) { if (keys.has(d?.key)) p.push(`Two designs use the key "${d.key}". Give each its own key.`); keys.add(d?.key); p.push(...validateDesign(d, o.family)); }
  if (!o.defaultDesign || !on.some((d) => d.key === o.defaultDesign)) p.push('Choose which of the four designs new vendors start with.');
  const s = o.seed;
  if (!s || typeof s !== 'object') { p.push('Fill in the starter content (headline, sub-line, about text, items, questions).'); return p; }
  for (const k of ['headline', 'subline', 'tagline', 'about'] as const) if (typeof s[k] !== 'string' || !s[k].trim()) p.push(`Starter content: write the ${k === 'subline' ? 'sub-line' : k}.`);
  if (!Array.isArray(s.items) || s.items.length < 3 || s.items.length > 12 || !s.items.every((i) => i && isStr(i.title, 120) && typeof i.desc === 'string')) p.push('Starter content: add 3 to 12 items, each with a name and a short description.');
  if (!Array.isArray(s.faq) || s.faq.length < 3 || s.faq.length > 12 || !s.faq.every((f) => f && isStr(f.q, 200) && isStr(f.a, 800))) p.push('Starter content: add at least 3 common questions, each with an answer.');
  if (!Array.isArray(s.quotes) || !s.quotes.every((q) => q && isStr(q.quote, 600) && isStr(q.author, 120))) p.push('Starter content: sample customer quotes need a quote and a name.');
  return p;
}

export const fillPlaceholders = (t: string, v: { business: string; city: string; phone?: string }): string =>
  t.replace(/\{business\}/g, v.business).replace(/\{city\}/g, v.city || 'your city').replace(/\{phone\}/g, v.phone ?? '').replace(/\s{2,}/g, ' ').trim();
