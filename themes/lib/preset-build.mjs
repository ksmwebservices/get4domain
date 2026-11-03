// Helpers that turn a short design seed into a complete, contrast-checked preset (presets/<categoryId>.json). Used by the Standard theme build only;
// the packages carry the generated JSON, so nothing here runs on the platform. Pure, deterministic.
import { hslToHex, rgbToHsl, parseHex, ratio, suggestAccent, AA_TEXT } from './contrast.mjs';
import { derivePalette, paletteFindings } from './preset.mjs';
import { categoryById } from './categories.mjs';

const norm = (h) => (((h % 360) + 360) % 360) / 360;
const hsl = (h, s, l) => hslToHex([norm(h), Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))]);

/** The theme's own text colours (a preset never changes them); presets are checked against these. */
export const THEME_TEXT = { text: '#14211e', muted: '#4a5a56', textDark: '#e8f0ee', mutedDark: '#a9bab6' };

/**
 * A light and dark palette from a hue (0-359), a saturation (0-1) and how far the accent sits from the primary on the colour wheel.
 * The primary is darkened (light mode) or lightened (dark mode) until the button text reads at AA; the accent is nudged until it reads as text on the
 * background and the surface. Same inputs, same output.
 */
export function makePalette({ h, s, accentShift = 35 }) {
  const sat = Math.min(0.95, Math.max(0.2, s));
  const lightBg = hsl(h, Math.min(0.6, sat), 0.97);
  let pl = 0.28;
  let primary = hsl(h, sat, pl);
  while ((ratio('#ffffff', primary) ?? 0) < AA_TEXT && pl > 0.05) { pl -= 0.02; primary = hsl(h, sat, pl); }
  let accent = hsl(h + accentShift, Math.min(sat, 0.85), 0.3);
  const lightSurface = derivePalette('light', { primary, accent, background: lightBg }).surface;
  accent = suggestAccent(accent, [lightBg, lightSurface]) ?? accent;

  const darkBg = hsl(h, 0.28, 0.08);
  let dl = 0.62;
  let primaryD = hsl(h, Math.min(0.8, sat + 0.05), dl);
  while ((ratio('#0b1210', primaryD) ?? 0) < AA_TEXT && dl < 0.95) { dl += 0.02; primaryD = hsl(h, Math.min(0.8, sat + 0.05), dl); }
  let accentD = hsl(h + accentShift, Math.min(sat, 0.8), 0.7);
  const darkSurface = derivePalette('dark', { primary: primaryD, accent: accentD, background: darkBg }).surface;
  accentD = suggestAccent(accentD, [darkBg, darkSurface]) ?? accentD;

  return { light: { primary, accent, background: lightBg }, dark: { primary: primaryD, accent: accentD, background: darkBg } };
}

/** Order of the extra blocks: the lead block always first, the rest in a seed-chosen order ('keep', 'reverse', or 'rotate' by one). */
export function orderBlocks(categoryId, mode = 'keep') {
  const [lead, ...rest] = categoryById(categoryId).extraBlocks;
  let tail = [...rest];
  if (mode === 'reverse') tail.reverse();
  else if (mode === 'rotate' && tail.length > 1) tail = [...tail.slice(1), tail[0]];
  return [lead, ...tail];
}

/**
 * @param {{h:number,s:number,accentShift?:number,fonts:[string,string],pattern:string,blocks?:'keep'|'reverse'|'rotate',hidden?:string[],order?:string[]}} seed
 * @param {{category:string,services:{en:{name:string,description:string}[],ta:{name:string,description:string}[]},faqs:{en:{q:string,a:string}[],ta:{q:string,a:string}[]}}} content
 */
export function buildPreset(seed, content) {
  const palette = makePalette(seed);
  const problems = paletteFindings(palette, THEME_TEXT);
  if (problems.length) throw new Error(`preset ${content.category}: ${problems.join('; ')}`);
  const sections = {};
  if (seed.order?.length) sections.order = seed.order;
  if (seed.hidden?.length) sections.hidden = seed.hidden;
  return {
    category: content.category,
    palette,
    fonts: { heading: seed.fonts[0], body: seed.fonts[1] },
    blocks: orderBlocks(content.category, seed.blocks ?? 'keep'),
    hero: { pattern: seed.pattern },
    services: content.services,
    faqs: content.faqs,
    ...(Object.keys(sections).length ? { sections } : {}),
  };
}

export { rgbToHsl, parseHex };
