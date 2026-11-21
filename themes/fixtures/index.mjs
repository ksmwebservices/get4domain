// Sample vendor content for all 41 categories, in English and Tamil, plus extreme fixtures for the lint.
// Every business, name, number and review is invented. Image values are the pseudo-sources "sample:<name>", which the renderer turns into
// deterministic placeholder pictures; they are not real files. Pure data: no clock, no randomness, no network.
import { CATEGORIES, categoryById, blockTitle } from '../lib/categories.mjs';
import { SEEDS } from './data.mjs';

export const LANGS = ['en', 'ta'];

/** Entitlements for the renderer: everything off (the default) and everything on (the lint renders both). */
/** OFF = a Pro site without the optional extras: calls to action are on, video, cart, booking and the custom domain are off. */
export const ENTITLEMENTS_OFF = Object.freeze({ video: false, cart: false, booking: false, customDomain: false, callsToAction: true });
export const ENTITLEMENTS_ON = Object.freeze({ video: true, cart: true, booking: true, customDomain: true, callsToAction: true });
/** A Free site: an informational listing with no call to action of any kind (owner rule 5). */
export const ENTITLEMENTS_LISTING = Object.freeze({ video: false, cart: false, booking: false, customDomain: false, callsToAction: false });
/** A realistic set: a Free-plan vendor is a listing with none (no call to action either); a Pro-plan vendor has calls to action, video and a custom domain, booking on Handyman and Professional, the cart on Ecommerce. */
export function sampleEntitlements(categoryId, { pro = false } = {}) {
  const cat = categoryById(categoryId);
  if (!pro) return { ...ENTITLEMENTS_LISTING };
  return { video: true, cart: cat.track === 'ecommerce', booking: cat.track !== 'ecommerce', customDomain: true, callsToAction: true };
}
export const EXTREME_KINDS = ['long-name', 'long-list', 'empty', 'no-images', 'long-text'];

const T = (lang, en, ta) => (lang === 'ta' ? ta : en);
const pad = (n) => String(n).padStart(2, '0');
const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const PLACES = [['Gandhi Nagar', 'காந்தி நகர்'], ['Kamaraj Road', 'காமராஜர் சாலை'], ['Bazaar Street', 'பஜார் தெரு'], ['Railway Colony', 'ரயில்வே காலனி'], ['Market Road', 'மார்க்கெட் சாலை'], ['Temple Street', 'கோயில் தெரு']];
const DAYS = [['Monday', 'திங்கள்'], ['Tuesday', 'செவ்வாய்'], ['Wednesday', 'புதன்'], ['Thursday', 'வியாழன்'], ['Friday', 'வெள்ளி'], ['Saturday', 'சனி'], ['Sunday', 'ஞாயிறு']];
const CUSTOMERS = [['Meena R.', 'மீனா ஆர்.'], ['Karthik S.', 'கார்த்திக் எஸ்.'], ['Fatima B.', 'பாத்திமா பி.'], ['Joseph A.', 'ஜோசப் ஏ.']];

const PRICE_BLOCKS = new Set(['priceList', 'packages', 'pricing', 'areaPricing', 'amcPlans', 'memberships', 'fees', 'products', 'testList', 'servicesMenu', 'menu', 'treatments', 'courses', 'batches', 'rooms', 'listings', 'collections', 'offers', 'services']);
const PLACE_BLOCKS = new Set(['areas', 'routes', 'destinations', 'nearby', 'eventTypes', 'occasions']);
const TEXT_BLOCKS = new Set(['disclaimer', 'safetyNote', 'licence', 'barCouncilNo', 'purityNote', 'homeCollection', 'reportsLink', 'deliveryPinCheck', 'deliveryInfo', 'assemblyInfo', 'emergency24x7', 'sameDay', 'pickupDrop', 'reservations', 'deliveryLinks', 'customOrders', 'bulkOrders', 'sizeGuide', 'warranty', 'timings', 'complianceCalendar']);
const TEXT_EN = 'Sample text for preview. The real wording is written by the business owner.';
const TEXT_TA = 'முன்னோட்டத்துக்கான மாதிரி உரை. உண்மையான வாசகத்தை வணிக உரிமையாளர் எழுதுவார்.';

