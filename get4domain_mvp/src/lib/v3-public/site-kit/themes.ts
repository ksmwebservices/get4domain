import { paletteFor } from './color';
import { GENERAL_PACK, PACKS, type Family, type Imagery, type SitePack } from './packs';

/**
 * The theme design kit. A theme is the SAME manifest the marketplace already uses (id, name, version, author, families, categories, colors, cssVars: see
 * docs/v3/THEME_PACKAGE_SPEC.md) plus four fields this lane adds ("pack", "track", "freeMode", "targets") and a "design" block that says how the built-in kit draws it.
 * Themes differ in layout, section order, type and imagery; the colours are only one of the knobs.
 */
export const HERO_VARIANTS = ['split', 'centered', 'fullbleed', 'overlap', 'band'] as const;
export const SERVICE_LAYOUTS = ['rows', 'cards', 'products', 'numbered'] as const;
export const GALLERY_LAYOUTS = ['mosaic', 'strip', 'grid'] as const;
export const TYPE_STYLES = ['serif-classic', 'modern-sans', 'humanist', 'editorial', 'geometric', 'slab'] as const;
export const SECTION_KEYS = ['hero', 'services', 'gallery', 'reviews', 'faq', 'pricing', 'map', 'contact'] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];
export type ServiceLayout = (typeof SERVICE_LAYOUTS)[number];
export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number];
export type TypeStyle = (typeof TYPE_STYLES)[number];
export type SectionKey = (typeof SECTION_KEYS)[number];

