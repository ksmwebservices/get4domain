// ── INDUSTRY EXPERIENCE REGISTRY (PRD §8, §31-32) ──────────────────────────────
// One config that makes industry selection MEANINGFUL (PRD §46): it drives the vendor
// module list + mobile-nav priorities (Phase B), the client-app modules (Phase C), the
// CRM pipeline stages (§27) and the primary/secondary operations (§10-11). Config-driven
// per §32; mirrors the backend IndustryExperience schema + seed. Extend toward the PRD's
// 135+ industry×category matrix by adding entries / subcategory overrides — no code edits.

import type { OperationKey } from './operations';

export type BusinessModel =
  | 'product' | 'service' | 'property' | 'experience' | 'consultation'
  | 'membership' | 'subscription' | 'booking' | 'appointment' | 'marketplace' | 'mixed';

export interface IndustryExperienceEntry {
  industry: string;            // canonical engine id (matches src/engine/registry.ts)
  label: string;
  group: string;               // PRD §31 industry group
  businessModel: BusinessModel;
  primaryOperation: OperationKey;
  secondaryOperations: OperationKey[];
  primaryCta: string;
  /** Vendor WebApp modules to surface for this industry (PRD §5/§24/§32 vendorModules). */
  vendorModules: string[];
  /** Vendor mobile bottom-nav priority (≤5; PRD §7 — not the full desktop nav). */
  vendorMobileNav: string[];
  /** Client WebApp modules (PRD §6/§32 clientModules). */
  clientModules: string[];
  /** CRM pipeline stages for this industry (PRD §27). */
  crmPipeline: string[];
}

// Universal fallback pipeline for industries without a bespoke one.
const GENERIC_PIPELINE = ['Lead', 'Contacted', 'Qualified', 'Won'];

