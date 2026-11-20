// P11: more fake vendors for the design kit: Free and Pro sites of different packs (industries that have no bespoke engine design, so the generic kit draws the Pro ones).
// Same answer shape as fake-backend-p9.mjs. Local only (127.0.0.1). Usage: import { startFakeBackend, SITES } from './fake-backend-p11.mjs'.
import { SITES, PLUMBERBOY, startFakeBackend } from './fake-backend-p9.mjs';

const prod = (name, description, price, image) => ({ id: `p-${name}`, name, description, price, image, category: null, customFields: null });
const site = (sub, businessName, industry, plan, cms, products) => ({
  ...PLUMBERBOY, vendor: { id: `v-${sub}`, businessName, industry, subdomain: sub },
  cms: { ...PLUMBERBOY.cms, businessName, tagline: null, about: null, phone: null, banner: '/starter/generic/hero.svg', testimonials: [], ...cms }, plan, docV2: false, products,
});
const img = (folder, n) => `/starter/${folder}/g${n}.webp`;

// the live Free case, with the flaws of the old page: an "Opening hours" placeholder and a business with a real address
SITES.plumberboy = { ...PLUMBERBOY, cms: { ...PLUMBERBOY.cms, address: '12 Lake Road, Chennai', hours: 'Opening hours', tagline: 'Quick plumbing repairs at your door.' } };

SITES['spice-route'] = site('spice-route', 'Spice Route Kitchen', 'Restaurant', 'FREE', { tagline: 'Home-style South Indian food, cooked fresh every day.', about: 'We cook the way it is done at home: small batches, fresh masala and no shortcuts. Come for lunch, stay for the filter coffee.', phone: '+91 90000 11111', address: '4 Temple Street, Madurai', hours: 'Mon to Sun: 11 am to 10 pm', email: 'owner@spice.example', whatsapp: '919000011111' },
  [prod('Meals', 'Rice, sambar, rasam and three curries', null, img('restaurant', 1)), prod('Biryani', 'Slow-cooked with whole spices', null, img('restaurant', 2)), prod('Dosa and idli', 'Crisp, soft and hot', null, img('restaurant', 3)), prod('Filter coffee', 'Strong and sweet', null, img('restaurant', 4))]);
SITES['lens-and-light'] = site('lens-and-light', 'Lens and Light Studio', 'Photography', 'FREE', { tagline: 'Weddings, portraits and products, photographed with care.', about: 'A small studio that treats every shoot as a story. We deliver edited pictures within two weeks.', phone: '+91 90000 22222', address: '9 Gandhi Road, Coimbatore', hours: 'Tue to Sun: 10 am to 7 pm' },
  [prod('Wedding stories', 'Two photographers, full day', null, img('photography', 1)), prod('Portraits', 'Studio or outdoors', null, img('photography', 2)), prod('Product shoots', 'Clean white or styled', null, img('photography', 3)), prod('Events', 'Birthdays and receptions', null, img('photography', 4))]);
SITES['lakeview-homes'] = site('lakeview-homes', 'Lakeview Homes', 'Real estate', 'FREE', { tagline: 'Plots and apartments near the lake.', about: 'We help families find a home that fits the budget, and explain every paper in plain words.', phone: '+91 90000 33333', address: '21 Lake Road, Hyderabad', hours: 'Mon to Sat: 9 am to 6 pm' },
  [prod('2 BHK apartments', 'Ready to move, near the lake', '₹ 58 lakh', img('realestate', 1)), prod('Plots', 'Gated layout, clear title', '₹ 22 lakh', img('realestate', 2)), prod('Villas', 'Three bedrooms with garden', '₹ 1.2 crore', img('realestate', 3)), prod('Rentals', 'Furnished and unfurnished', null, img('realestate', 4))]);
SITES['homefix-pro'] = site('homefix-pro', 'HomeFix Services', 'homeservices', 'PRO', { tagline: 'Plumbing, electrical and cleaning for your home.', about: 'Trained technicians, fixed visit charges and a warranty on every job.', phone: '+91 90000 44444', whatsapp: '919000044444', email: 'help@homefix.example', address: '5 Market Road, Pune', hours: 'Every day: 8 am to 8 pm',
  testimonials: [{ quote: 'They arrived on time and fixed the leak in an hour.', author: 'Anita R.' }, { quote: 'Fair price and tidy work.', author: 'Suresh K.' }], faqs: [{ q: 'Do you charge for a visit?', a: 'The visit charge is adjusted in the final bill.' }, { q: 'Which areas do you serve?', a: 'All of Pune and nearby areas.' }] },
  [prod('Tap and pipe repair', 'Leaks fixed the same day', '₹ 399', img('home-services', 1)), prod('Fan and light fitting', 'New or repair', '₹ 249', img('home-services', 2)), prod('Deep cleaning', 'Kitchen and bathroom', '₹ 1,499', img('home-services', 3)), prod('Water tank cleaning', 'Overhead and sump', '₹ 799', img('home-services', 4))]);
SITES['studio-nine'] = site('studio-nine', 'Studio Nine Interiors', 'interior', 'PRO', { tagline: 'Interiors that feel like you.', about: 'Space planning, modular kitchens and wardrobes, delivered on the agreed date.', phone: '+91 90000 55555', email: 'hello@studionine.example', address: '31 Residency Road, Bengaluru', hours: 'Mon to Sat: 10 am to 6 pm' },
  [prod('Modular kitchens', 'Designed around how you cook', null, img('construction', 1)), prod('Wardrobes', 'Floor to ceiling storage', null, img('construction', 2)), prod('Living rooms', 'Furniture and lighting', null, img('construction', 3)), prod('Full homes', 'One team from plan to handover', null, img('construction', 4))]);
SITES['paws-and-care'] = site('paws-and-care', 'Paws and Care', 'petcare', 'PRO', { tagline: 'Grooming, check-ups and boarding for pets.', about: 'A gentle clinic and grooming parlour for dogs and cats.', phone: '+91 90000 66666', whatsapp: '919000066666', address: '8 Park Lane, Kochi', hours: 'Mon to Sat: 9 am to 7 pm' },
  [prod('Grooming', 'Bath, trim and nails', '₹ 700', null), prod('Check-up', 'With a vet', '₹ 400', null), prod('Boarding', 'Per day, with walks', '₹ 500', null)]);

export { SITES, startFakeBackend };
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\/]/).pop())) { await startFakeBackend(Number(process.argv[2] ?? 3199)); console.log('fake backend (p11) listening'); }
