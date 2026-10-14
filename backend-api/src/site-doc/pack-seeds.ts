import { CATEGORIES } from '../leadspace/leadspace.types';
import { TEMPLATES } from '../leadspace/templates';
import { PackConfig, PackGoal, PackSection } from './pack.types';

/**
 * Starter packs. The 12 LeadSpace trades come straight from their templates (so one engine powers the free LeadSpace page and the full website);
 * the 20 industries the website engine already serves are described here as data. After the first seeding everything is edited in the admin screen.
 */
const SECTIONS: PackSection[] = ['hero', 'services', 'about', 'gallery', 'testimonials', 'faq', 'contact'];
const LAYOUT = { hero: 'overlay', about: 'split', services: 'cards', gallery: 'mosaic', testimonials: 'cards', contact: 'card' };

const GOAL_BY_TRADE: Record<string, PackGoal> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.goal as PackGoal]));
const ITEM_BY_TRADE: Record<string, PackConfig['item']> = {
  'shop-retail': { kind: 'product', noun: 'product', nounPlural: 'products' }, 'restaurant-food': { kind: 'product', noun: 'dish', nounPlural: 'menu' },
  'real-estate': { kind: 'listing', noun: 'listing', nounPlural: 'listings' }, 'builders-interiors': { kind: 'case', noun: 'project', nounPlural: 'projects' },
  clinic: { kind: 'treatment', noun: 'treatment', nounPlural: 'treatments' }, advocate: { kind: 'service', noun: 'practice area', nounPlural: 'practice areas' },
};
const THEME_BY_TRADE: Record<string, string> = {
  'home-services': 'sunset-orange', 'builders-interiors': 'clean-teal', 'real-estate': 'classic-blue', freelancer: 'bold-violet', startup: 'plum-night',
  'photography-events': 'midnight-gold', tutor: 'classic-blue', 'salon-beauty': 'soft-rose', 'shop-retail': 'fresh-green', 'restaurant-food': 'warm-sand', advocate: 'ocean-dark', clinic: 'clean-teal',
};
const SEO_BY_TRADE: Record<string, string> = { 'shop-retail': 'Store', 'restaurant-food': 'Restaurant', clinic: 'MedicalClinic', 'real-estate': 'RealEstateAgent', advocate: 'LegalService', tutor: 'EducationalOrganization', 'salon-beauty': 'BeautySalon', 'builders-interiors': 'GeneralContractor' };

export function tradePacks(): { key: string; name: string; config: PackConfig }[] {
  return CATEGORIES.map((c) => {
    const t = TEMPLATES[c.id];
    const goal = GOAL_BY_TRADE[c.id] ?? 'ENQUIRY';
    const item = ITEM_BY_TRADE[c.id] ?? { kind: 'service' as const, noun: 'service', nounPlural: 'services' };
    return {
      key: c.id, name: c.label,
      config: {
        keywords: [c.id, c.label.toLowerCase(), ...(t?.keywords ?? [])], goal, ctaLabel: t?.cta?.[goal] ?? 'Get in touch', sections: SECTIONS, item,
        defaults: {
          tagline: `${c.label} in {city}`, about: `{business} is a ${c.label.toLowerCase()} in {city}. ${c.blurb}`, headline: t?.headline ?? '{business}', subline: t?.subline ?? c.blurb,
          trust: t?.trust ?? [], faq: t?.faqs ?? [],
        },
        themeKey: THEME_BY_TRADE[c.id] ?? 'clean-teal', layouts: { ...LAYOUT, services: goal === 'CART_ORDER' ? 'cards' : item.kind === 'listing' ? 'rows' : 'cards' }, seoType: SEO_BY_TRADE[c.id] ?? 'LocalBusiness',
        aiPrompts: { about: `Write a warm, honest 80-word About text for {business}, a ${c.label.toLowerCase()} in {city}. No claims that cannot be checked.`, tagline: `A short tagline (under 8 words) for {business}, ${c.label.toLowerCase()}, {city}.`, images: `Three photo ideas for the website of a ${c.label.toLowerCase()}: a hero picture, a work-in-progress picture and a team picture.` },
      },
    };
  });
}

