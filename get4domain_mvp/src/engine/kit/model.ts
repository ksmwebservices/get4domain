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
}

export interface KitStat { value: string; label: string }
export interface KitItem {
  title: string;
  subtitle?: string;
  price?: string;
  image?: string;
  desc?: string;
  tags?: string[];
  meta?: { label: string; value: string }[];
}
export interface KitPerson { name: string; role?: string; note?: string; image?: string }
export interface KitFeature { label: string; icon: string; desc?: string }
export interface KitRow { label: string; value: string }
export interface KitStep { title: string; desc?: string; state?: 'done' | 'active' | 'upcoming' }
export interface KitQuote { quote: string; author: string; note?: string }
export interface KitFaqItem { q: string; a: string }

export type KitSection =
  | { type: 'hero'; variant: 'overlay' | 'split' | 'panel'; eyebrow?: string; headline: string; subline: string; highlight?: string; image: string; stats?: KitStat[] }
  | { type: 'stats'; items: KitStat[] }
  | { type: 'showcase'; id: string; variant: 'rows' | 'cards' | 'menu' | 'tiles'; eyebrow: string; title: string; sub?: string; items: KitItem[] }
  | { type: 'featureIndex'; id: string; eyebrow: string; title: string; sub?: string; items: { label: string; blurb: string }[] }
  | { type: 'iconGrid'; id: string; eyebrow: string; title: string; sub?: string; items: KitFeature[] }
  | { type: 'rows'; id: string; eyebrow: string; title: string; sub?: string; note?: string; items: KitRow[] }
  | { type: 'steps'; id: string; eyebrow: string; title: string; sub?: string; items: KitStep[] }
  | { type: 'gallery'; id: string; eyebrow: string; title: string; images: string[] }
  | { type: 'people'; id: string; eyebrow: string; title: string; sub?: string; items: KitPerson[] }
  | { type: 'testimonials'; id: string; eyebrow: string; title: string; items: KitQuote[] }
  | { type: 'faq'; id: string; eyebrow: string; title: string; items: KitFaqItem[] }
  | { type: 'cta'; id: string; title: string; sub?: string; image?: string }
  | { type: 'enquiry'; id: string; eyebrow: string; title: string; sub: string; points?: string[]; tabs: EnquiryTab[] };

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

export interface KitSiteModel {
  brand: KitBrand;
  theme: ThemeTokens;
  /** Options for the "choice" field (e.g. service/room/course) surfaced in the enquiry. */
  choices: string[];
  choiceLabel: string;
  /** The nav links (anchors into sections). */
  nav: { href: string; label: string }[];
  /** Primary CTA label + anchor for nav + bottom-nav. */
  primaryCta: EngineActionSpec;
  sections: KitSection[];
}
