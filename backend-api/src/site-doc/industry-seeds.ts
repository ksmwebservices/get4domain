import { FamilyKey, FAMILIES, designsFor } from './families';
import type { PackConfig, StarterSeed } from './pack.types';
import { PART1 } from './seeds/part1';
import { PART2 } from './seeds/part2';
import { PART3 } from './seeds/part3';
import type { CategorySeed } from './seeds/seed.types';

/** The 24 launch categories (see evidence/industry-designs/AUDIT.md). Each starter pack is built from one of these plus its family; nothing here is code a new category needs. */
export const CATEGORY_SEEDS: CategorySeed[] = [...PART1, ...PART2, ...PART3];

/** Family fall-backs for the points a category does not word itself. */
const TRUST: Record<FamilyKey, string[]> = {
  shop: ['Order here or on WhatsApp', 'We confirm every order', 'Delivery in your area', 'Easy to reach'],
  booking: ['Book in a minute', 'Clear prices', 'Friendly, on-time service', 'Easy to find'],
  enquiry: ['Free first conversation', 'Estimate in writing', 'Clear communication', 'Local and easy to reach'],
  packages: ['Plans made around you', 'Prices in writing', 'Reachable throughout', 'A local team'],
  menu: ['Cooked fresh', 'Veg and non-veg marked', 'Tables confirmed by message', 'Party orders welcome'],
  portfolio: ['See real work first', 'Quote in writing', 'Delivery dates agreed', 'Easy to reach'],
  listings: ['Site visits arranged', 'Paperwork explained plainly', 'Local knowledge', 'Clear communication'],
  courses: ['Trial class on request', 'Progress shared regularly', 'Clear fees', 'Easy to reach'],
};
const STEPS: Record<FamilyKey, [string, string][]> = {
  shop: [['Choose', 'Pick what you like.'], ['Send your order', 'Use the form or WhatsApp.'], ['We confirm', 'Availability, total and delivery.'], ['Delivery or pick-up', 'At a time that suits you.']],
  booking: [['Choose a service', 'See what we offer.'], ['Pick a time', 'Send your preferred slot.'], ['We confirm', 'You get a message back.'], ['Visit us', 'Come at the agreed time.']],
  enquiry: [['Tell us what you need', 'A short message is enough.'], ['We reply', 'With questions and a next step.'], ['Agree the scope', 'Price and timeline in writing.'], ['We deliver', 'And stay in touch.']],
  packages: [['Tell us your plan', 'Dates, people and ideas.'], ['Get a plan and price', 'In writing.'], ['Confirm', 'We hold your booking.'], ['Enjoy', 'We stay reachable.']],
  menu: [['Browse the menu', 'See what is cooking.'], ['Reserve or order', 'Send the form or call.'], ['We confirm', 'By message.'], ['Enjoy your meal', 'Fresh and on time.']],
  portfolio: [['See our work', 'Browse the gallery.'], ['Tell us your idea', 'Send a short brief.'], ['Get a quote', 'In writing.'], ['We deliver', 'On the agreed date.']],
  listings: [['Tell us what you want', 'Budget, area and type.'], ['See the options', 'We share what matches.'], ['Visit', 'We arrange the site visit.'], ['Paperwork', 'Explained in plain words.']],
  courses: [['Send an enquiry', 'Tell us the course.'], ['Visit or demo', 'Meet the teacher.'], ['Choose a batch', 'Timings and fees.'], ['Start learning', 'With regular progress reviews.']],
};

const FAMILY_PAGE_ITEM_NOUN: Record<FamilyKey, string> = { shop: 'products', booking: 'services', enquiry: 'services', packages: 'packages', menu: 'menu', portfolio: 'work', listings: 'properties', courses: 'courses' };
void FAMILY_PAGE_ITEM_NOUN;

