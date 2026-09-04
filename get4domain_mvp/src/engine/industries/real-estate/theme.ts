import type { ThemeTokens } from '../../types';

/**
 * Real Estate — premium, architectural, sophisticated, spacious, high-value.
 *
 * Deliberately NOT the marketing site's blue/rounded SaaS look: a warm near-black
 * ground, ivory text, a single bronze-gold accent, a sharp 2px radius (square,
 * architectural) and a serif display face. This palette + a serif headline is what
 * makes the reference site read as a bespoke property developer's website rather
 * than a recoloured template.
 */
export const realEstateTheme: ThemeTokens = {
  bg: '#111013', // warm near-black
  fg: '#F3EFE8', // ivory
  surface: '#1B1A1E', // raised panel
  border: 'rgba(201,162,75,0.18)', // faint gold hairline
  muted: '#A29B90', // stone
  accent: '#C9A24B', // bronze-gold
  accentFg: '#111013', // text on the gold
  accent2: '#7C8B7A', // sage (secondary, understated)
  fontDisplay: "'Playfair Display', 'Fraunces', Georgia, 'Times New Roman', serif",
  fontBody: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  radius: '2px',
  mode: 'dark',
};

/** A light counterpart used for the enquiry/detail surfaces where trust + clarity win. */
export const realEstateLightSurface = {
  bg: '#F6F3EC',
  fg: '#1B1A1E',
  muted: '#6B6459',
  border: 'rgba(27,26,30,0.12)',
};
