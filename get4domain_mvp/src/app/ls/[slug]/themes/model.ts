// The page model the API sends (GET /leadspace/public/page/<slug>). The design components take this and nothing else.

export type TradeId =
  | 'home-services' | 'builders-interiors' | 'real-estate' | 'freelancer' | 'startup' | 'photography-events'
  | 'tutor' | 'salon-beauty' | 'shop-retail' | 'restaurant-food' | 'advocate' | 'clinic';

export type GoalId = 'ENQUIRY' | 'BOOKING' | 'APPOINTMENT' | 'SITE_VISIT' | 'CART_ORDER';
export type FieldKind = 'text' | 'tel' | 'textarea' | 'date' | 'select' | 'cart';

export interface Theme { accent: string; accentDark: string; soft: string; ink: string }
export interface ServiceItem { name: string; priceText: string | null; description: string | null; image: string | null; buyPath?: string | null }
export interface FormField { key: string; label: string; kind: FieldKind; required: boolean; options?: string[]; hint?: string }

export type Block =
  | { type: 'hero'; headline: string; subline: string; image: string | null; primaryButton: string }
  | { type: 'offer'; headline: string; text: string; validUntil: string | null }
  | { type: 'services'; title: string; items: ServiceItem[] }
  | { type: 'gallery'; images: { src: string; alt: string }[] }
  | { type: 'trust'; items: string[] }
  | { type: 'map'; address: string | null; mapsLink: string | null; area: string | null; hours: string | null }
  | { type: 'faq'; items: { q: string; a: string }[] }
  | { type: 'about'; text: string };

export interface PageModel {
  slug: string; mode: 'TEMPLATE' | 'EXISTING_PAGE'; goal: GoalId; templateId: TradeId; theme: Theme;
  business: { name: string; city: string; category: string; categoryLabel: string };
  blocks: Block[]; primaryButton: string; stickyCta: { label: string };
  form: { goal: string; fields: FormField[]; submitLabel: string; consentText: string };
  disclaimer: string | null; rera: string | null;
  seo: { title: string; description: string; canonical: string; robots: string; jsonLd: Record<string, unknown> };
  existingPageUrl: string | null; indexable: boolean;
}
