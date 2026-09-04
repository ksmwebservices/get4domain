import type { EngineSiteData, IndustryWebsite, ReadinessCheck } from '../../types';
import { realEstateTheme } from './theme';

/**
 * Real Estate industry-website config.
 *
 * Conversion journey (deliberately RE-specific, not a generic SaaS funnel):
 *   browse projects → shortlist a configuration → BOOK A SITE VISIT (primary) →
 *   enquire / WhatsApp (secondary) → pay a booking token (revenue).
 *
 * The primary CTA is a site visit, not "Buy now" — because in real estate the
 * walk-through is the real conversion event; payment follows the visit.
 */
export const realEstateWebsite: IndustryWebsite = {
  key: 'realestate',
  label: 'Real Estate',
  theme: realEstateTheme,
  primaryCta: { intent: 'realestate.site_visit', label: 'Book a site visit', kind: 'booking' },
  secondaryCtas: [
    { intent: 'realestate.enquiry', label: 'Request details', kind: 'enquiry' },
    { intent: 'realestate.payment_cta', label: 'Pay booking token', kind: 'payment' },
    { intent: 'realestate.whatsapp', label: 'Chat on WhatsApp', kind: 'whatsapp' },
  ],
  sectionOrder: [
    'hero', 'trust', 'featured-projects', 'property-types', 'location',
    'amenities', 'floor-plans', 'gallery', 'construction', 'enquiry', 'footer',
  ],
  readiness: (site: EngineSiteData): ReadinessCheck[] => {
    const cms = site.cms;
    const has = (v: string | null | undefined) => !!(v && v.trim());
    return [
      { key: 'name', label: 'Business name set', weight: 'required', passed: has(cms?.businessName) || has(site.vendor.businessName) },
      { key: 'tagline', label: 'Tagline / positioning', weight: 'recommended', passed: has(cms?.tagline), hint: 'A one-line promise buyers remember.' },
      { key: 'about', label: 'About the developer', weight: 'recommended', passed: has(cms?.about) },
      { key: 'phone', label: 'Phone number for callbacks', weight: 'required', passed: has(cms?.phone) },
      { key: 'whatsapp', label: 'WhatsApp enquiry number', weight: 'required', passed: has(cms?.whatsapp) || has(cms?.phone), hint: 'Most property enquiries start on WhatsApp.' },
      { key: 'projects', label: 'At least one project listed', weight: 'required', passed: site.products.length > 0, hint: 'Add projects in Website Manager → Services/Listings.' },
      { key: 'images', label: 'Project photos uploaded', weight: 'required', passed: site.products.some((p) => !!p.image) || has(cms?.banner), hint: 'Property buyers decide on images first.' },
      { key: 'address', label: 'Site / office address', weight: 'recommended', passed: has(cms?.address) },
      { key: 'seo', label: 'SEO title & description', weight: 'recommended', passed: has(cms?.seoTitle) && has(cms?.seoDesc) },
    ];
  },
};