function blockItems(key, items, lang) {
  if (TEXT_BLOCKS.has(key)) return [{ title: T(lang, 'Please note', 'கவனத்திற்கு'), detail: T(lang, TEXT_EN, TEXT_TA), price: '' }];
  if (PLACE_BLOCKS.has(key)) return PLACES.slice(0, 4).map(([en, ta]) => ({ title: T(lang, en, ta), detail: '', price: '' }));
  if (PRICE_BLOCKS.has(key)) return items.slice(0, 4).map((i) => ({ title: i.name, detail: i.description, price: i.price }));
  return items.slice(2, 5).map((i) => ({ title: i.name, detail: i.description, price: '' }));
}

/** @param {string} categoryId @param {{lang?:'en'|'ta'}} [opts] */
export function sampleContent(categoryId, { lang = 'en' } = {}) {
  const cat = categoryById(categoryId);
  const seed = SEEDS[categoryId];
  if (!seed) throw new RangeError(`No fixture seed for ${categoryId}`);
  const [nameEn, nameTa, cityEn, cityTa, tagEn, tagTa, labelTa, services] = seed;
  const idx = CATEGORIES.findIndex((c) => c.id === categoryId) + 1;
  const name = T(lang, nameEn, nameTa);
  const city = T(lang, cityEn, cityTa);
  const label = T(lang, cat.label.toLowerCase(), labelTa);
  const slug = slugOf(nameEn);
  const shop = cat.track === 'ecommerce';
  const sampleNote = T(lang, 'Sample content for preview', 'முன்னோட்டத்துக்கான மாதிரி உள்ளடக்கம்');

  const items = services.map(([en, ta, price], i) => ({
    id: `item-${i + 1}`, slug: `item-${i + 1}`,
    name: T(lang, en, ta),
    description: T(lang, `${en}, done properly by the ${cat.label.toLowerCase()} team. Sample description for preview.`, `${ta}. ${labelTa} குழுவால் சரியாகச் செய்யப்படும். முன்னோட்டத்துக்கான மாதிரி விளக்கம்.`),
    price, image: `sample:item-${i + 1}`, href: `/item-${i + 1}`,
    badge: i === 0 ? T(lang, shop ? 'Bestseller' : 'Popular', 'பிரபலம்') : '',
    category: T(lang, cat.label, labelTa), duration: shop ? '' : T(lang, '1 hour', '1 மணி நேரம்'), tags: '', includes: '', location: '', area: '', bedrooms: '', veg: '',
  }));

  const content = {
    category: categoryId,
    lang,
    sample: true,
    sampleNote,
    site: { name, tagline: T(lang, tagEn, tagTa), logo: 'sample:logo', logoAlt: T(lang, `${nameEn} logo`, `${nameTa} சின்னம்`), favicon: '', year: 2026, url: `https://${slug}.example`, established: '2014', registrationNo: `SAMPLE-${pad(idx)}-2014` },
    hero: { title: T(lang, `${nameEn} - ${cat.label.toLowerCase()} in ${cityEn}`, `${nameTa} - ${cityTa} ${labelTa}`), badge: cat.extraBlocks.includes('emergency24x7') ? T(lang, 'Emergency service 24x7', '24x7 அவசர சேவை') : cat.extraBlocks.includes('sameDay') ? T(lang, 'Same-day service', 'அதே நாள் சேவை') : '', subtitle: T(lang, tagEn, tagTa), image: 'sample:hero', imageAlt: T(lang, `${nameEn} at work`, `${nameTa} பணியிடம்`), cta: '' },
    about: { title: T(lang, `About ${nameEn}`, `${nameTa} பற்றி`), text: T(lang, `${nameEn} is a ${cat.label.toLowerCase()} serving ${cityEn} and nearby areas.\n\nWe keep prices clear, arrive on time and explain the work before we start. This text is sample content for preview.`, `${nameTa} ${cityTa} மற்றும் அருகிலுள்ள பகுதிகளில் சேவை செய்யும் ${labelTa}.\n\nவிலைகளைத் தெளிவாகச் சொல்கிறோம், நேரத்தில் வருகிறோம், வேலைக்கு முன் விளக்குகிறோம். இது முன்னோட்டத்துக்கான மாதிரி உரை.`), image: 'sample:about', imageAlt: T(lang, `${nameEn} team`, `${nameTa} குழு`) },
    contact: { phone: `+91 00000 000${pad(idx)}`, phoneHref: `tel:+9100000000${pad(idx)}`, whatsapp: `+91 00000 000${pad(idx)}`, whatsappHref: `https://wa.me/9100000000${pad(idx)}`, email: `hello@${slug}.example`, address: T(lang, `12, ${PLACES[idx % 6][0]}, ${cityEn} 6000${pad(idx)}`, `12, ${PLACES[idx % 6][1]}, ${cityTa} 6000${pad(idx)}`), city, area: T(lang, PLACES[idx % 6][0], PLACES[idx % 6][1]), pin: `6000${pad(idx)}`, mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nameEn} ${cityEn}`)}`, lat: 11 + idx / 100, lng: 78 + idx / 100 },
    hours: DAYS.map(([en, ta], i) => ({ day: T(lang, en, ta), open: i === 6 ? '' : '09:00', close: i === 6 ? '' : '19:00', closed: i === 6 })),
    social: { instagram: `https://www.instagram.com/${slug}-sample`, facebook: `https://www.facebook.com/${slug}.sample`, youtube: '', linkedin: '', x: '', whatsapp: `https://wa.me/9100000000${pad(idx)}`, maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nameEn)}`, custom: '', customLabel: '', pinterest: '', telegram: '', whatsappChannel: '' },
    cta: { label: T(lang, cat.ctaPrimary, ctaTamil(cat.ctaPrimary)), href: `tel:+9100000000${pad(idx)}`, secondaryLabel: T(lang, 'See our services', 'எங்கள் சேவைகளைப் பாருங்கள்'), secondaryHref: '/services' },
    page: { title: T(lang, 'Offers and notices', 'சலுகைகள், அறிவிப்புகள்'), intro: T(lang, 'Current offers and notices from the business.', 'வணிகத்தின் தற்போதைய சலுகைகள், அறிவிப்புகள்.'), body: T(lang, 'This page is written by the business owner.\n\nSample text for preview.', 'இந்தப் பக்கத்தை வணிக உரிமையாளர் எழுதுவார்.\n\nமுன்னோட்டத்துக்கான மாதிரி உரை.'), slug: 'offers' },
    terms: shop ? { team: T(lang, 'Our team', 'எங்கள் குழு'), teamOne: T(lang, 'Team member', 'குழு உறுப்பினர்'), items: T(lang, 'Products', 'பொருட்கள்'), itemOne: T(lang, 'Product', 'பொருள்'), groups: T(lang, 'Categories', 'வகைகள்') }
      : { team: T(lang, 'Our team', 'எங்கள் குழு'), teamOne: T(lang, 'Team member', 'குழு உறுப்பினர்'), items: T(lang, 'Services', 'சேவைகள்'), itemOne: T(lang, 'Service', 'சேவை'), groups: T(lang, 'Groups', 'பிரிவுகள்') },
    items,
    groups: [{ name: T(lang, 'Popular', 'பிரபலமானவை'), slug: 'popular', count: 3, items: items.slice(0, 3) }, { name: T(lang, 'More', 'மேலும்'), slug: 'more', count: 3, items: items.slice(3, 6) }],
    team: [1, 2, 3].map((n) => ({ id: `t${n}`, name: T(lang, ['Ravi K.', 'Priya M.', 'Imran S.'][n - 1], ['ரவி கே.', 'பிரியா எம்.', 'இம்ரான் எஸ்.'][n - 1]), role: T(lang, ['Owner', 'Senior specialist', 'Coordinator'][n - 1], ['உரிமையாளர்', 'மூத்த நிபுணர்', 'ஒருங்கிணைப்பாளர்'][n - 1]), note: '', image: `sample:team-${n}` })),
    testimonials: CUSTOMERS.slice(0, 3).map(([en, ta], i) => ({ quote: T(lang, ['Quick, neat and fairly priced.', 'They explained everything before starting.', 'Will call them again.'][i] + ' (sample)', ['விரைவு, நேர்த்தி, நியாயமான விலை.', 'தொடங்கும் முன் எல்லாவற்றையும் விளக்கினார்கள்.', 'மீண்டும் அழைப்பேன்.'][i] + ' (மாதிரி)'), author: T(lang, en, ta), note: T(lang, 'Sample customer', 'மாதிரி வாடிக்கையாளர்') })),
    faqs: [
      { q: T(lang, 'Do you give a price before starting?', 'தொடங்கும் முன் விலை சொல்வீர்களா?'), a: T(lang, 'Yes. We share the price first and start only after you agree. (sample)', 'ஆம். முதலில் விலை சொல்வோம், நீங்கள் ஒப்புக்கொண்ட பின்தான் தொடங்குவோம். (மாதிரி)') },
      { q: T(lang, 'Which areas do you cover?', 'எந்தெந்த பகுதிகளில் சேவை செய்கிறீர்கள்?'), a: T(lang, `${cityEn} and nearby areas. Call to confirm your area. (sample)`, `${cityTa} மற்றும் அருகிலுள்ள பகுதிகள். உங்கள் பகுதியை உறுதிப்படுத்த அழையுங்கள். (மாதிரி)`) },
      { q: T(lang, 'How do I book?', 'எப்படி முன்பதிவு செய்வது?'), a: T(lang, 'Call, message on WhatsApp or send the enquiry form. (sample)', 'அழைக்கவும், வாட்ஸ்அப்பில் செய்தி அனுப்பவும் அல்லது விசாரணைப் படிவத்தை அனுப்பவும். (மாதிரி)') },
      { q: T(lang, 'What payment methods do you accept?', 'என்ன முறைகளில் பணம் செலுத்தலாம்?'), a: T(lang, 'UPI, cash and bank transfer. (sample)', 'UPI, ரொக்கம், வங்கிப் பரிமாற்றம். (மாதிரி)') },
    ],
    gallery: [1, 2, 3, 4, 5, 6].map((n) => ({ src: `sample:gallery-${n}`, alt: T(lang, `${nameEn} work sample ${n}`, `${nameTa} பணி மாதிரி ${n}`), title: T(lang, `Work sample ${n}`, `பணி மாதிரி ${n}`) })),
    steps: [1, 2, 3, 4].map((n) => ({ n, title: T(lang, ['Tell us what you need', 'We confirm the price', 'We do the work', 'You check and pay'][n - 1], ['உங்கள் தேவையைச் சொல்லுங்கள்', 'விலையை உறுதி செய்கிறோம்', 'வேலையைச் செய்கிறோம்', 'நீங்கள் சரிபார்த்து பணம் செலுத்துங்கள்'][n - 1]), desc: T(lang, 'Sample step description.', 'மாதிரி படி விளக்கம்.') })),
    trust: [T(lang, 'Clear prices', 'தெளிவான விலை'), T(lang, 'On-time service', 'நேரத்தில் சேவை'), T(lang, 'Local and trusted', 'உள்ளூர், நம்பகமானது')].map((text) => ({ text })),
    stats: [{ value: '12+', label: T(lang, 'Years', 'ஆண்டுகள்') }, { value: '2,400+', label: T(lang, 'Customers served', 'வாடிக்கையாளர்கள்') }, { value: '4.8', label: T(lang, 'Average rating', 'சராசரி மதிப்பீடு') }],
    areas: PLACES.map(([en, ta]) => ({ name: T(lang, en, ta) })),
    credentials: [{ title: T(lang, 'Registered business', 'பதிவு செய்யப்பட்ட வணிகம்'), detail: `SAMPLE-${pad(idx)}-2014` }, { title: T(lang, 'Trained team', 'பயிற்சி பெற்ற குழு'), detail: T(lang, 'Sample detail', 'மாதிரி விவரம்') }],
    blocks: cat.extraBlocks.map((key) => ({ key, title: blockTitle(key, lang), items: blockItems(key, items, lang) })),
    reviews: {
      sample: true,
      summary: { rating: 4.7, count: 128 },
      writeUrl: 'https://www.google.com/maps/search/?api=1&query=sample',
      google: [
        { name: T(lang, 'Sample reviewer A', 'மாதிரி மதிப்பாய்வாளர் A'), rating: 5, text: T(lang, 'Sample review text for preview. Fast and friendly.', 'முன்னோட்டத்துக்கான மாதிரி மதிப்புரை. விரைவு, நட்பான சேவை.'), date: '2026-09-14', reply: T(lang, 'Thank you for the kind words. (sample reply)', 'அன்பான வார்த்தைகளுக்கு நன்றி. (மாதிரி பதில்)') },
        { name: T(lang, 'Sample reviewer B', 'மாதிரி மதிப்பாய்வாளர் B'), rating: 4, text: T(lang, 'Sample review text for preview. Good work, a little late.', 'மாதிரி மதிப்புரை. நல்ல வேலை, சற்று தாமதம்.'), date: '2026-08-02', reply: '' },
        { name: T(lang, 'Sample reviewer C', 'மாதிரி மதிப்பாய்வாளர் C'), rating: 2, text: T(lang, 'Sample review text for preview. Not happy with the first visit.', 'மாதிரி மதிப்புரை. முதல் வருகையில் திருப்தி இல்லை.'), date: '2026-06-21', reply: T(lang, 'Sorry to hear that; we have called you. (sample reply)', 'வருந்துகிறோம்; உங்களை அழைத்தோம். (மாதிரி பதில்)') },
      ],
    },
    videos: [1, 2, 3].map((n) => ({ title: T(lang, `How we work, part ${n}`, `நாங்கள் செயல்படும் விதம், பகுதி ${n}`), url: `https://www.youtube-nocookie.com/watch?v=sample${n}`, poster: `sample:video-${n}`, duration: `${n}:30`, chapters: [], transcript: T(lang, 'Sample transcript text for preview.', 'மாதிரி டிரான்ஸ்கிரிப்ட் உரை.') })),
    products: shop ? items : [],
    offers: cat.extraBlocks.includes('offers') ? [
      { title: T(lang, 'Festival offer: 10% off on selected items', 'பண்டிகைச் சலுகை: தேர்ந்தெடுத்த பொருட்களுக்கு 10% தள்ளுபடி'), detail: T(lang, 'Sample offer for preview', 'முன்னோட்டத்துக்கான மாதிரிச் சலுகை'), price: '' },
      { title: T(lang, 'Free delivery on orders above ₹999', '₹999-க்கு மேல் ஆர்டருக்கு இலவச டெலிவரி'), detail: T(lang, 'Sample offer for preview', 'முன்னோட்டத்துக்கான மாதிரிச் சலுகை'), price: '' },
      { title: T(lang, 'Buy two, get a small gift', 'இரண்டு வாங்கினால் சிறிய பரிசு'), detail: T(lang, 'Sample offer for preview', 'முன்னோட்டத்துக்கான மாதிரிச் சலுகை'), price: '' },
    ] : [],
    host: { siteUrl: `https://${slug}.get4domain.com` },
  };
  return content;
}

