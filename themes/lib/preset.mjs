// Category presets: the default look and the starter content of one category inside a Standard theme (presets/<categoryId>.json).
// The renderer applies a preset as the DEFAULT settings for its category; the vendor's own settings always override it.
// Pure functions, no I/O. Shared by the renderer, the lint and the package validator.
import { validateAgainst } from './schema.mjs';
import { buildPresetSchema } from './preset-schema.mjs';
import { categoryById } from './categories.mjs';
import { parseHex, ratio, AA_TEXT } from './contrast.mjs';
import { PRESET_PATTERNS, FREE_LIMITS } from './vocabulary.mjs';

export { PRESET_PATTERNS, FREE_LIMITS };
export const PRESET_SCHEMA = buildPresetSchema();

const INK = '#0b1210';
const WHITE = '#ffffff';

function mix(a, b, t) {
  const A = parseHex(a); const B = parseHex(b);
  return `#${[0, 1, 2].map((i) => Math.round(A[i] * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Fills in what a preset does not state: the text colour on the primary colour, the surface and the border. Same rule everywhere. */
export function derivePalette(mode, { primary, accent, background }) {
  const dark = mode === 'dark';
  return {
    primary,
    primaryContrast: (ratio(WHITE, primary) ?? 0) >= (ratio(INK, primary) ?? 0) ? WHITE : INK,
    accent,
    bg: background,
    surface: mix(background, dark ? WHITE : '#000000', dark ? 0.05 : 0.04),
    border: mix(background, dark ? WHITE : '#000000', dark ? 0.16 : 0.14),
  };
}

/**
 * AA contrast of a palette against the THEME's own text colours (a preset never changes those).
 * @param {{light:object,dark:object}} palette
 * @param {{text:string,muted:string,textDark:string,mutedDark:string}} tokens
 * @returns {string[]} one sentence per failure
 */
export function paletteFindings(palette, tokens) {
  const out = [];
  for (const mode of ['light', 'dark']) {
    const p = derivePalette(mode, palette[mode]);
    const text = mode === 'dark' ? tokens.textDark : tokens.text;
    const muted = mode === 'dark' ? tokens.mutedDark : tokens.muted;
    const pairs = [
      ['text', text, 'background', p.bg], ['text', text, 'surface', p.surface], ['muted text', muted, 'background', p.bg], ['muted text', muted, 'surface', p.surface],
      ['accent', p.accent, 'background', p.bg], ['accent', p.accent, 'surface', p.surface], ['button text', p.primaryContrast, 'primary colour', p.primary],
    ];
    for (const [fgName, fg, bgName, bg] of pairs) {
      const r = ratio(fg, bg);
      if (r === null) out.push(`${mode}: ${fgName} on ${bgName} cannot be checked (not a #hex colour)`);
      else if (r < AA_TEXT) out.push(`${mode}: ${fgName} on ${bgName} is ${r.toFixed(2)}:1; AA needs ${AA_TEXT}:1`);
    }
  }
  return out;
}

/**
 * @param {object} preset
 * @param {{manifest?:object, file?:string}} [ctx] manifest: checks fonts against manifest.fonts; file: `presets/<id>.json`, checks the name matches the category
 * @returns {{path:string,code:string,message:string}[]}
 */
export function validatePreset(preset, { manifest, file } = {}) {
  const errors = validateAgainst(PRESET_SCHEMA, preset);
  if (errors.length) return errors;
  const add = (path, code, message) => errors.push({ path, code, message });
  const cat = categoryById(preset.category);
  if (file && !file.endsWith(`/${preset.category}.json`) && file !== `${preset.category}.json`) add('category', 'category-file', `the file is named ${file} but the preset is for ${preset.category}`);
  if (manifest?.fonts) for (const k of ['heading', 'body']) if (!manifest.fonts.includes(preset.fonts[k])) add(`fonts.${k}`, 'font-not-in-manifest', `${preset.fonts[k]} is not listed in theme.json fonts`);
  const want = [...cat.extraBlocks].sort().join();
  if ([...preset.blocks].sort().join() !== want) add('blocks', 'blocks-mismatch', `blocks must list each of ${cat.extraBlocks.join(', ')} exactly once`);
  else if (preset.blocks[0] !== cat.extraBlocks[0]) add('blocks', 'blocks-lead', `the category's lead block "${cat.extraBlocks[0]}" must come first`);
  if (preset.sections?.hidden?.includes('hero')) add('sections.hidden', 'section-hero', 'the hero section cannot be hidden');
  return errors;
}

/** Wrapper style variables for a preset's palette (light and dark). */
export function presetStyle(preset) {
  const parts = [];
  for (const [mode, suffix] of [['light', ''], ['dark', '-d']]) {
    const p = derivePalette(mode, preset.palette[mode]);
    parts.push(`--g4d-pal-primary${suffix}:${p.primary}`, `--g4d-pal-primary-contrast${suffix}:${p.primaryContrast}`, `--g4d-pal-accent${suffix}:${p.accent}`, `--g4d-pal-bg${suffix}:${p.bg}`, `--g4d-pal-surface${suffix}:${p.surface}`, `--g4d-pal-border${suffix}:${p.border}`);
  }
  return parts.join(';');
}

/** Starter content for a category that has none of its own: the preset's services and FAQs in the visitor's language, and the blocks in the preset's order. Never overrides vendor content. */
export function applyPresetContent(content, preset, lang) {
  const c = { ...content };
  const l = lang === 'ta' ? 'ta' : 'en';
  if (!Array.isArray(c.items) || c.items.length === 0) {
    c.items = preset.services[l].map((s, i) => ({ id: `item-${i + 1}`, slug: `item-${i + 1}`, name: s.name, description: s.description, price: '', image: '', href: '', badge: '', category: '', duration: '', tags: '', includes: '', location: '', area: '', bedrooms: '', veg: '' }));
  }
  if (!Array.isArray(c.faqs) || c.faqs.length === 0) c.faqs = preset.faqs[l].map((f) => ({ q: f.q, a: f.a }));
  if (Array.isArray(c.blocks)) {
    const rank = (k) => { const i = preset.blocks.indexOf(k); return i < 0 ? preset.blocks.length : i; };
    c.blocks = [...c.blocks].sort((a, b) => rank(a?.key) - rank(b?.key));
  }
  return c;
}
