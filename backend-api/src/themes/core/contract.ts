import contractJson from './theme-contract.json';

/**
 * The theme package contract (round 2). One JSON file is the vocabulary: the slots, repeaters, engine tags, allowed elements and attributes, limits and the
 * signature of each flow family. The website keeps a byte-identical copy (a guard compares them), so the sanitiser, the lint and the renderer cannot disagree.
 */
export interface Contract {
  contract: number;
  limits: { packageBytes: number; imageBytes: number; fontBytes: number; htmlBytes: number; cssBytes: number; maxPages: number; maxFiles: number; dataUriBytes: number };
  families: string[];
  pageTemplates: string[];
  standardSlugs: Record<string, string>;
  itemPages: string[];
  slots: string[];
  repeaters: Record<string, { as: string; fields: string[] }>;
  itemSlots: string[];
  tags: string[];
  tagAttributes: Record<string, string[]>;
  requiredTags: string[];
  dataAttributes: string[];
  elements: string[];
  dropWithContent: string[];
  attributes: string[];
  uriAttributes: string[];
  allowedUriSchemes: string[];
  googleFontsPrefix: string;
  familyPages: Record<string, { pages: string[]; home: string[]; tags: string[] }>;
}

export const CONTRACT = contractJson as unknown as Contract;

export const THEME_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The page templates a theme may supply, as file names. */
export const templateFile = (t: string): string => `${t}.html`;

/** Colour pairs the lint and the admin screen check (WCAG AA 4.5:1). */
export const CONTRAST_PAIRS: [string, string, string][] = [
  ['text on page', 'fg', 'bg'], ['muted text on page', 'muted', 'bg'], ['button text on button', 'accentFg', 'accent'], ['accent text on page', 'accent', 'bg'],
];

const lum = (hex: string): number | null => {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/** Contrast ratio of two hex colours, or null when either is not a plain hex colour. */
export function contrast(a: string, b: string): number | null {
  const x = lum(a); const y = lum(b);
  if (x === null || y === null) return null;
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}
