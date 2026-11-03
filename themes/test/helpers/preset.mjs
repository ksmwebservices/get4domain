// A valid category preset for tests (the real presets are generated into the Standard themes).
import { categoryById, CATEGORY_IDS } from '../../lib/categories.mjs';

export const PRESET_FONTS = ['Inter', 'Montserrat', 'Work Sans', 'Poppins', 'Noto Sans Tamil'];

export function goodPreset(category = 'plumber', over = {}) {
  const c = categoryById(category);
  const [lead, ...rest] = c.extraBlocks;
  return {
    category,
    palette: {
      light: { primary: '#7a3300', accent: '#8a3b00', background: '#fff8f1' },
      dark: { primary: '#ff9d57', accent: '#ffb27d', background: '#17100b' },
    },
    fonts: { heading: 'Montserrat', body: 'Work Sans' },
    blocks: [lead, ...[...rest].reverse()],
    hero: { pattern: 'rays' },
    services: {
      en: [{ name: 'Tap repair', description: 'Fixed properly, with a clear price.' }, { name: 'Leak check', description: 'We find the leak first.' }],
      ta: [{ name: 'குழாய் பழுது', description: 'தெளிவான விலையில் சரியாகச் செய்யப்படும்.' }, { name: 'கசிவு சோதனை', description: 'முதலில் கசிவைக் கண்டறிகிறோம்.' }],
    },
    faqs: {
      en: [{ q: 'Do you give a price first?', a: 'Yes, before we start.' }],
      ta: [{ q: 'முதலில் விலை சொல்வீர்களா?', a: 'ஆம், தொடங்கும் முன்.' }],
    },
    sections: { hidden: ['stats'] },
    ...over,
  };
}

/** One valid preset for every category, with fonts every test theme allows. */
export function allPresets(over = {}) {
  return Object.fromEntries(CATEGORY_IDS.map((id) => [id, goodPreset(id, { fonts: { heading: 'Poppins', body: 'Inter' }, ...over })]));
}
