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
      id: 'rental', name: 'Rentals',
      keywords: ['rental', 'rent', 'rent flat', 'pg', 'lease', 'rent house'],
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
