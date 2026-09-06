import { PrismaClient } from '@prisma/client';

/**
 * Idempotent seed for the Operation Registry (PRD §10) + Industry Experience Registry
 * (PRD §8, §31-32). Mirrors get4domain_mvp/src/config/{operations,industry-experience}.ts —
 * keep the two in sync. Uses upsert so re-running is safe (no duplicates, updates in place).
 * Callable from prisma/seed.ts (via `prisma db seed`) or standalone (`npm run seed:registry`).
 */

const OPERATIONS: Array<{
  key: string; label: string; cta: string; groupKey: string; actionIntent: string | null; description: string;
}> = [
  { key: 'appointment', label: 'Appointment', cta: 'Book Appointment', groupKey: 'convert', actionIntent: 'engine.enquiry', description: 'Time-slot visit with a practitioner (clinic, salon, diagnostics).' },
  { key: 'booking', label: 'Booking', cta: 'Book Now', groupKey: 'convert', actionIntent: 'engine.enquiry', description: 'Reserve a room / package / date (hotel, travel, events, photography).' },
  { key: 'site_visit', label: 'Site Visit', cta: 'Book Site Visit', groupKey: 'convert', actionIntent: 'realestate.site_visit', description: 'Schedule an in-person property/site visit (real estate, construction).' },
  { key: 'cart', label: 'Cart', cta: 'Add to Cart', groupKey: 'transact', actionIntent: 'engine.checkout.order', description: 'Multi-item basket before checkout (retail, restaurant, agriculture).' },
  { key: 'order', label: 'Order', cta: 'Order Now', groupKey: 'transact', actionIntent: 'engine.checkout.order', description: 'Purchase products/food, paid online (retail, restaurant).' },
  { key: 'quote', label: 'Quote', cta: 'Request a Quote', groupKey: 'convert', actionIntent: 'engine.enquiry', description: 'Priced proposal for a job (construction, logistics, finance).' },
  { key: 'enquiry', label: 'Enquiry', cta: 'Enquire Now', groupKey: 'convert', actionIntent: 'engine.enquiry', description: 'General interest capture → CRM lead (universal fallback).' },
  { key: 'lead', label: 'Lead', cta: 'Get in Touch', groupKey: 'relationship', actionIntent: 'engine.enquiry', description: 'A tracked prospect in the CRM pipeline.' },
  { key: 'application', label: 'Application', cta: 'Apply Now', groupKey: 'convert', actionIntent: 'engine.enquiry', description: 'Structured application/admission (education, coaching, finance).' },
  { key: 'consultation', label: 'Consultation', cta: 'Book a Consultation', groupKey: 'convert', actionIntent: 'engine.enquiry', description: 'Advisory session before service (professional, tech, finance).' },
  { key: 'membership', label: 'Membership', cta: 'Join Now', groupKey: 'transact', actionIntent: 'engine.checkout.order', description: 'Recurring access plan (gym, clubs).' },
  { key: 'subscription', label: 'Subscription', cta: 'Subscribe', groupKey: 'transact', actionIntent: 'engine.checkout.order', description: 'Recurring billed plan.' },
  { key: 'payment', label: 'Payment', cta: 'Pay Now', groupKey: 'transact', actionIntent: 'engine.checkout.order', description: 'Online payment/fee/deposit (all industries with payments enabled).' },
  { key: 'pos', label: 'POS', cta: 'Ring Up Sale', groupKey: 'fulfil', actionIntent: 'retail.create_sale', description: 'In-store point of sale (vendor-side; retail, restaurant).' },
  { key: 'delivery', label: 'Delivery', cta: 'Deliver', groupKey: 'fulfil', actionIntent: null, description: 'Fulfilment to the customer address (restaurant, retail).' },
  { key: 'pickup', label: 'Pickup', cta: 'Pickup', groupKey: 'fulfil', actionIntent: null, description: 'Customer collects the order (restaurant, retail).' },
  { key: 'service_request', label: 'Service Request', cta: 'Request Service', groupKey: 'convert', actionIntent: 'engine.enquiry', description: 'Book a service job (automobile, logistics, home services).' },
];

