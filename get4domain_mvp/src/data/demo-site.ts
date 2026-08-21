// Two-level demo-site model (Category → Subcategory) layered over the existing
// 20-industry content. Categories = the 20 industries (industry-content.ts).
// Subcategories extend a category additively; unknown subcategories fall back to
// the category baseline (nothing breaks, adding config later is additive).
import { industryContent, type IndustryContent } from './industry-content';

export type SectionType = 'catalog' | 'gallery' | 'team' | 'booking' | 'about' | 'contact' | 'blog';
export interface DemoSection { slug: string; label: string; type: SectionType }

// Sub-category-specific copy, injected OVER the category baseline (any field left
// out falls back to the category's own content). Real content per sub-type — not a
// find-and-replace of the category text.
export interface SubContent {
  tagline?: string;
  shortDesc?: string;      // 1 sentence — cards / meta description
  fullDesc?: string;       // 3-4 sentences — about section
  heroHeadline?: string;
  heroSubline?: string;
  highlight?: string;      // the small highlight strip under headings
  seoKeywords?: string[];  // prepended to the category's own keywords
}

export interface Subcategory {
  id: string;
  name: string;
  /** Extra search terms (besides the name) that resolve to this sub-type. */
  keywords?: string[];
  /** Sub-specific copy injected over the category baseline. */
  content?: SubContent;
}

export const CATEGORY_IDS = industryContent.map((c) => c.id);

// Legacy SEO slugs → canonical industry keys (mirrors the backend INDUSTRY_ALIASES).
// After the Aug 2026 key standardization the canonical ids are clinic/salon/gym; this
// keeps old /demo/healthcare URLs and any stored vendor.industry='healthcare' resolving.
const INDUSTRY_ALIASES: Record<string, string> = { healthcare: 'clinic', beauty: 'salon', fitness: 'gym' };
export function canonicalIndustryId(id: string): string { return INDUSTRY_ALIASES[id] ?? id; }

