import type { EngineSiteData, IndustryWebsite, ReadinessCheck } from '../../types';
import { retailTheme } from './theme';

/**
 * Retail industry-website config.
 *
 * Conversion journey: browse the catalogue → ADD TO CART (primary) → checkout with
 * Razorpay → the vendor is paid and a real order (PosSale) is recorded. Enquiry/
 * WhatsApp stays as a fallback for shoppers who'd rather ask first (bulk orders,
 * availability, jewellery-style "on request" pricing).
 */
export const retailWebsite: IndustryWebsite = {
  key: 'retail',
  label: 'Retail & Shopping',
  theme: retailTheme,
  primaryCta: { intent: 'engine.checkout.order', label: 'Add to cart', kind: 'payment' },
  secondaryCtas: [
    { intent: 'engine.enquiry', label: 'Ask us', kind: 'enquiry' },
  ],
  sectionOrder: ['hero', 'shop', 'why', 'reviews', 'visit', 'enquiry', 'footer'],
  readiness: (site: EngineSiteData): ReadinessCheck[] => {
    const cms = site.cms;
    const has = (v: string | null | undefined) => !!(v && v.trim());
    return [
      { key: 'name', label: 'Business name set', weight: 'required', passed: has(cms?.businessName) || has(site.vendor.businessName) },
      { key: 'phone', label: 'Phone number for enquiries', weight: 'required', passed: has(cms?.phone) },
      { key: 'products', label: 'At least one product listed', weight: 'required', passed: site.products.length > 0, hint: 'Add products in Website Manager → My Products.' },
      { key: 'images', label: 'Product photos uploaded', weight: 'required', passed: site.products.some((p) => !!p.image), hint: 'Shoppers decide on photos first — add one per product.' },
      { key: 'payments', label: 'Payments turned on (Razorpay)', weight: 'recommended', passed: !!site.paymentsEnabled, hint: 'Turn on payments to let shoppers check out with a real cart, not just enquire.' },
      { key: 'address', label: 'Store / pickup address', weight: 'recommended', passed: has(cms?.address) },
      { key: 'seo', label: 'SEO title & description', weight: 'recommended', passed: has(cms?.seoTitle) && has(cms?.seoDesc) },
    ];
  },
};
