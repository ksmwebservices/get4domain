import type { EngineSiteData } from '../../types';
import type { KitSiteModel, EnquiryTab, BottomNavItem } from '../../kit/model';
import { THEMES } from '../../kit/themes';
import { brandFrom, itemsFrom, IMG } from '../../kit/content';

const nav = (...items: [string, string][]) => items.map(([href, label]) => ({ href, label }));
const bn = (label: string, icon: string, href: string, emphasis = false): BottomNavItem => ({ label, icon, href, emphasis });
const enquire = (label = 'Enquire'): EnquiryTab => ({ key: 'enquiry', label, icon: 'MessageSquare', action: { intent: 'engine.enquiry', label, kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel: 'Send enquiry' });
const orderTab = (label: string, submitLabel: string): EnquiryTab => ({ key: 'order', label, icon: 'Package', action: { intent: 'engine.enquiry', label, kind: 'enquiry' }, fields: ['choice', 'message'], submitLabel });
const bookTab = (label: string, submitLabel: string): EnquiryTab => ({ key: 'book', label, icon: 'CalendarCheck', action: { intent: 'engine.enquiry', label, kind: 'booking' }, fields: ['choice', 'date', 'message'], submitLabel });

/* ── RESTAURANT / CAFE — Urban Spice Restaurant (§13) ── */
export function buildRestaurant(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'Urban Spice Restaurant', tagline: 'Great Food. Easy Ordering.', about: 'A neighbourhood kitchen where the recipes are honest, the produce is fresh and every plate is made to be shared.' });
  const menu = itemsFrom(site, [
    { title: 'Butter Chicken', subtitle: 'Signature', price: '₹320', desc: 'The one everyone comes back for.' },
    { title: 'Paneer Tikka', subtitle: 'Veg', price: '₹280', desc: 'Charred, smoky, tender.' },
    { title: 'Biryani', price: '₹260', desc: 'Long-grain, slow-dum, fragrant.' },
    { title: 'Masala Dosa', price: '₹140', desc: 'Crisp, golden, with chutney trio.' },
  ]);
  return {
    brand: b, theme: THEMES.restaurant, choices: ['Dine-in', 'Takeaway', 'Delivery'], choiceLabel: 'Order type',
    nav: nav(['#menu', 'Menu'], ['#offers', 'Offers'], ['#gallery', 'Gallery'], ['#visit', 'Visit']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Menu', 'menu', '#menu'), bn('Order', 'order', '#enquiry', true), bn('Offers', 'offers', '#offers'), bn('More', 'more', '#visit')],
    primaryCta: { intent: 'engine.enquiry', label: 'Order Now', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Open today · 12–11pm', headline: b.tagline, subline: b.about, highlight: 'Dine-in · Takeaway · Delivery · Table reservations', image: IMG.restaurant[0],
        ctaPrimary: { label: 'View Menu', href: '#menu' }, ctaSecondary: { label: 'Order Now', href: '#enquiry' } },
      { type: 'showcase', id: 'menu', variant: 'menu', eyebrow: 'The menu', title: 'What\'s cooking', sub: 'A taste of the favourites — the full menu is even bigger.', items: menu },
      { type: 'rows', id: 'offers', eyebrow: 'Today\'s offers', title: 'Worth a visit this week', note: 'Dine-in and delivery deals, updated weekly.', items: [
        { label: 'Weekday lunch thali', value: '₹199' }, { label: 'Family combo (serves 4)', value: '₹899' }, { label: 'Free delivery above', value: '₹499' }, { label: 'Happy hours', value: '4–7pm' },
      ] },
      { type: 'featureIndex', id: 'story', eyebrow: 'Our story', title: 'Why people keep coming back', items: [
        { label: 'Fresh daily', blurb: 'Produce sourced every morning.' }, { label: 'Made to order', blurb: 'Nothing sits under a lamp.' },
        { label: 'Family recipes', blurb: 'Three generations in the kitchen.' }, { label: 'Warm service', blurb: 'You\'re a guest, not a table number.' },
      ] },
      { type: 'gallery', id: 'gallery', eyebrow: 'On the table', title: 'Feast your eyes', images: IMG.restaurant },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Regulars', title: 'The reviews are in', items: [
        { quote: 'That biryani is the best in the area. We\'re here weekly.', author: 'Local guide' },
        { quote: 'Delivery arrived hot and exactly on time. Rare these days.', author: 'Meera' },
        { quote: 'Booked a table for 12 — they handled our big group beautifully.', author: 'Karthik' },
      ] },
      { type: 'rows', id: 'visit', eyebrow: 'Find us', title: 'Come hungry', note: 'Walk in, or reserve ahead on weekends.', items: [
        { label: 'Lunch', value: '12 – 3pm' }, { label: 'Dinner', value: '7 – 11pm' }, { label: 'Delivery radius', value: '6 km' }, { label: 'Parking', value: 'Valet' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Order or reserve', title: 'Table or takeaway?', sub: 'Reserve a table or place an order — we\'ll confirm on WhatsApp.', points: ['Instant confirmation', 'Live order updates', 'Group bookings welcome'], tabs: [orderTab('Order food', 'Place order'), bookTab('Reserve a table', 'Reserve table'), enquire('Ask us')] },
    ],
  };
}

