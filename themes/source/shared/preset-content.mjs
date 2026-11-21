// Starter content for presets: generic, invented services and FAQs in English and Tamil, taken from the category's fixture seed (names only, no prices).
// A theme passes its own FAQ wording; "{label}" is replaced by the category's name in each language.
import { SEEDS } from '../../fixtures/data.mjs';
import { categoryById } from '../../lib/categories.mjs';

const DESC = { en: 'Ask us for the details and a clear price.', ta: 'விவரங்களையும் தெளிவான விலையையும் கேளுங்கள்.' };

/**
 * @param {string} categoryId
 * @param {{en:{q:string,a:string}[],ta:{q:string,a:string}[]}} faqSet 3 to 6 questions per language
 */
export function presetContent(categoryId, faqSet) {
  const seed = SEEDS[categoryId];
  if (!seed) throw new RangeError(`No fixture seed for ${categoryId}`);
  const labelEn = categoryById(categoryId).label.toLowerCase();
  const labelTa = seed[6];
  const services = seed[7].slice(0, 8);
  const fill = (s, label) => s.replaceAll('{label}', label);
  return {
    category: categoryId,
    services: {
      en: services.map((s) => ({ name: s[0], description: DESC.en })),
      ta: services.map((s) => ({ name: s[1], description: DESC.ta })),
    },
    faqs: {
      en: faqSet.en.map((f) => ({ q: fill(f.q, labelEn), a: fill(f.a, labelEn) })),
      ta: faqSet.ta.map((f) => ({ q: fill(f.q, labelTa), a: fill(f.a, labelTa) })),
    },
  };
}

/** Builds { categoryId: preset } from a table of design seeds. */
export function presetsFrom(table, faqSet, buildPreset) {
  return Object.fromEntries(Object.entries(table).map(([id, seed]) => [id, buildPreset(seed, presetContent(id, faqSet))]));
}
