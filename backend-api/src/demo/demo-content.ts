// Per-industry demo content for the Book-Demo funnel (Phase 2 website + Phase 3
// seed data). Kept intentionally lightweight and believable; prices are in
// RUPEES (DomainApp catalog/records use Float rupees, not paise). Any industry
// not listed falls back to `buildFallback` derived from its industry config.

export interface DemoService { name: string; price: number; desc: string }
export interface DemoTestimonial { name: string; text: string }

export interface DemoContent {
  business: string;
  tagline: string;
  about: string;
  services: DemoService[];
  testimonials: DemoTestimonial[];
}

// Shared sample customer names (reused across industries for seeded contacts).
export const NAME_POOL = [
  'Ravi Kumar', 'Priya Sharma', 'Arjun Menon', 'Sneha Reddy', 'Imran Khan',
  'Deepa Nair', 'Vikram Singh', 'Ananya Iyer', 'Rahul Verma', 'Fatima Sheikh',
];

export const DEMO_CONTENT: Record<string, DemoContent> = {
  travel: {
    business: 'Wanderlust Travels',
    tagline: 'Tailor-made tours & trusted cabs across India',
    about: 'From weekend getaways to grand pilgrimages, we plan, book and drive your journeys end to end.',
    services: [
      { name: 'Goa Beach Package (3N/4D)', price: 14999, desc: 'Flights, stay, sightseeing' },
      { name: 'Kerala Backwaters (5N/6D)', price: 24999, desc: 'Houseboat + resorts' },
      { name: 'Airport Cab (Sedan)', price: 1299, desc: 'One-way city transfer' },
    ],
    testimonials: [
      { name: 'Priya S.', text: 'Booked our Kerala trip in minutes — driver was on time and courteous.' },
      { name: 'Arjun M.', text: 'Best rates for Goa and zero hassle. Highly recommend.' },
    ],
  },
  restaurant: {
    business: 'Spice Garden',
    tagline: 'Authentic flavours, delivered fresh',
    about: 'A family kitchen serving regional favourites for dine-in, takeaway and online orders.',
    services: [
      { name: 'Family Thali', price: 349, desc: 'Unlimited veg thali' },
      { name: 'Chicken Biryani (Full)', price: 299, desc: 'Serves 2' },
      { name: 'Party Catering (per plate)', price: 449, desc: 'Min 25 plates' },
    ],
    testimonials: [
      { name: 'Deepa N.', text: 'The biryani is unreal and delivery is always hot.' },
      { name: 'Imran K.', text: 'Catered our office party — everyone loved it.' },
    ],
  },
  clinic: {
    business: 'CareWell Clinic',
    tagline: 'Compassionate care, close to home',
    about: 'General physicians and specialists offering consultations, health checks and follow-ups.',
    services: [
      { name: 'General Consultation', price: 500, desc: '15-min doctor visit' },
      { name: 'Full Body Health Check', price: 2999, desc: '60+ parameters' },
      { name: 'Follow-up Visit', price: 300, desc: 'Within 14 days' },
    ],
    testimonials: [
      { name: 'Ananya I.', text: 'Booking and reports on WhatsApp made everything so easy.' },
      { name: 'Rahul V.', text: 'Doctors take time to explain. Very reassuring.' },
    ],
  },
  hotel: {
    business: 'The Grand Stay',
    tagline: 'Comfort and hospitality, your home away from home',
    about: 'Well-appointed rooms, banquet halls and event spaces for every occasion.',
    services: [
      { name: 'Deluxe Room / night', price: 3499, desc: 'King bed, breakfast' },
      { name: 'Suite / night', price: 6999, desc: 'Living area + breakfast' },
      { name: 'Banquet Hall (day)', price: 34999, desc: 'Up to 200 guests' },
    ],
    testimonials: [
      { name: 'Fatima S.', text: 'Rooms were spotless and staff were wonderful.' },
      { name: 'Vikram S.', text: 'Hosted our wedding here — flawless arrangements.' },
    ],
  },
  salon: {
    business: 'Glow & Go Salon',
    tagline: 'Look good, feel great',
    about: 'Hair, skin and grooming services by trained stylists in a relaxing space.',
    services: [
      { name: 'Haircut & Styling', price: 499, desc: 'Wash + cut + blow-dry' },
      { name: 'Facial (Gold)', price: 1499, desc: '60-min glow facial' },
      { name: 'Bridal Package', price: 12999, desc: 'Hair, makeup, drape' },
    ],
    testimonials: [
      { name: 'Sneha R.', text: 'My bridal makeup lasted the whole day. Loved it!' },
      { name: 'Priya S.', text: 'Easy online booking and no waiting.' },
    ],
  },
  gym: {
    business: 'Iron Pulse Fitness',
    tagline: 'Stronger every day',
    about: 'Modern equipment, certified trainers and group classes for every fitness level.',
    services: [
      { name: 'Monthly Membership', price: 1499, desc: 'Full gym access' },
      { name: 'Personal Training (10)', price: 6999, desc: '10 PT sessions' },
      { name: 'Annual Membership', price: 11999, desc: 'Best value' },
    ],
    testimonials: [
      { name: 'Rahul V.', text: 'Lost 8kg in 3 months with the PT plan.' },
      { name: 'Deepa N.', text: 'Clean, well-equipped and never overcrowded.' },
    ],
  },
  realestate: {
    business: 'Prime Nest Realty',
    tagline: 'Find the place you’ll call home',
    about: 'Buy, sell and rent residential and commercial properties with trusted advisors.',
    services: [
      { name: '2BHK Apartment (visit)', price: 0, desc: 'Free site visit' },
      { name: 'Property Listing (Premium)', price: 4999, desc: '60-day featured' },
      { name: 'Legal & Documentation', price: 9999, desc: 'End-to-end support' },
    ],
    testimonials: [
      { name: 'Imran K.', text: 'Found my flat in two weekends. Smooth paperwork.' },
      { name: 'Ananya I.', text: 'Sold our plot above expectations. Great team.' },
    ],
  },
  education: {
    business: 'BrightPath Academy',
    tagline: 'Learning that lasts',
    about: 'Coaching for school, competitive exams and skills — online and in-class.',
    services: [
      { name: 'Class 10 Tuition (month)', price: 2499, desc: 'All subjects' },
      { name: 'NEET Crash Course', price: 14999, desc: '3-month intensive' },
      { name: 'Spoken English (batch)', price: 3999, desc: '8-week program' },
    ],
    testimonials: [
      { name: 'Sneha R.', text: 'My daughter’s grades jumped a full band.' },
      { name: 'Vikram S.', text: 'Great faculty and regular parent updates.' },
    ],
  },
  retail: {
    business: 'DailyMart Store',
    tagline: 'Everything you need, every day',
    about: 'Groceries, essentials and gifts with quick home delivery.',
    services: [
      { name: 'Grocery Combo', price: 999, desc: 'Weekly essentials' },
      { name: 'Gift Hamper', price: 1499, desc: 'Festive special' },
      { name: 'Home Delivery', price: 49, desc: 'Within 5 km' },
    ],
    testimonials: [
      { name: 'Deepa N.', text: 'Orders arrive fast and nothing is ever missing.' },
      { name: 'Rahul V.', text: 'Festive hampers were a big hit with family.' },
    ],
  },
  construction: {
    business: 'BuildRight Interiors',
    tagline: 'Spaces built around you',
    about: 'Turnkey construction and interior design for homes and offices.',
    services: [
      { name: 'Interior Consultation', price: 1999, desc: 'On-site design visit' },
      { name: 'Modular Kitchen', price: 149999, desc: 'Design + install' },
      { name: 'Office Fit-out (sq ft)', price: 1200, desc: 'Turnkey rate' },
    ],
    testimonials: [
      { name: 'Ananya I.', text: 'Our kitchen turned out exactly like the 3D plan.' },
      { name: 'Imran K.', text: 'On time and on budget. Rare and appreciated.' },
    ],
  },
  events: {
    business: 'Celebration Co.',
    tagline: 'Moments made memorable',
    about: 'End-to-end planning for weddings, birthdays and corporate events.',
    services: [
      { name: 'Birthday Package', price: 24999, desc: 'Decor + cake + host' },
      { name: 'Wedding Planning', price: 199999, desc: 'Full-service' },
      { name: 'Corporate Event', price: 74999, desc: 'Venue + AV + catering' },
    ],
    testimonials: [
      { name: 'Priya S.', text: 'They handled every detail of our wedding beautifully.' },
      { name: 'Vikram S.', text: 'Our product launch went off without a hitch.' },
    ],
  },
  finance: {
    business: 'SecureWealth Advisors',
    tagline: 'Plan today, prosper tomorrow',
    about: 'Insurance, mutual funds and tax planning tailored to your goals.',
    services: [
      { name: 'Financial Health Check', price: 999, desc: '60-min review' },
      { name: 'Tax Filing (Individual)', price: 1499, desc: 'ITR + advisory' },
      { name: 'Investment Plan', price: 2999, desc: 'Goal-based portfolio' },
    ],
    testimonials: [
      { name: 'Rahul V.', text: 'Saved a lot on tax with their guidance.' },
      { name: 'Fatima S.', text: 'Clear advice, no jargon. Trustworthy.' },
    ],
  },
  automobile: {
    business: 'AutoCare Motors',
    tagline: 'Your car, our care',
    about: 'Sales, service and genuine spares for all major car brands.',
    services: [
      { name: 'General Service', price: 2999, desc: 'Oil + 20-point check' },
      { name: 'AC Service', price: 1999, desc: 'Gas + filter' },
      { name: 'Insurance Renewal', price: 0, desc: 'Free assistance' },
    ],
    testimonials: [
      { name: 'Imran K.', text: 'Pickup, service and drop — super convenient.' },
      { name: 'Deepa N.', text: 'Fair pricing and honest recommendations.' },
    ],
  },
  logistics: {
    business: 'SwiftMove Logistics',
    tagline: 'Delivered right, every time',
    about: 'Packers, movers and fleet services for homes and businesses.',
    services: [
      { name: 'Home Shifting (local)', price: 7999, desc: '2BHK within city' },
      { name: 'Inter-city Transport', price: 18999, desc: 'Door to door' },
      { name: 'Fleet on Contract (day)', price: 4999, desc: 'Per vehicle' },
    ],
    testimonials: [
      { name: 'Ananya I.', text: 'Not a single scratch on our furniture. Impressed.' },
      { name: 'Vikram S.', text: 'Reliable fleet for our daily dispatches.' },
    ],
  },
  diagnostics: {
    business: 'PrecisionLab Diagnostics',
    tagline: 'Accurate results, faster',
    about: 'Home sample collection and a full range of pathology tests.',
    services: [
      { name: 'Complete Blood Count', price: 299, desc: 'Home collection' },
      { name: 'Diabetes Panel', price: 699, desc: 'HbA1c + fasting' },
      { name: 'Full Body Package', price: 1999, desc: '70+ tests' },
    ],
    testimonials: [
      { name: 'Priya S.', text: 'Reports on WhatsApp within hours. Brilliant.' },
      { name: 'Rahul V.', text: 'Phlebotomist was professional and on time.' },
    ],
  },
  photography: {
    business: 'Frame Story Studio',
    tagline: 'Your moments, beautifully told',
    about: 'Weddings, portraits and product shoots with a creative team.',
    services: [
      { name: 'Portrait Session', price: 4999, desc: '1-hour studio shoot' },
      { name: 'Wedding Coverage', price: 89999, desc: 'Photo + cinematic film' },
      { name: 'Product Shoot (10)', price: 5999, desc: '10 catalog images' },
    ],
    testimonials: [
      { name: 'Sneha R.', text: 'Our wedding album is a work of art.' },
      { name: 'Imran K.', text: 'Product photos boosted our online sales.' },
    ],
  },
  professional: {
    business: 'Sharma & Associates',
    tagline: 'Trusted professional services',
    about: 'CA, legal and compliance services for individuals and businesses.',
    services: [
      { name: 'Company Registration', price: 6999, desc: 'Pvt Ltd, end-to-end' },
      { name: 'GST Filing (monthly)', price: 999, desc: 'Returns + advisory' },
      { name: 'Annual Compliance', price: 14999, desc: 'ROC + accounts' },
    ],
    testimonials: [
      { name: 'Vikram S.', text: 'Registered my startup in a week. Painless.' },
      { name: 'Fatima S.', text: 'Reliable for all our monthly compliance.' },
    ],
  },
  agriculture: {
    business: 'GreenField Agro',
    tagline: 'Growing prosperity, together',
    about: 'Seeds, inputs and advisory to help farmers get better yields.',
    services: [
      { name: 'Seed Pack (per acre)', price: 1899, desc: 'High-yield hybrid' },
      { name: 'Soil Testing', price: 499, desc: 'Full nutrient report' },
      { name: 'Crop Advisory (season)', price: 999, desc: 'Expert guidance' },
    ],
    testimonials: [
      { name: 'Ravi K.', text: 'Soil report changed how I fertilise. Better yield.' },
      { name: 'Deepa N.', text: 'Good seeds and timely advice every season.' },
    ],
  },
  coaching: {
    business: 'PeakMinds Coaching',
    tagline: 'Unlock your potential',
    about: 'Personalised tuition and skill coaching, online and offline.',
    services: [
      { name: 'One-on-one Tuition (month)', price: 3999, desc: 'Any subject' },
      { name: 'Group Batch (month)', price: 1999, desc: 'Small batches' },
      { name: 'Career Counselling', price: 1499, desc: '90-min session' },
    ],
    testimonials: [
      { name: 'Priya S.', text: 'The one-on-one plan worked wonders for my son.' },
      { name: 'Rahul V.', text: 'Career counselling gave real clarity.' },
    ],
  },
  technology: {
    business: 'NextByte Solutions',
    tagline: 'Software that moves your business',
    about: 'Websites, apps and IT support for growing businesses.',
    services: [
      { name: 'Business Website', price: 24999, desc: '5-page responsive site' },
      { name: 'Mobile App (MVP)', price: 149999, desc: 'iOS + Android' },
      { name: 'AMC (monthly)', price: 4999, desc: 'Support + updates' },
    ],
    testimonials: [
      { name: 'Imran K.', text: 'Our new site doubled enquiries in a month.' },
      { name: 'Ananya I.', text: 'Responsive support and clean code.' },
    ],
  },
};