// Curated subcategories; categories not listed get a single "general" derived from
// the category name. Additive — extend anytime without a migration.
const SUBCATEGORIES: Record<string, Subcategory[]> = {
  clinic: [
    { id: 'general', name: 'Clinic' },
    {
      id: 'dental', name: 'Dental',
      keywords: ['dental', 'dentist', 'dental clinic', 'teeth', 'tooth', 'orthodontist', 'braces', 'root canal', 'dental implant', 'dental care'],
      content: {
        tagline: 'Healthy Smiles, Expert Dental Care',
        shortDesc: 'Dental clinic website with a treatment list, online appointment booking and a smile gallery.',
        fullDesc: 'A website built for dental clinics and dentists. Patients browse your treatments — from routine cleaning and fillings to root canals, braces, aligners and implants — book appointments online and see before/after smile transformations. Your Google profile is optimised so people searching "dentist near me" find you first.',
        heroHeadline: 'Gentle, Modern Dentistry for the Whole Family',
        heroSubline: 'Painless treatments, digital X-rays and same-day appointments',
        highlight: 'Painless treatment · Digital X-ray · EMI available · Open 6 days a week',
        seoKeywords: ['dental clinic website india', 'dentist website', 'dental appointment booking software', 'orthodontist website'],
      },
    },
    {
      id: 'dermatology', name: 'Skin & Hair Clinic',
      keywords: ['dermatology', 'dermatologist', 'skin clinic', 'skin specialist', 'cosmetic', 'cosmetology', 'hair transplant', 'acne', 'laser', 'aesthetic clinic', 'skin doctor'],
      content: {
        tagline: 'Healthy Skin, Confident You',
        shortDesc: 'Dermatology and cosmetology clinic website with a treatment menu, online consultation booking and before/after gallery.',
        fullDesc: 'A website built for skin and hair clinics, dermatologists and cosmetologists. Patients browse your treatments — from acne, pigmentation and anti-ageing to laser hair reduction, PRP and hair transplants — book consultations online and see genuine before/after results. Ideal for aesthetic clinics that live and die by their gallery and reviews.',
        heroHeadline: 'Advanced Skin & Hair Treatments You Can Trust',
        heroSubline: 'Dermatologist-led care — acne, laser, anti-ageing and hair restoration',
        highlight: 'Dermatologist-led · USFDA lasers · Visible results · EMI available',
        seoKeywords: ['dermatology clinic website', 'skin clinic website india', 'cosmetologist website', 'hair transplant clinic website'],
      },
    },
    {
      id: 'orthopedic', name: 'Orthopaedic Clinic',
      keywords: ['orthopedic', 'orthopaedic', 'ortho', 'bone', 'joint', 'knee', 'spine', 'fracture', 'joint replacement', 'arthritis', 'orthopedist'],
      content: {
        tagline: 'Move Freely, Live Painlessly',
        shortDesc: 'Orthopaedic clinic website with a treatment list, online appointment booking and surgeon profiles.',
        fullDesc: 'A website built for orthopaedic surgeons and bone-and-joint clinics. Patients browse your specialities — from fracture care, arthritis and sports injuries to knee and hip replacement and spine surgery — book appointments online and read your surgeons’ credentials. Built to convert people searching for a trusted joint-replacement or knee-pain specialist near them.',
        heroHeadline: 'Expert Care for Bones, Joints & Spine',
        heroSubline: 'Fracture care, arthritis management and advanced joint replacement',
        highlight: 'Joint replacement · Arthroscopy · Sports injury · Digital X-ray on site',
        seoKeywords: ['orthopedic clinic website', 'orthopaedic surgeon website india', 'joint replacement clinic website', 'knee specialist website'],
      },
    },
    {
      id: 'physiotherapy', name: 'Physiotherapy',
      keywords: ['physiotherapy', 'physio', 'physiotherapist', 'rehab', 'sports injury', 'back pain'],
      content: {
        tagline: 'Recover Faster, Move Better',
        shortDesc: 'Physiotherapy clinic website with a therapy menu, online slot booking and home-visit requests.',
        fullDesc: 'A website built for physiotherapy and rehabilitation clinics. Patients browse your therapies — back and neck pain, post-surgery rehab, sports-injury recovery and geriatric care — book sessions online and request home visits for elders. Designed to bring in the back-pain and post-operative rehab enquiries that fill a physio’s calendar.',
        heroHeadline: 'Pain Relief & Rehabilitation That Works',
        heroSubline: 'Back pain, sports injuries and post-surgery recovery — in clinic or at home',
        highlight: 'Manual therapy · Sports rehab · Home visits · Personalised recovery plans',
        seoKeywords: ['physiotherapy clinic website', 'physiotherapist website india', 'sports injury rehab website', 'physio home visit'],
      },
    },
    {
      id: 'general-physician', name: 'General Physician',
      keywords: ['general physician', 'gp', 'family doctor', 'clinic', 'consultation'],
      content: {
        tagline: 'Your Family’s Trusted Doctor',
        shortDesc: 'General physician clinic website with consultation booking, chronic-care services and health certificates.',
        fullDesc: 'A website built for general physicians and family-medicine clinics. Patients book consultations online for everyday illnesses, chronic-care reviews for diabetes and blood pressure, adult vaccinations and same-day fitness certificates. The simple, reassuring front door for a neighbourhood clinic that people return to for years.',
        heroHeadline: 'Trusted Everyday Care for the Whole Family',
        heroSubline: 'Consultations, chronic-care management, vaccinations and health checks',
        highlight: 'Same-day appointments · Diabetes & BP care · Vaccinations · Health certificates',
        seoKeywords: ['general physician website', 'family doctor clinic website', 'gp clinic website india'],
      },
    },
    {
      id: 'hospital', name: 'Hospital',
      keywords: ['hospital', 'multispeciality', 'nursing home', 'medical centre'],
      content: {
        tagline: 'Comprehensive Care Under One Roof',
        shortDesc: 'Multispeciality hospital website with departments, doctor directory, 24/7 emergency info and appointment booking.',
        fullDesc: 'A website built for hospitals and nursing homes. Patients explore your departments — emergency, surgery, cardiology, maternity and more — find the right specialist in the doctor directory, book appointments and see cashless-insurance and 24/7 emergency information at a glance. Built to reassure families choosing where to be treated.',
        heroHeadline: 'Multispeciality Care, Round the Clock',
        heroSubline: '24/7 emergency, expert specialists and cashless insurance under one roof',
        highlight: '24/7 emergency · Cashless insurance · Multispeciality · Ambulance service',
        seoKeywords: ['hospital website india', 'multispeciality hospital website', 'nursing home website'],
      },
    },
  ],
  realestate: [
    { id: 'general', name: 'Real Estate' },
    {
      id: 'residential', name: 'Residential',
      keywords: ['residential', 'flats', 'apartments', 'villas', 'houses for sale', 'buy home'],
      content: {
        tagline: 'Find the Home That’s Right for You',
        shortDesc: 'Residential property website with listings, photo galleries and site-visit booking.',
        fullDesc: 'A website built for residential real-estate agents and builders. Buyers browse verified listings — apartments, villas and independent houses — filter by budget and configuration, view photos and floor details and book a site visit. Built to turn a serious buyer’s search into a walk-through.',
        heroHeadline: 'Your Dream Home Is a Click Away',
        heroSubline: 'Verified apartments, villas and houses — book a site visit online',
        highlight: 'Verified listings · Real photos · Home-loan assistance · Easy site visits',
        seoKeywords: ['residential property website', 'flats for sale website india', 'real estate agent website', 'buy apartment website'],
      },
    },
    {
      id: 'commercial', name: 'Commercial',
      keywords: ['commercial', 'office space', 'shops', 'showroom', 'commercial property'],
      content: {
        tagline: 'Space That Works for Your Business',
        shortDesc: 'Commercial property website with office, retail and warehouse listings and enquiry booking.',
        fullDesc: 'A website built for commercial real-estate agents. Businesses browse your listings — office spaces, retail showrooms, warehouses and commercial plots — with area, rent and location details, and enquire for a visit. Built to connect landlords and businesses looking for the right address.',
        heroHeadline: 'The Right Address for Your Business',
        heroSubline: 'Offices, showrooms, warehouses and commercial plots — for lease or sale',
        highlight: 'Prime locations · Ready-to-move · Lease or buy · Verified listings',
        seoKeywords: ['commercial property website', 'office space for rent website india', 'commercial real estate website', 'showroom for rent website'],
      },
    },
    {
      id: 'property-rent', name: 'Rentals',
      keywords: ['rent flat', 'flat for rent', 'house for rent', 'rent house', 'rent apartment', 'pg', 'pg accommodation', 'property for rent', 'flats on rent', 'rent a flat', 'rooms for rent'],
      content: {
        tagline: 'Rent Without the Runaround',
        shortDesc: 'Rental property website with flats, houses and PG listings and quick enquiry booking.',
        fullDesc: 'A website built for rental agents and property managers. Tenants browse available rentals — flats, independent houses and PG/shared accommodation — filter by budget and locality and enquire directly, no broker chase. Built to fill vacancies fast with genuine, ready-to-move listings.',
        heroHeadline: 'Move-In Ready Rentals, No Hassle',
        heroSubline: 'Flats, houses and PGs for rent — filter, enquire and move in',
        highlight: 'Verified rentals · Semi & fully furnished · PG options · Direct enquiry',
        seoKeywords: ['rental property website', 'flats for rent website india', 'pg accommodation website', 'house for rent website'],
      },
    },
  ],
  restaurant: [
    { id: 'general', name: 'Restaurant' },
    {
      id: 'cafe', name: 'Cafe',
      keywords: ['cafe', 'coffee shop', 'coffee', 'bistro', 'brew'],
      content: {
        tagline: 'Great Coffee, Good Vibes',
        shortDesc: 'Cafe website with a menu, ambience gallery and table reservations.',
        fullDesc: 'A website built for cafes and coffee shops. Guests browse your menu — specialty coffee, shakes, sandwiches, pasta and desserts — soak in your ambience through the gallery and reserve a table for their favourite corner. Built for the neighbourhood cafe that people come back to for the vibe as much as the coffee.',
        heroHeadline: 'Your Favourite Corner in the City',
        heroSubline: 'Specialty coffee, all-day bites and a place to linger',
        highlight: 'Freshly brewed · Free Wi-Fi · Cosy seating · Instagram-worthy',
        seoKeywords: ['cafe website india', 'coffee shop website', 'cafe menu website', 'cafe table booking'],
      },
    },
    {
      id: 'cloud-kitchen', name: 'Cloud Kitchen',
      keywords: ['cloud kitchen', 'delivery kitchen', 'ghost kitchen', 'dark kitchen', 'online food delivery', 'delivery only restaurant', 'tiffin service'],
      content: {
        tagline: 'Delivery-First Kitchen — Order Online, Delivered Hot',
        shortDesc: 'Cloud kitchen website with an online-order menu, delivery areas and WhatsApp ordering.',
        fullDesc: 'A website built for cloud kitchens and delivery-only food brands. Customers browse your delivery menu, place orders online or on WhatsApp, and check which areas you deliver to — all without a dine-in space. Perfect for multi-brand kitchens, tiffin services and food-delivery startups running on Swiggy and Zomato.',
        heroHeadline: 'Chef-Cooked Meals, Delivered to Your Door',
        heroSubline: 'Order online for fast delivery — no dine-in, all the flavour',
        highlight: 'Delivery only · 30–45 min · Live on Swiggy & Zomato · WhatsApp orders',
        seoKeywords: ['cloud kitchen website', 'delivery only restaurant website', 'ghost kitchen website india', 'online food ordering system'],
      },
    },
    {
      id: 'bakery', name: 'Bakery',
      keywords: ['bakery', 'cake shop', 'cakes', 'pastry', 'confectionery', 'custom cakes'],
      content: {
        tagline: 'Baked Fresh, Every Day',
        shortDesc: 'Bakery website with a product menu, custom-cake ordering and a bakes gallery.',
        fullDesc: 'A website built for bakeries and cake shops. Customers browse your bakes — cakes, breads, cookies and savouries — order custom birthday and wedding cakes online and see a gallery of your creations. Built for a bakery whose custom-cake orders come from photos people fall in love with.',
        heroHeadline: 'Cakes & Bakes Made with Love',
        heroSubline: 'Custom cakes, fresh breads, cookies and daily treats',
        highlight: 'Eggless options · Custom cakes · Same-day pickup · Made fresh daily',
        seoKeywords: ['bakery website india', 'cake shop website', 'custom cake order website', 'online cake booking'],
      },
    },
    {
      id: 'fine-dining', name: 'Fine Dining',
      keywords: ['fine dining', 'restaurant', 'family restaurant', 'multicuisine', 'multi cuisine', 'dine in', 'buffet', 'rooftop restaurant'],
      content: {
        tagline: 'An Experience, Not Just a Meal',
        shortDesc: 'Fine-dining restaurant website with a full menu, ambience gallery and table reservations.',
        fullDesc: 'A website built for full-service and fine-dining restaurants. Guests browse your multi-cuisine menu, view the ambience and chef’s specials, and reserve a table for the evening. Built to make a special-occasion diner choose you before they even walk in.',
        heroHeadline: 'Where Every Meal Feels Like an Occasion',
        heroSubline: 'Multi-cuisine menu, curated ambience and warm hospitality',
        highlight: 'Table reservations · Private dining · Chef specials · Full bar',
        seoKeywords: ['fine dining restaurant website', 'multicuisine restaurant website india', 'restaurant table reservation website', 'family restaurant website'],
      },
    },
  ],
  salon: [
    { id: 'general', name: 'Salon' },
    {
      id: 'spa', name: 'Spa',
      keywords: ['spa', 'massage', 'wellness', 'day spa', 'body spa'],
      content: {
        tagline: 'Unwind, Relax, Rejuvenate',
        shortDesc: 'Day spa website with a therapy menu, online booking and relaxing gallery.',
        fullDesc: 'A website built for spas and wellness centres. Guests browse your therapies — Swedish and deep-tissue massage, aromatherapy, body scrubs and couple packages — book their preferred slot online and see your calming ambience in the gallery. Designed to turn a stressed browser into a booked appointment.',
        heroHeadline: 'Your Escape from the Everyday',
        heroSubline: 'Massage, aromatherapy and body rituals in a calm, private setting',
        highlight: 'Certified therapists · Couple rooms · Hygienic & private · Easy online booking',
        seoKeywords: ['spa website india', 'day spa booking website', 'massage centre website', 'wellness spa website'],
      },
    },
    {
      id: 'nails', name: 'Nail Studio',
      keywords: ['nails', 'nail studio', 'nail art', 'manicure', 'pedicure', 'nail salon'],
      content: {
        tagline: 'Nails That Make a Statement',
        shortDesc: 'Nail studio website with a service menu, nail-art gallery and online booking.',
        fullDesc: 'A website built for nail studios and nail artists. Clients browse your services — gel extensions, nail art, manicures and pedicures — book appointments online and scroll a gallery of your best designs. Built for a business where the portfolio is the sales pitch.',
        heroHeadline: 'Gorgeous Nails, Every Single Visit',
        heroSubline: 'Gel extensions, custom nail art, manicures and pedicures',
        highlight: 'Sterilised tools · Latest designs · Gel & acrylic experts · Walk-ins welcome',
        seoKeywords: ['nail studio website', 'nail art salon website india', 'manicure pedicure booking website'],
      },
    },
    {
      id: 'bridal', name: 'Bridal & Makeup',
      keywords: ['bridal', 'bridal makeup', 'makeup artist', 'mua', 'beauty parlour', 'beauty parlor', 'party makeup', 'wedding makeup', 'ladies salon'],
      content: {
        tagline: 'Look Flawless on Your Big Day',
        shortDesc: 'Bridal makeup and beauty parlour website with packages, a portfolio gallery and enquiry booking.',
        fullDesc: 'A website built for bridal makeup artists and ladies’ beauty parlours. Brides browse your packages — bridal, engagement and party makeup, mehendi, pre-bridal skin and hair — view your portfolio and enquire for their wedding date. Built to win the bookings that get chosen months in advance on the strength of your gallery.',
        heroHeadline: 'Bridal Makeup That Turns Heads',
        heroSubline: 'HD & airbrush bridal looks, party makeup and complete pre-bridal care',
        highlight: 'HD & airbrush makeup · Trial available · Home service · Pre-bridal packages',
        seoKeywords: ['bridal makeup artist website', 'beauty parlour website india', 'makeup artist portfolio website', 'wedding makeup booking'],
      },
    },
    {
      id: 'mens-grooming', name: "Men's Grooming",
      keywords: ['mens salon', "men's salon", 'barber', 'barber shop', 'mens grooming', 'gents parlour', 'gents salon', 'beard', 'haircut for men'],
      content: {
        tagline: 'Sharp Looks, Every Time',
        shortDesc: "Men's salon and barbershop website with a service menu, membership plans and online booking.",
        fullDesc: 'A website built for men’s salons and barbershops. Clients browse your services — haircuts, beard styling, shaves, hair colour and facials — book a chair online and sign up for grooming memberships. Designed for the modern gents’ salon that runs on repeat regulars and walk-ins.',
        heroHeadline: 'Grooming Built for the Modern Man',
        heroSubline: 'Haircuts, beard styling, shaves and facials — book your chair online',
        highlight: 'Skilled barbers · Membership plans · Beard & hair experts · Quick booking',
        seoKeywords: ['mens salon website', 'barbershop website india', 'gents parlour website', 'mens grooming booking website'],
      },
    },
  ],
  gym: [
    { id: 'general', name: 'Gym' },
    {
      id: 'yoga', name: 'Yoga Studio',
      keywords: ['yoga', 'yoga studio', 'meditation', 'yoga classes', 'yoga teacher'],
      content: {
        tagline: 'Breathe. Balance. Belong.',
        shortDesc: 'Yoga studio website with class schedules, membership plans and easy online booking.',
        fullDesc: 'A website built for yoga studios and teachers. Students browse your classes — Hatha, Power, prenatal and meditation — see the weekly schedule, book their spot and buy memberships online. Designed to fill your mats with regulars, not just trial visitors.',
        heroHeadline: 'Find Your Calm, Build Your Strength',
        heroSubline: 'Hatha, Power, prenatal and meditation — for every level',
        highlight: 'Certified teachers · Small batches · Prenatal & beginners · Flexible timings',
        seoKeywords: ['yoga studio website', 'yoga classes website india', 'yoga booking website', 'meditation centre website'],
      },
    },
    {
      id: 'crossfit', name: 'CrossFit',
      keywords: ['crossfit', 'functional training', 'strength', 'wod', 'functional fitness'],
      content: {
        tagline: 'Stronger Every WOD',
        shortDesc: 'CrossFit box website with class plans, coach profiles and membership sign-up.',
        fullDesc: 'A website built for CrossFit boxes and functional-fitness gyms. Athletes browse your plans — drop-in classes, unlimited memberships and beginner on-ramps — meet your coaches and sign up online. Built for a community-driven box where the coaching is the product.',
        heroHeadline: 'Train Hard. Together.',
        heroSubline: 'Coached WODs, strength and conditioning for every fitness level',
        highlight: 'Certified coaches · Beginner on-ramp · Community WODs · Progress tracking',
        seoKeywords: ['crossfit box website', 'functional training gym website', 'crossfit membership website india'],
      },
    },
    {
      id: 'personal-training', name: 'Personal Training',
      keywords: ['personal trainer', 'personal training', 'fitness coach', 'weight loss', 'transformation', 'body transformation', 'online fitness coaching', 'pt'],
      content: {
        tagline: 'Your Goals, Your Personal Coach',
        shortDesc: 'Personal trainer website with coaching packages, transformation gallery and enquiry booking.',
        fullDesc: 'A website built for personal trainers and fitness coaches. Clients browse your packages — one-on-one training, weight-loss and transformation programs and online coaching — see real client transformations and book a free consultation. Built to turn your results into your best marketing.',
        heroHeadline: 'Real Coaching. Real Results.',
        heroSubline: 'Personalised training, nutrition and transformation programs',
        highlight: 'Custom plans · Diet guidance · In-person or online · Proven transformations',
        seoKeywords: ['personal trainer website', 'fitness coach website india', 'weight loss transformation website', 'online fitness coaching website'],
      },
    },
    {
      id: 'dance-fitness', name: 'Zumba & Dance Fitness',
      keywords: ['zumba', 'dance fitness', 'aerobics', 'dance workout', 'zumba classes', 'cardio dance'],
      content: {
        tagline: 'Sweat It Out, Dance It Off',
        shortDesc: 'Zumba and dance-fitness studio website with class schedules, batch plans and online booking.',
        fullDesc: 'A website built for Zumba and dance-fitness studios. Members browse your classes — Zumba, aerobics, cardio dance and weight-loss batches — see timings and book online. Designed for high-energy studios that grow on word of mouth and packed morning and evening batches.',
        heroHeadline: 'Fitness That Feels Like a Party',
        heroSubline: 'Zumba, aerobics and cardio dance — burn calories, have fun',
        highlight: 'Licensed instructors · Morning & evening batches · All levels · Fun cardio',
        seoKeywords: ['zumba classes website', 'dance fitness studio website india', 'aerobics classes website'],
      },
    },
  ],
  education: [
    { id: 'general', name: 'School' },
    {
      id: 'coaching', name: 'Coaching Centre',
      keywords: ['coaching', 'coaching centre', 'tuition', 'test prep', 'competitive exam', 'iit jee', 'neet coaching'],
      content: {
        tagline: 'Coaching That Delivers Results',
        shortDesc: 'Coaching centre website with course listings, faculty profiles and admission enquiry.',
        fullDesc: 'A website built for coaching centres and tuition institutes. Students and parents browse your courses — JEE, NEET, board foundation and crash courses — meet your faculty, see results and enquire for admission. Built to convert the results-driven parent comparing coaching options in your area.',
        heroHeadline: 'Turn Hard Work into Top Ranks',
        heroSubline: 'JEE, NEET and board coaching from experienced faculty',
        highlight: 'Experienced faculty · Proven results · Small batches · Regular tests',
        seoKeywords: ['coaching centre website', 'coaching institute website india', 'jee neet coaching website', 'tuition centre website'],
      },
    },
    {
      id: 'college', name: 'College',
      keywords: ['college', 'university', 'degree', 'higher education', 'admission', 'engineering college'],
      content: {
        tagline: 'Where Ambition Meets Opportunity',
        shortDesc: 'College website with programs, admissions info, campus gallery and enquiry.',
        fullDesc: 'A website built for colleges and institutes of higher education. Prospective students browse your programs — engineering, commerce, management and diplomas — see campus facilities, placements and admission details and enquire online. Built to be the credible information hub families rely on during admission season.',
        heroHeadline: 'Build Your Future on a Strong Foundation',
        heroSubline: 'UG and PG programs with modern campuses and strong placements',
        highlight: 'Approved programs · Modern campus · Placement support · Scholarships',
        seoKeywords: ['college website india', 'college admission website', 'university website', 'engineering college website'],
      },
    },
  ],
  retail: [
    { id: 'general', name: 'Store' },
    {
      id: 'fashion', name: 'Fashion & Clothing',
      keywords: ['fashion', 'clothing', 'boutique', 'apparel', 'garments', 'ladies wear', 'mens wear', 'ethnic wear', 'saree', 'dress shop', 'clothing store'],
      content: {
        tagline: 'Style That Speaks for You',
        shortDesc: 'Fashion boutique website with a product catalogue, collections gallery and WhatsApp ordering.',
        fullDesc: 'A website built for clothing boutiques and fashion stores. Shoppers browse your collections — ethnic wear, western wear, sarees and accessories — see new arrivals and enquire or order over WhatsApp. Built for a boutique whose catalogue and new-arrival photos do the selling.',
        heroHeadline: 'The Latest Looks, In Store & Online',
        heroSubline: 'Ethnic, western and party wear — new arrivals every week',
        highlight: 'New arrivals weekly · All sizes · WhatsApp orders · Home trial in select areas',
        seoKeywords: ['clothing boutique website', 'fashion store website india', 'online clothing catalogue website', 'garment shop website'],
      },
    },
    {
      id: 'electronics', name: 'Electronics & Mobiles',
      keywords: ['electronics', 'mobile shop', 'mobile store', 'mobiles', 'gadgets', 'appliances', 'laptop', 'electronics store', 'mobile showroom'],
      content: {
        tagline: 'Latest Gadgets, Best Prices',
        shortDesc: 'Electronics and mobile store website with a product catalogue, offers and enquiry ordering.',
        fullDesc: 'A website built for electronics and mobile stores. Customers browse your products — smartphones, laptops, accessories and home appliances — check the latest offers and EMI options and enquire before they visit. Built to bring footfall to a store competing with online marketplaces on trust and service.',
        heroHeadline: 'Smartphones, Gadgets & Appliances',
        heroSubline: 'Genuine products, easy EMI and after-sales service you can trust',
        highlight: 'Latest models · No-cost EMI · Genuine warranty · Exchange offers',
        seoKeywords: ['mobile shop website', 'electronics store website india', 'gadget shop website', 'appliance store website'],
      },
    },
    {
      id: 'grocery', name: 'Grocery & Supermarket',
      keywords: ['grocery', 'supermarket', 'kirana', 'grocery store', 'departmental store', 'provision store', 'daily needs', 'grocery delivery'],
      content: {
        tagline: 'Your Neighbourhood Store, Online',
        shortDesc: 'Grocery and supermarket website with a product list, offers and home-delivery ordering.',
        fullDesc: 'A website built for grocery stores and supermarkets. Customers browse everyday essentials — staples, fresh produce, packaged foods and household items — see weekly offers and place home-delivery orders on WhatsApp. Built to turn a local kirana into an online-ordering neighbourhood favourite.',
        heroHeadline: 'Daily Essentials, Delivered to Your Door',
        heroSubline: 'Groceries, fresh produce and household needs — order in minutes',
        highlight: 'Home delivery · Weekly offers · Fresh stock daily · WhatsApp ordering',
        seoKeywords: ['grocery store website', 'supermarket website india', 'kirana store website', 'grocery home delivery website'],
      },
    },
    {
      id: 'jewellery', name: 'Jewellery',
      keywords: ['jewellery', 'jewelry', 'jeweller', 'gold', 'gold shop', 'diamond', 'silver', 'ornaments', 'jewellery shop'],
      content: {
        tagline: 'Timeless Craft, Trusted for Generations',
        shortDesc: 'Jewellery showroom website with a collections gallery, designs catalogue and enquiry booking.',
        fullDesc: 'A website built for jewellery showrooms and jewellers. Customers browse your collections — gold, diamond, silver and bridal sets — view intricate designs and enquire for a showroom visit or custom order. Built for a business where trust and a stunning gallery close the sale.',
        heroHeadline: 'Jewellery as Special as the Moment',
        heroSubline: 'Gold, diamond and bridal collections — hallmarked and certified',
        highlight: 'BIS hallmarked · Certified diamonds · Custom designs · Buyback assurance',
        seoKeywords: ['jewellery showroom website', 'gold shop website india', 'jewellery shop website', 'diamond jewellery website'],
      },
    },
  ],
  travel: [
    { id: 'general', name: 'Travel Agency' },
    {
      id: 'holiday-packages', name: 'Holiday Packages',
      keywords: ['holiday packages', 'tour package', 'tour operator', 'holiday', 'vacation', 'honeymoon', 'family tour', 'travel packages', 'trip'],
      content: {
        tagline: 'Your Perfect Getaway, Planned for You',
        shortDesc: 'Tour operator website with holiday packages, destination gallery and enquiry booking.',
        fullDesc: 'A website built for tour operators and holiday planners. Travellers browse your curated packages — hill stations, beaches, honeymoons and family tours — see day-wise itineraries and enquire for custom trips. Built to turn a dream destination photo into a booked, all-inclusive package.',
        heroHeadline: 'Handcrafted Holidays, Zero Hassle',
        heroSubline: 'Curated tour packages with stays, sightseeing and transfers included',
        highlight: 'Custom itineraries · All-inclusive · Verified stays · 24/7 trip support',
        seoKeywords: ['tour operator website', 'holiday package website india', 'travel packages website', 'honeymoon package website'],
      },
    },
    {
      id: 'cab-rental', name: 'Cab & Car Rental',
      keywords: ['cab', 'taxi', 'car rental', 'cab rental', 'car hire', 'airport taxi', 'outstation cab', 'tempo traveller', 'self drive'],
      content: {
        tagline: 'Reliable Rides, Anytime, Anywhere',
        shortDesc: 'Cab and car-rental website with a fleet list, fare enquiry and instant booking.',
        fullDesc: 'A website built for taxi and car-rental services. Customers browse your fleet — sedans, SUVs and tempo travellers — check fares for airport transfers, city trips and outstation travel, and book online. Built for an operator who wins on clean cars, on-time pickups and transparent fares.',
        heroHeadline: 'Book a Cab in Seconds',
        heroSubline: 'Airport transfers, city rides and outstation trips — clean cars, fair fares',
        highlight: 'On-time pickup · Transparent fares · GPS-tracked · Verified drivers',
        seoKeywords: ['cab booking website', 'car rental website india', 'taxi service website', 'outstation cab website'],
      },
    },
    {
      id: 'visa-ticketing', name: 'Visa & Ticketing',
      keywords: ['visa', 'passport', 'flight ticket', 'ticketing', 'air ticket', 'travel agent', 'forex', 'international travel', 'visa assistance'],
      content: {
        tagline: 'Flights, Visas & Everything Between',
        shortDesc: 'Travel agency website for flight ticketing, visa assistance and forex — with quick enquiry.',
        fullDesc: 'A website built for travel agencies handling ticketing and visas. Travellers enquire for domestic and international flight tickets, visa and passport assistance, travel insurance and forex — all from one trusted local agent. Built to be the reassuring first call for anyone planning to fly abroad.',
        heroHeadline: 'Your One-Stop Travel Desk',
        heroSubline: 'Flight tickets, visa assistance, insurance and forex — sorted',
        highlight: 'Visa assistance · Best fares · Travel insurance · Forex support',
        seoKeywords: ['travel agency website india', 'visa assistance website', 'flight ticketing website', 'air ticket booking agency'],
      },
    },
    {
      id: 'pilgrimage', name: 'Pilgrimage Tours',
      keywords: ['pilgrimage', 'religious tour', 'temple tour', 'char dham', 'tirupati', 'yatra', 'spiritual tour', 'devotional tour'],
      content: {
        tagline: 'Journeys of Faith, Cared For',
        shortDesc: 'Pilgrimage tour website with yatra packages, darshan assistance and enquiry booking.',
        fullDesc: 'A website built for pilgrimage and religious-tour operators. Devotees browse your yatra packages — Char Dham, Tirupati, Vaishno Devi and temple circuits — with darshan assistance, comfortable stays and elder-friendly arrangements, and enquire for group or family bookings. Built with the trust and care this segment relies on.',
        heroHeadline: 'Sacred Journeys, Thoughtfully Arranged',
        heroSubline: 'Char Dham, Tirupati and temple yatras with darshan assistance',
        highlight: 'Darshan assistance · Elder-friendly · Comfortable stays · Group tours',
        seoKeywords: ['pilgrimage tour website', 'yatra package website india', 'char dham tour website', 'religious tour operator website'],
      },
    },
  ],
  professional: [
    { id: 'general', name: 'Professional Services' },
    {
      id: 'ca-accounting', name: 'CA & Accounting',
      keywords: ['ca', 'chartered accountant', 'accounting', 'accountant', 'gst', 'gst filing', 'income tax', 'itr', 'bookkeeping', 'tax consultant', 'auditor'],
      content: {
        tagline: 'Numbers Handled, Compliance Sorted',
        shortDesc: 'Chartered accountant website with tax, GST and accounting services and consultation booking.',
        fullDesc: 'A website built for chartered accountants and tax consultants. Clients browse your services — GST and income-tax filing, bookkeeping, audit and business compliance — and book a consultation. Built to be the credible, professional front for a practice that runs on trust and referrals.',
        heroHeadline: 'Your Trusted Tax & Accounting Partner',
        heroSubline: 'GST, income tax, bookkeeping and audit — accurate and on time',
        highlight: 'GST & ITR filing · Bookkeeping · Audit · Timely compliance',
        seoKeywords: ['chartered accountant website', 'ca firm website india', 'gst filing service website', 'tax consultant website'],
      },
    },
    {
      id: 'legal', name: 'Legal & Advocates',
      keywords: ['lawyer', 'advocate', 'legal', 'legal services', 'attorney', 'law firm', 'legal consultation', 'property lawyer', 'divorce lawyer'],
      content: {
        tagline: 'Sound Legal Counsel You Can Rely On',
        shortDesc: 'Advocate and law-firm website with practice areas, lawyer profiles and consultation booking.',
        fullDesc: 'A website built for advocates and law firms. Clients browse your practice areas — civil, criminal, family, property and corporate law — read your credentials and book a confidential consultation. Built to project the credibility and discretion clients look for before they pick up the phone.',
        heroHeadline: 'Experienced Advocates, Practical Advice',
        heroSubline: 'Civil, criminal, family, property and corporate legal services',
        highlight: 'Confidential · Experienced advocates · Clear fees · First consultation available',
        seoKeywords: ['advocate website india', 'law firm website', 'lawyer website', 'legal services website'],
      },
    },
    {
      id: 'company-registration', name: 'Company Registration',
      keywords: ['company registration', 'startup registration', 'business registration', 'pvt ltd', 'llp', 'incorporation', 'trademark', 'compliance', 'roc filing'],
      content: {
        tagline: 'Start & Run Your Business, By the Book',
        shortDesc: 'Business registration website with incorporation, trademark and compliance services.',
        fullDesc: 'A website built for company-registration and compliance consultants. Founders browse your services — Pvt Ltd, LLP and startup registration, trademark, ROC filing and ongoing compliance — with clear pricing and timelines, and enquire online. Built to convert first-time founders who want a hassle-free, fixed-price setup.',
        heroHeadline: 'Register Your Company, Hassle-Free',
        heroSubline: 'Pvt Ltd, LLP, trademark and compliance — fixed price, clear timelines',
        highlight: 'Fixed pricing · Fast turnaround · End-to-end · Ongoing compliance',
        seoKeywords: ['company registration website india', 'startup registration service website', 'trademark registration website', 'business compliance website'],
      },
    },
    {
      id: 'insurance', name: 'Insurance Advisory',
      keywords: ['insurance', 'insurance advisor', 'insurance agent', 'lic', 'life insurance', 'health insurance', 'motor insurance', 'policy', 'mutual fund advisor'],
      content: {
        tagline: 'Protect What Matters Most',
        shortDesc: 'Insurance advisory website with plan categories, comparison guidance and enquiry booking.',
        fullDesc: 'A website built for insurance advisors and agents. Clients browse the cover you offer — life, health, motor and investment plans — get help comparing options and enquire for a personalised recommendation. Built to establish an advisor as the trustworthy expert families rely on for the right cover.',
        heroHeadline: 'The Right Cover, Honest Advice',
        heroSubline: 'Life, health, motor and investment plans — compared and explained',
        highlight: 'Personalised advice · Multiple insurers · Claim support · No pushy selling',
        seoKeywords: ['insurance advisor website', 'insurance agent website india', 'health insurance advisor website', 'life insurance agent website'],
      },
    },
  ],
  petcare: [
    { id: 'general', name: 'Pet Care' },
    {
      id: 'veterinary', name: 'Veterinary Clinic',
      keywords: ['vet', 'veterinary', 'veterinarian', 'pet clinic', 'animal hospital', 'pet doctor', 'pet vaccination', 'dog clinic', 'cat clinic'],
      content: {
        tagline: 'Expert Vet Care for Every Pet',
        shortDesc: 'Veterinary clinic website with services, online appointment booking and vaccination reminders.',
        fullDesc: 'A website built for veterinary clinics and pet hospitals. Pet parents browse your services — consultations, vaccinations, deworming, surgery and diagnostics — book appointments online and get vaccination reminders. Built to be the trusted first stop when a pet needs a doctor.',
        heroHeadline: 'Healthy Pets, Happy Families',
        heroSubline: 'Consultations, vaccinations, surgery and emergency vet care',
        highlight: 'Qualified vets · Vaccination reminders · Surgery · Emergency care',
        seoKeywords: ['veterinary clinic website', 'vet appointment booking website', 'animal hospital website india', 'pet doctor website'],
      },
    },
    {
      id: 'grooming', name: 'Pet Grooming',
      keywords: ['pet grooming', 'dog grooming', 'cat grooming', 'pet spa', 'pet salon', 'dog bath', 'pet haircut'],
      content: {
        tagline: 'Pampering Your Pet, Head to Paw',
        shortDesc: 'Pet grooming studio website with a grooming menu, packages and online booking.',
        fullDesc: 'A website built for pet grooming studios and pet spas. Owners browse your grooming services — bath and blow-dry, haircuts, nail trimming, de-shedding and spa packages — and book a slot online or request a home visit. Built for a business where the before/after photos sell every appointment.',
        heroHeadline: 'Grooming Your Pet Will Love',
        heroSubline: 'Bath, haircut, nail care and spa packages — in studio or at home',
        highlight: 'Gentle handling · Breed-specific cuts · Home service · Spa packages',
        seoKeywords: ['pet grooming website', 'dog grooming website india', 'pet spa website', 'mobile pet grooming website'],
      },
    },
    {
      id: 'boarding', name: 'Pet Boarding & Daycare',
      keywords: ['pet boarding', 'dog boarding', 'pet daycare', 'dog hostel', 'pet hostel', 'cattery', 'pet sitting'],
      content: {
        tagline: 'A Home Away from Home for Your Pet',
        shortDesc: 'Pet boarding and daycare website with plans, facility gallery and booking enquiry.',
        fullDesc: 'A website built for pet boarding and daycare centres. Owners browse your day and overnight plans, see your safe, clean facilities in the gallery and book stays online — with meals, play and updates included. Built to reassure the anxious pet parent leaving town.',
        heroHeadline: 'Safe, Loving Care While You’re Away',
        heroSubline: 'Day boarding and overnight stays with play, meals and daily updates',
        highlight: 'Supervised play · Clean kennels · Daily photo updates · Vet on call',
        seoKeywords: ['pet boarding website', 'dog boarding daycare website india', 'pet hostel website', 'dog daycare website'],
      },
    },
    {
      id: 'petshop', name: 'Pet Shop & Supplies',
      keywords: ['pet shop', 'pet store', 'pet supplies', 'pet food', 'dog food', 'cat food', 'pet accessories', 'aquarium'],
      content: {
        tagline: 'Everything Your Pet Needs',
        shortDesc: 'Pet shop website with a product catalogue, offers and home-delivery enquiry.',
        fullDesc: 'A website built for pet shops and pet-supply stores. Customers browse your products — pet food, treats, toys, accessories and aquarium supplies — check offers and order for home delivery on WhatsApp. Built to keep regulars restocking with you instead of an app.',
        heroHeadline: 'Quality Food, Toys & Accessories',
        heroSubline: 'Premium pet food, treats, toys and accessories — delivered home',
        highlight: 'Trusted brands · Home delivery · Fresh stock · Aquarium & bird supplies',
        seoKeywords: ['pet shop website', 'pet supplies website india', 'pet food store website', 'online pet store website'],
      },
    },
  ],
  movers: [
    { id: 'general', name: 'Packers & Movers' },
    {
      id: 'local-shifting', name: 'Local Shifting',
      keywords: ['local shifting', 'house shifting', 'home shifting', 'local movers', 'within city shifting', 'local packers'],
      content: {
        tagline: 'Your City Move, Handled with Care',
        shortDesc: 'Local shifting website with instant quote enquiry, packing services and a move checklist.',
        fullDesc: 'A website built for local packers and movers. Customers get a quick quote for within-city home shifting, share their item list and book professional packing, loading and transport — all in a day. Built to win the last-minute, price-comparing local mover enquiry with a clear, fast quote.',
        heroHeadline: 'Fast, Safe Local Home Shifting',
        heroSubline: 'Same-city moves with professional packing, loading and transport',
        highlight: 'Same-day moves · Trained crew · Careful packing · Transparent pricing',
        seoKeywords: ['local shifting website', 'home shifting services website india', 'local packers and movers website'],
      },
    },
    {
      id: 'intercity', name: 'Intercity Moving',
      keywords: ['intercity', 'interstate', 'intercity moving', 'city to city shifting', 'long distance moving', 'domestic relocation'],
      content: {
        tagline: 'City to City, Door to Door',
        shortDesc: 'Intercity moving website with quote enquiry, insured transit info and move tracking.',
        fullDesc: 'A website built for intercity and interstate movers. Customers get quotes for long-distance home relocation, see your insured-transit and coverage details and share their inventory for an accurate estimate. Built to reassure a family moving across states that their belongings are in safe hands.',
        heroHeadline: 'Long-Distance Moves Made Simple',
        heroSubline: 'City-to-city relocation with insured transit and on-time delivery',
        highlight: 'Insured transit · GPS-tracked · Dedicated vehicles · Pan-India coverage',
        seoKeywords: ['intercity movers website', 'interstate relocation website india', 'long distance packers and movers website'],
      },
    },
    {
      id: 'office-relocation', name: 'Office Relocation',
      keywords: ['office relocation', 'office shifting', 'commercial shifting', 'corporate relocation', 'office movers'],
      content: {
        tagline: 'Move Your Office, Not Your Momentum',
        shortDesc: 'Office relocation website with planning services, quote enquiry and minimal-downtime moves.',
        fullDesc: 'A website built for commercial and office movers. Businesses request a survey and quote for office shifting — IT equipment, furniture and records handled with a planned, minimal-downtime move over weekends. Built to land the corporate contracts that value process over price.',
        heroHeadline: 'Seamless Office Relocation',
        heroSubline: 'Planned, minimal-downtime moves for offices and businesses',
        highlight: 'Weekend moves · IT & furniture handling · Insured · Dedicated coordinator',
        seoKeywords: ['office relocation website', 'commercial shifting website india', 'corporate movers website'],
      },
    },
    {
      id: 'vehicle-transport', name: 'Vehicle Transport',
      keywords: ['vehicle transport', 'car transport', 'bike transport', 'car carrier', 'car shifting', 'two wheeler transport'],
      content: {
        tagline: 'Your Vehicle, Delivered Safely',
        shortDesc: 'Vehicle transport website with quote enquiry, covered-carrier info and tracking.',
        fullDesc: 'A website built for car and bike transport services. Customers get quotes to move their vehicle city-to-city in enclosed carriers, with insurance and door-to-door pickup and delivery. Built for the relocating professional who needs their car moved without a scratch.',
        heroHeadline: 'Safe Car & Bike Transport, Anywhere',
        heroSubline: 'Enclosed carriers, insured transit and door-to-door delivery',
        highlight: 'Covered carriers · Insured · Door-to-door · GPS tracking',
        seoKeywords: ['car transport website india', 'vehicle transport service website', 'bike transport website', 'car carrier website'],
      },
    },
  ],
  astrology: [
    { id: 'general', name: 'Astrology & Spiritual' },
    {
      id: 'astrologer', name: 'Astrologer',
      keywords: ['astrologer', 'astrology', 'jyotish', 'kundli', 'horoscope', 'zodiac', 'birth chart', 'best astrologer', 'online astrology'],
      content: {
        tagline: 'Answers Written in the Stars',
        shortDesc: 'Astrologer website with consultation services, online booking and client testimonials.',
        fullDesc: 'A website built for astrologers and jyotish consultants. Clients browse your services — kundli readings, career, marriage and health predictions and remedies — and book a consultation by phone, video or in person. Built to turn a searcher looking for a trusted astrologer into a booked, paid consultation.',
        heroHeadline: 'Trusted Astrology Guidance',
        heroSubline: 'Kundli readings and predictions for career, marriage and life',
        highlight: 'Vedic astrology · Phone / video consults · Remedies · 100% private',
        seoKeywords: ['astrologer website', 'online astrology consultation website', 'kundli reading website india', 'best astrologer website'],
      },
    },
    {
      id: 'numerology', name: 'Numerology',
      keywords: ['numerology', 'numerologist', 'name correction', 'lucky number', 'name numerology', 'business name numerology'],
      content: {
        tagline: 'The Power of the Right Numbers',
        shortDesc: 'Numerology website with reports, name-correction services and online booking.',
        fullDesc: 'A website built for numerologists. Clients browse your services — personal and business name analysis, name correction, lucky numbers and compatibility reports — and book a consultation online. Built for a practice where a clear, credible site converts curious visitors into paying clients.',
        heroHeadline: 'Align Your Name with Your Destiny',
        heroSubline: 'Personal and business numerology, name correction and lucky numbers',
        highlight: 'Detailed reports · Name correction · Business numerology · Online consults',
        seoKeywords: ['numerology website', 'numerologist website india', 'name correction numerology website', 'business numerology website'],
      },
    },
    {
      id: 'vastu', name: 'Vastu Consultant',
      keywords: ['vastu', 'vastu shastra', 'vastu consultant', 'vastu expert', 'home vastu', 'office vastu', 'vastu for home'],
      content: {
        tagline: 'Harmony for Home and Workplace',
        shortDesc: 'Vastu consultant website with services, on-site/online reviews and enquiry booking.',
        fullDesc: 'A website built for vastu consultants. Clients browse your services — home, office, plot and factory vastu reviews with practical, no-demolition remedies — and book an on-site or online consultation. Built to establish the authority and trust this advisory business depends on.',
        heroHeadline: 'Positive Energy by Design',
        heroSubline: 'Vastu reviews for homes, offices and plots — practical remedies',
        highlight: 'On-site & online · No-demolition remedies · Home & commercial · Detailed report',
        seoKeywords: ['vastu consultant website', 'vastu expert website india', 'home vastu consultation website', 'office vastu website'],
      },
    },
    {
      id: 'pandit-puja', name: 'Pandit & Puja Services',
      keywords: ['pandit', 'priest', 'puja', 'pooja', 'puja services', 'pandit for puja', 'havan', 'griha pravesh', 'satyanarayan puja'],
      content: {
        tagline: 'Sacred Ceremonies, Done Right',
        shortDesc: 'Pandit and puja-services website with ceremony listings, samagri info and booking.',
        fullDesc: 'A website built for pandits and puja-service providers. Families browse ceremonies — griha pravesh, satyanarayan puja, havan, wedding and last rites — book an experienced pandit and arrange samagri, in the language and tradition they follow. Built to be the reliable first call for an auspicious occasion.',
        heroHeadline: 'Experienced Pandits for Every Occasion',
        heroSubline: 'Griha pravesh, satyanarayan puja, havan, weddings and more',
        highlight: 'Experienced pandits · Samagri arranged · All traditions · Book by date',
        seoKeywords: ['pandit booking website', 'puja services website india', 'online pandit website', 'pooja booking website'],
      },
    },
  ],
  pestcontrol: [
    { id: 'general', name: 'Pest Control' },
    {
      id: 'general-pest', name: 'General Pest Control',
      keywords: ['pest control', 'cockroach', 'cockroach control', 'ant control', 'general pest', 'pest control service', 'disinfection'],
      content: {
        tagline: 'A Clean, Pest-Free Home',
        shortDesc: 'General pest control website with treatment plans, safe-chemical info and online booking.',
        fullDesc: 'A website built for general pest-control services. Customers book treatment for cockroaches, ants and household pests, see your pet- and child-safe methods and choose one-time or AMC plans. Built to be the reassuring, professional choice over an unknown local sprayer.',
        heroHeadline: 'Household Pests, Handled Safely',
        heroSubline: 'Cockroach, ant and general pest treatment — pet & child safe',
        highlight: 'Odourless chemicals · Pet & child safe · Same-week service · AMC available',
        seoKeywords: ['general pest control website', 'cockroach control service website', 'pest control booking website india'],
      },
    },
    {
      id: 'termite', name: 'Termite Treatment',
      keywords: ['termite', 'termite treatment', 'anti termite', 'white ants', 'wood borer', 'termite control'],
      content: {
        tagline: 'Protect Your Home from Termites',
        shortDesc: 'Anti-termite treatment website with warranty plans, pre/post-construction options and booking.',
        fullDesc: 'A website built for termite-treatment specialists. Homeowners and builders book anti-termite treatment — pre- and post-construction — with multi-year warranties and drilling/injection methods explained. Built to win the high-value, warranty-backed jobs that protect a property investment.',
        heroHeadline: 'Stop Termites Before They Spread',
        heroSubline: 'Warranty-backed anti-termite treatment for homes and buildings',
        highlight: 'Up to 5-year warranty · Pre & post-construction · Certified · Free inspection',
        seoKeywords: ['termite treatment website', 'anti termite service website india', 'termite control company website'],
      },
    },
    {
      id: 'rodent', name: 'Rodent Control',
      keywords: ['rodent', 'rat control', 'rodent control', 'rats', 'mice', 'mouse control'],
      content: {
        tagline: 'Rats Out, Peace of Mind In',
        shortDesc: 'Rodent control website with safe baiting, exclusion services and booking.',
        fullDesc: 'A website built for rodent-control services. Homes and businesses book rat and mouse control using safe baiting, trapping and exclusion — with follow-up visits and food-safe methods for kitchens and warehouses. Built for the urgent, don’t-want-to-see-another-rat enquiry.',
        heroHeadline: 'Effective, Safe Rodent Control',
        heroSubline: 'Rat and mouse management with baiting, trapping and prevention',
        highlight: 'Food-safe methods · Warehouses & kitchens · Follow-up visits · Discreet service',
        seoKeywords: ['rodent control website', 'rat control service website india', 'pest control for rats website'],
      },
    },
    {
      id: 'bedbug', name: 'Bed Bug Treatment',
      keywords: ['bed bug', 'bedbug', 'bed bug treatment', 'bed bug control', 'khatmal'],
      content: {
        tagline: 'Sleep Easy, Bed-Bug Free',
        shortDesc: 'Bed bug treatment website with targeted service, hotel/PG plans and booking.',
        fullDesc: 'A website built for bed-bug treatment specialists. Homes, hotels and PGs book targeted heat and chemical treatment with follow-up visits to fully clear infestations. Built for a discreet, urgent service where results and privacy matter most.',
        heroHeadline: 'Get Rid of Bed Bugs — Completely',
        heroSubline: 'Targeted treatment for homes, hotels and PGs with follow-up',
        highlight: 'Complete elimination · Follow-up included · Homes, hotels & PGs · Discreet',
        seoKeywords: ['bed bug treatment website', 'bed bug control service website india', 'bed bug pest control website'],
      },
    },
  ],
  interior: [
    { id: 'general', name: 'Interior Design' },
    {
      id: 'residential-interior', name: 'Home Interiors',
      keywords: ['interior designer', 'home interior', 'residential interior', 'home decor', 'flat interior', 'house interior', 'interior design'],
      content: {
        tagline: 'Your Dream Home, Designed Beautifully',
        shortDesc: 'Home interior design website with a portfolio, packages and consultation booking.',
        fullDesc: 'A website built for residential interior designers. Homeowners browse your portfolio of living rooms, bedrooms and kitchens, explore turnkey packages with 3D visualisation and book a design consultation. Built so a stunning portfolio does the convincing before the first meeting.',
        heroHeadline: 'Interiors That Feel Like Home',
        heroSubline: 'Turnkey home interiors with 3D design and on-time handover',
        highlight: 'Free consult · 3D visualisation · Turnkey execution · Transparent quotes',
        seoKeywords: ['home interior designer website', 'residential interior design website india', 'flat interior design website'],
      },
    },
    {
      id: 'modular-kitchen', name: 'Modular Kitchen',
      keywords: ['modular kitchen', 'kitchen design', 'modular kitchen designer', 'kitchen interior', 'kitchen cabinets'],
      content: {
        tagline: 'A Kitchen That Works as Good as It Looks',
        shortDesc: 'Modular kitchen website with designs, finishes catalogue and quote enquiry.',
        fullDesc: 'A website built for modular-kitchen specialists. Customers browse kitchen layouts — L-shape, U-shape, island and parallel — see finishes and accessories and get a quote. Built to convert the homeowner comparing modular-kitchen brands on design and price.',
        heroHeadline: 'Modular Kitchens Built Around You',
        heroSubline: 'Smart layouts, quality finishes and premium fittings',
        highlight: 'Custom layouts · Quality hardware · 10-year warranty · Free 3D design',
        seoKeywords: ['modular kitchen website', 'modular kitchen designer website india', 'kitchen interior design website'],
      },
    },
    {
      id: 'commercial-interior', name: 'Office & Commercial',
      keywords: ['office interior', 'commercial interior', 'office design', 'shop interior', 'showroom interior', 'restaurant interior', 'workspace design'],
      content: {
        tagline: 'Workspaces That Work Harder',
        shortDesc: 'Commercial interior design website with a portfolio, fit-out services and enquiry.',
        fullDesc: 'A website built for commercial interior designers. Businesses browse your office, retail and hospitality projects, explore fit-out services and enquire for a walkthrough and quote. Built to win the contracts that value process, timelines and a strong project portfolio.',
        heroHeadline: 'Interiors That Elevate Your Brand',
        heroSubline: 'Office, retail and hospitality design and fit-out',
        highlight: 'Space planning · Fast fit-out · Brand-led design · Turnkey delivery',
        seoKeywords: ['office interior designer website', 'commercial interior design website india', 'shop interior design website'],
      },
    },
    {
      id: 'false-ceiling', name: 'False Ceiling & POP',
      keywords: ['false ceiling', 'pop', 'gypsum ceiling', 'pop ceiling', 'ceiling design', 'pvc ceiling'],
      content: {
        tagline: 'Ceilings That Make a Room',
        shortDesc: 'False ceiling and POP website with design options, per-sqft pricing and booking.',
        fullDesc: 'A website built for false-ceiling and POP contractors. Customers browse gypsum, POP and PVC ceiling designs with cove lighting, see clear per-square-foot pricing and enquire for a site measurement. Built for a trade business where visible work quality wins referrals.',
        heroHeadline: 'Stylish False Ceilings & POP Work',
        heroSubline: 'Gypsum, POP and PVC ceilings with modern lighting',
        highlight: 'Per-sqft pricing · Cove lighting · Neat finish · Quick execution',
        seoKeywords: ['false ceiling website', 'pop ceiling contractor website india', 'gypsum ceiling design website'],
      },
    },
  ],
  homeservices: [
    { id: 'general', name: 'Home Services' },
    {
      id: 'electrician', name: 'Electrician',
      keywords: ['electrician', 'electrical', 'wiring', 'electrical repair', 'fan repair', 'switch board', 'electric work'],
      content: {
        tagline: 'Reliable Electricians, On Call',
        shortDesc: 'Electrician services website with fixed pricing, online booking and same-day visits.',
        fullDesc: 'A website built for electricians and electrical services. Customers book wiring, switchboard, fan, light and fault-repair work with upfront pricing and same-day visits. Built to turn the urgent “need an electrician now” search into a booked, trusted visit.',
        heroHeadline: 'Electrical Work Done Right',
        heroSubline: 'Wiring, repairs, fans and fittings — verified electricians at your door',
        highlight: 'Upfront pricing · Same-day visits · Verified electricians · 30-day warranty',
        seoKeywords: ['electrician website', 'electrician service website india', 'electrical repair booking website'],
      },
    },
    {
      id: 'plumber', name: 'Plumber',
      keywords: ['plumber', 'plumbing', 'plumbing repair', 'leak repair', 'tap repair', 'pipe repair', 'bathroom fitting'],
      content: {
        tagline: 'Plumbing Problems, Fixed Fast',
        shortDesc: 'Plumber services website with fixed pricing, online booking and quick response.',
        fullDesc: 'A website built for plumbers and plumbing services. Customers book leak repairs, tap and pipe work, blockage clearing and bathroom fittings with transparent pricing and fast response. Built for the emergency-leak enquiry that needs a plumber today.',
        heroHeadline: 'Fast, Reliable Plumbing Help',
        heroSubline: 'Leaks, taps, blockages and fittings — fixed the same day',
        highlight: 'Quick response · Upfront pricing · Verified plumbers · Neat work',
        seoKeywords: ['plumber website', 'plumbing service website india', 'plumber booking website'],
      },
    },
    {
      id: 'ac-repair', name: 'AC Repair & Service',
      keywords: ['ac repair', 'ac service', 'air conditioner', 'ac installation', 'ac gas', 'split ac service', 'ac amc'],
      content: {
        tagline: 'Cool Comfort, Expert Care',
        shortDesc: 'AC repair and service website with service plans, AMC and online booking.',
        fullDesc: 'A website built for AC repair and service businesses. Customers book jet-service cleaning, gas refill, repair and installation for split and window ACs, and sign up for seasonal AMC plans. Built to capture pre-summer service demand and lock in recurring AMC revenue.',
        heroHeadline: 'Keep Your AC Running Cool',
        heroSubline: 'Service, gas refill, repair and installation — split and window',
        highlight: 'Trained technicians · Genuine parts · AMC plans · 30-day service warranty',
        seoKeywords: ['ac repair website', 'ac service website india', 'ac installation service website', 'ac amc website'],
      },
    },
    {
      id: 'home-cleaning', name: 'Home Cleaning',
      keywords: ['home cleaning', 'deep cleaning', 'house cleaning', 'sofa cleaning', 'bathroom cleaning', 'cleaning service', 'housekeeping'],
      content: {
        tagline: 'A Spotless Home, Zero Effort',
        shortDesc: 'Home cleaning services website with packages, add-ons and online booking.',
        fullDesc: 'A website built for home-cleaning services. Customers book full-home deep cleaning, kitchen and bathroom cleaning, sofa and carpet shampooing with clear per-home pricing and trained staff. Built for a business that wins on trust, thoroughness and repeat bookings.',
        heroHeadline: 'Deep Cleaning You Can See & Feel',
        heroSubline: 'Full-home, kitchen, bathroom and sofa cleaning by trained staff',
        highlight: 'Trained staff · Safe chemicals · Fixed pricing · Same-week slots',
        seoKeywords: ['home cleaning service website', 'deep cleaning website india', 'house cleaning booking website', 'sofa cleaning website'],
      },
    },
  ],
  rentalservices: [
    { id: 'general', name: 'Rental Services' },
    {
      id: 'furniture-rental', name: 'Furniture Rental',
      keywords: ['furniture rental', 'rent furniture', 'furniture on rent', 'sofa on rent', 'bed on rent', 'furniture for rent'],
      content: {
        tagline: 'Furnish Your Home Without Buying',
        shortDesc: 'Furniture rental website with a catalogue, monthly rates and availability enquiry.',
        fullDesc: 'A website built for furniture-rental businesses. Customers browse beds, sofas, wardrobes, dining sets and combos, check monthly rates and refundable deposits and book with delivery and installation. Built for bachelors, families and companies who want to furnish a home without buying.',
        heroHeadline: 'Rent Furniture, Live Comfortably',
        heroSubline: 'Beds, sofas, wardrobes and combos on flexible monthly rentals',
        highlight: 'Free delivery & setup · Refundable deposit · Clean, serviced items · Flexible tenure',
        seoKeywords: ['furniture rental website', 'rent furniture online website india', 'furniture on rent website'],
      },
    },
    {
      id: 'appliance-rental', name: 'Appliance Rental',
      keywords: ['appliance rental', 'rent appliances', 'fridge on rent', 'washing machine on rent', 'ac on rent', 'tv on rent'],
      content: {
        tagline: 'Home Appliances on Easy Rent',
        shortDesc: 'Appliance rental website with a catalogue, monthly rates and quick booking.',
        fullDesc: 'A website built for appliance-rental businesses. Customers rent refrigerators, washing machines, ACs and TVs on flexible monthly plans with installation, service and refundable deposits. Built for the tenant or new home-owner who needs appliances without the upfront cost.',
        heroHeadline: 'Appliances Without the Big Spend',
        heroSubline: 'Fridge, washing machine, AC and TV on monthly rental',
        highlight: 'Free installation · Serviced appliances · Refundable deposit · Flexible tenure',
        seoKeywords: ['appliance rental website', 'rent fridge washing machine website india', 'appliances on rent website'],
      },
    },
    {
      id: 'equipment-rental', name: 'Equipment & Tools',
      keywords: ['equipment rental', 'tool rental', 'rent tools', 'construction equipment rental', 'machinery rental', 'power tools on rent'],
      content: {
        tagline: 'The Right Tools, Only When You Need Them',
        shortDesc: 'Equipment and tool rental website with a catalogue, daily rates and availability.',
        fullDesc: 'A website built for equipment and tool-rental businesses. Contractors and DIYers browse power tools, construction equipment and machinery, check daily and weekly rates and availability and book with a deposit. Built for a rental business where availability and condition matter most.',
        heroHeadline: 'Rent Tools & Equipment, Hassle-Free',
        heroSubline: 'Power tools, construction gear and machinery on daily rental',
        highlight: 'Daily & weekly rates · Well-maintained · Deposit-based · Pickup or delivery',
        seoKeywords: ['equipment rental website', 'tool rental website india', 'construction equipment on rent website'],
      },
    },
    {
      id: 'event-rental', name: 'Event & Party Rental',
      keywords: ['event rental', 'party rental', 'tent house', 'chair rental', 'event equipment rental', 'sound rental', 'decoration on rent'],
      content: {
        tagline: 'Everything for the Perfect Event',
        shortDesc: 'Event and party rental website with a catalogue, packages and availability enquiry.',
        fullDesc: 'A website built for event and party-rental businesses. Customers browse chairs, tables, tents, sound, lighting and decor, check package rates and date availability and enquire for their event. Built for tent houses and event-rental businesses whose bookings peak on dates.',
        heroHeadline: 'Rent Everything Your Event Needs',
        heroSubline: 'Chairs, tents, sound, lighting and decor — for any occasion',
        highlight: 'Date-based booking · Setup & teardown · Bulk quantities · Package rates',
        seoKeywords: ['event rental website', 'party equipment rental website india', 'tent house website', 'event supplies on rent website'],
      },
    },
  ],
  printing: [
    { id: 'general', name: 'Books, Stationery & Printing' },
    {
      id: 'bookstore', name: 'Bookstore',
      keywords: ['bookstore', 'book shop', 'books', 'book store', 'buy books', 'academic books', 'novels', 'book seller'],
      content: {
        tagline: 'A World of Books, Near You',
        shortDesc: 'Bookstore website with a catalogue, new arrivals and home-delivery ordering.',
        fullDesc: 'A website built for bookstores and book sellers. Readers browse your catalogue — academic, competitive-exam, fiction and children’s books — see new arrivals and order for pickup or home delivery. Built for a bookshop that wants regulars ordering online instead of drifting to marketplaces.',
        heroHeadline: 'Find Your Next Great Read',
        heroSubline: 'Academic, competitive, fiction and children’s books — order online',
        highlight: 'Wide range · Exam & academic titles · Home delivery · Order on WhatsApp',
        seoKeywords: ['bookstore website', 'book shop website india', 'online bookstore website', 'academic books website'],
      },
    },
    {
      id: 'stationery', name: 'Stationery Shop',
      keywords: ['stationery', 'stationary', 'stationery shop', 'office supplies', 'school supplies', 'notebooks', 'pens', 'stationery store'],
      content: {
        tagline: 'Everything for School & Office',
        shortDesc: 'Stationery shop website with a product catalogue, bulk supply and delivery ordering.',
        fullDesc: 'A website built for stationery shops. Customers browse notebooks, pens, files, art supplies and office essentials, place bulk school and office orders and get home delivery. Built to lock in the recurring school-list and office-supply business that keeps a stationer busy.',
        heroHeadline: 'Stationery & Office Supplies, Delivered',
        heroSubline: 'Notebooks, pens, files and art supplies — retail and bulk',
        highlight: 'Bulk & office supply · School lists · Home delivery · Wide range',
        seoKeywords: ['stationery shop website', 'office supplies website india', 'school stationery website', 'stationery store website'],
      },
    },
    {
      id: 'digital-printing', name: 'Printing & Xerox',
      keywords: ['xerox', 'photocopy', 'digital printing', 'printing press', 'document printing', 'banner printing', 'flex printing', 'colour printing', 'brochure printing'],
      content: {
        tagline: 'Fast, Sharp Printing — Every Time',
        shortDesc: 'Printing and xerox website with services, print-job enquiry and quick turnaround.',
        fullDesc: 'A website built for printing presses and xerox centres. Customers submit print jobs — documents, business cards, brochures, banners and flex — get a quote and track the job from order to ready. Built for a print shop that wins repeat business on speed and quality.',
        heroHeadline: 'Printing Done Right, Done Fast',
        heroSubline: 'Documents, cards, brochures, banners and flex printing',
        highlight: 'Same-day printing · Bulk rates · Design help · Colour & B/W',
        seoKeywords: ['printing press website', 'digital printing website india', 'xerox photocopy shop website', 'document printing website'],
      },
    },
    {
      id: 'custom-printing', name: 'Custom Printing',
      keywords: ['custom printing', 't-shirt printing', 'tshirt printing', 'mug printing', 'merchandise printing', 'personalised gifts', 'photo printing', 'id card printing'],
      content: {
        tagline: 'Put Your Design on Anything',
        shortDesc: 'Custom printing website with a product range, design upload and order enquiry.',
        fullDesc: 'A website built for custom-printing studios. Customers order personalised t-shirts, mugs, photo frames, ID cards and corporate merchandise, upload their design or logo and enquire for bulk orders. Built for a studio whose gifting and corporate-branding orders come from a good product gallery.',
        heroHeadline: 'Custom Prints for Gifts & Branding',
        heroSubline: 'T-shirts, mugs, photo frames and corporate merchandise',
        highlight: 'Personalised gifts · Bulk corporate orders · Design help · Quick turnaround',
        seoKeywords: ['custom printing website', 't-shirt printing website india', 'mug printing website', 'personalised gifts printing website'],
      },
    },
  ],
  recruitment: [
    { id: 'general', name: 'Recruitment & Placement' },
    {
      id: 'staffing', name: 'Staffing Agency',
      keywords: ['staffing', 'staffing agency', 'recruitment agency', 'placement agency', 'job consultancy', 'manpower', 'hr consultancy', 'hiring agency'],
      content: {
        tagline: 'Hire Faster, Hire Better',
        shortDesc: 'Staffing agency website with hiring services, current openings and employer enquiry.',
        fullDesc: 'A website built for staffing and placement agencies. Companies post requirements and candidates browse openings and submit resumes, while you run permanent and contract hiring across roles. Built to win employer mandates with a credible, results-focused presence.',
        heroHeadline: 'Your Hiring Partner, End to End',
        heroSubline: 'Permanent and contract staffing across roles and industries',
        highlight: 'Verified candidates · Fast turnaround · Replacement guarantee · Multi-industry',
        seoKeywords: ['staffing agency website', 'recruitment agency website india', 'placement agency website', 'job consultancy website'],
      },
    },
    {
      id: 'executive-search', name: 'Executive Search',
      keywords: ['executive search', 'headhunting', 'headhunter', 'leadership hiring', 'senior hiring', 'cxo hiring', 'executive recruitment'],
      content: {
        tagline: 'Leaders Who Move Your Business Forward',
        shortDesc: 'Executive search website with a headhunting process, sector focus and employer enquiry.',
        fullDesc: 'A website built for executive-search and headhunting firms. Companies engage you to find leadership and senior specialist talent through a discreet, mandate-based search process. Built to project the credibility and confidentiality this high-value business depends on.',
        heroHeadline: 'Find the Leaders You Need',
        heroSubline: 'Discreet headhunting for CXO and senior specialist roles',
        highlight: 'Confidential search · Sector specialists · Mandate-based · Global reach',
        seoKeywords: ['executive search website', 'headhunting firm website india', 'leadership hiring website', 'cxo recruitment website'],
      },
    },
    {
      id: 'bluecollar-placement', name: 'Blue-Collar Placement',
      keywords: ['blue collar', 'blue collar placement', 'worker placement', 'labour supply', 'security guard placement', 'driver placement', 'housekeeping staff', 'skilled worker'],
      content: {
        tagline: 'Reliable Workforce, Ready to Deploy',
        shortDesc: 'Blue-collar placement website with worker categories, bulk hiring and employer enquiry.',
        fullDesc: 'A website built for blue-collar and skilled-worker placement agencies. Businesses hire drivers, security guards, housekeeping, factory and skilled workers — verified and ready — in single or bulk numbers. Built for the volume-hiring, quick-deployment enquiries this segment runs on.',
        heroHeadline: 'Verified Workers, When You Need Them',
        heroSubline: 'Drivers, guards, housekeeping and skilled staff — single or bulk',
        highlight: 'Police-verified · Bulk supply · Quick deployment · Replacement support',
        seoKeywords: ['blue collar placement website', 'manpower supply website india', 'worker placement agency website', 'labour supply website'],
      },
    },
    {
      id: 'overseas-recruitment', name: 'Overseas Recruitment',
      keywords: ['overseas recruitment', 'overseas jobs', 'gulf jobs', 'abroad jobs', 'international recruitment', 'overseas placement', 'foreign jobs', 'work visa jobs'],
      content: {
        tagline: 'Careers Beyond Borders',
        shortDesc: 'Overseas recruitment website with international openings, process info and candidate enquiry.',
        fullDesc: 'A website built for overseas recruitment agencies. Candidates browse international openings — Gulf, Europe and beyond — and enquire, while employers engage you for compliant foreign hiring with documentation and visa support. Built to be the trustworthy front for a business where credibility is everything.',
        heroHeadline: 'Your Gateway to Overseas Jobs',
        heroSubline: 'Verified international openings with visa and documentation support',
        highlight: 'Licensed recruiter · Visa & documentation · Gulf & Europe · Genuine openings',
        seoKeywords: ['overseas recruitment website', 'overseas jobs website india', 'gulf jobs consultancy website', 'international placement agency website'],
      },
    },
  ],
  government: [
    { id: 'general', name: 'Government & Utility Services' },
    {
      id: 'csc', name: 'Common Service Centre',
      keywords: ['csc', 'common service centre', 'common service center', 'e-governance', 'e governance', 'jan seva kendra', 'govt service centre', 'digital seva'],
      content: {
        tagline: 'Your Local Digital Seva Centre',
        shortDesc: 'Common Service Centre website with a full government-service list, document guidance and enquiry.',
        fullDesc: 'A website built for Common Service Centres and e-governance points. Citizens see the wide range of services you assist with — Aadhaar, PAN, certificates, pensions, insurance and bill payments — with the documents needed for each, and enquire or visit. Built to be the neighbourhood’s trusted first stop for any government service.',
        heroHeadline: 'One Centre for Every Government Service',
        heroSubline: 'Aadhaar, PAN, certificates, pensions and bill payments — all in one place',
        highlight: 'Authorised centre · Document guidance · Wide range · Nominal charges',
        seoKeywords: ['common service centre website', 'csc website india', 'jan seva kendra website', 'e-governance service centre website'],
      },
    },
    {
      id: 'aadhaar-pan', name: 'Aadhaar & PAN Services',
      keywords: ['aadhaar', 'aadhar', 'aadhaar card', 'pan card', 'pan', 'aadhaar update', 'pan correction', 'aadhaar center', 'pan card agent'],
      content: {
        tagline: 'Aadhaar & PAN, Sorted Quickly',
        shortDesc: 'Aadhaar and PAN services website with application help, document checklists and enquiry.',
        fullDesc: 'A website built for Aadhaar and PAN service centres. Visitors get help with new Aadhaar enrolment, address and mobile updates, new PAN cards and corrections — with a clear list of documents to bring. Built to bring in the steady, everyday identity-document footfall.',
        heroHeadline: 'Aadhaar & PAN Made Easy',
        heroSubline: 'Enrolment, updates, new PAN and corrections — with document guidance',
        highlight: 'Quick service · Clear document list · Corrections handled · Nominal charges',
        seoKeywords: ['aadhaar service centre website', 'pan card service website india', 'aadhaar pan agent website'],
      },
    },
    {
      id: 'certificates', name: 'Certificate Services',
      keywords: ['certificate', 'income certificate', 'caste certificate', 'birth certificate', 'domicile certificate', 'certificate service', 'documentation service', 'affidavit'],
      content: {
        tagline: 'Certificates & Documents, Hassle-Free',
        shortDesc: 'Certificate services website with document checklists, application help and status updates.',
        fullDesc: 'A website built for certificate and documentation services. Citizens see which certificates you help obtain — income, caste, domicile, birth and death — with the exact documents required, and enquire to apply. Application status is shared on request as the work progresses. Built to demystify a confusing, document-heavy process.',
        heroHeadline: 'Government Certificates, Without the Queues',
        heroSubline: 'Income, caste, domicile, birth and death certificate assistance',
        highlight: 'Document checklists · Application help · Status on request · Nominal charges',
        seoKeywords: ['certificate service website india', 'income caste certificate service website', 'documentation service website'],
      },
    },
    {
      id: 'bill-payment', name: 'Utility Bill Payment',
      keywords: ['bill payment', 'utility bill', 'electricity bill', 'water bill', 'gas bill', 'recharge', 'bill payment centre', 'money transfer'],
      content: {
        tagline: 'Pay Every Bill in One Place',
        shortDesc: 'Utility bill payment centre website with a services list, coverage and quick enquiry.',
        fullDesc: 'A website built for utility bill-payment and mini-banking centres. Customers pay electricity, water, gas and mobile bills, recharge, and use money-transfer and AEPS services at your counter. Built for a high-footfall neighbourhood service point that thrives on trust and convenience.',
        heroHeadline: 'Bills, Recharges & Payments — Sorted',
        heroSubline: 'Electricity, water, gas, recharges and money transfer at one counter',
        highlight: 'All bills accepted · Instant receipts · Money transfer · Open long hours',
        seoKeywords: ['bill payment centre website', 'utility bill payment website india', 'mini banking csc website', 'money transfer centre website'],
      },
    },
  ],
};

