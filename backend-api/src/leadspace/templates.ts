import { EventType } from './leadspace.types';

/**
 * The industry template catalogue. One entry per trade in CATEGORIES (leadspace.types.ts). A template does not hold a page: it holds the words, trust items,
 * questions, form hints and colours the page builder fills from the vendor's company details. Everything is plain data so an admin screen can edit it later.
 */
export interface PageTheme { accent: string; accentDark: string; soft: string; ink: string }

export interface TemplateDef {
  id: string;
  theme: PageTheme;
  /** `{business}` and `{city}` are replaced. */
  headline: string;
  subline: string;
  cta: Record<EventType, string>;
  trust: string[];
  faqs: { q: string; a: string }[];
  starterServices: string[];
  /** booking and appointment pages offer these slots */
  slots: string[];
  messageHint: string;
  /** shown in a visible box on the page (regulated trades) */
  disclaimer?: string;
  /** words that may never appear in generated or typed text for this trade */
  forbiddenClaims?: string[];
  keywords: string[];
}

const SLOTS_DAY = ['9 am - 12 pm', '12 pm - 3 pm', '3 pm - 6 pm', '6 pm - 8 pm'];
const BASE_CTA: Record<EventType, string> = { ENQUIRY: 'Get a call back', BOOKING: 'Book now', APPOINTMENT: 'Book an appointment', SITE_VISIT: 'Book a site visit', CART_ORDER: 'Place an order' };

const T = (t: Omit<TemplateDef, 'cta'> & { cta?: Partial<Record<EventType, string>> }): TemplateDef => ({ ...t, cta: { ...BASE_CTA, ...(t.cta ?? {}) } });