/* ── RETAIL — SmartMart Supermarket (§20 grocery default; subs vary via content) ── */
export function buildRetail(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'SmartMart Supermarket', tagline: 'Everything You Need. Shop Online.', about: 'A modern store with a curated range, honest prices and quick delivery — shop in-store or online, your way.' });
  const products = itemsFrom(site, [
    { title: 'Fresh & Grocery', subtitle: 'Daily', desc: 'Fruit, veg and everyday staples.', image: IMG.retail[0] },
    { title: 'Household', subtitle: 'Best sellers', desc: 'Cleaning, kitchen and home care.', image: IMG.retail[1] },
    { title: 'Personal Care', desc: 'Beauty, health and wellness.', image: IMG.retail[2] },
    { title: 'Offers', subtitle: 'Up to 40% off', desc: 'This week\'s biggest savings.', image: IMG.retail[3] },
  ]);
  return {
    brand: b, theme: THEMES.retail, choices: ['Groceries', 'Household', 'Personal care', 'Bulk order'], choiceLabel: 'Interested in',
    nav: nav(['#shop', 'Products'], ['#offers', 'Offers'], ['#why', 'Why us'], ['#visit', 'Visit']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Products', 'products', '#shop'), bn('Cart', 'cart', '#enquiry', true), bn('Offers', 'offers', '#offers'), bn('More', 'more', '#why')],
    primaryCta: { intent: 'engine.enquiry', label: 'Shop Now', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'panel', eyebrow: 'Shop in-store or online', headline: b.tagline, subline: b.about, image: IMG.retail[0],
        ctaPrimary: { label: 'Shop Now', href: '#shop' }, ctaSecondary: { label: 'WhatsApp Us', href: '#enquiry' } },
      { type: 'showcase', id: 'shop', variant: 'cards', eyebrow: 'Shop', title: 'Browse the store', items: products },
      { type: 'featureIndex', id: 'offers', eyebrow: 'This week', title: 'Deals worth grabbing', items: [
        { label: 'Free delivery', blurb: 'On orders above ₹499.' }, { label: 'Bank offers', blurb: '10% off on select cards.' },
        { label: 'Combo packs', blurb: 'Bundle and save more.' }, { label: 'Loyalty points', blurb: 'Earn on every purchase.' },
      ] },
      { type: 'iconGrid', id: 'why', eyebrow: 'Why shop with us', title: 'Made for easy shopping', items: [
        { label: 'Genuine products', icon: 'ShieldCheck' }, { label: 'Fast delivery', icon: 'Truck' }, { label: 'Easy returns', icon: 'Package' },
        { label: 'Secure payments', icon: 'Percent' }, { label: 'In-store pickup', icon: 'Home' }, { label: 'Friendly support', icon: 'Phone' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Shoppers', title: 'What shoppers say', items: [
        { quote: 'Ordered in the morning, delivered by evening. Genuine products too.', author: 'Anita' },
        { quote: 'The offers are unreal. Grabbed three things at a big discount.', author: 'Vivek' },
        { quote: 'Loyalty points actually add up. Been a regular for a year.', author: 'Sana' },
      ] },
      { type: 'rows', id: 'visit', eyebrow: 'Visit', title: 'Find the store', note: 'Open all week; delivery across the city.', items: [
        { label: 'Store hours', value: '10 – 9pm' }, { label: 'Delivery', value: 'Same day' }, { label: 'Returns', value: '7 days' }, { label: 'Parking', value: 'Available' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Order', title: 'Order or enquire', sub: 'Tell us what you\'re after — we\'ll confirm stock, price and delivery.', points: ['Genuine products', 'Same-day delivery', 'Easy returns'], tabs: [orderTab('Place an order', 'Send order'), enquire('Check a product')] },
    ],
  };
}

/* ── AGRICULTURE — GreenHarvest Farms (§26 style) ── */
export function buildAgriculture(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'GreenHarvest Farms', tagline: 'From Our Fields to Your Table.', about: 'Farm-fresh produce and dependable agri-supply — grown responsibly, priced fairly and delivered in bulk or by the basket.' });
  const products = itemsFrom(site, [
    { title: 'Fresh Produce', subtitle: 'Daily harvest', desc: 'Vegetables and fruit, picked at peak.', image: IMG.agriculture[0] },
    { title: 'Grains & Pulses', desc: 'Cleaned, graded, bulk-ready.', image: IMG.agriculture[1] },
    { title: 'Dairy & Organic', desc: 'Fresh milk and organic staples.', image: IMG.agriculture[2] },
    { title: 'Seeds & Inputs', desc: 'Quality seeds, fertiliser and tools.', image: IMG.agriculture[3] },
  ]);
  return {
    brand: b, theme: THEMES.agriculture, choices: ['Fresh produce', 'Grains & pulses', 'Dairy', 'Bulk / wholesale'], choiceLabel: 'Product',
    nav: nav(['#produce', 'Products'], ['#why', 'Why us'], ['#how', 'How to order'], ['#reviews', 'Buyers']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Products', 'products', '#produce'), bn('Enquiry', 'enquiry', '#enquiry', true), bn('Contact', 'contact', '#enquiry'), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Enquire', kind: 'enquiry' },
    sections: [
      { type: 'hero', variant: 'split', eyebrow: 'Harvested fresh', headline: b.tagline, subline: b.about, highlight: 'Farm-direct · Fair pricing · Bulk & retail supply', image: IMG.agriculture[0],
        ctaPrimary: { label: 'Enquire', href: '#enquiry' }, ctaSecondary: { label: 'WhatsApp Us', href: '#enquiry' } },
      { type: 'showcase', id: 'produce', variant: 'cards', eyebrow: 'Our produce', title: 'What we supply', items: products },
      { type: 'iconGrid', id: 'why', eyebrow: 'Why us', title: 'Trusted by kitchens and traders', items: [
        { label: 'Farm-direct', icon: 'Sprout' }, { label: 'No middlemen', icon: 'Leaf' }, { label: 'Graded quality', icon: 'ShieldCheck' },
        { label: 'Bulk supply', icon: 'Truck' }, { label: 'Fair prices', icon: 'Percent' }, { label: 'Reliable delivery', icon: 'Clock' },
      ] },
      { type: 'steps', id: 'how', eyebrow: 'Ordering', title: 'How to order', items: [
        { title: 'Enquire', desc: 'Tell us produce and quantity.' }, { title: 'Quote', desc: 'Fair, transparent pricing.' },
        { title: 'Harvest & pack', desc: 'Picked and graded fresh.' }, { title: 'Deliver', desc: 'To your door or market.' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Buyers', title: 'What buyers say', items: [
        { quote: 'Consistent quality and fair rates — our restaurant buys weekly.', author: 'Chef, cloud kitchen' },
        { quote: 'Bulk grain order arrived clean and correctly weighed.', author: 'Trader' },
        { quote: 'The organic basket for home is the freshest we\'ve found.', author: 'Household' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Order', title: 'Enquire or place a bulk order', sub: 'Tell us the produce and quantity — we\'ll send a fair quote fast.', points: ['Farm-direct', 'Fair pricing', 'Bulk & retail'], tabs: [enquire('Get a quote'), orderTab('Place bulk order', 'Send order')] },
    ],
  };
}

/* ── AUTOMOBILE — AutoCare Service Centre (§26 style) ── */
export function buildAutomobile(site: EngineSiteData): KitSiteModel {
  const b = brandFrom(site, { name: 'AutoCare Service Centre', tagline: 'Your Car, in Expert Hands.', about: 'A modern service centre and workshop — genuine parts, transparent pricing and technicians who actually explain what your car needs.' });
  const services = itemsFrom(site, [
    { title: 'Periodic Service', subtitle: 'Most booked', price: 'from ₹2,999', desc: 'Oil, filters, 40-point check.', image: IMG.automobile[1] },
    { title: 'Denting & Painting', price: 'on quote', desc: 'Showroom finish, insurance-friendly.', image: IMG.automobile[2] },
    { title: 'AC & Electrical', price: 'from ₹1,499', desc: 'Cooling, wiring and diagnostics.', image: IMG.automobile[3] },
    { title: 'Detailing & Ceramic', price: 'from ₹4,999', desc: 'Deep clean and paint protection.', image: IMG.automobile[0] },
  ]);
  return {
    brand: b, theme: THEMES.automobile, choices: ['Periodic service', 'Denting & painting', 'AC / electrical', 'Detailing'], choiceLabel: 'Service',
    nav: nav(['#services', 'Services'], ['#why', 'Why us'], ['#how', 'How it works'], ['#reviews', 'Reviews']),
    bottomNav: [bn('Home', 'home', '#top'), bn('Services', 'services', '#services'), bn('Book', 'book', '#enquiry', true), bn('Offers', 'offers', '#why'), bn('More', 'more', '#reviews')],
    primaryCta: { intent: 'engine.enquiry', label: 'Book a Service', kind: 'booking' },
    sections: [
      { type: 'hero', variant: 'overlay', eyebrow: 'Pick-up & drop available', headline: b.tagline, subline: b.about, highlight: 'Genuine parts · Transparent quotes · Free pick-up & drop', image: IMG.automobile[0],
        ctaPrimary: { label: 'Book a Service', href: '#enquiry' }, ctaSecondary: { label: 'Get a Quote', href: '#enquiry' } },
      { type: 'showcase', id: 'services', variant: 'cards', eyebrow: 'Services', title: 'What we do', items: services },
      { type: 'stats', items: [{ value: '25k+', label: 'Cars serviced' }, { value: '4.8★', label: 'Rating' }, { value: '100%', label: 'Genuine parts' }, { value: 'Same-day', label: 'Most jobs' }] },
      { type: 'iconGrid', id: 'why', eyebrow: 'Why us', title: 'Service without the worry', items: [
        { label: 'Genuine parts only', icon: 'ShieldCheck' }, { label: 'Transparent estimate', icon: 'Percent' }, { label: 'Free pick-up & drop', icon: 'Car' },
        { label: 'Live job updates', icon: 'Activity' }, { label: 'Warranty on work', icon: 'Award' }, { label: 'Skilled technicians', icon: 'Wrench' },
      ] },
      { type: 'steps', id: 'how', eyebrow: 'Simple', title: 'How it works', items: [
        { title: 'Book', desc: 'Pick a service and slot.' }, { title: 'Pick-up', desc: 'We collect your car.' },
        { title: 'Approve', desc: 'Quote before any work.' }, { title: 'Delivered', desc: 'Serviced and cleaned.' },
      ] },
      { type: 'testimonials', id: 'reviews', eyebrow: 'Customers', title: 'What drivers say', items: [
        { quote: 'Sent photos and a quote before touching the car. No surprises.', author: 'Rohit' },
        { quote: 'Pick-up and drop made it effortless. Car came back spotless.', author: 'Priya' },
        { quote: 'Fixed an AC issue two others couldn\'t. Fair price.', author: 'Sameer' },
      ] },
      { type: 'enquiry', id: 'enquiry', eyebrow: 'Book', title: 'Book a service', sub: 'Choose a service and time — we\'ll confirm pick-up and share a quote.', points: ['Free pick-up & drop', 'Quote before work', 'Genuine parts'], tabs: [bookTab('Book a Service', 'Book service'), enquire('Get a quote')] },
    ],
  };
}