function ctaTamil(en) {
  return ({ 'Call now': 'இப்போது அழையுங்கள்', 'Get a quote': 'விலைப்புள்ளி பெறுங்கள்', 'Book a visit': 'வருகையை முன்பதிவு செய்யுங்கள்', 'Book a slot': 'நேரத்தை முன்பதிவு செய்யுங்கள்', 'Book appointment': 'நேரம் முன்பதிவு செய்யுங்கள்', 'Book a test': 'பரிசோதனை முன்பதிவு', 'Book consultation': 'ஆலோசனை முன்பதிவு', 'Enquire now': 'இப்போது விசாரிக்கவும்', 'Book a demo': 'டெமோ முன்பதிவு', 'Book a trial': 'சோதனை வகுப்பு முன்பதிவு', 'Check dates': 'தேதிகளைப் பாருங்கள்', 'Book a call': 'அழைப்பு முன்பதிவு', 'Reserve a table': 'மேசை முன்பதிவு', 'Check availability': 'இருப்பைப் பாருங்கள்', 'Plan my trip': 'என் பயணத்தைத் திட்டமிடுங்கள்', 'Shop now': 'இப்போது வாங்குங்கள்', 'Order now': 'இப்போது ஆர்டர் செய்யுங்கள்' })[en] ?? en;
}

