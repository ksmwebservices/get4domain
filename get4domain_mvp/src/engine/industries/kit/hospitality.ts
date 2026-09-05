import type { EngineSiteData } from '../../types';
import type { KitSiteModel, EnquiryTab, BottomNavItem } from '../../kit/model';
import { THEMES } from '../../kit/themes';
import { brandFrom, itemsFrom, IMG } from '../../kit/content';

const nav = (...items: [string, string][]) => items.map(([href, label]) => ({ href, label }));
const bn = (label: string, icon: string, href: string, emphasis = false): BottomNavItem => ({ label, icon, href, emphasis });
const enquire = (label = 'Enquire'): EnquiryTab => ({ key: 'enquiry', label, icon: 'MessageSquare', action: { intent: 'engine.enquiry', label, kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel: 'Send enquiry' });
const bookTab = (label: string, submitLabel: string): EnquiryTab => ({ key: 'book', label, icon: 'CalendarCheck', action: { intent: 'engine.enquiry', label, kind: 'booking' }, fields: ['choice', 'date', 'message'], submitLabel });

/* ── HOTEL — The Grand Retreat (hospitality, §5 style) ── */
export function buildHotel(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'The Grand Retreat', tagline: 'Stay a Little Longer.', about: 'A calm retreat with warm hospitality, thoughtful rooms and food worth travelling for — the kind of stay guests come back to.' });
  const rooms = itemsFrom(site, [
    { title: 'Deluxe Room', subtitle: 'City view', price: '₹4,500 / night', desc: 'King bed, work desk, rain shower.', image: IMG.hotel[1] },
    { title: 'Premier Suite', subtitle: 'Corner', price: '₹7,900 / night', desc: 'Separate living, lounge access.', image: IMG.hotel[2] },
    { title: 'Garden Villa', subtitle: 'Private', price: '₹12,500 / night', desc: 'Plunge pool and private deck.', image: IMG.hotel[3] },
  ]);
  return {
    brand: b, theme: THEMES.hotel, choices: ['Deluxe Room', 'Premier Suite', 'Garden Villa'], choiceLabel: 'Room type',
    nav: nav(['#rooms', 'Rooms'], ['#amenities', 'Amenities'], ['#gallery', 'Gallery'], ['#location', 'Location']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Rooms', 'building', '#rooms'), bn('Book', 'book', '#enquiry', true), bn('Amenities', 'services', '#amenities'), bn('More', 'more', '#gallery')],
    primaryCta: { intent: 'engine.enquiry', label: 'Check Availability', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Now taking bookings', headline: b.tagline, subline: b.about, highlight: 'Best-rate direct · Free cancellation · Complimentary breakfast', image: IMG.hotel[0],
        ctaPrimary: { label: 'Check Availability', href: '#enquiry' }, ctaSecondary: { label: 'View Rooms', href: '#rooms' } },
      { type: 'showcase', id: 'rooms', variant: 'rows', eyebrow: 'Stay', title: 'Rooms & suites', sub: 'Every room is quiet, spacious and beautifully kept.', items: rooms },
      { type: 'iconGrid', id: 'amenities', eyebrow: 'Amenities', title: 'Everything for a perfect stay', items: [
        { label: 'Swimming pool', icon: 'Waves' }, { label: 'Multi-cuisine dining', icon: 'Utensils' }, { label: 'Spa & wellness', icon: 'Flower2' },
        { label: 'Free high-speed Wi-Fi', icon: 'Wifi' }, { label: 'Airport transfers', icon: 'Car' }, { label: 'Concierge', icon: 'ConciergeBell' },
        { label: '24×7 room service', icon: 'Clock' }, { label: 'Banquet & events', icon: 'Drama' },
      ] },
      { type: 'gallery', id: 'gallery', eyebrow: 'The property', title: 'A look around', images: IMG.hotel },
      { type: 'rows', id: 'location', eyebrow: 'Location', title: 'Perfectly placed', note: 'Close to everything that matters, away from the noise.', items: [
        { label: 'City centre', value: '10 min' }, { label: 'Airport', value: '25 min' }, { label: 'Beach', value: '5 min' }, { label: 'Convention centre', value: '15 min' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Guests', title: 'Rated for hospitality', items: [
        { quote: 'The staff remembered our anniversary and surprised us. Unforgettable.', author: 'Guest, Mumbai' },
        { quote: 'Spotless rooms and the best breakfast spread we\'ve had.', author: 'Guest, Delhi' },
        { quote: 'Direct booking was cheaper and cancellation was truly free.', author: 'Guest, Pune' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Reserve', title: 'Check availability', sub: 'Tell us your dates and room — we\'ll confirm and hold the best rate.', points: ['Best-rate direct', 'Free cancellation', 'Instant confirmation'], tabs: [bookTab('Book a room', 'Check dates'), enquire('Ask about a stay')] },
    ],
  };
}

/* ── EVENTS & PLANNING — Celebrate Events (§25) ── */
export function buildEvents(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'Celebrate Events', tagline: 'Occasions Worth Remembering.', about: 'Full-service event planning and venues — weddings, celebrations and corporate days handled end-to-end, beautifully.' });
  const packages = itemsFrom(site, [
    { title: 'Weddings', subtitle: 'Signature', desc: 'Décor, catering, coordination — turnkey.', image: IMG.events[0] },
    { title: 'Corporate Events', desc: 'Conferences, offsites and launches.', image: IMG.events[1] },
    { title: 'Private Celebrations', desc: 'Birthdays, anniversaries, receptions.', image: IMG.events[3] },
  ]);
  return {
    brand: b, theme: THEMES.events, choices: ['Wedding', 'Corporate', 'Private party', 'Venue only'], choiceLabel: 'Occasion',
    nav: nav(['#services', 'Services'], ['#gallery', 'Gallery'], ['#how', 'Process'], ['#reviews', 'Clients']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Services', 'services', '#services'), bn('Gallery', 'gallery', '#gallery'), bn('Enquiry', 'enquiry', '#enquiry', true), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Enquire Now', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'panel', eyebrow: 'Now booking 2026', headline: b.tagline, subline: b.about, image: IMG.events[0],
        ctaPrimary: { label: 'Enquire Now', href: '#enquiry' }, ctaSecondary: { label: 'View Gallery', href: '#gallery' } },
      { type: 'showcase', id: 'services', variant: 'cards', eyebrow: 'What we do', title: 'Events we create', items: packages },
      { type: 'gallery', id: 'gallery', eyebrow: 'Portfolio', title: 'Moments we\'ve made', images: IMG.events },
      { type: 'steps', id: 'how', eyebrow: 'Process', title: 'From idea to standing ovation', items: [
        { title: 'Consult', desc: 'Vision, date and budget.' }, { title: 'Design', desc: 'Concept, décor and plan.' },
        { title: 'Coordinate', desc: 'Vendors and timeline.' }, { title: 'Celebrate', desc: 'You enjoy; we run it.' },
      ] },
      { type: 'stats', items: [{ value: '600+', label: 'Events delivered' }, { value: '4.9★', label: 'Client rating' }, { value: '50+', label: 'Vendor partners' }, { value: '12 yrs', label: 'Experience' }] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Clients', title: 'They trusted us with the big day', items: [
        { quote: 'Our wedding was flawless — every detail handled so we could just enjoy it.', author: 'Riya & Sameer' },
        { quote: 'Ran our 300-person conference without a single hitch.', author: 'HR Head' },
        { quote: 'The décor took everyone\'s breath away.', author: 'Anniversary host' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Enquire', title: 'Book a consultation', sub: 'Share the occasion and date — we\'ll check availability and send ideas.', points: ['Turnkey planning', 'Trusted vendors', 'Every budget'], tabs: [enquire('Enquire Now'), bookTab('Book a consultation', 'Request consultation')] },
    ],
  };
}