/** Paths of the starter pictures (made by scripts/industry-designs/seed-images.js and served from the website's own storage). */
export const starterImages = (key: string): { hero: string; gallery: string[] } => ({
  hero: `/starter/${key}/hero.webp`, gallery: [1, 2, 3, 4].map((n) => `/starter/${key}/g${n}.webp`),
});

export function seedFor(s: CategorySeed): StarterSeed {
  const fam = FAMILIES[s.family];
  return {
    headline: s.headline, subline: s.subline, tagline: s.tagline, about: s.about, announce: s.announce, cta: s.cta,
    trust: s.trust ?? TRUST[s.family],
    steps: (s.steps ?? STEPS[s.family]).map(([title, desc]) => ({ title, desc })),
    quotes: s.quotes.map(([quote, author]) => ({ quote, author })),
    faq: s.faq.map(([q, a]) => ({ q, a })),
    items: s.items.map(([title, desc, price, category, fields]) => ({ title, desc, price, category, fields: Object.fromEntries(Object.entries(fields ?? {}).filter(([, v]) => v !== '')) })),
    motif: s.motif, hue: s.hue, images: starterImages(s.key),
    itemKind: fam.itemKind,
  };
}

export function packFromSeed(s: CategorySeed): { key: string; name: string; config: PackConfig } {
  const fam = FAMILIES[s.family];
  const designs = designsFor(s.family, s.theme);
  const first = designs[0];
  const seed = seedFor(s);
  return {
    key: s.key, name: s.name,
    config: {
      keywords: [...new Set([s.key, s.name.toLowerCase(), ...s.aliases])],
      goal: fam.goal, ctaLabel: s.cta,
      sections: ['hero', 'services', 'about', 'gallery', 'testimonials', 'faq', 'contact'],
      item: { kind: fam.itemKind, noun: s.itemNoun, nounPlural: s.itemNounPlural },
      defaults: { tagline: s.tagline, about: s.about, headline: s.headline, subline: s.subline, trust: seed.trust, faq: s.faq.map(([q, a]) => ({ q, a })) },
      themeKey: first.themeKey,
      layouts: { hero: 'overlay', about: 'split', services: 'cards', gallery: 'mosaic', testimonials: 'cards', contact: 'card' },
      seoType: s.seoType,
      aiPrompts: {
        about: `Write a warm, honest 80-word About text for {business}, ${s.name.toLowerCase()}, {city}. No claims that cannot be checked.`,
        tagline: `A short tagline (under 8 words) for {business}, ${s.name.toLowerCase()}, {city}.`,
        images: `Three photo ideas for the website of ${s.name.toLowerCase()}: ${fam.imageMood}.`,
      },
      family: s.family, designs, defaultDesign: first.key, seed,
    },
  };
}

/** Every starter pack: the 24 categories. */
export const starterDesignPacks = (): { key: string; name: string; config: PackConfig }[] => CATEGORY_SEEDS.map(packFromSeed);

/**
 * What seeding the starter categories would do against the packs that exist: create the missing ones; add the family, the four designs and the starter content to an older
 * pack that has none (keeping everything an admin edited); leave the rest alone. Used by the admin button and by the VM script, so they can never disagree.
 */
export function planStarterSeed(existing: { key: string; config: unknown }[]): { create: { key: string; name: string; config: PackConfig }[]; upgrade: { key: string; config: PackConfig }[]; kept: number } {
  const have = new Map(existing.map((p) => [p.key, p.config as PackConfig]));
  const create: { key: string; name: string; config: PackConfig }[] = []; const upgrade: { key: string; config: PackConfig }[] = []; let kept = 0;
  for (const p of starterDesignPacks()) {
    const old = have.get(p.key);
    if (!old) create.push(p);
    else if (!old.designs) upgrade.push({ key: p.key, config: { ...old, keywords: [...new Set([...(old.keywords ?? []), ...p.config.keywords])], family: p.config.family, designs: p.config.designs, defaultDesign: p.config.defaultDesign, seed: p.config.seed } });
    else kept += 1;
  }
  return { create, upgrade, kept };
}
