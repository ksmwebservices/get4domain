// The 41 V3 categories (T0 brief catalogue), their families, tracks, and the layout variant each family sets (T5 brief).
// `flow` and `packKey` are the bridge to the as-built backend (8 flow families, 24 category packs). They are an INFERENCE made in
// THEMES-CC-0 (see themes/CONTRACT.md section 7); nothing in the backend states them.

export const TRACK_LABELS = { handyman: 'Handyman', professional: 'Professional', ecommerce: 'Ecommerce' };

/** V3 family -> track, label, layout variant (T5). `motion` is the default motion intensity. */
export const FAMILIES = {
  'home-services': { label: 'Home services', track: 'handyman', variant: { id: 'bold-split', hero: 'split', header: 'bold', services: 'icon-grid', secondaryServices: 'price-table', card: 'sharp', divider: 'notch', decor: 'badge-shapes', motion: 'Medium', notes: 'emergency badge and big phone number' } },
  'auto-services': { label: 'Auto services', track: 'handyman', variant: { id: 'dark-bento', hero: 'full-bleed', header: 'dark', services: 'bento', secondaryServices: 'before-after', card: 'sharp', divider: 'speed-line', decor: 'stripes', motion: 'Medium', notes: 'dark hero, before and after slider' } },
  healthcare: { label: 'Healthcare', track: 'professional', variant: { id: 'calm-centered', hero: 'centered-statement', header: 'light', services: 'tabbed-list', secondaryServices: null, card: 'soft', divider: 'curve', decor: 'soft-blobs', motion: 'Low', notes: 'trust strip first' } },
  'legal-finance': { label: 'Legal and finance', track: 'professional', variant: { id: 'structured-split', hero: 'split', header: 'serif', services: 'price-table', secondaryServices: null, card: 'flat', divider: 'notch', decor: 'rules', motion: 'Low', notes: 'practice-area list, serif headings; "minimal motion" is read as Low' } },
  education: { label: 'Education', track: 'professional', variant: { id: 'card-stack', hero: 'card-stack', header: 'playful', services: 'timeline', secondaryServices: 'price-table', card: 'round', divider: 'wave', decor: 'playful-shapes', motion: 'Medium', notes: 'batch and fee tables' } },
  'wellness-beauty': { label: 'Wellness and beauty', track: 'professional', variant: { id: 'fullbleed-bento', hero: 'full-bleed', header: 'transparent', services: 'bento', secondaryServices: 'price-table', card: 'round', divider: 'wave', decor: 'petals', motion: 'Rich', notes: 'masonry gallery' } },
  'creative-consulting': { label: 'Creative and consulting', track: 'professional', variant: { id: 'portfolio-first', hero: 'diagonal-cut', header: 'minimal', services: 'timeline', secondaryServices: null, card: 'flat', divider: 'diagonal', decor: 'lines', motion: 'Rich', notes: 'portfolio first, masonry gallery, case-study timeline' } },
  'hospitality-property': { label: 'Hospitality and property', track: 'professional', variant: { id: 'fullbleed-booking', hero: 'full-bleed', header: 'transparent', services: 'image-cards', secondaryServices: null, card: 'round', divider: 'curve', decor: 'ornaments', motion: 'Rich', notes: 'booking slot in the hero' } },
  'fashion-lifestyle': { label: 'Fashion and lifestyle', track: 'ecommerce', variant: { id: 'product-first', hero: 'split', header: 'shop', services: 'bento', secondaryServices: null, card: 'product', divider: 'curve', decor: 'tags', motion: 'Medium', notes: 'product-first, offer strip marquee' } },
  'food-grocery': { label: 'Food and grocery', track: 'ecommerce', variant: { id: 'product-first', hero: 'split', header: 'shop', services: 'bento', secondaryServices: null, card: 'product', divider: 'curve', decor: 'tags', motion: 'Medium', notes: 'product-first, offer strip marquee' } },
  'electronics-home': { label: 'Electronics and home', track: 'ecommerce', variant: { id: 'product-first', hero: 'split', header: 'shop', services: 'bento', secondaryServices: null, card: 'product', divider: 'curve', decor: 'tags', motion: 'Medium', notes: 'product-first, offer strip marquee' } },
  'gifts-books': { label: 'Gifts and books', track: 'ecommerce', variant: { id: 'product-first', hero: 'split', header: 'shop', services: 'bento', secondaryServices: null, card: 'product', divider: 'curve', decor: 'tags', motion: 'Medium', notes: 'product-first, offer strip marquee' } },
};