export const INDUSTRY_EXPERIENCE: Record<string, IndustryExperienceEntry> = {
  clinic: {
    industry: 'clinic', label: 'Clinic & Healthcare', group: 'Healthcare', businessModel: 'appointment',
    primaryOperation: 'appointment', secondaryOperations: ['consultation', 'payment', 'enquiry'], primaryCta: 'Book Appointment',
    vendorModules: ['patients', 'doctors', 'treatments', 'appointments', 'crm', 'payments', 'communication', 'website'],
    vendorMobileNav: ['dashboard', 'appointments', 'patients', 'crm', 'more'],
    clientModules: ['doctors', 'treatments', 'appointment', 'my-appointments', 'payments', 'notifications'],
    crmPipeline: ['Enquiry', 'Consultation', 'Treatment Plan', 'Payment', 'Follow-up'],
  },
  salon: {
    industry: 'salon', label: 'Salon & Beauty', group: 'Beauty & Wellness', businessModel: 'appointment',
    primaryOperation: 'appointment', secondaryOperations: ['payment', 'enquiry', 'membership'], primaryCta: 'Book Appointment',
    vendorModules: ['services', 'staff', 'appointments', 'customers', 'packages', 'payments', 'website'],
    vendorMobileNav: ['dashboard', 'appointments', 'customers', 'campaigns', 'more'],
    clientModules: ['services', 'staff', 'appointment', 'my-appointments', 'payments', 'notifications'],
    crmPipeline: ['Enquiry', 'Booked', 'Serviced', 'Repeat'],
  },
  gym: {
    industry: 'gym', label: 'Gym & Fitness', group: 'Fitness & Sports', businessModel: 'membership',
    primaryOperation: 'membership', secondaryOperations: ['enquiry', 'payment', 'booking'], primaryCta: 'Join Now',
    vendorModules: ['plans', 'members', 'schedule', 'trainers', 'payments', 'crm', 'website'],
    vendorMobileNav: ['dashboard', 'members', 'schedule', 'crm', 'more'],
    clientModules: ['programs', 'trainers', 'membership', 'schedule', 'payments', 'notifications'],
    crmPipeline: ['Lead', 'Trial', 'Member', 'Renewal Due', 'Renewed'],
  },
  coaching: {
    industry: 'coaching', label: 'Coaching & Training', group: 'Education', businessModel: 'service',
    primaryOperation: 'enquiry', secondaryOperations: ['application', 'consultation', 'payment'], primaryCta: 'Book a Call',
    vendorModules: ['courses', 'leads', 'counselling', 'students', 'payments', 'crm', 'website'],
    vendorMobileNav: ['dashboard', 'leads', 'students', 'campaigns', 'more'],
    clientModules: ['courses', 'enquiry', 'application', 'payments', 'student-area', 'notifications'],
    crmPipeline: ['Enquiry', 'Counselling', 'Enrolled', 'Payment', 'Active'],
  },
  education: {
    industry: 'education', label: 'Education & Schools', group: 'Education', businessModel: 'service',
    primaryOperation: 'enquiry', secondaryOperations: ['application', 'consultation', 'payment'], primaryCta: 'Admission Enquiry',
    vendorModules: ['courses', 'leads', 'counselling', 'applications', 'students', 'payments', 'website'],
    vendorMobileNav: ['dashboard', 'leads', 'applications', 'students', 'more'],
    clientModules: ['courses', 'course-details', 'enquiry', 'application', 'payments', 'student-area'],
    crmPipeline: ['Enquiry', 'Counselling', 'Course Selected', 'Application', 'Payment', 'Enrolled'],
  },
  professional: {
    industry: 'professional', label: 'Professional Services', group: 'Professional Services', businessModel: 'consultation',
    primaryOperation: 'enquiry', secondaryOperations: ['consultation', 'appointment', 'payment'], primaryCta: 'Book a Consultation',
    vendorModules: ['clients', 'services', 'appointments', 'crm', 'payments', 'website'],
    vendorMobileNav: ['dashboard', 'clients', 'appointments', 'crm', 'more'],
    clientModules: ['services', 'consultation', 'documents', 'payments', 'notifications'],
    crmPipeline: ['Enquiry', 'Consultation', 'Proposal', 'Engaged', 'Payment'],
  },
  finance: {
    industry: 'finance', label: 'Finance & Advisory', group: 'Finance & Insurance', businessModel: 'consultation',
    primaryOperation: 'lead', secondaryOperations: ['quote', 'application', 'consultation', 'payment'], primaryCta: 'Get a Quote',
    vendorModules: ['leads', 'products', 'quotes', 'customers', 'payments', 'crm', 'website'],
    vendorMobileNav: ['dashboard', 'leads', 'quotes', 'crm', 'more'],
    clientModules: ['products', 'enquiry', 'quote', 'application', 'payments', 'notifications'],
    crmPipeline: ['Lead', 'Requirement', 'Quote', 'Documents', 'Proposal', 'Policy'],
  },
  diagnostics: {
    industry: 'diagnostics', label: 'Diagnostics & Labs', group: 'Healthcare', businessModel: 'booking',
    primaryOperation: 'booking', secondaryOperations: ['appointment', 'payment', 'enquiry'], primaryCta: 'Book a Test',
    vendorModules: ['tests', 'appointments', 'patients', 'reports', 'payments', 'website'],
    vendorMobileNav: ['dashboard', 'appointments', 'reports', 'patients', 'more'],
    clientModules: ['tests', 'book-test', 'reports', 'payments', 'notifications'],
    crmPipeline: ['Enquiry', 'Booked', 'Sample Collected', 'Report Ready', 'Paid'],
  },
  photography: {
    industry: 'photography', label: 'Photography & Studio', group: 'Events & Entertainment', businessModel: 'booking',
    primaryOperation: 'enquiry', secondaryOperations: ['booking', 'payment'], primaryCta: 'Check Availability',
    vendorModules: ['packages', 'bookings', 'leads', 'customers', 'payments', 'website'],
    vendorMobileNav: ['dashboard', 'bookings', 'leads', 'campaigns', 'more'],
    clientModules: ['portfolio', 'packages', 'enquiry', 'booking', 'payments', 'notifications'],
    crmPipeline: ['Enquiry', 'Quote', 'Booked', 'Shoot Done', 'Delivered'],
  },
  hotel: {
    industry: 'hotel', label: 'Hotel & Hospitality', group: 'Travel & Tours', businessModel: 'booking',
    primaryOperation: 'booking', secondaryOperations: ['payment', 'enquiry'], primaryCta: 'Check Availability',
    vendorModules: ['rooms', 'bookings', 'guests', 'offers', 'payments', 'website'],
    vendorMobileNav: ['dashboard', 'bookings', 'guests', 'campaigns', 'more'],
    clientModules: ['rooms', 'availability', 'booking', 'payments', 'my-bookings', 'notifications'],
    crmPipeline: ['Enquiry', 'Booking', 'Confirmed', 'Stayed'],
  },
  events: {
    industry: 'events', label: 'Events & Venues', group: 'Events & Entertainment', businessModel: 'booking',
    primaryOperation: 'enquiry', secondaryOperations: ['booking', 'quote', 'payment'], primaryCta: 'Check Your Date',
    vendorModules: ['packages', 'bookings', 'leads', 'customers', 'payments', 'website'],
    vendorMobileNav: ['dashboard', 'bookings', 'leads', 'campaigns', 'more'],
    clientModules: ['services', 'packages', 'enquiry', 'booking', 'payments', 'notifications'],
    crmPipeline: ['Enquiry', 'Quote', 'Booked', 'Delivered'],
  },
  travel: {
    industry: 'travel', label: 'Travel & Tours', group: 'Travel & Tours', businessModel: 'booking',
    primaryOperation: 'enquiry', secondaryOperations: ['booking', 'payment'], primaryCta: 'Plan My Trip',
    vendorModules: ['packages', 'leads', 'bookings', 'customers', 'payments', 'crm', 'website'],
    vendorMobileNav: ['dashboard', 'leads', 'bookings', 'crm', 'more'],
    clientModules: ['packages', 'search', 'enquiry', 'booking', 'payments', 'my-bookings'],
    crmPipeline: ['Enquiry', 'Quote', 'Booking', 'Paid', 'Travelled'],
  },
  restaurant: {
    industry: 'restaurant', label: 'Restaurant & Cafe', group: 'Restaurant & Food', businessModel: 'product',
    primaryOperation: 'order', secondaryOperations: ['cart', 'payment', 'delivery', 'pickup', 'pos'], primaryCta: 'Order Now',
    vendorModules: ['menu', 'orders', 'pos', 'tables', 'kitchen', 'customers', 'offers', 'website'],
    vendorMobileNav: ['dashboard', 'orders', 'kitchen', 'tables', 'more'],
    clientModules: ['menu', 'cart', 'order', 'pickup-delivery', 'payments', 'order-tracking'],
    crmPipeline: ['New', 'Preparing', 'Ready', 'Delivered'],
  },
  retail: {
    industry: 'retail', label: 'Retail & Shopping', group: 'Retail & Shopping', businessModel: 'product',
    primaryOperation: 'order', secondaryOperations: ['cart', 'payment', 'delivery', 'pickup', 'pos'], primaryCta: 'Shop Now',
    vendorModules: ['products', 'orders', 'pos', 'inventory', 'customers', 'offers', 'website'],
    vendorMobileNav: ['dashboard', 'orders', 'products', 'customers', 'more'],
    clientModules: ['products', 'cart', 'order', 'payments', 'order-history', 'notifications'],
    crmPipeline: ['New', 'Confirmed', 'Packed', 'Shipped', 'Delivered'],
  },
  agriculture: {
    industry: 'agriculture', label: 'Agriculture', group: 'Retail & Shopping', businessModel: 'product',
    primaryOperation: 'enquiry', secondaryOperations: ['order', 'cart', 'payment', 'delivery'], primaryCta: 'Enquire / Order',
    vendorModules: ['products', 'orders', 'leads', 'customers', 'payments', 'website'],
    vendorMobileNav: ['dashboard', 'orders', 'leads', 'products', 'more'],
    clientModules: ['products', 'enquiry', 'order', 'payments', 'notifications'],
    crmPipeline: GENERIC_PIPELINE,
  },
  automobile: {
    industry: 'automobile', label: 'Automobile Services', group: 'Professional Services', businessModel: 'service',
    primaryOperation: 'service_request', secondaryOperations: ['appointment', 'enquiry', 'payment'], primaryCta: 'Book a Service',
    vendorModules: ['services', 'jobs', 'appointments', 'customers', 'payments', 'crm', 'website'],
    vendorMobileNav: ['dashboard', 'jobs', 'appointments', 'customers', 'more'],
    clientModules: ['services', 'book-service', 'job-status', 'payments', 'notifications'],
    crmPipeline: ['Enquiry', 'Booked', 'In Service', 'Ready', 'Paid'],
  },
  construction: {
    industry: 'construction', label: 'Construction & Interior', group: 'Construction & Interior', businessModel: 'service',
    primaryOperation: 'enquiry', secondaryOperations: ['quote', 'site_visit', 'payment'], primaryCta: 'Request a Quote',
    vendorModules: ['projects', 'leads', 'quotes', 'clients', 'site-visits', 'payments', 'website'],
    vendorMobileNav: ['dashboard', 'leads', 'projects', 'quotes', 'more'],
    clientModules: ['projects', 'portfolio', 'quote-request', 'enquiry', 'payments'],
    crmPipeline: ['Lead', 'Site Visit', 'Quote', 'Negotiation', 'Won'],
  },
  technology: {
    industry: 'technology', label: 'Technology & IT', group: 'Professional Services', businessModel: 'consultation',
    primaryOperation: 'enquiry', secondaryOperations: ['consultation', 'quote', 'payment'], primaryCta: 'Book a Discovery Call',
    vendorModules: ['services', 'leads', 'projects', 'clients', 'payments', 'crm', 'website'],
    vendorMobileNav: ['dashboard', 'leads', 'projects', 'crm', 'more'],
    clientModules: ['services', 'enquiry', 'consultation', 'payments', 'notifications'],
    crmPipeline: ['Lead', 'Discovery', 'Proposal', 'Negotiation', 'Won'],
  },
  logistics: {
    industry: 'logistics', label: 'Logistics & Transport', group: 'Professional Services', businessModel: 'service',
    primaryOperation: 'enquiry', secondaryOperations: ['quote', 'service_request', 'booking', 'payment'], primaryCta: 'Get a Quote',
    vendorModules: ['shipments', 'leads', 'quotes', 'clients', 'payments', 'crm', 'website'],
    vendorMobileNav: ['dashboard', 'shipments', 'leads', 'quotes', 'more'],
    clientModules: ['services', 'quote', 'enquiry', 'track', 'payments'],
    crmPipeline: ['Lead', 'Quote', 'Booked', 'In Transit', 'Delivered'],
  },
  realestate: {
    industry: 'realestate', label: 'Real Estate', group: 'Real Estate', businessModel: 'property',
    primaryOperation: 'site_visit', secondaryOperations: ['enquiry', 'payment'], primaryCta: 'Book Site Visit',
    vendorModules: ['leads', 'projects', 'properties', 'site-visits', 'follow-ups', 'payments', 'campaigns', 'website'],
    vendorMobileNav: ['dashboard', 'leads', 'site-visits', 'properties', 'more'],
    clientModules: ['projects', 'property-details', 'floor-plans', 'location', 'site-visit', 'enquiry', 'payments', 'my-visits'],
    crmPipeline: ['Lead', 'Qualified', 'Site Visit', 'Negotiation', 'Booking', 'Won'],
  },
};

/** Canonical-industry lookup with a safe generic fallback (never throws). */
export function getIndustryExperience(industry?: string | null): IndustryExperienceEntry {
  const key = (industry ?? '').toLowerCase();
  return (
    INDUSTRY_EXPERIENCE[key] ?? {
      industry: key || 'general', label: 'Business', group: 'General', businessModel: 'mixed',
      primaryOperation: 'enquiry', secondaryOperations: ['payment'], primaryCta: 'Enquire Now',
      vendorModules: ['crm', 'payments', 'website'], vendorMobileNav: ['dashboard', 'crm', 'website', 'more'],
      clientModules: ['home', 'enquiry', 'payments'], crmPipeline: GENERIC_PIPELINE,
    }
  );
}

export const INDUSTRY_EXPERIENCE_KEYS = Object.keys(INDUSTRY_EXPERIENCE);
