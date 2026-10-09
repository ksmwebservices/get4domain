/** LeadSpace shared constants and small pure helpers (no database, no Nest). */
import * as crypto from 'crypto';

export const EVENT_TYPES = ['ENQUIRY', 'BOOKING', 'APPOINTMENT', 'SITE_VISIT', 'CART_ORDER'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_LABEL: Record<EventType, string> = {
  ENQUIRY: 'Enquiry', BOOKING: 'Booking', APPOINTMENT: 'Appointment', SITE_VISIT: 'Site visit', CART_ORDER: 'Order',
};

/** Vendor-visible lead statuses. DELIVERED is what the vendor sees as "New". */
export const LEAD_STATUSES = ['NEW', 'HELD', 'DELIVERED', 'CONTACTED', 'WON', 'LOST', 'DISPUTED', 'CREDITED'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const CHANNELS = ['FACEBOOK_PAGE', 'INSTAGRAM', 'TELEGRAM', 'GOOGLE_BUSINESS'] as const;
export type Channel = (typeof CHANNELS)[number];

/** The ten to twelve trades the first templates are written for. `regulated` ones carry extra rules (see regulated.ts). */
export const CATEGORIES: { id: string; label: string; goal: EventType; regulated?: 'advocate' | 'clinic' | 'realEstate'; blurb: string }[] = [
  { id: 'home-services', label: 'Handyman and home services', goal: 'BOOKING', blurb: 'Plumbing, electrical, carpentry, painting, cleaning, repairs.' },
  { id: 'builders-interiors', label: 'Builders and interiors', goal: 'SITE_VISIT', blurb: 'Construction, renovation, interior design.' },
  { id: 'real-estate', label: 'Real estate agent', goal: 'SITE_VISIT', regulated: 'realEstate', blurb: 'Flats, plots, villas, rentals.' },
  { id: 'freelancer', label: 'Freelancer', goal: 'ENQUIRY', blurb: 'Design, writing, development, accounting, consulting.' },
  { id: 'startup', label: 'Small startup', goal: 'ENQUIRY', blurb: 'A product or service that needs its first customers.' },
  { id: 'photography-events', label: 'Photographer and events', goal: 'ENQUIRY', blurb: 'Weddings, shoots, event planning, decor.' },
  { id: 'tutor', label: 'Tutor and coaching', goal: 'BOOKING', blurb: 'School subjects, exams, music, languages, skills.' },
  { id: 'salon-beauty', label: 'Salon and beauty', goal: 'APPOINTMENT', blurb: 'Hair, skin, spa, bridal.' },
  { id: 'shop-retail', label: 'Shop and local retail', goal: 'CART_ORDER', blurb: 'Products people can order from you.' },
  { id: 'restaurant-food', label: 'Food, bakery and catering', goal: 'CART_ORDER', blurb: 'Cakes, tiffin, catering, cloud kitchen.' },
  { id: 'advocate', label: 'Advocate', goal: 'ENQUIRY', regulated: 'advocate', blurb: 'Information and enquiry page only.' },
  { id: 'clinic', label: 'Clinic and doctor', goal: 'APPOINTMENT', regulated: 'clinic', blurb: 'Information and appointment enquiry only.' },
];

export const categoryOf = (id: string | null | undefined) => CATEGORIES.find((c) => c.id === id);

/** The last 10 digits of an Indian mobile number, or null when it cannot be one. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const d = String(raw ?? '').replace(/\D/g, '');
  const ten = d.length >= 10 ? d.slice(-10) : d;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

const salt = (): string => process.env.LEADSPACE_HASH_SALT || process.env.PLATFORM_SETTINGS_KEY || 'leadspace-local-salt';
/** One-way hash of a phone number (or IP, or device id) so it can be compared and rate limited without being stored in clear. */
export const hashOf = (value: string): string => crypto.createHash('sha256').update(`${salt()}:${value}`).digest('hex');
export const phoneHash = (ten: string): string => hashOf(`p:${ten}`);

/** "98xxxxx210": shown to a vendor whose lead is held until the next refill. */
export const maskPhone = (ten: string): string => `${ten.slice(0, 2)}${'x'.repeat(5)}${ten.slice(-3)}`;

export const rupeesText = (paise: number): string => `Rs ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function slugify(input: string): string {
  const s = input.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s || 'business';
}

/** Words that may never appear in a business name or tagline on a LeadSpace page. */
export const DEFAULT_BLOCKLIST = ['casino', 'betting', 'satta', 'lottery', 'escort', 'adult', 'porn', 'loan shark', 'hawala', 'fake certificate', 'fake degree', 'weapon', 'drugs', 'gun for sale'];