// ---------- extremes ----------
const LONG_WORD = 'Supercalifragilisticexpialidocious'.repeat(2);
const LONG_URL_TEXT = 'https://example.com/a/very/long/path/that/never/breaks/' + 'segment-'.repeat(14);
const para = (s, n) => Array.from({ length: n }, () => s).join('\n\n');

/** @param {string} categoryId @param {typeof EXTREME_KINDS[number]} kind */
export function extremeContent(categoryId, kind, { lang = 'en' } = {}) {
  const c = sampleContent(categoryId, { lang });
  switch (kind) {
    case 'long-name': {
      const name = `Sri Venkateswara Lakshmi Narasimha Swamy Memorial Charitable ${c.site.name} and Associates ${LONG_WORD}`;
      c.site.name = name;
      c.site.tagline = `${c.site.tagline} `.repeat(6).trim();
      c.hero.title = `${c.hero.title} ${LONG_WORD} ${c.hero.title}`;
      c.contact.address = `${c.contact.address}, ${LONG_WORD}, ${LONG_WORD}`;
      c.cta.label = `${c.cta.label} ${c.cta.label} ${c.cta.label}`;
      c.items.forEach((i) => { i.name = `${i.name} ${LONG_WORD}`; });
      return c;
    }
    case 'long-list': {
      const grow = (arr, n) => Array.from({ length: n }, (_, k) => ({ ...arr[k % arr.length], id: `${arr[k % arr.length].id ?? 'x'}-${k}`, slug: `s-${k}` }));
      c.items = grow(c.items, 48);
      c.groups = [{ ...c.groups[0], items: c.items.slice(0, 24), count: 24 }, { ...c.groups[1], items: c.items.slice(24), count: 24 }];
      c.faqs = Array.from({ length: 30 }, (_, k) => ({ ...c.faqs[k % 4] }));
      c.gallery = Array.from({ length: 36 }, (_, k) => ({ ...c.gallery[k % 6], src: `sample:gallery-${(k % 6) + 1}` }));
      c.testimonials = Array.from({ length: 24 }, (_, k) => ({ ...c.testimonials[k % 3] }));
      c.team = Array.from({ length: 20 }, (_, k) => ({ ...c.team[k % 3], id: `t-${k}` }));
      c.blocks = c.blocks.map((b) => ({ ...b, items: Array.from({ length: 20 }, (_, k) => ({ ...b.items[k % b.items.length] })) }));
      c.reviews.google = Array.from({ length: 40 }, (_, k) => ({ ...c.reviews.google[k % 3] }));
      return c;
    }
    case 'empty': {
      c.contact = { ...c.contact, phone: '', phoneHref: '', whatsapp: '', whatsappHref: '', email: '', mapUrl: '', city: '', area: '', pin: '' };
      for (const k of Object.keys(c.social)) c.social[k] = '';
      c.site.logo = ''; c.site.tagline = ''; c.site.established = ''; c.site.registrationNo = '';
      c.hero.subtitle = ''; c.hero.image = ''; c.hero.imageAlt = '';
      c.about.image = ''; c.about.text = '';
      c.cta = { label: '', href: '', secondaryLabel: '', secondaryHref: '' };
      for (const k of ['hours', 'items', 'groups', 'team', 'testimonials', 'faqs', 'gallery', 'steps', 'trust', 'stats', 'areas', 'credentials', 'blocks', 'videos', 'products', 'offers']) c[k] = [];
      c.reviews = { sample: false, summary: { rating: 0, count: 0 }, writeUrl: '', google: [] };
      return c;
    }
    case 'no-images': {
      c.site.logo = ''; c.hero.image = ''; c.about.image = '';
      c.items.forEach((i) => { i.image = ''; });
      c.groups.forEach((g) => g.items.forEach((i) => { i.image = ''; }));
      c.team.forEach((m) => { m.image = ''; });
      c.gallery = [];
      c.videos.forEach((v) => { v.poster = ''; });
      c.products = c.products.map((p) => ({ ...p, image: '' }));
      return c;
    }
    case 'long-text': {
      c.about.text = para(`${c.about.text.split('\n')[0]} ${LONG_URL_TEXT} ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(12)}`, 6);
      c.items.forEach((i) => { i.description = `${i.description} ${'More sample words. '.repeat(40)} ${LONG_URL_TEXT}`; });
      c.faqs.forEach((f) => { f.a = `${f.a} ${'Extra sample answer text. '.repeat(25)}`; });
      c.page.body = para(`${LONG_URL_TEXT} ${'Sample paragraph text. '.repeat(30)}`, 5);
      c.reviews.google.forEach((r) => { r.text = `${r.text} ${LONG_URL_TEXT} ${'Review words. '.repeat(30)}`; });
      return c;
    }
    default:
      throw new RangeError(`Unknown extreme fixture "${kind}"`);
  }
}