const ENGINE: [string, string, PackGoal, PackConfig['item'], string, string, string][] = [
  // key, label, goal, item, themeKey, seoType, cta
  ['realestate', 'Real estate', 'SITE_VISIT', { kind: 'listing', noun: 'listing', nounPlural: 'listings' }, 'classic-blue', 'RealEstateAgent', 'Book a site visit'],
  ['clinic', 'Clinic and healthcare', 'APPOINTMENT', { kind: 'treatment', noun: 'treatment', nounPlural: 'treatments' }, 'clean-teal', 'MedicalClinic', 'Book an appointment'],
  ['salon', 'Salon and beauty', 'APPOINTMENT', { kind: 'service', noun: 'service', nounPlural: 'services' }, 'soft-rose', 'BeautySalon', 'Book my slot'],
  ['gym', 'Gym and fitness', 'BOOKING', { kind: 'service', noun: 'plan', nounPlural: 'plans' }, 'forest-night', 'SportsActivityLocation', 'Start a free trial'],
  ['coaching', 'Coaching and training', 'BOOKING', { kind: 'service', noun: 'programme', nounPlural: 'programmes' }, 'classic-blue', 'EducationalOrganization', 'Book a call'],
  ['education', 'Education and schools', 'ENQUIRY', { kind: 'service', noun: 'course', nounPlural: 'courses' }, 'classic-blue', 'EducationalOrganization', 'Admission enquiry'],
  ['professional', 'Professional services', 'APPOINTMENT', { kind: 'service', noun: 'service', nounPlural: 'services' }, 'ocean-dark', 'ProfessionalService', 'Book a consultation'],
  ['finance', 'Finance and advisory', 'APPOINTMENT', { kind: 'service', noun: 'service', nounPlural: 'services' }, 'ocean-dark', 'ProfessionalService', 'Book a review'],
  ['diagnostics', 'Diagnostics and labs', 'BOOKING', { kind: 'service', noun: 'test', nounPlural: 'tests' }, 'clean-teal', 'MedicalClinic', 'Book a test'],
  ['photography', 'Photography and studio', 'BOOKING', { kind: 'package', noun: 'package', nounPlural: 'packages' }, 'midnight-gold', 'LocalBusiness', 'Check availability'],
  ['hotel', 'Hotel and hospitality', 'BOOKING', { kind: 'room', noun: 'room', nounPlural: 'rooms' }, 'warm-sand', 'LodgingBusiness', 'Check availability'],
  ['events', 'Events and venues', 'BOOKING', { kind: 'package', noun: 'package', nounPlural: 'packages' }, 'plum-night', 'LocalBusiness', 'Check your date'],
  ['travel', 'Travel and tours', 'ENQUIRY', { kind: 'package', noun: 'package', nounPlural: 'packages' }, 'clean-teal', 'TravelAgency', 'Plan my trip'],
  ['restaurant', 'Restaurant and cafe', 'BOOKING', { kind: 'product', noun: 'dish', nounPlural: 'menu' }, 'warm-sand', 'Restaurant', 'Reserve a table'],
  ['retail', 'Retail and e-commerce', 'CART_ORDER', { kind: 'product', noun: 'product', nounPlural: 'products' }, 'bold-violet', 'Store', 'Shop now'],
  ['agriculture', 'Agriculture', 'ENQUIRY', { kind: 'product', noun: 'product', nounPlural: 'products' }, 'fresh-green', 'LocalBusiness', 'Enquire or order'],
  ['automobile', 'Automobile services', 'BOOKING', { kind: 'service', noun: 'service', nounPlural: 'services' }, 'ocean-dark', 'AutoRepair', 'Book a service'],
  ['construction', 'Construction', 'ENQUIRY', { kind: 'case', noun: 'project', nounPlural: 'projects' }, 'sunset-orange', 'GeneralContractor', 'Request a quote'],
  ['technology', 'Technology and IT', 'BOOKING', { kind: 'service', noun: 'service', nounPlural: 'services' }, 'plum-night', 'ProfessionalService', 'Book a discovery call'],
  ['logistics', 'Logistics and transport', 'ENQUIRY', { kind: 'service', noun: 'service', nounPlural: 'services' }, 'classic-blue', 'LocalBusiness', 'Get a quote'],
];

export function industryPacks(): { key: string; name: string; config: PackConfig }[] {
  return ENGINE.map(([key, label, goal, item, themeKey, seoType, cta]) => ({
    key, name: label,
    config: {
      keywords: [key, label.toLowerCase()], goal, ctaLabel: cta, sections: SECTIONS, item,
      defaults: {
        tagline: `${label} in {city}`, about: `{business} offers ${label.toLowerCase()} in {city}. Tell us what you need and we will get back to you.`, headline: '{business}', subline: `${label} in {city}. ${cta} and we will confirm with you.`,
        trust: [], faq: [{ q: 'How do I get in touch?', a: 'Use the form on this page. We reply as soon as we can.' }, { q: 'Where are you?', a: 'We serve {city} and nearby areas.' }],
      },
      themeKey, layouts: { ...LAYOUT, services: item.kind === 'listing' || item.kind === 'room' ? 'rows' : 'cards' }, seoType,
      aiPrompts: { about: `Write a warm, honest 80-word About text for {business}, ${label.toLowerCase()}, {city}. No claims that cannot be checked.`, tagline: `A short tagline (under 8 words) for {business}, ${label.toLowerCase()}, {city}.`, images: `Three photo ideas for the website of ${label.toLowerCase()}: a hero picture, a service picture and a team picture.` },
    },
  }));
}

/** One pack per key: where a LeadSpace trade and a website industry share a key (clinic), the LeadSpace trade wins because it carries the regulated-trade wording. */
export const starterPacks = (): { key: string; name: string; config: PackConfig }[] => {
  const seen = new Set<string>();
  return [...tradePacks(), ...industryPacks()].filter((p) => (seen.has(p.key) ? false : (seen.add(p.key), true)));
};