// id | label | family | schemaType | ctaPrimary | extraBlocks (first = shown first) | flow | packKey
const ROWS = [
  ['plumber', 'Plumber', 'home-services', 'Plumber', 'Call now', ['areas', 'emergency24x7', 'priceList', 'beforeAfter', 'licence'], 'enquiry', 'home-services'],
  ['electrician', 'Electrician', 'home-services', 'Electrician', 'Call now', ['areas', 'emergency24x7', 'priceList', 'safetyCertificates'], 'enquiry', 'home-services'],
  ['carpenter', 'Carpenter', 'home-services', 'HomeAndConstructionBusiness', 'Get a quote', ['portfolio', 'materials', 'process'], 'enquiry', 'home-services'],
  ['painter', 'Painter', 'home-services', 'HousePainter', 'Get a quote', ['portfolio', 'packages', 'beforeAfter'], 'enquiry', 'home-services'],
  ['ac-appliance-repair', 'AC and appliance repair', 'home-services', 'HVACBusiness', 'Book a visit', ['brandsServiced', 'amcPlans', 'sameDay'], 'booking', 'home-services'],
  ['pest-control', 'Pest control', 'home-services', 'HomeAndConstructionBusiness', 'Book a visit', ['packages', 'safetyNote', 'areaPricing'], 'booking', 'home-services'],
  ['home-cleaning', 'Home cleaning', 'home-services', 'HomeAndConstructionBusiness', 'Book a visit', ['packages', 'areaPricing', 'checklist'], 'booking', 'home-services'],
  ['locksmith', 'Locksmith', 'home-services', 'Locksmith', 'Call now', ['areas', 'emergency24x7'], 'enquiry', 'home-services'],
  ['packers-movers', 'Packers and movers', 'home-services', 'MovingCompany', 'Get a quote', ['routes', 'process', 'pricing'], 'enquiry', 'logistics'],
  ['mason-contractor', 'Mason and contractor', 'home-services', 'GeneralContractor', 'Get a quote', ['portfolio', 'process', 'areas'], 'portfolio', 'construction'],
  ['cctv-security-installer', 'CCTV and security installer', 'home-services', 'HomeAndConstructionBusiness', 'Get a quote', ['packages', 'brands'], 'enquiry', 'home-services'],
  ['auto-mechanic', 'Auto mechanic', 'auto-services', 'AutoRepair', 'Book a visit', ['servicesMenu', 'brandsServiced', 'pickupDrop'], 'booking', 'automobile'],
  ['car-wash-detailing', 'Car wash and detailing', 'auto-services', 'AutoRepair', 'Book a slot', ['packages', 'beforeAfter'], 'booking', 'automobile'],
  ['doctor-clinic', 'Doctor and clinic', 'healthcare', 'Physician', 'Book appointment', ['departments', 'timings', 'insuranceAccepted', 'disclaimer'], 'booking', 'clinic'],
  ['dentist', 'Dentist', 'healthcare', 'Dentist', 'Book appointment', ['treatments', 'beforeAfter', 'disclaimer'], 'booking', 'clinic'],
  ['physiotherapy', 'Physiotherapy', 'healthcare', 'MedicalClinic', 'Book appointment', ['conditions', 'packages', 'disclaimer'], 'booking', 'clinic'],
  ['diagnostics-lab', 'Diagnostics lab', 'healthcare', 'MedicalBusiness', 'Book a test', ['testList', 'homeCollection', 'reportsLink'], 'booking', 'diagnostics'],
  ['lawyer', 'Lawyer', 'legal-finance', 'LegalService', 'Book consultation', ['practiceAreas', 'barCouncilNo', 'consultationModes', 'disclaimer'], 'enquiry', 'advocate'],
  ['ca-tax-consultant', 'CA and tax consultant', 'legal-finance', 'AccountingService', 'Book consultation', ['services', 'complianceCalendar', 'disclaimer'], 'enquiry', 'finance'],
  ['insurance-advisor', 'Insurance advisor', 'legal-finance', 'InsuranceAgency', 'Get a quote', ['products', 'disclaimer'], 'enquiry', 'finance'],
  ['coaching-centre', 'Coaching centre', 'education', 'EducationalOrganization', 'Enquire now', ['courses', 'batches', 'fees', 'results', 'faculty'], 'courses', 'coaching'],
  ['tutor', 'Tutor', 'education', 'LocalBusiness', 'Book a demo', ['subjects', 'fees', 'results'], 'courses', 'coaching'],
  ['music-dance-school', 'Music and dance school', 'education', 'EducationalOrganization', 'Book a trial', ['courses', 'batches', 'events'], 'courses', 'education'],
  ['salon-spa', 'Salon and spa', 'wellness-beauty', 'BeautySalon', 'Book a slot', ['servicesMenu', 'stylists', 'packages'], 'booking', 'salon'],
  ['gym-yoga', 'Gym and yoga', 'wellness-beauty', 'ExerciseGym', 'Book a trial', ['memberships', 'classTimetable', 'trainers'], 'booking', 'gym'],
  ['photographer', 'Photographer', 'creative-consulting', 'Photographer', 'Check dates', ['portfolio', 'packages', 'process'], 'portfolio', 'photography'],
  ['interior-designer-architect', 'Interior designer and architect', 'creative-consulting', 'ProfessionalService', 'Get a quote', ['portfolio', 'process', 'packages'], 'portfolio', 'construction'],
  ['event-planner', 'Event planner', 'creative-consulting', 'ProfessionalService', 'Get a quote', ['portfolio', 'packages', 'eventTypes'], 'portfolio', 'events'],
  ['it-consultant', 'IT and business consultant', 'creative-consulting', 'ProfessionalService', 'Book a call', ['caseStudies', 'services', 'process'], 'enquiry', 'technology'],
  ['restaurant-cafe', 'Restaurant and cafe', 'hospitality-property', 'Restaurant', 'Reserve a table', ['menu', 'reservations', 'deliveryLinks'], 'menu', 'restaurant'],
  ['hotel-homestay', 'Hotel and homestay', 'hospitality-property', 'Hotel', 'Check availability', ['rooms', 'amenities', 'nearby'], 'packages', 'hotel'],
  ['travel-agency', 'Travel agency', 'hospitality-property', 'TravelAgency', 'Plan my trip', ['packages', 'destinations'], 'packages', 'travel'],
  ['real-estate-agent', 'Real estate agent', 'hospitality-property', 'RealEstateAgent', 'Enquire now', ['listings', 'areas', 'process'], 'listings', 'realestate'],
  ['fashion-apparel', 'Fashion and apparel', 'fashion-lifestyle', 'Store', 'Shop now', ['sizeGuide', 'collections', 'offers'], 'shop', 'retail'],
  ['jewellery', 'Jewellery', 'fashion-lifestyle', 'JewelryStore', 'Shop now', ['collections', 'purityNote', 'offers'], 'shop', 'retail'],
  ['grocery-kirana', 'Grocery and kirana', 'food-grocery', 'GroceryStore', 'Order now', ['deliveryPinCheck', 'categories', 'offers'], 'shop', 'retail'],
  ['bakery-sweets', 'Bakery and sweets', 'food-grocery', 'Bakery', 'Order now', ['menu', 'customOrders', 'deliveryPinCheck'], 'shop', 'retail'],
  ['electronics-mobile', 'Electronics and mobiles', 'electronics-home', 'ElectronicsStore', 'Shop now', ['warranty', 'brands', 'offers'], 'shop', 'retail'],
  ['home-furniture', 'Home and furniture', 'electronics-home', 'FurnitureStore', 'Shop now', ['collections', 'deliveryInfo', 'assemblyInfo'], 'shop', 'retail'],
  ['gifts-handicrafts', 'Gifts and handicrafts', 'gifts-books', 'Store', 'Shop now', ['customOrders', 'collections', 'occasions'], 'shop', 'retail'],
  ['books-stationery', 'Books and stationery', 'gifts-books', 'BookStore', 'Shop now', ['categories', 'bulkOrders'], 'shop', 'retail'],
];

