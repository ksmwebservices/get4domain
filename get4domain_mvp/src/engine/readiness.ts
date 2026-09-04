import type { EngineSiteData, ReadinessCheck } from './types';

/**
 * Every main industry now on the engine. Client-safe (no RSC imports) so the vendor
 * dashboard can use it without pulling server components. Keep in sync with registry.ts.
 */
export const ENGINE_KEYS = [
  'realestate', 'clinic', 'salon', 'gym', 'coaching', 'education', 'professional', 'finance',
  'diagnostics', 'photography', 'hotel', 'events', 'travel', 'restaurant', 'retail',
  'agriculture', 'automobile', 'construction', 'technology', 'logistics',
] as const;

export const isEngineKey = (key: string): boolean => (ENGINE_KEYS as readonly string[]).includes(key);

/**
 * Generic revenue/launch readiness — the same signals every industry site needs to
 * take leads: identity, a reachable contact, catalogue content with images, and SEO.
 */
export function genericReadiness(site: EngineSiteData): ReadinessCheck[] {
  const cms = site.cms;
  const has = (v: string | null | undefined) => !!(v && v.trim());
  return [
    { key: 'name', label: 'Business name set', weight: 'required', passed: has(cms?.businessName) || has(site.vendor.businessName) },
    { key: 'tagline', label: 'Tagline / positioning', weight: 'recommended', passed: has(cms?.tagline), hint: 'A one-line promise customers remember.' },
    { key: 'about', label: 'About your business', weight: 'recommended', passed: has(cms?.about) },
    { key: 'phone', label: 'Phone number for callbacks', weight: 'required', passed: has(cms?.phone) },
    { key: 'whatsapp', label: 'WhatsApp enquiry number', weight: 'required', passed: has(cms?.whatsapp) || has(cms?.phone), hint: 'Most enquiries start on WhatsApp.' },
    { key: 'catalog', label: 'At least one service / product listed', weight: 'required', passed: site.products.length > 0, hint: 'Add items in Website Manager → Services/Products.' },
    { key: 'images', label: 'Photos uploaded', weight: 'required', passed: site.products.some((p) => !!p.image) || has(cms?.banner), hint: 'Customers decide on images first.' },
    { key: 'address', label: 'Business address', weight: 'recommended', passed: has(cms?.address) },
    { key: 'seo', label: 'SEO title & description', weight: 'recommended', passed: has(cms?.seoTitle) && has(cms?.seoDesc) },
  ];
}
