import type { EngineActionSpec, ThemeTokens } from '../types';

/**
 * The engine section KIT — reusable CAPABILITY components that different industries
 * compose DIFFERENTLY (different theme, hero/showcase variants, section order and
 * content) so each reads as a bespoke site rather than a recoloured template.
 *
 * A KitSiteModel is a normalized, data-driven composition: an industry's builder
 * returns theme + brand + an ordered list of typed sections, and KitRenderer maps
 * them to components. Variety comes from per-industry themes + variant choices +
 * content — not from one shared layout.
 */

export interface KitBrand {
  name: string;
  tagline: string;
  about: string;
  logo?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  businessHours?: string;
  facebook?: string; instagram?: string; linkedin?: string; youtube?: string; googleMaps?: string;
}

export interface KitStat { value: string; label: string }
export interface KitItem {
  /** the vendor's product id, so a cart line can be priced and stocked by the server */
  id?: string;
  title: string;
  subtitle?: string;
  price?: string;
  image?: string;
  desc?: string;
  tags?: string[];
  meta?: { label: string; value: string }[];
  /** menu items: a veg, non-veg or egg mark */
  veg?: 'veg' | 'nonveg' | 'egg';
}
export interface KitPerson { name: string; role?: string; note?: string; image?: string }
export interface KitBeforeAfter { before: string; after: string; caption?: string }
export interface KitFeature { label: string; icon: string; desc?: string }
export interface KitRow { label: string; value: string }
export interface KitStep { title: string; desc?: string; state?: 'done' | 'active' | 'upcoming' }
export interface KitQuote { quote: string; author: string; note?: string }
export interface KitFaqItem { q: string; a: string }

/** A mobile bottom-nav item (Section 9 of the reference — industry-specific label sets). */
export interface BottomNavItem {
  label: string;
  /** Icon name resolved by EngineBottomNav's compact icon map. */
  icon: string;
  /** In-page anchor ('#services') or '#top' for Home. */
  href: string;
  /** The primary action (e.g. Book / Order / Join) — visually emphasized. */
  emphasis?: boolean;
}

/** A hero CTA (label + in-page anchor, or an external tel:/wa link). */
export interface HeroCta { label: string; href: string }

export type KitSection =
  | { type: 'hero'; variant: 'overlay' | 'split' | 'panel' | 'center' | 'card'; eyebrow?: string; headline: string; subline: string; highlight?: string; image: string; imageAlt?: string; stats?: KitStat[]; ctaPrimary?: HeroCta; ctaSecondary?: HeroCta; card?: { title: string; lines: string[] } }
  | { type: 'announce'; variant: 'strip' | 'accent' | 'ticker'; text: string; href?: string }
  | { type: 'trust'; variant: 'icons' | 'pills' | 'divided'; items: string[] }
  | { type: 'catalog'; id: string; variant: 'grid' | 'list' | 'compact'; eyebrow: string; title: string; sub?: string; items: KitItem[]; categories: string[] }
  | { type: 'packages'; id: string; variant: 'cards' | 'featured' | 'horizontal'; eyebrow: string; title: string; sub?: string; items: KitItem[] }
  | { type: 'menu'; id: string; variant: 'twocol' | 'tabs' | 'photo'; eyebrow: string; title: string; sub?: string; items: KitItem[]; categories: string[] }
  | { type: 'pricing'; id: string; variant: 'table' | 'cards' | 'compare'; eyebrow: string; title: string; sub?: string; items: KitItem[] }
  | { type: 'beforeAfter'; id: string; variant: 'pair' | 'slider' | 'stack'; eyebrow: string; title: string; items: KitBeforeAfter[] }
  | { type: 'hours'; id: string; variant: 'table' | 'card' | 'strip'; eyebrow: string; title: string; rows: KitRow[] }
  | { type: 'stats'; variant?: 'band' | 'cards' | 'inline'; items: KitStat[] }
  | { type: 'showcase'; id: string; variant: 'rows' | 'cards' | 'menu' | 'tiles'; eyebrow: string; title: string; sub?: string; items: KitItem[] }
  | { type: 'featureIndex'; id: string; eyebrow: string; title: string; sub?: string; items: { label: string; blurb: string }[] }
  | { type: 'iconGrid'; id: string; eyebrow: string; title: string; sub?: string; items: KitFeature[] }
  | { type: 'rows'; id: string; eyebrow: string; title: string; sub?: string; note?: string; items: KitRow[] }
  | { type: 'steps'; id: string; variant?: 'cards' | 'timeline' | 'line'; eyebrow: string; title: string; sub?: string; items: KitStep[] }
  | { type: 'gallery'; id: string; eyebrow: string; title: string; images: string[]; variant?: 'mosaic' | 'grid' | 'strip' }
  | { type: 'about'; id: string; variant: 'split' | 'centered' | 'columns'; eyebrow: string; title: string; text: string; image?: string; points?: string[] }
  | { type: 'contact'; id: string; variant: 'card' | 'split' | 'minimal'; eyebrow: string; title: string; sub?: string }
  | { type: 'people'; id: string; variant?: 'cards' | 'circles' | 'list'; eyebrow: string; title: string; sub?: string; items: KitPerson[] }
  | { type: 'testimonials'; id: string; eyebrow: string; title: string; items: KitQuote[]; variant?: 'cards' | 'quote' | 'list' }
  | { type: 'faq'; id: string; variant?: 'accordion' | 'columns' | 'cards'; eyebrow: string; title: string; items: KitFaqItem[] }
  | { type: 'cta'; id: string; variant?: 'band' | 'card' | 'split'; title: string; sub?: string; image?: string; label?: string }
  | { type: 'enquiry'; id: string; variant?: 'panel' | 'split' | 'card'; eyebrow: string; title: string; sub: string; points?: string[]; tabs: EnquiryTab[] };

/** A conversion tab in the enquiry block, mapped to an engine action + input fields. */
export interface EnquiryTab {
  key: string;
  label: string;
  icon: string;
  /** The action this tab fires (its intent selects the live Action Registry target). */
  action: EngineActionSpec;
  /** Which optional fields to show beyond name+phone. */
  fields: ('date' | 'message' | 'amount' | 'choice')[];
  submitLabel: string;
}

/** How a design dresses the page: button shape, navigation, footer and the mobile action bar. Old builders leave it out and keep the original look. */
export interface KitStyle {
  button: 'solid' | 'outline' | 'pill';
  nav: 'bar' | 'centered' | 'minimal';
  footer: 'columns' | 'centered' | 'minimal';
  actionBar: 'tabs' | 'cta' | 'split';
}

export interface KitSiteModel {
  brand: KitBrand;
  style?: KitStyle;
  theme: ThemeTokens;
  /** Options for the "choice" field (e.g. service/room/course) surfaced in the enquiry. */
  choices: string[];
  choiceLabel: string;
  /** Desktop top-nav links (anchors into sections). */
  nav: { href: string; label: string }[];
  /** Mobile bottom-nav — the reference's own industry-specific label set (4–5 items). */
  bottomNav: BottomNavItem[];
  /** Primary CTA (used by the desktop nav + metadata). */
  primaryCta: EngineActionSpec;
  sections: KitSection[];
}