/** Type scale: font stacks use only fonts every phone and computer has (no font download), and a modular scale in rem (ratio) from a 1rem body. */
export const TYPE_SCALE: Record<TypeStyle, { head: string; body: string; ratio: number; headWeight: number; headTracking: string; headTransform: 'none' | 'uppercase' }> = {
  'serif-classic': { head: "Georgia, Cambria, 'Times New Roman', serif", body: "system-ui, 'Segoe UI', Roboto, sans-serif", ratio: 1.25, headWeight: 700, headTracking: '-0.01em', headTransform: 'none' },
  'modern-sans': { head: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif", body: "system-ui, 'Segoe UI', Roboto, sans-serif", ratio: 1.333, headWeight: 800, headTracking: '-0.03em', headTransform: 'none' },
  humanist: { head: "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif", body: "'Segoe UI', Tahoma, Verdana, sans-serif", ratio: 1.2, headWeight: 700, headTracking: '0', headTransform: 'none' },
  editorial: { head: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif", body: "Georgia, 'Times New Roman', serif", ratio: 1.414, headWeight: 600, headTracking: '-0.02em', headTransform: 'none' },
  geometric: { head: "'Century Gothic', 'Avenir Next', 'Segoe UI', sans-serif", body: "'Segoe UI', Roboto, sans-serif", ratio: 1.25, headWeight: 700, headTracking: '0.04em', headTransform: 'uppercase' },
  slab: { head: "Rockwell, 'Roboto Slab', Georgia, serif", body: "system-ui, 'Segoe UI', Roboto, sans-serif", ratio: 1.3, headWeight: 700, headTracking: '0', headTransform: 'none' },
};

export interface Design {
  hero: HeroVariant; services: ServiceLayout; gallery: GalleryLayout; type: TypeStyle;
  /** corner radius in px */
  radius: number;
  dark: boolean;
  /** the order of the sections on the page; a section with nothing to show is left out */
  order: SectionKey[];
  imagery: Imagery;
}

/** The layout of each family: the knobs that make a restaurant page not look like a clinic page. */
export const FAMILY_DESIGN: Record<Family, Omit<Design, 'imagery'>> = {
  menu: { hero: 'centered', services: 'rows', gallery: 'mosaic', type: 'serif-classic', radius: 6, dark: false, order: ['hero', 'services', 'gallery', 'reviews', 'pricing', 'faq', 'map', 'contact'] },
  booking: { hero: 'split', services: 'cards', gallery: 'grid', type: 'humanist', radius: 18, dark: false, order: ['hero', 'services', 'reviews', 'gallery', 'pricing', 'faq', 'map', 'contact'] },
  shop: { hero: 'fullbleed', services: 'products', gallery: 'strip', type: 'modern-sans', radius: 10, dark: false, order: ['hero', 'services', 'pricing', 'gallery', 'reviews', 'faq', 'map', 'contact'] },
  packages: { hero: 'overlap', services: 'cards', gallery: 'mosaic', type: 'geometric', radius: 14, dark: false, order: ['hero', 'pricing', 'services', 'gallery', 'reviews', 'faq', 'map', 'contact'] },
  enquiry: { hero: 'band', services: 'numbered', gallery: 'grid', type: 'slab', radius: 4, dark: false, order: ['hero', 'services', 'reviews', 'faq', 'gallery', 'pricing', 'map', 'contact'] },
  portfolio: { hero: 'fullbleed', services: 'rows', gallery: 'mosaic', type: 'editorial', radius: 2, dark: true, order: ['hero', 'gallery', 'services', 'reviews', 'pricing', 'faq', 'contact', 'map'] },
  listings: { hero: 'split', services: 'products', gallery: 'strip', type: 'modern-sans', radius: 8, dark: false, order: ['hero', 'services', 'gallery', 'map', 'reviews', 'faq', 'pricing', 'contact'] },
  courses: { hero: 'centered', services: 'numbered', gallery: 'grid', type: 'humanist', radius: 12, dark: false, order: ['hero', 'services', 'pricing', 'reviews', 'gallery', 'faq', 'map', 'contact'] },
};

/** A pack may bend its family's design a little, so two packs of one family are not twins (a different type style, a different hero). */
const PACK_TWEAK: Record<string, Partial<Omit<Design, 'imagery'>>> = {
  clinic: { type: 'humanist', hero: 'split' }, diagnostics: { type: 'modern-sans', hero: 'band' }, salon: { type: 'editorial', radius: 24, dark: false }, petcare: { type: 'humanist', radius: 28 },
  automobile: { type: 'geometric', hero: 'fullbleed', dark: true }, homeservices: { type: 'slab', hero: 'band' }, astrology: { type: 'editorial', dark: true, hero: 'centered' },
  gym: { type: 'geometric', hero: 'fullbleed', dark: true }, hotel: { type: 'serif-classic', hero: 'fullbleed' }, events: { type: 'editorial', hero: 'centered' }, travel: { type: 'modern-sans', hero: 'overlap' },
  technology: { type: 'modern-sans', dark: true }, interior: { type: 'serif-classic', dark: false, hero: 'split' }, finance: { type: 'serif-classic', hero: 'split' }, professional: { type: 'serif-classic', hero: 'split' },
  government: { type: 'humanist', hero: 'band', radius: 2 }, recruitment: { type: 'modern-sans', hero: 'split' }, agriculture: { type: 'humanist', hero: 'fullbleed' }, retail: { type: 'modern-sans', hero: 'overlap' },
};

export type TargetLevel = 'main' | 'category' | 'sub';
/** A target names a main category, a category or a sub category by id or slug (one of the two is enough). */
export interface Target { level: TargetLevel; id?: string; slug?: string }
export type Track = 'free' | 'pro' | 'both';

export interface KitTheme {
  id: string; name: string; version: number; author: string; description: string;
  /** the industry pack this theme is the flagship (or a member) of */
  pack: string;
  track: Track;
  /** true when the theme has a Free (information only) variant: no form, no chat, no button links */
  freeMode: boolean;
  families: Family[];
  /** category-pack keys (the field the marketplace already has) */
  categories: string[];
  targets: Target[];
  /** the theme a category falls back to when several themes target it and the vendor chose none */
  isDefault: boolean;
  colors: { bg: string; fg: string; muted: string; accent: string; accentFg: string };
  cssVars: Record<string, string>;
  design: Design;
}

export const FLAGSHIP_SUFFIX = '-flagship';
export const flagshipId = (packId: string): string => `${packId}${FLAGSHIP_SUFFIX}`;

export function designFor(pack: SitePack): Design {
  const base = FAMILY_DESIGN[pack.family];
  return { ...base, ...(PACK_TWEAK[pack.id] ?? {}), imagery: pack.imagery };
}

/** The flagship theme of one pack: its family layout, its own palette, type and starter imagery. */
export function flagshipFor(pack: SitePack): KitTheme {
  const design = designFor(pack);
  const p = paletteFor(pack.hue, design.dark);
  return {
    id: flagshipId(pack.id), name: `${pack.name} flagship`, version: 1, author: 'Get4Domain', description: `The flagship design of the ${pack.name} pack: ${design.hero} hero, ${design.services} services, ${design.gallery} gallery, ${design.type} type.`,
    pack: pack.id, track: 'both', freeMode: true, families: [pack.family], categories: [pack.id], targets: [{ level: 'main', id: pack.id, slug: pack.id }], isDefault: true,
    colors: { bg: p.bg, fg: p.fg, muted: p.muted, accent: p.accent, accentFg: p.accentFg },
    cssVars: { '--g4d-radius': `${design.radius}px`, '--g4d-surface': p.surface, '--g4d-border': p.border, '--g4d-soft': p.soft },
    design,
  };
}

/** The flagship of the safe default pack. */
export const GENERAL_THEME: KitTheme = flagshipFor(GENERAL_PACK);
export const DEFAULT_THEME_ID = GENERAL_THEME.id;

/** Every flagship theme: one per pack, plus the safe default. */
export const FLAGSHIPS: readonly KitTheme[] = [...PACKS.map(flagshipFor), GENERAL_THEME];

export function themeById(id: string | null | undefined, extra: readonly KitTheme[] = []): KitTheme | null {
  const k = String(id ?? '').trim().toLowerCase();
  return [...extra, ...FLAGSHIPS].find((t) => t.id === k) ?? null;
}

/** The shape of the "targets" a theme.json may carry, checked in plain sentences (the same sentences the admin upload will use once the backend reads the field). */
export function validateTargets(raw: unknown, known?: { main?: ReadonlySet<string>; category?: ReadonlySet<string>; sub?: ReadonlySet<string> }): { targets: Target[]; errors: string[] } {
  const errors: string[] = [];
  if (raw === undefined) return { targets: [], errors };
  if (!Array.isArray(raw)) return { targets: [], errors: ['theme.json "targets" must be a list, for example [{"level":"main","id":"clinic"}].'] };
  if (raw.length > 60) errors.push('theme.json "targets" can hold at most 60 entries.');
  const out: Target[] = [];
  raw.slice(0, 60).forEach((t, i) => {
    const o = t && typeof t === 'object' ? (t as Record<string, unknown>) : null;
    const level = o?.level;
    if (level !== 'main' && level !== 'category' && level !== 'sub') { errors.push(`targets[${i}]: "level" must be "main", "category" or "sub".`); return; }
    const id = typeof o?.id === 'string' ? o.id.trim().toLowerCase() : '';
    const slug = typeof o?.slug === 'string' ? o.slug.trim().toLowerCase() : '';
    if (!id && !slug) { errors.push(`targets[${i}]: give an "id" or a "slug" of the ${level} category.`); return; }
    for (const v of [id, slug]) if (v && !/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)?$/.test(v)) { errors.push(`targets[${i}]: "${v}" is not a valid id or slug (lower-case letters, numbers and dashes).`); return; }
    const set = known?.[level];
    if (set && ![id, slug].some((v) => v && set.has(v))) { errors.push(`targets[${i}]: the ${level} category "${id || slug}" does not exist in the category data.`); return; }
    out.push({ level, ...(id ? { id } : {}), ...(slug ? { slug } : {}) });
  });
  const seen = new Set<string>();
  for (const t of out) { const k = `${t.level}:${t.id ?? ''}:${t.slug ?? ''}`; if (seen.has(k)) errors.push(`targets: "${t.id ?? t.slug}" (${t.level}) is listed twice.`); seen.add(k); }
  return { targets: out, errors };
}
