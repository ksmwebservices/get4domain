import { SourceDocument } from '../../src/site-publish/content/content-types';
import { ResolvedEntitlements, ResolvedFeature } from '../../src/plans/entitlements/entitlement-engine';

/** Shared fixtures for the site renderer / publish tests: a vendor's source document per track, and resolved entitlements for a Free and a Pro plan. */
export const NOW = new Date('2026-11-05T09:00:00Z');
export const YEAR = 2026;

type Over = Partial<SourceDocument['cms']> & Record<string, unknown>;

export function doc(kind: 'plumber' | 'dentist' | 'jewellery', over: { vendor?: Partial<SourceDocument['vendor']>; cms?: Over; items?: SourceDocument['items']; claimed?: boolean } = {}): SourceDocument {
  const base = {
    plumber: { name: 'Sri Ganesh Plumbing', industry: 'plumber', address: '12, Kamaraj Road, Chennai 600001', tagline: 'Leaks fixed fast, every time.', about: 'Sri Ganesh Plumbing serves Chennai. We explain the work before we start.', phone: '+919876543210', email: 'ganesh@example.com', sub: 'sri-ganesh-plumbing' },
    dentist: { name: 'Meenakshi Dental Care', industry: 'dentist', address: '4, Temple Street, Madurai 625001', tagline: 'Gentle dental care for the whole family.', about: 'Meenakshi Dental Care has served Madurai families for years.', phone: '+919876543211', email: 'dr@example.com', sub: 'meenakshi-dental' },
    jewellery: { name: 'Mangala Gold House', industry: 'jewellery', address: '88, Bazaar Street, Coimbatore 641001', tagline: 'Pure gold, honest making charges.', about: 'Mangala Gold House is a family jeweller in Coimbatore.', phone: '+919876543212', email: 'shop@example.com', sub: 'mangala-gold' },
  }[kind];
  return {
    vendor: { id: `v-${kind}`, subdomain: base.sub, businessName: base.name, name: 'Owner Name', phone: base.phone, email: base.email, status: 'PENDING', industry: base.industry, ...(over.vendor ?? {}) },
    cms: {
      businessName: base.name, tagline: base.tagline, about: base.about, logo: null, banner: 'https://cdn.example.test/banner.jpg', favicon: null, phone: base.phone, email: base.email, address: base.address,
      whatsapp: base.phone, facebook: 'https://www.facebook.com/example.page', instagram: null, linkedin: null, youtube: null, googleMaps: null, businessHours: 'Mon-Sat 9am-8pm',
      portfolio: [{ id: 'g1', src: 'https://cdn.example.test/g1.jpg', alt: 'Work 1', title: 'Work 1' }], testimonials: [{ quote: 'Very good work', author: 'A Customer' }, { quote: 'Starter quote', author: 'Sample', sample: true }],
      pages: [{ slug: 'offers', title: 'Offers', body: 'Current offers.' }], extras: { faq: [{ q: 'Do you work on Sundays?', a: 'Yes, by appointment.' }], trust: ['Licensed and insured'], steps: [{ title: 'Call us', desc: 'Tell us the problem.' }] },
      packKey: base.industry, siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null, ...(over.cms ?? {}),
    } as SourceDocument['cms'],
    items: over.items ?? [
      { id: 'i1', name: 'Tap repair', description: 'Fix a leaking tap.', price: '300', image: 'https://cdn.example.test/i1.jpg', category: 'Repairs', active: true, sample: false, samplePrice: false },
      { id: 'i2', name: 'Pipe fitting', description: 'New pipe work.', price: '500', image: null, category: 'Repairs', active: true, sample: true, samplePrice: true },
    ],
    claimed: over.claimed ?? false,
  };
}

const f = (state: ResolvedFeature['state'], limit: number | null = null, enumValue: string | null = null, upsellText: string | null = null): ResolvedFeature => ({ state, limit, enumValue, upsellText, overLimit: false, source: 'PLAN' });

/** Resolved entitlements of a Free (level FREE) or Pro vendor on a track, with just the features the site slice reads. */
export function entitlements(level: 'FREE' | 'PRO', track: 'handyman' | 'professional' | 'ecommerce' = 'handyman'): ResolvedEntitlements {
  const pro = level === 'PRO';
  return {
    mode: 'V3', plan: `${track}_${level.toLowerCase()}`, subscribedPlan: `${track}_${level.toLowerCase()}`, track, level, subscriptionStatus: 'ACTIVE', graceWarning: false, suspended: false,
    features: {
      'site.pages': f('LIMITED', pro ? 24 : 1), 'site.services': f('LIMITED', pro ? 24 : 8), 'site.gallery': f('LIMITED', pro ? 40 : 5), 'site.faqs': f('LIMITED', pro ? 12 : 6),
      'site.themes': f('ACTIVE', null, pro ? 'library' : 'assigned', null),
      'site.video': pro ? f('ACTIVE') : f('LOCKED_PREVIEW', null, null, 'Show your work on video with Pro.'),
      'site.cta': pro ? f('ACTIVE') : f('LOCKED_PREVIEW', null, null, 'Let customers contact, book or order from your site with Pro.'),
      'site.booking': pro && track !== 'ecommerce' ? f('ACTIVE') : f('LOCKED_PREVIEW', null, null, 'Let customers book you online with Pro.'),
      'shop.cart': pro && track === 'ecommerce' ? f('ACTIVE') : f('HIDDEN'),
      'site.language_ta': pro ? f('ACTIVE') : f('LOCKED_PREVIEW', null, null, 'Reach more customers with a Tamil site on Pro.'),
      'site.custom_domain': pro ? f('ACTIVE') : f('LOCKED_PREVIEW', null, null, 'Use your own web address with Pro.'),
      'promotion.custom_domain_addon': f('HIDDEN'),   // never part of a plan: only an override turns it on
      'site.revisions': pro ? f('ACTIVE') : f('LOCKED_PREVIEW', null, null, 'Go back to an earlier version of your site with Pro.'),
    },
  };
}
