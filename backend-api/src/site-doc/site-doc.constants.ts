/**
 * Website Manager: one site row per vendor ("VendorCMS"). The published columns are what the public site reads; `draft` holds edits that are not live yet.
 * This file is the single list of what the editor may change, the design choices a vendor may pick and what each plan allows.
 */

/** Plain text fields of the site (one string each). Empty string clears a field. */
export const SITE_TEXT_FIELDS = [
  'businessName', 'tagline', 'about', 'logo', 'banner', 'favicon', 'ogImage',
  'seoTitle', 'seoDesc', 'seoKeywords', 'googleAnalyticsId',
  'phone', 'whatsapp', 'email', 'address', 'businessHours',
  'facebook', 'instagram', 'linkedin', 'youtube', 'googleMaps',
  'themeId', 'designKey',
] as const;
export type SiteTextField = (typeof SITE_TEXT_FIELDS)[number];

/** Structured fields (JSON). */
export const SITE_JSON_FIELDS = ['portfolio', 'testimonials', 'pages', 'layout', 'extras'] as const;
export type SiteJsonField = (typeof SITE_JSON_FIELDS)[number];

export const SITE_FIELDS = [...SITE_TEXT_FIELDS, ...SITE_JSON_FIELDS] as const;

/** The themes a vendor can pick (design tokens live in get4domain_mvp/src/engine/kit/site-themes.ts; a guard keeps both lists equal). */
export const SITE_THEME_KEYS = [
  'clean-teal', 'classic-blue', 'warm-sand', 'fresh-green', 'bold-violet', 'sunset-orange', 'soft-rose',
  'midnight-gold', 'forest-night', 'ocean-dark', 'plum-night',
  // the two colour schemes of the first hand-written sites (Allwin Tours, Step N Rock), so they look the same when moved onto the shared renderer
  'harbour-amber', 'street-orange',
] as const;

export const SITE_VARIANTS = {
  hero: ['overlay', 'split', 'panel'],
  about: ['split', 'centered', 'columns'],
  services: ['rows', 'cards', 'menu', 'tiles'],
  gallery: ['mosaic', 'grid', 'strip'],
  testimonials: ['cards', 'quote', 'list'],
  contact: ['card', 'split', 'minimal'],
} as const;
export type SiteVariantSlot = keyof typeof SITE_VARIANTS;

export interface SiteLayout {
  themeKey?: string;
  hero?: string; about?: string; services?: string; gallery?: string; testimonials?: string; contact?: string;
}

export interface SitePage { slug: string; title: string; body: string }
export interface SiteTestimonial { quote: string; author: string; note?: string; sample?: boolean }

/**
 * Everything a design shows that is not a plain column: stored in one JSON field (`extras`) and edited in Website Manager. The `sample` map says which of
 * these (and which of tagline, about, banner, gallery) are still the starter text; a field the vendor changes stops being sample.
 */
export const SITE_EXTRAS_TEXT = ['headline', 'subline', 'ctaLabel', 'announcement', 'announcementLink'] as const;
export const SITE_EXTRAS_LISTS = ['trust', 'faq', 'steps', 'stats', 'team', 'beforeAfter'] as const;
export const SITE_SAMPLE_KEYS = ['tagline', 'about', 'banner', 'gallery', ...SITE_EXTRAS_TEXT, ...SITE_EXTRAS_LISTS] as const;
export interface SiteExtras {
  headline?: string; subline?: string; ctaLabel?: string; announcement?: string; announcementLink?: string;
  trust?: string[];
  faq?: { q: string; a: string }[];
  steps?: { title: string; desc?: string }[];
  stats?: { value: string; label: string }[];
  team?: { name: string; role?: string; note?: string; image?: string }[];
  beforeAfter?: { before: string; after: string; caption?: string }[];
  /** true = still the starter text */
  sample?: Record<string, boolean>;
}

/** Limits that keep the extras from becoming a novel. */
export const SITE_EXTRAS_LIMITS = { trust: 8, faq: 12, steps: 8, stats: 6, team: 12, beforeAfter: 8 } as const;

export const SITE_STATUSES = ['LIVE', 'DRAFT', 'UNCLAIMED'] as const;

/** What a plan allows. Limits only: every plan gets the whole editor, themes, layouts, preview and publish. */
export type SitePlan = 'LEADSPACE' | 'WORKSPACE' | 'BOS';
export const SITE_PLAN_LIMITS: Record<SitePlan, { pages: number; mediaMb: number }> = {
  LEADSPACE: { pages: 1, mediaMb: 100 },
  WORKSPACE: { pages: 5, mediaMb: 1000 },
  BOS: { pages: 25, mediaMb: 5000 },
};

/** Versions kept per vendor. */
export const SITE_VERSIONS_KEPT = 10;

export const SITE_FLAG_ADDON = 'site_doc_v2';

/** Free-text fields keep a sensible size so one field cannot hold a novel. */
export const SITE_TEXT_MAX: Partial<Record<SiteTextField, number>> = {
  about: 5000, tagline: 200, businessName: 120, seoTitle: 120, seoDesc: 320, seoKeywords: 400, businessHours: 500, address: 400,
};