/* ── TRAVEL & TOURS — WanderWell Travel (§5 style) ── */
export function buildTravel(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'WanderWell Travel', tagline: 'Go Somewhere Wonderful.', about: 'Handcrafted holidays and hassle-free travel — curated itineraries, honest pricing and support that stays with you the whole trip.' });
  const packages = itemsFrom(site, [
    { title: 'Bali Escape', subtitle: '6 nights', price: 'from ₹62,000', desc: 'Beaches, temples and villas.', image: IMG.travel[0] },
    { title: 'Kerala Backwaters', subtitle: '5 nights', price: 'from ₹28,000', desc: 'Houseboats and hill stations.', image: IMG.travel[1] },
    { title: 'Europe Highlights', subtitle: '9 nights', price: 'from ₹1,65,000', desc: 'Three countries, one seamless trip.', image: IMG.travel[2] },
    { title: 'Dubai Getaway', subtitle: '4 nights', price: 'from ₹48,000', desc: 'City, desert and dining.', image: IMG.travel[3] },
  ]);
  return {
    brand: b, theme: THEMES.travel, choices: ['Domestic', 'International', 'Honeymoon', 'Group'], choiceLabel: 'Trip type',
    nav: nav(['#packages', 'Packages'], ['#why', 'Why us'], ['#how', 'How it works'], ['#reviews', 'Travellers']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Packages', 'grid', '#packages'), bn('Enquiry', 'enquiry', '#enquiry', true), bn('Contact', 'contact', '#enquiry'), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Plan My Trip', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Trips that just work', headline: b.tagline, subline: b.about, highlight: 'Custom itineraries · Best prices · 24×7 on-trip support', image: IMG.travel[0],
        ctaPrimary: { label: 'Plan My Trip', href: '#enquiry' }, ctaSecondary: { label: 'View Packages', href: '#packages' } },
      { type: 'showcase', id: 'packages', variant: 'cards', eyebrow: 'Popular', title: 'Holiday packages', sub: 'Fully customisable — these are just starting points.', items: packages },
      { type: 'iconGrid', id: 'why', eyebrow: 'Why us', title: 'Travel without the stress', items: [
        { label: 'Handcrafted itineraries', icon: 'MapPin' }, { label: 'Best-price promise', icon: 'Percent' }, { label: 'Visa assistance', icon: 'ShieldCheck' },
        { label: '24×7 on-trip support', icon: 'Phone' }, { label: 'Trusted stays', icon: 'Bed' }, { label: 'Flexible payments', icon: 'Gift' },
      ] },
      { type: 'steps', id: 'how', eyebrow: 'Simple', title: 'From dream to departure', items: [
        { title: 'Tell us', desc: 'Where, when, budget.' }, { title: 'We plan', desc: 'A tailored itinerary.' },
        { title: 'Book', desc: 'Flights, stays, visas.' }, { title: 'Travel', desc: 'We\'re a call away.' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Travellers', title: 'Happy travellers', items: [
        { quote: 'Every detail was sorted. We just showed up and enjoyed.', author: 'The Sharmas' },
        { quote: 'They rebooked a missed connection within minutes. Real support.', author: 'Aditi' },
        { quote: 'Honeymoon of our dreams, and under budget.', author: 'Rahul & Neha' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Start', title: 'Plan my trip', sub: 'Tell us where you\'d like to go — we\'ll send a custom itinerary and quote.', points: ['Custom itineraries', 'Best-price promise', '24×7 support'], tabs: [enquire('Plan My Trip'), bookTab('Talk to an expert', 'Book a call')] },
    ],
  };
}