export function getCategory(id: string): IndustryContent | undefined {
  const canonical = canonicalIndustryId(id);
  return industryContent.find((c) => c.id === canonical);
}

export function getSubcategories(categoryId: string): Subcategory[] {
  const canonical = canonicalIndustryId(categoryId);
  const cat = getCategory(canonical);
  return SUBCATEGORIES[canonical] ?? [{ id: 'general', name: cat?.name ?? 'General' }];
}

/** Resolve a subcategory, falling back to the category baseline (the "general" one). */
export function getSubcategory(categoryId: string, subId?: string): Subcategory {
  const subs = getSubcategories(categoryId);
  return subs.find((s) => s.id === subId) ?? subs[0];
}

// The effective demo copy for a (category, sub) — sub content injected over the
// category baseline. This is what the demo page renders, so a sub-type shows its
// OWN hero/description/keywords rather than the generic category text.
export interface DemoContent {
  name: string;            // display/brand name for this sub-type
  tagline: string;
  shortDesc: string;
  fullDesc: string;
  heroHeadline: string;
  heroSubline: string;
  highlight: string;
  seoKeywords: string[];
}

export function getDemoContent(categoryId: string, subId?: string): DemoContent | undefined {
  const cat = getCategory(categoryId);
  if (!cat) return undefined;
  const sub = getSubcategory(categoryId, subId);
  const c = sub.content ?? {};
  const isSub = sub.id !== 'general';
  return {
    name: isSub ? sub.name : cat.name,
    tagline: c.tagline ?? cat.tagline,
    shortDesc: c.shortDesc ?? cat.shortDesc,
    fullDesc: c.fullDesc ?? cat.fullDesc,
    heroHeadline: c.heroHeadline ?? cat.sampleContent.heroHeadline,
    heroSubline: c.heroSubline ?? cat.sampleContent.heroSubline,
    highlight: c.highlight ?? cat.sampleContent.highlight,
    seoKeywords: [...(c.seoKeywords ?? []), ...cat.seoKeywords],
  };
}