// ── Multi-section site metadata (Phase 4 dispatch) ─────────────────────────
// Per-industry section labels for the multi-section demo site. Keyed by the
// DomainApp config key (clinic/salon/gym — canonical aliases resolve to these).
// Sections are assembled in demo.service.buildSections() from this + DEMO_CONTENT.
export interface SectionMeta {
  catalogLabel: string;       // Menu / Tour Packages / Services / Products …
  bookingLabel?: string;      // Appointments / Reservations / Book a Trip …
  teamLabel?: string;         // "Our Doctors" — omit where a team doesn't fit
  teamRole?: string;          // Doctor / Stylist / Trainer …
}

export const SECTION_META: Record<string, SectionMeta> = {
  travel: { catalogLabel: 'Tour Packages', bookingLabel: 'Book a Trip' },
  restaurant: { catalogLabel: 'Menu', bookingLabel: 'Reservations' },
  clinic: { catalogLabel: 'Services', bookingLabel: 'Appointments', teamLabel: 'Our Doctors', teamRole: 'Doctor' },
  hotel: { catalogLabel: 'Rooms & Halls', bookingLabel: 'Reservations' },
  salon: { catalogLabel: 'Services', bookingLabel: 'Appointments', teamLabel: 'Our Stylists', teamRole: 'Stylist' },
  gym: { catalogLabel: 'Memberships', bookingLabel: 'Book a Session', teamLabel: 'Our Trainers', teamRole: 'Trainer' },
  realestate: { catalogLabel: 'Listings', bookingLabel: 'Book a Visit', teamLabel: 'Our Agents', teamRole: 'Agent' },
  education: { catalogLabel: 'Courses', bookingLabel: 'Enrol Now', teamLabel: 'Our Faculty', teamRole: 'Teacher' },
  retail: { catalogLabel: 'Products', bookingLabel: 'Enquire' },
  construction: { catalogLabel: 'Services', bookingLabel: 'Get a Quote', teamLabel: 'Our Team', teamRole: 'Engineer' },
  events: { catalogLabel: 'Packages', bookingLabel: 'Book an Event', teamLabel: 'Our Team', teamRole: 'Planner' },
  finance: { catalogLabel: 'Services', bookingLabel: 'Book a Consultation', teamLabel: 'Our Advisors', teamRole: 'Advisor' },
  automobile: { catalogLabel: 'Services', bookingLabel: 'Book a Service' },
  logistics: { catalogLabel: 'Services', bookingLabel: 'Get a Quote' },
  diagnostics: { catalogLabel: 'Tests', bookingLabel: 'Book a Test' },
  photography: { catalogLabel: 'Packages', bookingLabel: 'Book a Shoot', teamLabel: 'Our Photographers', teamRole: 'Photographer' },
  professional: { catalogLabel: 'Services', bookingLabel: 'Book a Consultation', teamLabel: 'Our Team', teamRole: 'Consultant' },
  agriculture: { catalogLabel: 'Products', bookingLabel: 'Enquire' },
  coaching: { catalogLabel: 'Programs', bookingLabel: 'Join a Batch', teamLabel: 'Our Coaches', teamRole: 'Coach' },
  technology: { catalogLabel: 'Services', bookingLabel: 'Get a Quote', teamLabel: 'Our Team', teamRole: 'Engineer' },
  general: { catalogLabel: 'Services', bookingLabel: 'Enquire' },
};

export function getSectionMeta(key: string): SectionMeta {
  return SECTION_META[key] ?? SECTION_META.general;
}

/** Generic content derived from an industry config, for keys not in DEMO_CONTENT. */
export function buildFallback(label: string, catalogPlural: string): DemoContent {
  return {
    business: `${label} Demo Business`,
    tagline: `Quality ${label.toLowerCase()} services you can trust`,
    about: `A sample ${label.toLowerCase()} business showing how Get4Domain manages your ${catalogPlural.toLowerCase()}, customers and invoices in one place.`,
    services: [
      { name: `${catalogPlural} — Standard`, price: 999, desc: 'Popular choice' },
      { name: `${catalogPlural} — Premium`, price: 2999, desc: 'Best value' },
      { name: `${catalogPlural} — Consultation`, price: 499, desc: 'Get started' },
    ],
    testimonials: [
      { name: 'Ravi K.', text: 'Simple to book and always reliable.' },
      { name: 'Priya S.', text: 'Great service and easy WhatsApp updates.' },
    ],
  };
}