/** Wording for extra blocks (English title, Tamil title). Unlisted keys are humanised from the key. */
export const BLOCK_TITLES = {
  areas: ['Areas we serve', 'நாங்கள் சேவை செய்யும் பகுதிகள்'], emergency24x7: ['24x7 emergency service', '24x7 அவசர சேவை'], priceList: ['Price list', 'விலைப் பட்டியல்'],
  beforeAfter: ['Before and after', 'முன்பும் பின்பும்'], licence: ['Licence and registration', 'உரிமம் மற்றும் பதிவு'], safetyCertificates: ['Safety certificates', 'பாதுகாப்புச் சான்றிதழ்கள்'],
  portfolio: ['Our work', 'எங்கள் பணிகள்'], materials: ['Materials we use', 'நாங்கள் பயன்படுத்தும் பொருட்கள்'], process: ['How we work', 'நாங்கள் செயல்படும் விதம்'],
  packages: ['Packages', 'தொகுப்புகள்'], brandsServiced: ['Brands we service', 'நாங்கள் சேவை செய்யும் பிராண்டுகள்'], amcPlans: ['Annual maintenance plans', 'ஆண்டு பராமரிப்புத் திட்டங்கள்'],
  sameDay: ['Same-day service', 'அதே நாள் சேவை'], safetyNote: ['Safety note', 'பாதுகாப்புக் குறிப்பு'], areaPricing: ['Pricing by area', 'பகுதி வாரியான கட்டணம்'],
  checklist: ['What is included', 'என்னென்ன அடங்கும்'], routes: ['Routes we cover', 'நாங்கள் செல்லும் வழித்தடங்கள்'], pricing: ['Pricing', 'கட்டணம்'], brands: ['Brands', 'பிராண்டுகள்'],
  servicesMenu: ['Services and prices', 'சேவைகளும் விலைகளும்'], pickupDrop: ['Pickup and drop', 'எடுத்தல் மற்றும் விடுதல்'],
  departments: ['Departments', 'துறைகள்'], timings: ['Clinic timings', 'கிளினிக் நேரங்கள்'], insuranceAccepted: ['Insurance accepted', 'ஏற்கப்படும் காப்பீடுகள்'], disclaimer: ['Disclaimer', 'குறிப்பு'],
  treatments: ['Treatments', 'சிகிச்சைகள்'], conditions: ['Conditions we treat', 'நாங்கள் சிகிச்சையளிக்கும் நிலைகள்'], testList: ['Tests we offer', 'எங்கள் பரிசோதனைகள்'],
  homeCollection: ['Home sample collection', 'வீட்டில் மாதிரி சேகரிப்பு'], reportsLink: ['Get your reports', 'உங்கள் அறிக்கைகளைப் பெறுங்கள்'],
  practiceAreas: ['Practice areas', 'பணிப் பிரிவுகள்'], barCouncilNo: ['Bar Council enrolment', 'பார் கவுன்சில் பதிவு'], consultationModes: ['Ways to consult', 'ஆலோசனை முறைகள்'],
  services: ['Services', 'சேவைகள்'], complianceCalendar: ['Compliance calendar', 'இணக்க நாட்காட்டி'], products: ['Plans we offer', 'நாங்கள் வழங்கும் திட்டங்கள்'],
  courses: ['Courses', 'படிப்புகள்'], batches: ['Batches', 'பிரிவுகள்'], fees: ['Fees', 'கட்டணங்கள்'], results: ['Results', 'முடிவுகள்'], faculty: ['Faculty', 'ஆசிரியர்கள்'],
  subjects: ['Subjects', 'பாடங்கள்'], events: ['Events', 'நிகழ்வுகள்'], stylists: ['Our stylists', 'எங்கள் ஒப்பனையாளர்கள்'], memberships: ['Memberships', 'உறுப்பினர் திட்டங்கள்'],
  classTimetable: ['Class timetable', 'வகுப்பு அட்டவணை'], trainers: ['Trainers', 'பயிற்சியாளர்கள்'], eventTypes: ['Events we plan', 'நாங்கள் நடத்தும் நிகழ்வுகள்'],
  caseStudies: ['Case studies', 'வழக்கு ஆய்வுகள்'], menu: ['Menu', 'உணவுப் பட்டியல்'], reservations: ['Reservations', 'முன்பதிவு'], deliveryLinks: ['Order for delivery', 'டெலிவரிக்கு ஆர்டர்'],
  rooms: ['Rooms', 'அறைகள்'], amenities: ['Amenities', 'வசதிகள்'], nearby: ['Nearby places', 'அருகிலுள்ள இடங்கள்'], destinations: ['Destinations', 'சுற்றுலாத் தலங்கள்'],
  listings: ['Listings', 'பட்டியல்கள்'], sizeGuide: ['Size guide', 'அளவு வழிகாட்டி'], collections: ['Collections', 'தொகுப்புகள்'], offers: ['Offers', 'சலுகைகள்'],
  purityNote: ['Purity and hallmark', 'தூய்மை மற்றும் ஹால்மார்க்'], deliveryPinCheck: ['Check delivery to your PIN code', 'உங்கள் அஞ்சல் குறியீட்டிற்கு டெலிவரி சரிபார்க்க'],
  categories: ['Categories', 'வகைகள்'], customOrders: ['Custom orders', 'தனிப்பயன் ஆர்டர்கள்'], warranty: ['Warranty', 'உத்தரவாதம்'], deliveryInfo: ['Delivery information', 'டெலிவரி தகவல்'],
  assemblyInfo: ['Assembly information', 'பொருத்துதல் தகவல்'], occasions: ['Occasions', 'சந்தர்ப்பங்கள்'], bulkOrders: ['Bulk orders', 'மொத்த ஆர்டர்கள்'],
};
export const blockTitle = (key, lang = 'en') => {
  const t = BLOCK_TITLES[key];
  if (t) return lang === 'ta' ? t[1] : t[0];
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
};

export const CATEGORIES = ROWS.map(([id, label, family, schemaType, ctaPrimary, extraBlocks, flow, packKey]) => ({
  id, label, family, track: FAMILIES[family].track, schemaType, ctaPrimary, extraBlocks, flow, packKey,
  /** Both price classes (Standard, Premium) are eligible in every category. Tier is a price class of a theme, not a plan. */
  tiers: ['Standard', 'Premium'],
}));

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const FAMILY_IDS = Object.keys(FAMILIES);
export const FLOWS = ['shop', 'booking', 'enquiry', 'packages', 'menu', 'portfolio', 'listings', 'courses'];
const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id) {
  const c = BY_ID.get(id);
  if (!c) throw new RangeError(`Unknown category "${id}"`);
  return c;
}
export const hasCategory = (id) => BY_ID.has(id);
export const categoriesOfFamily = (family) => CATEGORIES.filter((c) => c.family === family);
export const categoriesOfTrack = (track) => CATEGORIES.filter((c) => c.track === track);
/** The layout variant is read-only for vendors: it follows from the category's family. */
export const variantFor = (categoryId) => FAMILIES[categoryById(categoryId).family].variant;
export const isEcommerce = (categoryId) => categoryById(categoryId).track === 'ecommerce';
