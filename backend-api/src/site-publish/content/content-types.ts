/**
 * What the site slice reads about a vendor, as plain data. The port (ContentSource) fills it from the legacy VendorCMS draft document and the vendor's
 * items; slice 5.5 replaces the source and nothing else in this slice changes. Every field is optional text as the legacy tables hold it.
 */
export interface SourceItem {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  image: string | null;
  category: string | null;
  active: boolean;
  /** the item is still the platform's starter text (shown, but never as a real offer) */
  sample: boolean;
  /** the price is a starter price: hidden on the public page */
  samplePrice: boolean;
}

import type { ManagedDoc } from '../../v3-website/core/managed-doc';

export interface SourceExtras {
  headline?: string; subline?: string; ctaLabel?: string; announcement?: string;
  trust?: string[]; faq?: Array<{ q: string; a: string }>; steps?: Array<{ title: string; desc?: string }>;
  stats?: Array<{ value: string; label: string }>; team?: Array<{ name: string; role?: string; note?: string; image?: string }>;
  social?: { x?: string; customLabel?: string; customUrl?: string };
  /** slice 5.5a: written in the Website manager */
  heroImageAlt?: string; aboutImage?: string; aboutImageAlt?: string; city?: string; pin?: string; credentials?: Array<{ title: string; detail?: string }>;
}

export interface SourceCms {
  businessName: string | null; tagline: string | null; about: string | null; logo: string | null; banner: string | null; favicon: string | null;
  phone: string | null; email: string | null; address: string | null; businessHours: string | null; whatsapp: string | null;
  facebook: string | null; instagram: string | null; linkedin: string | null; youtube: string | null; googleMaps: string | null;
  portfolio: Array<{ id?: string; src: string; alt?: string; title?: string }> | null;
  testimonials: Array<{ quote: string; author: string; note?: string; sample?: boolean }> | null;
  pages: Array<{ slug: string; title: string; body: string; intro?: string }> | null;
  extras: SourceExtras | null;
  packKey: string | null; siteStatus: string; ogImage: string | null; seoTitle: string | null; seoDesc: string | null;
}

export interface SourceVendor {
  id: string; subdomain: string | null; businessName: string; name: string; phone: string | null; email: string; status: string; industry: string | null;
}

export interface SourceDocument {
  vendor: SourceVendor;
  /** the published columns with the pending draft laid over them; null when the vendor has no site row */
  cms: SourceCms | null;
  items: SourceItem[];
  /** the owner has claimed the business (a used claim link exists): the verified contact until phone OTP arrives in slice 5.7 */
  claimed: boolean;
  /** slice 5.5a: renderer settings from the Website manager (brand tokens, hidden and ordered sections); absent for a site never edited there */
  rendererSettings?: Record<string, unknown>;
  /** the managed document that was laid over this source (live, or the overlay of this load); the build records it as the publication's snapshot. Not part of the content hash. */
  managed?: ManagedDoc;
  /** slice B1: the vendor's own SEO text per page key (home, about, page:<slug>, item:<id> ...); the build uses it ahead of the generated text */
  /** slice B3: the Google review link the vendor entered; the build gives it to the theme only on a plan with calls to action */
  reviewUrl?: string;
  pageSeo?: Record<string, { seoTitle?: string; seoDescription?: string; shareImageRef?: string }>;
}

export interface SiteLimits { pages: number | null; services: number | null; gallery: number | null; faqs: number | null }
