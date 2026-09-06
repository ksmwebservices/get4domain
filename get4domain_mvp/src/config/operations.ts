// ── OPERATION REGISTRY (PRD §10, §31-33) ───────────────────────────────────────
// The reusable operational capabilities the platform supports. Each business model
// selects a PRIMARY operation + SECONDARY operations; the UX/workflow adapts per
// industry while the underlying capability stays reusable. Mirrors the backend
// OperationType schema object (backend-api prisma + src/config) — keep in sync.

export type OperationKey =
  | 'appointment' | 'booking' | 'site_visit' | 'cart' | 'order' | 'quote'
  | 'enquiry' | 'lead' | 'application' | 'consultation' | 'membership'
  | 'subscription' | 'payment' | 'pos' | 'delivery' | 'pickup' | 'service_request';

/** Grouping is for UX ordering only — not a hard taxonomy. */
export type OperationGroup = 'convert' | 'transact' | 'fulfil' | 'relationship';

export interface OperationDef {
  key: OperationKey;
  label: string;
  /** Customer-facing verb / primary CTA seed. */
  cta: string;
  group: OperationGroup;
  /** The engine action intent this operation maps to when transactional (else null). */
  actionIntent: string | null;
  description: string;
}

export const OPERATIONS: Record<OperationKey, OperationDef> = {
  appointment:    { key: 'appointment',    label: 'Appointment',     cta: 'Book Appointment',   group: 'convert',  actionIntent: 'engine.enquiry',          description: 'Time-slot visit with a practitioner (clinic, salon, diagnostics).' },
  booking:        { key: 'booking',        label: 'Booking',         cta: 'Book Now',           group: 'convert',  actionIntent: 'engine.enquiry',          description: 'Reserve a room / package / date (hotel, travel, events, photography).' },
  site_visit:     { key: 'site_visit',     label: 'Site Visit',      cta: 'Book Site Visit',    group: 'convert',  actionIntent: 'realestate.site_visit',   description: 'Schedule an in-person property/site visit (real estate, construction).' },
  cart:           { key: 'cart',           label: 'Cart',            cta: 'Add to Cart',        group: 'transact', actionIntent: 'engine.checkout.order',   description: 'Multi-item basket before checkout (retail, restaurant, agriculture).' },
  order:          { key: 'order',          label: 'Order',           cta: 'Order Now',          group: 'transact', actionIntent: 'engine.checkout.order',   description: 'Purchase products/food, paid online (retail, restaurant).' },
  quote:          { key: 'quote',          label: 'Quote',           cta: 'Request a Quote',    group: 'convert',  actionIntent: 'engine.enquiry',          description: 'Priced proposal for a job (construction, logistics, finance).' },
  enquiry:        { key: 'enquiry',        label: 'Enquiry',         cta: 'Enquire Now',        group: 'convert',  actionIntent: 'engine.enquiry',          description: 'General interest capture → CRM lead (universal fallback).' },
  lead:           { key: 'lead',           label: 'Lead',            cta: 'Get in Touch',       group: 'relationship', actionIntent: 'engine.enquiry',      description: 'A tracked prospect in the CRM pipeline.' },
  application:    { key: 'application',    label: 'Application',     cta: 'Apply Now',          group: 'convert',  actionIntent: 'engine.enquiry',          description: 'Structured application/admission (education, coaching, finance).' },
  consultation:   { key: 'consultation',   label: 'Consultation',    cta: 'Book a Consultation', group: 'convert', actionIntent: 'engine.enquiry',         description: 'Advisory session before service (professional, tech, finance).' },
  membership:     { key: 'membership',     label: 'Membership',      cta: 'Join Now',           group: 'transact', actionIntent: 'engine.checkout.order',   description: 'Recurring access plan (gym, clubs).' },
  subscription:   { key: 'subscription',   label: 'Subscription',    cta: 'Subscribe',          group: 'transact', actionIntent: 'engine.checkout.order',   description: 'Recurring billed plan.' },
  payment:        { key: 'payment',        label: 'Payment',         cta: 'Pay Now',            group: 'transact', actionIntent: 'engine.checkout.order',   description: 'Online payment/fee/deposit (all industries with payments enabled).' },
  pos:            { key: 'pos',            label: 'POS',             cta: 'Ring Up Sale',       group: 'fulfil',   actionIntent: 'retail.create_sale',      description: 'In-store point of sale (vendor-side; retail, restaurant).' },
  delivery:       { key: 'delivery',       label: 'Delivery',        cta: 'Deliver',            group: 'fulfil',   actionIntent: null,                       description: 'Fulfilment to the customer address (restaurant, retail).' },
  pickup:         { key: 'pickup',         label: 'Pickup',          cta: 'Pickup',             group: 'fulfil',   actionIntent: null,                       description: 'Customer collects the order (restaurant, retail).' },
  service_request:{ key: 'service_request',label: 'Service Request', cta: 'Request Service',    group: 'convert',  actionIntent: 'engine.enquiry',          description: 'Book a service job (automobile, logistics, home services).' },
};

export const OPERATION_KEYS = Object.keys(OPERATIONS) as OperationKey[];
export const isOperationKey = (k: string): k is OperationKey => k in OPERATIONS;