export const TEMPLATES: Record<string, TemplateDef> = {
  'home-services': T({
    id: 'home-services', theme: { accent: '#d97706', accentDark: '#92400e', soft: '#fffbeb', ink: '#1f2937' },
    headline: 'Trusted home services in {city}', subline: '{business} sends a verified professional to your door. Tell us what needs fixing and pick a time that suits you.',
    cta: { BOOKING: 'Book a visit' },
    trust: ['Background-checked professionals', 'Clear price before work starts', 'Work done on time', 'Help after the job'],
    faqs: [
      { q: 'How soon can someone come?', a: 'Pick a day and time slot when you book. We confirm by phone.' },
      { q: 'Do I pay before the visit?', a: 'No. You agree the price with the professional before work starts.' },
      { q: 'Which areas do you serve?', a: 'See the service area on this page. If you are close by, send a request and we will tell you.' },
    ],
    starterServices: ['Plumbing repair', 'Electrical repair', 'Deep cleaning', 'Painting', 'Carpentry', 'AC service'], slots: SLOTS_DAY, messageHint: 'What needs fixing?',
    keywords: ['plumber', 'electrician', 'home repair', 'handyman'],
  }),
  'builders-interiors': T({
    id: 'builders-interiors', theme: { accent: '#0f766e', accentDark: '#115e59', soft: '#f0fdfa', ink: '#1f2937' },
    headline: 'Building and interiors in {city}', subline: '{business} plans, builds and finishes homes and offices. See our work on site and get a clear quote.',
    cta: { SITE_VISIT: 'Book a free site visit' },
    trust: ['Written quote before work', 'Site supervision', 'Fixed timeline', 'Warranty on workmanship'],
    faqs: [
      { q: 'Is the site visit free?', a: 'Ask the business when you book. The page will confirm the terms.' },
      { q: 'Do you give a written quote?', a: 'Yes. Quotes list materials, labour and timeline so there are no surprises.' },
      { q: 'Can I see past work?', a: 'See the gallery on this page, or ask to visit a finished site.' },
    ],
    starterServices: ['Home construction', 'Renovation', 'Modular kitchen', 'Full home interiors', 'Office interiors', 'False ceiling'], slots: SLOTS_DAY, messageHint: 'Tell us about your site and what you want built.',
    keywords: ['builder', 'interior designer', 'renovation', 'contractor'],
  }),
  'real-estate': T({
    id: 'real-estate', theme: { accent: '#1d4ed8', accentDark: '#1e3a8a', soft: '#eff6ff', ink: '#111827' },
    headline: 'Find your property in {city}', subline: '{business} shows verified listings in {city}. Pick a project and book a site visit at a time that suits you.',
    cta: { SITE_VISIT: 'Book a site visit' },
    trust: ['RERA registered where required', 'Verified listings', 'Site visits arranged for you', 'Help with paperwork'],
    faqs: [
      { q: 'Is the property RERA registered?', a: 'The RERA number of each project is shown on this page. Ask if you cannot see it.' },
      { q: 'Is there a charge to visit?', a: 'No. Booking a visit does not commit you to anything.' },
      { q: 'Can you help with a home loan?', a: 'We can guide you to banks. Loan approval is the bank\'s decision.' },
    ],
    starterServices: ['Apartments', 'Villas', 'Plots', 'Rentals', 'Commercial space'], slots: SLOTS_DAY, messageHint: 'Which area, budget and type are you looking for?',
    disclaimer: 'Property details can change. Check the RERA registration and visit the site before you decide.', keywords: ['real estate', 'flats', 'plots', 'villas'],
  }),
  freelancer: T({
    id: 'freelancer', theme: { accent: '#7c3aed', accentDark: '#5b21b6', soft: '#f5f3ff', ink: '#1f2937' },
    headline: '{business}, a professional you can rely on', subline: 'Based in {city}. Send a short brief and get a reply with a clear scope and price.',
    cta: { ENQUIRY: 'Send your brief' },
    trust: ['Clear scope and price', 'Work delivered on a date', 'Revisions included', 'Direct contact with the person doing the work'],
    faqs: [
      { q: 'How do you price work?', a: 'After reading your brief you get a fixed price or an hourly estimate in writing.' },
      { q: 'How long does a project take?', a: 'It depends on the scope. You get a delivery date before you commit.' },
      { q: 'Do you sign an agreement?', a: 'Yes, for larger projects. Ask when you send your brief.' },
    ],
    starterServices: ['Design', 'Writing', 'Development', 'Accounting', 'Consulting'], slots: SLOTS_DAY, messageHint: 'Describe the work, the deadline and your budget.',
    keywords: ['freelancer', 'consultant', 'designer', 'developer'],
  }),
  startup: T({
    id: 'startup', theme: { accent: '#e11d48', accentDark: '#9f1239', soft: '#fff1f2', ink: '#111827' },
    headline: '{business}: a new way to get it done in {city}', subline: 'We are early and listening. Tell us what you need and the founders will reply personally.',
    cta: { ENQUIRY: 'Talk to us' },
    trust: ['Founders reply personally', 'Early customer pricing', 'We listen and improve fast'],
    faqs: [
      { q: 'What do you do?', a: 'See the services on this page. If you are not sure we fit, ask. We will tell you honestly.' },
      { q: 'Is there an early-customer offer?', a: 'Check the offer on this page.' },
      { q: 'How quickly will I hear back?', a: 'Usually the same day.' },
    ],
    starterServices: ['Our main product', 'Starter plan', 'Custom work'], slots: SLOTS_DAY, messageHint: 'What would you like to know or try?',
    keywords: ['startup', 'new business', 'launch'],
  }),
  'photography-events': T({
    id: 'photography-events', theme: { accent: '#be185d', accentDark: '#831843', soft: '#fdf2f8', ink: '#1f2937' },
    headline: 'Photos and events done right in {city}', subline: '{business} captures and plans your day. Check the dates and send your details for a quote.',
    cta: { ENQUIRY: 'Check my date' },
    trust: ['See full albums before you book', 'Dates held for you', 'Delivery on a promised date', 'Backup equipment at every event'],
    faqs: [
      { q: 'Is my date available?', a: 'Send your date and place. We reply with availability and a quote.' },
      { q: 'How soon do I get the photos?', a: 'Delivery time is shown in your quote.' },
      { q: 'Do you travel?', a: 'Yes, within and beyond {city}. Travel costs are in the quote.' },
    ],
    starterServices: ['Wedding photography', 'Pre-wedding shoot', 'Birthday and events', 'Event planning', 'Decor'], slots: SLOTS_DAY, messageHint: 'Date, place and kind of event?',
    keywords: ['wedding photographer', 'event planner', 'photoshoot'],
  }),
  tutor: T({
    id: 'tutor', theme: { accent: '#0369a1', accentDark: '#075985', soft: '#f0f9ff', ink: '#0f172a' },
    headline: 'Learn with {business} in {city}', subline: 'Book a demo class and see if it is right for you before you decide.',
    cta: { BOOKING: 'Book a demo class' },
    trust: ['Demo class first', 'Small batches', 'Regular progress reports', 'Experienced teachers'],
    faqs: [
      { q: 'Is the demo class free?', a: 'Check the offer on this page. The business confirms when you book.' },
      { q: 'What are the batch timings?', a: 'Pick a slot when you book. Other timings can be arranged.' },
      { q: 'Online or at the centre?', a: 'Both may be offered. Mention your choice in the booking.' },
    ],
    starterServices: ['School subjects', 'Exam coaching', 'Music', 'Languages', 'Skill courses'], slots: ['7 am - 9 am', '4 pm - 6 pm', '6 pm - 8 pm', '8 pm - 9 pm'], messageHint: 'Which class or subject?',
    keywords: ['tuition', 'coaching', 'classes'],
  }),
  'salon-beauty': T({
    id: 'salon-beauty', theme: { accent: '#c026d3', accentDark: '#86198f', soft: '#fdf4ff', ink: '#1f2937' },
    headline: 'Look and feel your best in {city}', subline: '{business} offers hair, skin and beauty services by trained professionals. Book your slot in a minute.',
    cta: { APPOINTMENT: 'Book my slot' },
    trust: ['Trained professionals', 'Clean, sanitised tools', 'Quality products', 'Prices shown up front'],
    faqs: [
      { q: 'Do I need to book?', a: 'Booking guarantees your time. Walk-ins depend on the day.' },
      { q: 'Can I change my slot?', a: 'Yes. Tell the salon at least a few hours ahead.' },
      { q: 'Do you do bridal packages?', a: 'Ask for the bridal package when you book.' },
    ],
    starterServices: ['Haircut and styling', 'Facial', 'Bridal makeup', 'Hair colour', 'Spa', 'Manicure and pedicure'], slots: ['10 am - 12 pm', '12 pm - 2 pm', '2 pm - 5 pm', '5 pm - 8 pm'], messageHint: 'Which service would you like?',
    keywords: ['salon', 'beauty parlour', 'bridal makeup', 'spa'],
  }),
  'shop-retail': T({
    id: 'shop-retail', theme: { accent: '#16a34a', accentDark: '#166534', soft: '#f0fdf4', ink: '#14532d' },
    headline: 'Shop from {business} in {city}', subline: 'Choose what you want and send your order. {business} confirms it and arranges delivery or pickup.',
    cta: { CART_ORDER: 'Send my order' },
    trust: ['Local shop you can trust', 'Order confirmed by the shop', 'Pay the shop directly', 'Easy returns as the shop allows'],
    faqs: [
      { q: 'Do I pay on this page?', a: 'No. You send an order request. The shop confirms it and tells you how to pay.' },
      { q: 'Is delivery available?', a: 'Add your address. The shop tells you if it can deliver.' },
      { q: 'Can I change my order?', a: 'Yes, until the shop confirms it. Message the shop.' },
    ],
    starterServices: ['Popular item', 'New arrival', 'Gift item'], slots: SLOTS_DAY, messageHint: 'Anything the shop should know about your order?',
    keywords: ['shop', 'store', 'buy online'],
  }),
  'restaurant-food': T({
    id: 'restaurant-food', theme: { accent: '#ea580c', accentDark: '#9a3412', soft: '#fff7ed', ink: '#431407' },
    headline: 'Fresh from {business}, {city}', subline: 'Pick your items, send your order, and {business} confirms the time. Made fresh for you.',
    cta: { CART_ORDER: 'Order now' },
    trust: ['Made fresh', 'Hygiene first', 'On-time delivery or pickup', 'Custom orders welcome'],
    faqs: [
      { q: 'How much notice do you need?', a: 'The business confirms the time when it accepts your order. Cakes and catering need more notice.' },
      { q: 'Do you deliver?', a: 'Add your address. The business tells you if it can deliver.' },
      { q: 'Can I order for an event?', a: 'Yes. Mention the date and number of guests in the notes.' },
    ],
    starterServices: ['Signature dish', 'Cakes', 'Party catering', 'Daily meal box'], slots: SLOTS_DAY, messageHint: 'Date, time and anything special?',
    keywords: ['bakery', 'catering', 'cloud kitchen', 'tiffin'],
  }),
  advocate: T({
    id: 'advocate', theme: { accent: '#334155', accentDark: '#0f172a', soft: '#f8fafc', ink: '#0f172a' },
    headline: 'Legal information from {business}, {city}', subline: 'General information about the areas of law this office handles. Send an enquiry and the office will reply.',
    cta: { ENQUIRY: 'Send an enquiry' },
    trust: ['Enrolled with the Bar Council', 'Your enquiry is private', 'Fees explained in writing'],
    faqs: [
      { q: 'Is this legal advice?', a: 'No. This page gives general information only. Advice is given after the office has understood your matter.' },
      { q: 'Is my enquiry confidential?', a: 'Your enquiry goes only to the office. It is not published.' },
      { q: 'How do fees work?', a: 'The office explains fees in writing before it takes up a matter.' },
    ],
    starterServices: ['Civil matters', 'Property matters', 'Family matters', 'Company and contracts'], slots: SLOTS_DAY, messageHint: 'Describe your matter briefly. Do not include confidential documents here.',
    disclaimer: 'This page is for information only. It is not an advertisement or solicitation and does not create an advocate-client relationship. Rules of the Bar Council of India apply.',
    forbiddenClaims: ['best lawyer', 'guaranteed', 'win your case', 'no. 1', 'number one', 'specialist in winning', 'expert in all'], keywords: ['advocate', 'legal information'],
  }),
  clinic: T({
    id: 'clinic', theme: { accent: '#0d9488', accentDark: '#115e59', soft: '#f0fdfa', ink: '#134e4a' },
    headline: '{business}, {city}', subline: 'Information about the clinic, its timings and the services it offers. Request an appointment and the clinic will confirm.',
    cta: { APPOINTMENT: 'Request an appointment' },
    trust: ['Qualified doctors', 'Hygienic clinic', 'Appointment confirmed by the clinic'],
    faqs: [
      { q: 'Is my appointment confirmed right away?', a: 'The clinic confirms by phone or WhatsApp after you send the request.' },
      { q: 'What do I bring?', a: 'Bring earlier reports and a list of medicines you take.' },
      { q: 'Is this for emergencies?', a: 'No. In an emergency go to the nearest hospital or call 108.' },
    ],
    starterServices: ['General consultation', 'Follow-up visit', 'Health check'], slots: ['9 am - 12 pm', '12 pm - 2 pm', '4 pm - 6 pm', '6 pm - 8 pm'], messageHint: 'What would you like to see the doctor about?',
    disclaimer: 'This page gives general information about the clinic. It is not medical advice. In an emergency, call 108 or go to the nearest hospital.',
    forbiddenClaims: ['guaranteed cure', '100% cure', 'cure in', 'best doctor', 'no side effects', 'miracle', 'permanent cure', 'instant relief'], keywords: ['clinic', 'doctor', 'appointment'],
  }),
};

export const GENERIC_TEMPLATE: TemplateDef = TEMPLATES.freelancer;

export const templateFor = (categoryId: string): TemplateDef => TEMPLATES[categoryId] ?? GENERIC_TEMPLATE;