const INDUSTRIES: Array<{
  industry: string; label: string; groupKey: string; businessModel: string; primaryOperation: string;
  secondaryOperations: string[]; primaryCta: string; vendorModules: string[]; vendorMobileNav: string[];
  clientModules: string[]; crmPipeline: string[];
}> = [
  { industry: 'clinic', label: 'Clinic & Healthcare', groupKey: 'Healthcare', businessModel: 'appointment', primaryOperation: 'appointment', secondaryOperations: ['consultation', 'payment', 'enquiry'], primaryCta: 'Book Appointment', vendorModules: ['patients', 'doctors', 'treatments', 'appointments', 'crm', 'payments', 'communication', 'website'], vendorMobileNav: ['dashboard', 'appointments', 'patients', 'crm', 'more'], clientModules: ['doctors', 'treatments', 'appointment', 'my-appointments', 'payments', 'notifications'], crmPipeline: ['Enquiry', 'Consultation', 'Treatment Plan', 'Payment', 'Follow-up'] },
  { industry: 'salon', label: 'Salon & Beauty', groupKey: 'Beauty & Wellness', businessModel: 'appointment', primaryOperation: 'appointment', secondaryOperations: ['payment', 'enquiry', 'membership'], primaryCta: 'Book Appointment', vendorModules: ['services', 'staff', 'appointments', 'customers', 'packages', 'payments', 'website'], vendorMobileNav: ['dashboard', 'appointments', 'customers', 'campaigns', 'more'], clientModules: ['services', 'staff', 'appointment', 'my-appointments', 'payments', 'notifications'], crmPipeline: ['Enquiry', 'Booked', 'Serviced', 'Repeat'] },
  { industry: 'gym', label: 'Gym & Fitness', groupKey: 'Fitness & Sports', businessModel: 'membership', primaryOperation: 'membership', secondaryOperations: ['enquiry', 'payment', 'booking'], primaryCta: 'Join Now', vendorModules: ['plans', 'members', 'schedule', 'trainers', 'payments', 'crm', 'website'], vendorMobileNav: ['dashboard', 'members', 'schedule', 'crm', 'more'], clientModules: ['programs', 'trainers', 'membership', 'schedule', 'payments', 'notifications'], crmPipeline: ['Lead', 'Trial', 'Member', 'Renewal Due', 'Renewed'] },
  { industry: 'coaching', label: 'Coaching & Training', groupKey: 'Education', businessModel: 'service', primaryOperation: 'enquiry', secondaryOperations: ['application', 'consultation', 'payment'], primaryCta: 'Book a Call', vendorModules: ['courses', 'leads', 'counselling', 'students', 'payments', 'crm', 'website'], vendorMobileNav: ['dashboard', 'leads', 'students', 'campaigns', 'more'], clientModules: ['courses', 'enquiry', 'application', 'payments', 'student-area', 'notifications'], crmPipeline: ['Enquiry', 'Counselling', 'Enrolled', 'Payment', 'Active'] },
  { industry: 'education', label: 'Education & Schools', groupKey: 'Education', businessModel: 'service', primaryOperation: 'enquiry', secondaryOperations: ['application', 'consultation', 'payment'], primaryCta: 'Admission Enquiry', vendorModules: ['courses', 'leads', 'counselling', 'applications', 'students', 'payments', 'website'], vendorMobileNav: ['dashboard', 'leads', 'applications', 'students', 'more'], clientModules: ['courses', 'course-details', 'enquiry', 'application', 'payments', 'student-area'], crmPipeline: ['Enquiry', 'Counselling', 'Course Selected', 'Application', 'Payment', 'Enrolled'] },
  { industry: 'professional', label: 'Professional Services', groupKey: 'Professional Services', businessModel: 'consultation', primaryOperation: 'enquiry', secondaryOperations: ['consultation', 'appointment', 'payment'], primaryCta: 'Book a Consultation', vendorModules: ['clients', 'services', 'appointments', 'crm', 'payments', 'website'], vendorMobileNav: ['dashboard', 'clients', 'appointments', 'crm', 'more'], clientModules: ['services', 'consultation', 'documents', 'payments', 'notifications'], crmPipeline: ['Enquiry', 'Consultation', 'Proposal', 'Engaged', 'Payment'] },
  { industry: 'finance', label: 'Finance & Advisory', groupKey: 'Finance & Insurance', businessModel: 'consultation', primaryOperation: 'lead', secondaryOperations: ['quote', 'application', 'consultation', 'payment'], primaryCta: 'Get a Quote', vendorModules: ['leads', 'products', 'quotes', 'customers', 'payments', 'crm', 'website'], vendorMobileNav: ['dashboard', 'leads', 'quotes', 'crm', 'more'], clientModules: ['products', 'enquiry', 'quote', 'application', 'payments', 'notifications'], crmPipeline: ['Lead', 'Requirement', 'Quote', 'Documents', 'Proposal', 'Policy'] },
  { industry: 'diagnostics', label: 'Diagnostics & Labs', groupKey: 'Healthcare', businessModel: 'booking', primaryOperation: 'booking', secondaryOperations: ['appointment', 'payment', 'enquiry'], primaryCta: 'Book a Test', vendorModules: ['tests', 'appointments', 'patients', 'reports', 'payments', 'website'], vendorMobileNav: ['dashboard', 'appointments', 'reports', 'patients', 'more'], clientModules: ['tests', 'book-test', 'reports', 'payments', 'notifications'], crmPipeline: ['Enquiry', 'Booked', 'Sample Collected', 'Report Ready', 'Paid'] },
  { industry: 'photography', label: 'Photography & Studio', groupKey: 'Events & Entertainment', businessModel: 'booking', primaryOperation: 'enquiry', secondaryOperations: ['booking', 'payment'], primaryCta: 'Check Availability', vendorModules: ['packages', 'bookings', 'leads', 'customers', 'payments', 'website'], vendorMobileNav: ['dashboard', 'bookings', 'leads', 'campaigns', 'more'], clientModules: ['portfolio', 'packages', 'enquiry', 'booking', 'payments', 'notifications'], crmPipeline: ['Enquiry', 'Quote', 'Booked', 'Shoot Done', 'Delivered'] },
  { industry: 'hotel', label: 'Hotel & Hospitality', groupKey: 'Travel & Tours', businessModel: 'booking', primaryOperation: 'booking', secondaryOperations: ['payment', 'enquiry'], primaryCta: 'Check Availability', vendorModules: ['rooms', 'bookings', 'guests', 'offers', 'payments', 'website'], vendorMobileNav: ['dashboard', 'bookings', 'guests', 'campaigns', 'more'], clientModules: ['rooms', 'availability', 'booking', 'payments', 'my-bookings', 'notifications'], crmPipeline: ['Enquiry', 'Booking', 'Confirmed', 'Stayed'] },
  { industry: 'events', label: 'Events & Venues', groupKey: 'Events & Entertainment', businessModel: 'booking', primaryOperation: 'enquiry', secondaryOperations: ['booking', 'quote', 'payment'], primaryCta: 'Check Your Date', vendorModules: ['packages', 'bookings', 'leads', 'customers', 'payments', 'website'], vendorMobileNav: ['dashboard', 'bookings', 'leads', 'campaigns', 'more'], clientModules: ['services', 'packages', 'enquiry', 'booking', 'payments', 'notifications'], crmPipeline: ['Enquiry', 'Quote', 'Booked', 'Delivered'] },
  { industry: 'travel', label: 'Travel & Tours', groupKey: 'Travel & Tours', businessModel: 'booking', primaryOperation: 'enquiry', secondaryOperations: ['booking', 'payment'], primaryCta: 'Plan My Trip', vendorModules: ['packages', 'leads', 'bookings', 'customers', 'payments', 'crm', 'website'], vendorMobileNav: ['dashboard', 'leads', 'bookings', 'crm', 'more'], clientModules: ['packages', 'search', 'enquiry', 'booking', 'payments', 'my-bookings'], crmPipeline: ['Enquiry', 'Quote', 'Booking', 'Paid', 'Travelled'] },
  { industry: 'restaurant', label: 'Restaurant & Cafe', groupKey: 'Restaurant & Food', businessModel: 'product', primaryOperation: 'order', secondaryOperations: ['cart', 'payment', 'delivery', 'pickup', 'pos'], primaryCta: 'Order Now', vendorModules: ['menu', 'orders', 'pos', 'tables', 'kitchen', 'customers', 'offers', 'website'], vendorMobileNav: ['dashboard', 'orders', 'kitchen', 'tables', 'more'], clientModules: ['menu', 'cart', 'order', 'pickup-delivery', 'payments', 'order-tracking'], crmPipeline: ['New', 'Preparing', 'Ready', 'Delivered'] },
  { industry: 'retail', label: 'Retail & Shopping', groupKey: 'Retail & Shopping', businessModel: 'product', primaryOperation: 'order', secondaryOperations: ['cart', 'payment', 'delivery', 'pickup', 'pos'], primaryCta: 'Shop Now', vendorModules: ['products', 'orders', 'pos', 'inventory', 'customers', 'offers', 'website'], vendorMobileNav: ['dashboard', 'orders', 'products', 'customers', 'more'], clientModules: ['products', 'cart', 'order', 'payments', 'order-history', 'notifications'], crmPipeline: ['New', 'Confirmed', 'Packed', 'Shipped', 'Delivered'] },
  { industry: 'agriculture', label: 'Agriculture', groupKey: 'Retail & Shopping', businessModel: 'product', primaryOperation: 'enquiry', secondaryOperations: ['order', 'cart', 'payment', 'delivery'], primaryCta: 'Enquire / Order', vendorModules: ['products', 'orders', 'leads', 'customers', 'payments', 'website'], vendorMobileNav: ['dashboard', 'orders', 'leads', 'products', 'more'], clientModules: ['products', 'enquiry', 'order', 'payments', 'notifications'], crmPipeline: ['Lead', 'Contacted', 'Qualified', 'Won'] },
  { industry: 'automobile', label: 'Automobile Services', groupKey: 'Professional Services', businessModel: 'service', primaryOperation: 'service_request', secondaryOperations: ['appointment', 'enquiry', 'payment'], primaryCta: 'Book a Service', vendorModules: ['services', 'jobs', 'appointments', 'customers', 'payments', 'crm', 'website'], vendorMobileNav: ['dashboard', 'jobs', 'appointments', 'customers', 'more'], clientModules: ['services', 'book-service', 'job-status', 'payments', 'notifications'], crmPipeline: ['Enquiry', 'Booked', 'In Service', 'Ready', 'Paid'] },
  { industry: 'construction', label: 'Construction & Interior', groupKey: 'Construction & Interior', businessModel: 'service', primaryOperation: 'enquiry', secondaryOperations: ['quote', 'site_visit', 'payment'], primaryCta: 'Request a Quote', vendorModules: ['projects', 'leads', 'quotes', 'clients', 'site-visits', 'payments', 'website'], vendorMobileNav: ['dashboard', 'leads', 'projects', 'quotes', 'more'], clientModules: ['projects', 'portfolio', 'quote-request', 'enquiry', 'payments'], crmPipeline: ['Lead', 'Site Visit', 'Quote', 'Negotiation', 'Won'] },
  { industry: 'technology', label: 'Technology & IT', groupKey: 'Professional Services', businessModel: 'consultation', primaryOperation: 'enquiry', secondaryOperations: ['consultation', 'quote', 'payment'], primaryCta: 'Book a Discovery Call', vendorModules: ['services', 'leads', 'projects', 'clients', 'payments', 'crm', 'website'], vendorMobileNav: ['dashboard', 'leads', 'projects', 'crm', 'more'], clientModules: ['services', 'enquiry', 'consultation', 'payments', 'notifications'], crmPipeline: ['Lead', 'Discovery', 'Proposal', 'Negotiation', 'Won'] },
  { industry: 'logistics', label: 'Logistics & Transport', groupKey: 'Professional Services', businessModel: 'service', primaryOperation: 'enquiry', secondaryOperations: ['quote', 'service_request', 'booking', 'payment'], primaryCta: 'Get a Quote', vendorModules: ['shipments', 'leads', 'quotes', 'clients', 'payments', 'crm', 'website'], vendorMobileNav: ['dashboard', 'shipments', 'leads', 'quotes', 'more'], clientModules: ['services', 'quote', 'enquiry', 'track', 'payments'], crmPipeline: ['Lead', 'Quote', 'Booked', 'In Transit', 'Delivered'] },
  { industry: 'realestate', label: 'Real Estate', groupKey: 'Real Estate', businessModel: 'property', primaryOperation: 'site_visit', secondaryOperations: ['enquiry', 'payment'], primaryCta: 'Book Site Visit', vendorModules: ['leads', 'projects', 'properties', 'site-visits', 'follow-ups', 'payments', 'campaigns', 'website'], vendorMobileNav: ['dashboard', 'leads', 'site-visits', 'properties', 'more'], clientModules: ['projects', 'property-details', 'floor-plans', 'location', 'site-visit', 'enquiry', 'payments', 'my-visits'], crmPipeline: ['Lead', 'Qualified', 'Site Visit', 'Negotiation', 'Booking', 'Won'] },
];

export async function seedRegistry(prisma: PrismaClient): Promise<void> {
  for (let i = 0; i < OPERATIONS.length; i++) {
    const op = OPERATIONS[i];
    await prisma.operationType.upsert({
      where: { key: op.key },
      create: { ...op, sortOrder: i },
      update: { ...op, sortOrder: i, active: true },
    });
  }
  for (const ind of INDUSTRIES) {
    await prisma.industryExperience.upsert({
      where: { industry: ind.industry },
      create: ind,
      update: { ...ind, active: true },
    });
  }
  console.log(`Seeded ${OPERATIONS.length} operations + ${INDUSTRIES.length} industry experiences.`);
}

// Standalone entry (`npm run seed:registry`).
if (require.main === module) {
  const prisma = new PrismaClient();
  seedRegistry(prisma)
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
