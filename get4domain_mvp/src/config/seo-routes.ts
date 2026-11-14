/**
 * ONE place for per-route SEO facts: the date the page CONTENT last changed (used as the sitemap
 * `lastModified`), the breadcrumb label, and sitemap priority / frequency.
 *
 * `updated` is a hand-maintained content date (YYYY-MM-DD) — never a build or request time. When you
 * change the wording, prices or structure of a page, bump its date here. Search engines learn to trust
 * `lastmod` only when it moves with real changes, so do not bump it for a deploy or a CSS tweak.
 *
 * Initial dates are the last git commit that touched each page file.
 */
export type ChangeFreq = 'weekly' | 'monthly' | 'yearly';

export interface SeoRoute {
  /** Breadcrumb label (the page's own short name). */
  label: string;
  /** Content-updated date, YYYY-MM-DD. */
  updated: string;
  priority: number;
  changeFrequency: ChangeFreq;
}

export const SEO_ROUTES: Record<string, SeoRoute> = {
  '/':                 { label: 'Home',             updated: '2026-10-10', priority: 1.0,  changeFrequency: 'weekly' },
  '/leadspace':        { label: 'LeadSpace',        updated: '2026-10-10', priority: 0.95, changeFrequency: 'monthly' },
  '/managed-services': { label: 'Managed Services', updated: '2026-10-03', priority: 0.9,  changeFrequency: 'monthly' },
  '/domain-app':       { label: 'DomainApp',        updated: '2026-10-03', priority: 0.95, changeFrequency: 'monthly' },
  '/pricing':          { label: 'Pricing',          updated: '2026-10-10', priority: 0.9,  changeFrequency: 'monthly' },
  '/industries':       { label: 'Industries',       updated: '2026-10-03', priority: 0.9,  changeFrequency: 'monthly' },
  '/features':         { label: 'Features',         updated: '2026-10-03', priority: 0.9,  changeFrequency: 'monthly' },
  '/how-it-works':     { label: 'How It Works',     updated: '2026-10-03', priority: 0.85, changeFrequency: 'monthly' },
  '/book-demo':        { label: 'Book a Demo',      updated: '2026-10-03', priority: 0.9,  changeFrequency: 'monthly' },
  '/portfolio':        { label: 'Portfolio',        updated: '2026-07-18', priority: 0.7,  changeFrequency: 'monthly' },
  '/templates':        { label: 'Templates',        updated: '2026-07-18', priority: 0.6,  changeFrequency: 'monthly' },
  '/contact':          { label: 'Contact',          updated: '2026-09-09', priority: 0.75, changeFrequency: 'monthly' },
  '/support':          { label: 'Support',          updated: '2026-09-05', priority: 0.7,  changeFrequency: 'monthly' },
  '/about':            { label: 'About',            updated: '2026-10-10', priority: 0.7,  changeFrequency: 'monthly' },
  '/terms':            { label: 'Terms & Conditions', updated: '2026-09-05', priority: 0.3, changeFrequency: 'yearly' },
  '/privacy-policy':   { label: 'Privacy Policy',   updated: '2026-09-05', priority: 0.3,  changeFrequency: 'yearly' },
  '/refund-policy':    { label: 'Refund Policy',    updated: '2026-09-05', priority: 0.3,  changeFrequency: 'yearly' },
};

/** The 20 /industries/[id] landing pages share one content file (src/data/industry-content.ts). */
export const INDUSTRY_IDS = [
  'restaurant', 'travel', 'realestate', 'clinic', 'education',
  'construction', 'retail', 'salon', 'gym', 'professional',
  'events', 'finance', 'automobile', 'logistics', 'diagnostics',
  'hotel', 'photography', 'technology', 'agriculture', 'coaching',
] as const;

export const INDUSTRY_PAGE: Omit<SeoRoute, 'label'> = {
  updated: '2026-10-03',
  priority: 0.85,
  changeFrequency: 'monthly',
};