/** Repeats words so every readable string is about `factor` times longer. Used by the text-stretch lint. */
export function stretchContent(content, factor = 1.6) {
  const skip = /^(https?:|tel:|mailto:|sample:|\/|#|\d{4}-\d{2}-\d{2}$)/;
  const stretch = (s) => {
    if (typeof s !== 'string' || s.length < 6 || skip.test(s) || !s.includes(' ')) return s;
    const words = s.split(' ');
    const out = [...words];
    while (out.join(' ').length < s.length * factor) out.push(...words);
    return out.join(' ');
  };
  const walk = (v, key) => {
    if (typeof v === 'string') return ['href', 'src', 'url', 'id', 'slug', 'phoneHref', 'whatsappHref', 'mapUrl', 'writeUrl', 'lang', 'category'].includes(key) ? v : stretch(v);
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  return walk(content, '');
}

export function allSamples({ lang = 'en' } = {}) {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, sampleContent(c.id, { lang })]));
}

// ---------------------------------------------------------------- content at the two sizes the picture budget is checked with
const grow = (arr, n, fix) => Array.from({ length: n }, (_, k) => fix({ ...arr[k % arr.length] }, k));
function sized(categoryId, lang, { items, gallery, faqs, testimonials, team, videos }) {
  const c = sampleContent(categoryId, { lang });
  c.items = grow(c.items, items, (x, k) => ({ ...x, id: `item-${k + 1}`, slug: `item-${k + 1}`, href: `/item-${k + 1}`, image: `sample:item-${(k % 6) + 1}` }));
  c.gallery = grow(c.gallery, gallery, (x, k) => ({ ...x, src: `sample:gallery-${(k % 6) + 1}` }));
  c.faqs = grow(c.faqs, faqs, (x) => x);
  c.testimonials = grow(c.testimonials, testimonials, (x) => x);
  c.team = grow(c.team, team, (x, k) => ({ ...x, id: `t${k + 1}`, image: `sample:team-${(k % 3) + 1}` }));
  c.videos = grow(c.videos, videos, (x, k) => ({ ...x, poster: `sample:video-${(k % 3) + 1}` }));
  c.groups = [{ ...c.groups[0], items: c.items.slice(0, Math.ceil(items / 2)) }, { ...c.groups[1], items: c.items.slice(Math.ceil(items / 2)) }];
  c.products = categoryById(categoryId).track === 'ecommerce' ? c.items : [];
  return c;
}
/** What a Free site can hold: 8 services, 5 gallery images, 6 FAQs, with a picture on everything. */
export const freeLimitContent = (categoryId, { lang = 'en' } = {}) => sized(categoryId, lang, { items: 8, gallery: 5, faqs: 6, testimonials: 3, team: 3, videos: 0 });
/** The largest Pro content the picture budget allows for: 24 services or products, 12 gallery images, 12 FAQs, 6 team members, 6 videos. */
export const proMaxContent = (categoryId, { lang = 'en' } = {}) => sized(categoryId, lang, { items: 24, gallery: 12, faqs: 12, testimonials: 12, team: 6, videos: 6 });