// ── Search / resolution ────────────────────────────────────────────────────
// Resolve a free-text keyword (or a URL segment) to a (category, sub-type). A
// sub-category keyword wins over the plain category so "dental clinic" lands on the
// tailored dental demo, not the generic clinic one.
export interface DemoResolution { categoryId: string; subId: string }

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function containsTerm(haystack: string, term: string): boolean {
  const t = norm(term);
  if (!t) return false;
  return new RegExp(`(^| )${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(haystack);
}

export function resolveDemoQuery(query: string): DemoResolution | null {
  const q = norm(query);
  if (!q) return null;

  // 1) Most specific: a sub-category keyword / name.
  for (const cat of industryContent) {
    for (const sub of getSubcategories(cat.id)) {
      if (sub.id === 'general') continue;
      const terms = [sub.name, sub.id.replace(/-/g, ' '), ...(sub.keywords ?? [])];
      if (terms.some((t) => containsTerm(q, t))) return { categoryId: cat.id, subId: sub.id };
    }
  }
  // 2) Main category: id, name, or one of its SEO keywords.
  for (const cat of industryContent) {
    const terms = [cat.id, cat.name, ...cat.seoKeywords];
    if (terms.some((t) => containsTerm(q, t))) return { categoryId: cat.id, subId: 'general' };
  }
  // 3) Legacy alias (healthcare→clinic, …) as a bare token.
  const alias = canonicalIndustryId(q.replace(/\s+/g, ''));
  if (getCategory(alias)) return { categoryId: alias, subId: 'general' };
  return null;
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function classify(label: string): SectionType {
  const l = label.toLowerCase();
  if (/about/.test(l)) return 'about';
  if (/contact|location/.test(l)) return 'contact';
  if (/blog|news/.test(l)) return 'blog';
  if (/galler|destination|portfolio|photo/.test(l)) return 'gallery';
  if (/doctor|team|stylist|trainer|agent|faculty|fleet|vehicle|staff|coach|photographer|advisor|expert/.test(l)) return 'team';
  if (/reservation|appointment|book|enrol|enquir|enquiry/.test(l)) return 'booking';
  return 'catalog'; // menu / services / packages / listings / products / courses / …
}

/** Section routes for a category (from its curated "Website Pages", minus Home). */
export function getSections(categoryId: string): DemoSection[] {
  const cat = getCategory(categoryId);
  if (!cat) return [];
  return cat.websitePages
    .filter((p) => !/^home$/i.test(p))
    .map((label) => ({ slug: slugify(label), label, type: classify(label) }));
}

export function getSection(categoryId: string, slug: string): DemoSection | undefined {
  return getSections(categoryId).find((s) => s.slug === slug);
}

/** Every public demo URL (for the sitemap): category homes + subcategory homes +
 *  category-level section pages + subcategory-level section pages. */
export function allDemoPaths(): string[] {
  const paths: string[] = [];
  for (const cat of industryContent) {
    paths.push(`/demo/${cat.id}`);
    const sections = getSections(cat.id);
    for (const s of sections) paths.push(`/demo/${cat.id}/${s.slug}`);
    for (const sub of getSubcategories(cat.id)) {
      if (sub.id === 'general') continue; // general == category home, already added
      paths.push(`/demo/${cat.id}/${sub.id}`);
      for (const s of sections) paths.push(`/demo/${cat.id}/${sub.id}/${s.slug}`);
    }
  }
  return paths;
}
