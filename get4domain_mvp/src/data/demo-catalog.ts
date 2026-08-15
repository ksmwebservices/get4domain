// Rich, industry-specific demo content for the multi-page demo sites.
// This layers real *fields* (price, area, duration, config, …) and a real
// *business flow* (browse → book/reserve/enquire) on top of the category model in
// demo-site.ts. It is content + template data — NOT a new data model. Real vendors
// still use the generic CatalogItem schema; per-listing photos come from the image
// upload infra (here demo cards fall back to the category coverImage).
//
// Subcategories inherit their category catalog; a few medically/structurally
// distinct ones (dental, physiotherapy, commercial, rental, cafe, bakery, …) get
// curated overrides. Anything without an override renders the category's real
// content — never a generic card.

export type DemoFlow =
  | 'book-visit' | 'reserve-table' | 'book-appointment' | 'book-slot'
  | 'enquire-join' | 'check-availability' | 'enquire-order' | 'enquire-enroll'
  | 'book-service' | 'get-quote' | 'book-consult' | 'book-trip'
  | 'book-test' | 'book-shoot' | 'enquire';

/** Flows that ask for a preferred date/slot in the booking modal. */
export const DATED_FLOWS: DemoFlow[] = [
  'book-visit', 'reserve-table', 'book-appointment', 'book-slot',
  'check-availability', 'book-service', 'book-test', 'book-shoot', 'book-trip',
];

export interface DemoField { label: string; value: string }
export interface DemoListing {
  name: string;
  price?: string;
  desc?: string;
  tags?: string[];
  fields?: DemoField[];
  image?: string;         // optional; falls back to the category coverImage
}
export interface DemoTeamMember { name: string; role: string; note?: string }

export interface CategoryCatalog {
  flow: DemoFlow;
  ctaLabel: string;       // button text, e.g. "Book Site Visit"
  catalogNoun: string;    // "listings" | "dishes" | "services" …
  items: DemoListing[];
  team?: DemoTeamMember[];
  coverImage?: string;    // subcategory-specific banner (overrides the category cover)
}

/** Pexels CDN helper (all IDs verified to return a real image). */
const px = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

// ── Category catalogs (all 20) ───────────────────────────────────────────────
export const DEMO_CATALOG: Record<string, CategoryCatalog> = {
  restaurant: {
    flow: 'reserve-table', ctaLabel: 'Reserve a Table', catalogNoun: 'dishes',
    items: [
      { name: 'Paneer Butter Masala', price: '₹260', desc: 'Cottage cheese in a rich tomato-butter gravy.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Main Course' }, { label: 'Serves', value: '2' }] },
      { name: 'Chicken Dum Biryani', price: '₹320', desc: 'Dum-cooked basmati with tender chicken and saffron.', tags: ['Non-veg', 'Chef’s Special'], fields: [{ label: 'Course', value: 'Main Course' }, { label: 'Serves', value: '1–2' }] },
      { name: 'Masala Dosa', price: '₹120', desc: 'Crispy dosa with spiced potato filling, chutney & sambar.', tags: ['Veg'], fields: [{ label: 'Course', value: 'South Indian' }, { label: 'Serves', value: '1' }] },
      { name: 'Mutton Rogan Josh', price: '₹380', desc: 'Slow-cooked mutton in aromatic Kashmiri spices.', tags: ['Non-veg', 'Spicy'], fields: [{ label: 'Course', value: 'Main Course' }, { label: 'Serves', value: '2' }] },
      { name: 'Gulab Jamun (2 pcs)', price: '₹90', desc: 'Warm milk dumplings soaked in cardamom syrup.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Dessert' }] },
      { name: 'Filter Coffee', price: '₹60', desc: 'Authentic South Indian filter coffee.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Beverage' }] },
    ],
  },
  travel: {
    flow: 'book-trip', ctaLabel: 'Enquire / Book Package', catalogNoun: 'packages',
    items: [
      { name: 'Ooty & Coonoor Hill Tour', price: '₹12,999 / person', desc: 'Stays, sightseeing and private cab across the Nilgiris.', fields: [{ label: 'Duration', value: '3N / 4D' }, { label: 'Group', value: 'Up to 6' }, { label: 'Includes', value: 'Stay + Cab + Sightseeing' }] },
      { name: 'Kerala Backwaters', price: '₹18,500 / person', desc: 'Munnar, Alleppey houseboat and Kochi.', fields: [{ label: 'Duration', value: '4N / 5D' }, { label: 'Includes', value: 'Houseboat + Hotels' }] },
      { name: 'Golden Triangle', price: '₹22,000 / person', desc: 'Delhi · Agra · Jaipur with monuments and guide.', fields: [{ label: 'Duration', value: '5N / 6D' }, { label: 'Includes', value: 'AC Car + Guide' }] },
      { name: 'Tirupati Darshan', price: '₹4,999 / person', desc: 'Pilgrimage package with darshan assistance.', tags: ['Pilgrimage'], fields: [{ label: 'Duration', value: '1N / 2D' }] },
      { name: 'Airport Transfer (Sedan)', price: '₹1,200 one-way', desc: 'Clean AC sedan, on-time pickup, tracked trip.', fields: [{ label: 'Vehicle', value: 'Sedan · 4 seats' }] },
    ],
    team: [
      { name: 'Toyota Innova Crysta', role: '7-Seater AC', note: 'Ideal for family tours' },
      { name: 'Tempo Traveller', role: '12-Seater AC', note: 'Group & corporate travel' },
      { name: 'Swift Dzire', role: '4-Seater Sedan', note: 'Airport & city transfers' },
    ],
  },
  clinic: {
    flow: 'book-appointment', ctaLabel: 'Book Appointment', catalogNoun: 'services',
    items: [
      { name: 'General Consultation', price: '₹500', desc: 'Consult an experienced physician for common ailments.', fields: [{ label: 'Duration', value: '15 min' }, { label: 'Department', value: 'General Medicine' }] },
      { name: 'Full Body Health Checkup', price: '₹2,499', desc: 'Comprehensive preventive screening with report.', fields: [{ label: 'Duration', value: '45 min' }, { label: 'Department', value: 'Preventive Care' }] },
      { name: 'Dental Cleaning & Scaling', price: '₹1,200', desc: 'Professional cleaning and polishing.', fields: [{ label: 'Duration', value: '30 min' }, { label: 'Department', value: 'Dental' }] },
      { name: 'ECG', price: '₹400', desc: 'Resting electrocardiogram with same-day report.', fields: [{ label: 'Duration', value: '15 min' }, { label: 'Department', value: 'Cardiology' }] },
      { name: 'Physiotherapy Session', price: '₹600', desc: 'Guided rehab for pain and mobility.', fields: [{ label: 'Duration', value: '45 min' }, { label: 'Department', value: 'Physiotherapy' }] },
    ],
    team: [
      { name: 'Dr. Anjali Rao', role: 'General Physician', note: 'MBBS, MD · 14 yrs' },
      { name: 'Dr. Suresh Iyer', role: 'Orthopaedic Surgeon', note: 'MS Ortho · 18 yrs' },
      { name: 'Dr. Fatima Sheikh', role: 'Paediatrician', note: 'MBBS, DCH · 11 yrs' },
    ],
  },
  education: {
    flow: 'enquire-enroll', ctaLabel: 'Enquire / Enroll', catalogNoun: 'programs',
    items: [
      { name: 'CBSE Grade XI — Science', price: '₹85,000 / year', desc: 'PCM/PCB streams with smart classrooms and labs.', fields: [{ label: 'Duration', value: '1 Year' }, { label: 'Seats', value: '40' }] },
      { name: 'NEET Integrated Coaching', price: '₹1,20,000', desc: 'Two-year medical entrance preparation.', fields: [{ label: 'Duration', value: '2 Years' }, { label: 'Batch', value: 'Weekday' }] },
      { name: 'Spoken English', price: '₹6,000', desc: 'Practical fluency and communication skills.', fields: [{ label: 'Duration', value: '3 Months' }, { label: 'Mode', value: 'Classroom' }] },
      { name: 'Computer Basics (MS Office)', price: '₹4,500', desc: 'Word, Excel, PowerPoint and internet skills.', fields: [{ label: 'Duration', value: '2 Months' }] },
    ],
    team: [
      { name: 'Mrs. Lakshmi Menon', role: 'Principal', note: 'M.Ed · 22 yrs' },
      { name: 'Mr. Rajesh Verma', role: 'HOD — Science', note: 'M.Sc, B.Ed · 16 yrs' },
      { name: 'Ms. Divya Krishnan', role: 'English Faculty', note: 'MA English · 9 yrs' },
    ],
  },
  realestate: {
    flow: 'book-visit', ctaLabel: 'Book Site Visit', catalogNoun: 'listings',
    items: [
      { name: '2 BHK Apartment · Velachery', price: '₹68 Lakh', desc: 'Ready-to-move flat in a gated community.', tags: ['For Sale', 'Ready to Move'], fields: [{ label: 'Area', value: '1,050 sqft' }, { label: 'Config', value: '2 Bed · 2 Bath' }] },
      { name: '3 BHK Villa · ECR', price: '₹1.45 Cr', desc: 'Independent villa with private garden.', tags: ['For Sale'], fields: [{ label: 'Area', value: '1,800 sqft' }, { label: 'Config', value: '3 Bed · 3 Bath' }] },
      { name: 'Commercial Office · OMR', price: '₹95,000 / month', desc: 'Fitted-out office space on the IT corridor.', tags: ['For Rent'], fields: [{ label: 'Area', value: '1,200 sqft' }, { label: 'Type', value: 'Commercial' }] },
      { name: 'Residential Plot · Guduvanchery', price: '₹42 Lakh', desc: 'DTCP-approved plot, clear title.', tags: ['For Sale'], fields: [{ label: 'Area', value: '2,400 sqft' }, { label: 'Type', value: 'Plot' }] },
      { name: '1 BHK Flat · Tambaram', price: '₹14,000 / month', desc: 'Compact flat close to the railway station.', tags: ['For Rent'], fields: [{ label: 'Area', value: '620 sqft' }, { label: 'Config', value: '1 Bed · 1 Bath' }] },
    ],
    team: [
      { name: 'Karthik Subramanian', role: 'Senior Property Advisor', note: 'RERA-certified · 12 yrs' },
      { name: 'Meera Joseph', role: 'Rentals Specialist', note: '8 yrs · South Chennai' },
      { name: 'Aravind Balaji', role: 'Commercial Leasing', note: 'OMR / IT corridor' },
    ],
  },
  construction: {
    flow: 'get-quote', ctaLabel: 'Get a Quote', catalogNoun: 'services',
    items: [
      { name: 'Home Construction (Turnkey)', price: '₹1,850 / sqft', desc: 'Design-to-handover residential construction.', fields: [{ label: 'Scope', value: 'Turnkey' }, { label: 'Timeline', value: '8–12 months' }] },
      { name: 'Interior Design Package', price: 'From ₹1.2 Lakh', desc: 'Modular kitchen, wardrobes and false ceiling.', fields: [{ label: 'Scope', value: 'Per BHK' }] },
      { name: 'Renovation & Remodeling', price: 'Custom quote', desc: 'Structural and cosmetic upgrades.', fields: [{ label: 'Scope', value: 'Site survey' }] },
      { name: 'Structural Consultation', price: '₹5,000', desc: 'Engineer site visit and feasibility report.', fields: [{ label: 'Duration', value: '1 visit' }] },
    ],
  },
  retail: {
    flow: 'enquire-order', ctaLabel: 'Enquire / Order', catalogNoun: 'products',
    items: [
      { name: 'Cotton Kurti Set', price: '₹1,299', desc: 'Handblock-printed cotton kurti with dupatta.', tags: ['In Stock'], fields: [{ label: 'Category', value: 'Apparel' }, { label: 'Sizes', value: 'S–XXL' }] },
      { name: 'Steel Water Bottle 1L', price: '₹499', desc: 'Vacuum-insulated, keeps drinks cold 24h.', tags: ['In Stock'], fields: [{ label: 'Category', value: 'Homeware' }] },
      { name: 'LED Desk Lamp', price: '₹899', desc: 'Dimmable, USB-charged reading lamp.', tags: ['In Stock'], fields: [{ label: 'Category', value: 'Electronics' }] },
      { name: 'Bluetooth Earbuds', price: '₹1,499', desc: 'TWS earbuds with 30h battery case.', tags: ['Bestseller'], fields: [{ label: 'Category', value: 'Electronics' }] },
    ],
  },
  salon: {
    flow: 'book-slot', ctaLabel: 'Book a Slot', catalogNoun: 'services',
    items: [
      { name: 'Haircut & Styling', price: '₹350', desc: 'Consultation, cut and blow-dry.', fields: [{ label: 'Duration', value: '30 min' }] },
      { name: 'Bridal Makeup', price: '₹8,000', desc: 'HD bridal makeup with draping and trial.', tags: ['Popular'], fields: [{ label: 'Duration', value: '2 hrs' }] },
      { name: 'Gold Facial', price: '₹1,200', desc: 'Brightening facial for glowing skin.', fields: [{ label: 'Duration', value: '45 min' }] },
      { name: 'Full Body Spa', price: '₹2,500', desc: 'Aromatherapy massage and relaxation.', fields: [{ label: 'Duration', value: '90 min' }] },
      { name: 'Manicure & Pedicure', price: '₹800', desc: 'Cleanup, scrub and polish.', fields: [{ label: 'Duration', value: '60 min' }] },
    ],
    team: [
      { name: 'Nisha Kapoor', role: 'Senior Hair Stylist', note: '10 yrs' },
      { name: 'Reshma Ali', role: 'Bridal Makeup Artist', note: 'HD & airbrush' },
      { name: 'Pooja Nair', role: 'Skin & Spa Therapist', note: '7 yrs' },
    ],
  },
  gym: {
    flow: 'enquire-join', ctaLabel: 'Enquire / Join', catalogNoun: 'plans',
    items: [
      { name: 'Monthly Membership', price: '₹1,500 / month', desc: 'Full gym floor, cardio and locker access.', fields: [{ label: 'Duration', value: '1 Month' }, { label: 'Includes', value: 'Gym + Cardio' }] },
      { name: 'Quarterly Membership', price: '₹4,000', desc: 'Three months with one free month promo.', tags: ['Best Value'], fields: [{ label: 'Duration', value: '3 Months' }] },
      { name: 'Annual Membership', price: '₹12,000', desc: 'Full year plus free personal-training intro.', fields: [{ label: 'Duration', value: '12 Months' }, { label: 'Includes', value: '+ Free PT intro' }] },
      { name: 'Personal Training', price: '₹6,000 / month', desc: 'One-on-one coaching with a diet plan.', fields: [{ label: 'Duration', value: '12 sessions' }] },
      { name: 'Group Yoga Batch', price: '₹1,200 / month', desc: 'Morning and evening batches.', fields: [{ label: 'Duration', value: '1 Month' }] },
    ],
    team: [
      { name: 'Vikram Shetty', role: 'Head Coach — Strength', note: 'CPT · 9 yrs' },
      { name: 'Anita Desai', role: 'Yoga Instructor', note: 'RYT-500' },
      { name: 'Rahul Menon', role: 'Nutrition Coach', note: 'Sports nutrition' },
    ],
  },
  professional: {
    flow: 'book-consult', ctaLabel: 'Book Consultation', catalogNoun: 'services',
    items: [
      { name: 'Company Registration', price: '₹6,999', desc: 'Pvt Ltd / LLP incorporation, end to end.', fields: [{ label: 'Turnaround', value: '7–10 days' }] },
      { name: 'GST Return Filing', price: '₹1,500 / month', desc: 'Monthly GSTR-1 & 3B filing.', fields: [{ label: 'Cycle', value: 'Monthly' }] },
      { name: 'Income Tax Return', price: '₹2,000', desc: 'Salaried and business ITR filing.', fields: [{ label: 'Turnaround', value: '2–3 days' }] },
      { name: 'Legal Documentation', price: 'From ₹3,000', desc: 'Agreements, notices and contracts.', fields: [{ label: 'Type', value: 'Drafting' }] },
    ],
    team: [
      { name: 'CA Ramesh Gupta', role: 'Chartered Accountant', note: '15 yrs' },
      { name: 'Adv. Priya Nair', role: 'Corporate Lawyer', note: 'LLB · 12 yrs' },
      { name: 'CS Anil Kumar', role: 'Company Secretary', note: 'Compliance' },
    ],
  },
  events: {
    flow: 'get-quote', ctaLabel: 'Check Date & Enquire', catalogNoun: 'packages',
    items: [
      { name: 'Wedding Package (300 guests)', price: 'From ₹3,50,000', desc: 'Venue styling, catering coordination and stage.', fields: [{ label: 'Capacity', value: '300 guests' }, { label: 'Includes', value: 'Decor + Stage + Catering' }] },
      { name: 'Birthday Decoration', price: '₹15,000', desc: 'Theme decor, balloons and lighting.', fields: [{ label: 'Setup', value: 'On-site' }] },
      { name: 'Corporate Event Management', price: 'Custom', desc: 'Conferences, launches and team offsites.', fields: [{ label: 'Scope', value: 'End-to-end' }] },
      { name: 'Stage & Lighting', price: '₹40,000', desc: 'Truss stage, sound and DJ lighting.', fields: [{ label: 'Includes', value: 'Sound + Lights' }] },
    ],
  },
  finance: {
    flow: 'book-consult', ctaLabel: 'Book Consultation', catalogNoun: 'services',
    items: [
      { name: 'Home Loan Assistance', price: '0.5% processing', desc: 'Best rates across 20+ banks, doorstep docs.', fields: [{ label: 'Amount', value: 'Up to ₹5 Cr' }] },
      { name: 'Term Life Insurance', price: 'From ₹500 / month', desc: '₹1 Cr cover with claim assistance.', fields: [{ label: 'Cover', value: 'Up to ₹2 Cr' }] },
      { name: 'Mutual Fund SIP Advisory', price: 'Free consultation', desc: 'Goal-based portfolio planning.', fields: [{ label: 'Type', value: 'Advisory' }] },
      { name: 'Tax Planning', price: '₹2,500', desc: 'Save tax legally with a personalised plan.', fields: [{ label: 'Turnaround', value: '1 session' }] },
    ],
    team: [
      { name: 'Sanjay Mehta', role: 'Financial Advisor', note: 'CFP · 13 yrs' },
      { name: 'Kavya Reddy', role: 'Insurance Specialist', note: 'IRDAI-certified' },
    ],
  },
  automobile: {
    flow: 'book-service', ctaLabel: 'Book Service', catalogNoun: 'services',
    items: [
      { name: 'Full Car Service', price: '₹3,499', desc: 'Oil, filters, 25-point inspection and wash.', fields: [{ label: 'Duration', value: '4 hrs' }, { label: 'Warranty', value: '1,000 km' }] },
      { name: 'Wheel Alignment & Balancing', price: '₹899', desc: 'Computerised alignment for all four wheels.', fields: [{ label: 'Duration', value: '45 min' }] },
      { name: 'AC Service & Gas Refill', price: '₹1,800', desc: 'Cooling check, gas top-up and cleaning.', fields: [{ label: 'Duration', value: '90 min' }] },
      { name: 'Denting & Painting (per panel)', price: '₹2,500', desc: 'Dent removal and colour-matched paint.', fields: [{ label: 'Duration', value: '1–2 days' }] },
    ],
  },
  logistics: {
    flow: 'get-quote', ctaLabel: 'Get a Quote', catalogNoun: 'services',
    items: [
      { name: 'Full Truck Load (FTL)', price: 'Custom quote', desc: 'Dedicated door-to-door pan-India delivery.', fields: [{ label: 'Coverage', value: 'Pan-India' }] },
      { name: 'Part Load (PTL)', price: '₹12 / kg', desc: 'Shared transport for smaller consignments.', fields: [{ label: 'Min', value: '50 kg' }] },
      { name: 'Packers & Movers (2 BHK)', price: 'From ₹15,000', desc: 'Packing, loading, transport and unpacking.', fields: [{ label: 'Coverage', value: 'Intercity' }] },
      { name: 'Warehousing', price: '₹450 / pallet / month', desc: 'Secure storage with inventory tracking.', fields: [{ label: 'Type', value: 'Managed' }] },
    ],
  },
  diagnostics: {
    flow: 'book-test', ctaLabel: 'Book Test', catalogNoun: 'tests',
    items: [
      { name: 'Complete Blood Count (CBC)', price: '₹300', desc: 'Screens for infection, anaemia and more.', tags: ['Home Collection'], fields: [{ label: 'Report', value: 'Same day' }, { label: 'Sample', value: 'Blood' }] },
      { name: 'Lipid Profile', price: '₹600', desc: 'Cholesterol and cardiac risk markers.', tags: ['Fasting'], fields: [{ label: 'Report', value: 'Same day' }] },
      { name: 'Thyroid (T3 T4 TSH)', price: '₹500', desc: 'Complete thyroid function panel.', fields: [{ label: 'Report', value: '24 hrs' }] },
      { name: 'Full Body Checkup (60 tests)', price: '₹1,999', desc: 'Comprehensive preventive health package.', tags: ['Home Collection'], fields: [{ label: 'Report', value: '24 hrs' }, { label: 'Tests', value: '60' }] },
      { name: 'COVID RT-PCR', price: '₹500', desc: 'ICMR-approved with home collection.', tags: ['Home Collection'], fields: [{ label: 'Report', value: '24 hrs' }] },
    ],
  },
  hotel: {
    flow: 'check-availability', ctaLabel: 'Check Availability', catalogNoun: 'rooms',
    items: [
      { name: 'Deluxe Room', price: '₹2,800 / night', desc: 'Cosy room with modern amenities.', fields: [{ label: 'Occupancy', value: '2 Adults' }, { label: 'Amenities', value: 'AC · WiFi · Breakfast' }] },
      { name: 'Executive Suite', price: '₹4,500 / night', desc: 'Spacious suite with a living area.', tags: ['Popular'], fields: [{ label: 'Occupancy', value: '2 Adults' }, { label: 'Amenities', value: 'AC · WiFi · Minibar' }] },
      { name: 'Family Room', price: '₹5,200 / night', desc: 'Extra space for the whole family.', fields: [{ label: 'Occupancy', value: '4 Guests' }, { label: 'Amenities', value: 'AC · WiFi · Breakfast' }] },
      { name: 'Dormitory Bed', price: '₹700 / night', desc: 'Budget-friendly shared accommodation.', fields: [{ label: 'Occupancy', value: '1 Bed' }] },
    ],
  },
  photography: {
    flow: 'book-shoot', ctaLabel: 'Book a Shoot', catalogNoun: 'packages',
    items: [
      { name: 'Wedding Photography (Full Day)', price: '₹45,000', desc: 'Candid + traditional coverage with album.', fields: [{ label: 'Duration', value: 'Full day' }, { label: 'Deliverables', value: '300+ edited + album' }] },
      { name: 'Pre-Wedding Shoot', price: '₹18,000', desc: 'Two locations, cinematic edits.', tags: ['Popular'], fields: [{ label: 'Duration', value: '4 hrs' }] },
      { name: 'Baby / Newborn Shoot', price: '₹8,000', desc: 'Themed studio session with props.', fields: [{ label: 'Duration', value: '2 hrs' }] },
      { name: 'Product Photography', price: '₹5,000 / 10 shots', desc: 'Clean e-commerce product images.', fields: [{ label: 'Deliverables', value: '10 edited' }] },
      { name: 'Event Coverage', price: '₹15,000 / day', desc: 'Corporate and social event coverage.', fields: [{ label: 'Duration', value: 'Per day' }] },
    ],
    team: [
      { name: 'Arjun Kapoor', role: 'Lead Photographer', note: 'Weddings · 10 yrs' },
      { name: 'Sneha Rao', role: 'Candid & Portraits', note: '6 yrs' },
    ],
  },
  technology: {
    flow: 'get-quote', ctaLabel: 'Get a Quote', catalogNoun: 'services',
    items: [
      { name: 'Business Website (5 pages)', price: '₹24,999', desc: 'Responsive website with SEO and CMS.', fields: [{ label: 'Timeline', value: '2–3 weeks' }] },
      { name: 'E-commerce Store', price: 'From ₹60,000', desc: 'Full online store with payments.', fields: [{ label: 'Timeline', value: '4–6 weeks' }] },
      { name: 'Mobile App (Android + iOS)', price: 'From ₹1,50,000', desc: 'Cross-platform app with backend.', fields: [{ label: 'Timeline', value: '8–12 weeks' }] },
      { name: 'Digital Marketing', price: '₹15,000 / month', desc: 'SEO, ads and social media management.', fields: [{ label: 'Cycle', value: 'Monthly' }] },
    ],
  },
  agriculture: {
    flow: 'enquire', ctaLabel: 'Enquire Now', catalogNoun: 'products',
    items: [
      { name: 'Organic Fertilizer (50 kg)', price: '₹1,200', desc: 'Certified organic compost for better yield.', fields: [{ label: 'Unit', value: '50 kg bag' }] },
      { name: 'Drip Irrigation Kit', price: '₹18,000 / acre', desc: 'Water-saving drip system with fittings.', fields: [{ label: 'Coverage', value: '1 acre' }] },
      { name: 'Hybrid Tomato Seeds', price: '₹350 / pack', desc: 'High-yield disease-resistant variety.', fields: [{ label: 'Unit', value: '10g pack' }] },
      { name: 'Tractor Rental', price: '₹2,500 / day', desc: 'Tractor with operator for ploughing.', fields: [{ label: 'Unit', value: 'Per day' }] },
    ],
  },
  coaching: {
    flow: 'enquire-join', ctaLabel: 'Enquire / Join', catalogNoun: 'courses',
    items: [
      { name: 'UPSC Foundation', price: '₹95,000', desc: 'Prelims + Mains integrated one-year program.', fields: [{ label: 'Duration', value: '1 Year' }, { label: 'Mode', value: 'Classroom' }] },
      { name: 'Bank PO Crash Course', price: '₹18,000', desc: 'Focused prep for IBPS / SBI PO.', fields: [{ label: 'Duration', value: '3 Months' }, { label: 'Mode', value: 'Hybrid' }] },
      { name: 'SSC CGL Batch', price: '₹22,000', desc: 'Complete SSC CGL Tier 1 & 2 coaching.', fields: [{ label: 'Duration', value: '6 Months' }] },
      { name: 'Career Counselling', price: '₹1,500 / session', desc: 'One-on-one guidance and aptitude mapping.', fields: [{ label: 'Duration', value: '1 hr' }] },
    ],
    team: [
      { name: 'Dr. Manoj Tiwari', role: 'UPSC Mentor', note: 'History · 15 yrs' },
      { name: 'Ms. Reena George', role: 'Quant Faculty', note: 'Banking · 10 yrs' },
    ],
  },
};

// ── Curated subcategory overrides (distinct enough to warrant their own items) ──
// Everything else inherits the category catalog above.
const DEMO_SUBCATALOG: Record<string, Record<string, Partial<CategoryCatalog>>> = {
  clinic: {
    'general-physician': {
      catalogNoun: 'services', coverImage: px(5407206),
      items: [
        { name: 'General Consultation', price: '₹500', desc: 'Diagnosis and treatment for everyday illnesses.', fields: [{ label: 'Duration', value: '15 min' }, { label: 'Department', value: 'General Medicine' }] },
        { name: 'Fever & Infection Treatment', price: '₹500', desc: 'Viral, bacterial and seasonal infection care.', fields: [{ label: 'Duration', value: '15 min' }] },
        { name: 'Diabetes & BP Management', price: '₹600', desc: 'Chronic-care review with monitoring and diet plan.', fields: [{ label: 'Duration', value: '20 min' }] },
        { name: 'Adult Vaccination', price: '₹800', desc: 'Flu, typhoid, tetanus and travel vaccines.', fields: [{ label: 'Duration', value: '10 min' }] },
        { name: 'Fitness / Health Certificate', price: '₹300', desc: 'Medical fitness certificate on the same day.', fields: [{ label: 'Duration', value: '15 min' }] },
      ],
      team: [
        { name: 'Dr. Anjali Rao', role: 'General Physician', note: 'MBBS, MD · 14 yrs' },
        { name: 'Dr. Mohan Das', role: 'Family Physician', note: 'MBBS · 9 yrs' },
      ],
    },
    dental: {
      catalogNoun: 'treatments', coverImage: px(3845810),
      items: [
        { name: 'Dental Consultation & X-Ray', price: '₹300', desc: 'Examination with digital X-ray.', fields: [{ label: 'Duration', value: '20 min' }] },
        { name: 'Cleaning & Scaling', price: '₹1,200', desc: 'Removes plaque and tartar, polish included.', fields: [{ label: 'Duration', value: '30 min' }] },
        { name: 'Root Canal (RCT)', price: '₹4,500', desc: 'Single-sitting RCT with a crown option.', fields: [{ label: 'Duration', value: '60 min' }, { label: 'Sittings', value: '1–2' }] },
        { name: 'Tooth Extraction', price: '₹800', desc: 'Painless extraction under local anaesthesia.', fields: [{ label: 'Duration', value: '30 min' }] },
        { name: 'Teeth Whitening', price: '₹6,000', desc: 'In-clinic laser whitening, shades brighter.', tags: ['Popular'], fields: [{ label: 'Duration', value: '60 min' }] },
      ],
      team: [
        { name: 'Dr. Kavita Reddy', role: 'Dental Surgeon (BDS, MDS)', note: 'Endodontics · 12 yrs' },
        { name: 'Dr. Nikhil Jain', role: 'Orthodontist', note: 'Braces & aligners' },
      ],
    },
    physiotherapy: {
      catalogNoun: 'treatments', coverImage: px(4506109),
      items: [
        { name: 'Back & Neck Pain Therapy', price: '₹600 / session', desc: 'Manual therapy and posture correction.', fields: [{ label: 'Duration', value: '45 min' }] },
        { name: 'Post-Surgery Rehab', price: '₹800 / session', desc: 'Guided recovery after orthopaedic surgery.', fields: [{ label: 'Duration', value: '60 min' }] },
        { name: 'Sports Injury Rehab', price: '₹750 / session', desc: 'Return-to-play strengthening protocol.', fields: [{ label: 'Duration', value: '60 min' }] },
        { name: 'Home Visit Physiotherapy', price: '₹1,000 / visit', desc: 'Therapy at your home for elders.', tags: ['Home Visit'], fields: [{ label: 'Duration', value: '45 min' }] },
      ],
      team: [
        { name: 'Dr. Arun Prakash', role: 'Physiotherapist (BPT, MPT)', note: 'Ortho & Sports · 10 yrs' },
      ],
    },
    hospital: {
      catalogNoun: 'departments', coverImage: px(1692693),
      items: [
        { name: 'Emergency & Trauma (24/7)', price: 'Insurance / cashless', desc: 'Round-the-clock casualty and ambulance.', tags: ['24/7'], fields: [{ label: 'Availability', value: '24 hours' }] },
        { name: 'General Surgery', price: 'Consult ₹700', desc: 'Laparoscopic and general procedures.', fields: [{ label: 'Department', value: 'Surgery' }] },
        { name: 'Cardiology', price: 'Consult ₹800', desc: 'ECG, echo, angiography and cardiac care.', fields: [{ label: 'Department', value: 'Cardiology' }] },
        { name: 'Maternity & Gynaecology', price: 'Packages from ₹35,000', desc: 'Normal and C-section delivery packages.', fields: [{ label: 'Department', value: 'Obstetrics' }] },
      ],
    },
  },
  realestate: {
    residential: {
      catalogNoun: 'homes', coverImage: px(1396122),
      items: [
        { name: '2 BHK Apartment · Velachery', price: '₹68 Lakh', desc: 'Ready-to-move flat in a gated community.', tags: ['For Sale', 'Ready to Move'], fields: [{ label: 'Area', value: '1,050 sqft' }, { label: 'Config', value: '2 Bed · 2 Bath' }] },
        { name: '3 BHK Villa · ECR', price: '₹1.45 Cr', desc: 'Independent villa with a private garden.', tags: ['For Sale'], fields: [{ label: 'Area', value: '1,800 sqft' }, { label: 'Config', value: '3 Bed · 3 Bath' }] },
        { name: '3 BHK Apartment · Anna Nagar', price: '₹1.1 Cr', desc: 'Spacious flat with covered parking and lift.', tags: ['For Sale'], fields: [{ label: 'Area', value: '1,450 sqft' }, { label: 'Config', value: '3 Bed · 2 Bath' }] },
        { name: '2 BHK Builder Floor · Adyar', price: '₹85 Lakh', desc: 'Newly built floor close to the beach.', tags: ['For Sale'], fields: [{ label: 'Area', value: '1,150 sqft' }, { label: 'Config', value: '2 Bed · 2 Bath' }] },
        { name: 'Independent House · Porur', price: '₹1.2 Cr', desc: 'Two-storey house with car park and terrace.', tags: ['For Sale'], fields: [{ label: 'Area', value: '1,600 sqft' }, { label: 'Config', value: '3 Bed · 3 Bath' }] },
      ],
    },
    commercial: {
      catalogNoun: 'commercial spaces', coverImage: px(380769),
      items: [
        { name: 'IT Office Space · OMR', price: '₹95,000 / month', desc: 'Plug-and-play fitted office.', tags: ['For Rent'], fields: [{ label: 'Area', value: '1,200 sqft' }, { label: 'Seats', value: '~30' }] },
        { name: 'Retail Showroom · Anna Nagar', price: '₹1.8 Lakh / month', desc: 'Ground-floor showroom, high footfall.', tags: ['For Rent'], fields: [{ label: 'Area', value: '2,500 sqft' }] },
        { name: 'Warehouse · Sriperumbudur', price: '₹28 / sqft / month', desc: 'Godown with loading dock.', tags: ['For Lease'], fields: [{ label: 'Area', value: '20,000 sqft' }] },
        { name: 'Commercial Land · GST Road', price: '₹3.2 Cr', desc: 'Highway-facing commercial plot.', tags: ['For Sale'], fields: [{ label: 'Area', value: '10,000 sqft' }] },
      ],
    },
    rental: {
      catalogNoun: 'rentals', coverImage: px(1571460),
      items: [
        { name: '1 BHK Flat · Tambaram', price: '₹14,000 / month', desc: 'Near railway station, semi-furnished.', tags: ['For Rent'], fields: [{ label: 'Area', value: '620 sqft' }, { label: 'Config', value: '1 Bed · 1 Bath' }] },
        { name: '2 BHK Flat · Velachery', price: '₹22,000 / month', desc: 'Gated community with parking.', tags: ['For Rent'], fields: [{ label: 'Area', value: '1,050 sqft' }, { label: 'Config', value: '2 Bed · 2 Bath' }] },
        { name: '3 BHK House · Adyar', price: '₹40,000 / month', desc: 'Independent house, fully furnished.', tags: ['For Rent', 'Furnished'], fields: [{ label: 'Area', value: '1,600 sqft' }, { label: 'Config', value: '3 Bed · 3 Bath' }] },
        { name: 'PG / Shared Room · Guindy', price: '₹6,500 / month', desc: 'Working-professional PG with meals.', tags: ['For Rent'], fields: [{ label: 'Type', value: 'Sharing' }] },
      ],
    },
  },
  restaurant: {
    'cloud-kitchen': {
      flow: 'enquire-order', ctaLabel: 'Order Now', catalogNoun: 'menu', coverImage: px(4252137),
      items: [
        { name: 'Butter Chicken Combo', price: '₹280', desc: 'Butter chicken with 2 butter naan.', tags: ['Non-veg', 'Delivery only'], fields: [{ label: 'Serves', value: '1' }] },
        { name: 'Veg Meals Box', price: '₹150', desc: 'Rice, dal, sabzi, roti and curd.', tags: ['Veg', 'Delivery only'], fields: [{ label: 'Serves', value: '1' }] },
        { name: 'Chicken Biryani (Single)', price: '₹220', desc: 'Hyderabadi dum biryani with raita.', tags: ['Non-veg'], fields: [{ label: 'Serves', value: '1' }] },
        { name: 'Paneer Kathi Wrap', price: '₹120', desc: 'Spiced paneer rolled in a soft paratha.', tags: ['Veg'], fields: [{ label: 'Serves', value: '1' }] },
        { name: 'Family Combo', price: '₹650', desc: '2 mains, 6 rotis, rice and dessert.', tags: ['Value'], fields: [{ label: 'Serves', value: '4' }] },
      ],
    },
    cafe: {
      catalogNoun: 'menu', coverImage: px(302899),
      items: [
        { name: 'Cappuccino', price: '₹150', desc: 'Double-shot espresso with steamed milk.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Coffee' }] },
        { name: 'Cold Coffee with Ice Cream', price: '₹180', desc: 'Blended cold coffee topped with ice cream.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Beverage' }] },
        { name: 'Veg Cheese Sandwich', price: '₹160', desc: 'Grilled sandwich with veggies and cheese.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Snacks' }] },
        { name: 'Chocolate Brownie', price: '₹140', desc: 'Warm brownie with a molten centre.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Dessert' }] },
        { name: 'Pasta Alfredo', price: '₹240', desc: 'Creamy white-sauce pasta.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Main' }] },
      ],
    },
    bakery: {
      catalogNoun: 'bakes', coverImage: px(291528),
      items: [
        { name: 'Black Forest Cake (1/2 kg)', price: '₹450', desc: 'Chocolate sponge with cherries and cream.', tags: ['Eggless option'], fields: [{ label: 'Weight', value: '500 g' }] },
        { name: 'Fresh Bread Loaf', price: '₹45', desc: 'Soft daily-baked sandwich loaf.', tags: ['Veg'], fields: [{ label: 'Unit', value: '400 g' }] },
        { name: 'Assorted Cookies (250 g)', price: '₹180', desc: 'Butter, choco-chip and jeera cookies.', tags: ['Veg'], fields: [{ label: 'Weight', value: '250 g' }] },
        { name: 'Veg Puff', price: '₹30', desc: 'Flaky puff with spiced potato filling.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Snacks' }] },
        { name: 'Custom Birthday Cake (1 kg)', price: 'From ₹700', desc: 'Made-to-order themed cakes.', tags: ['Made to order'], fields: [{ label: 'Weight', value: '1 kg' }] },
      ],
    },
  },
  salon: {
    spa: {
      catalogNoun: 'therapies', coverImage: px(3757952),
      items: [
        { name: 'Swedish Full Body Massage', price: '₹2,000', desc: 'Relaxing full-body massage.', fields: [{ label: 'Duration', value: '60 min' }] },
        { name: 'Aromatherapy', price: '₹2,500', desc: 'Essential-oil massage for stress relief.', tags: ['Popular'], fields: [{ label: 'Duration', value: '75 min' }] },
        { name: 'Deep Tissue Massage', price: '₹2,800', desc: 'Targets deep muscle knots.', fields: [{ label: 'Duration', value: '75 min' }] },
        { name: 'Head & Shoulder Massage', price: '₹900', desc: 'Quick de-stress for neck and shoulders.', fields: [{ label: 'Duration', value: '30 min' }] },
      ],
    },
    nails: {
      catalogNoun: 'services', coverImage: px(704815),
      items: [
        { name: 'Classic Manicure', price: '₹500', desc: 'Cleanup, cuticle care, shaping and polish.', fields: [{ label: 'Duration', value: '40 min' }] },
        { name: 'Gel Nail Extensions', price: '₹1,800', desc: 'Long-lasting gel extensions with finish.', tags: ['Popular'], fields: [{ label: 'Duration', value: '90 min' }] },
        { name: 'Nail Art (per hand)', price: '₹600', desc: 'Custom designs, stones and chrome.', fields: [{ label: 'Duration', value: '45 min' }] },
        { name: 'Deluxe Pedicure', price: '₹900', desc: 'Scrub, mask and relaxing foot massage.', fields: [{ label: 'Duration', value: '60 min' }] },
        { name: 'Acrylic Refill', price: '₹1,200', desc: 'Refill and reshape existing acrylics.', fields: [{ label: 'Duration', value: '60 min' }] },
      ],
    },
  },
  gym: {
    crossfit: {
      catalogNoun: 'plans', coverImage: px(2261485),
      items: [
        { name: 'Drop-in Class', price: '₹400 / session', desc: 'Single WOD session with a coach.', fields: [{ label: 'Duration', value: '60 min' }] },
        { name: 'Monthly Unlimited', price: '₹3,500 / month', desc: 'Unlimited WODs plus coaching.', tags: ['Popular'], fields: [{ label: 'Duration', value: '1 Month' }, { label: 'Includes', value: 'All classes' }] },
        { name: 'Foundations (Beginner)', price: '₹5,000', desc: 'Two-week on-ramp for new athletes.', fields: [{ label: 'Duration', value: '2 Weeks' }] },
        { name: '3-Month Athlete', price: '₹9,000', desc: 'Quarterly plan with progress tracking.', fields: [{ label: 'Duration', value: '3 Months' }] },
        { name: 'Personal WOD Coaching', price: '₹7,000 / month', desc: 'One-on-one programming and coaching.', fields: [{ label: 'Duration', value: '12 sessions' }] },
      ],
      team: [
        { name: 'Arjun Rana', role: 'Head CrossFit Coach', note: 'CF-L2 · 8 yrs' },
        { name: 'Divya Pillai', role: 'Mobility & Conditioning', note: '6 yrs' },
      ],
    },
    yoga: {
      catalogNoun: 'classes', coverImage: px(3822622),
      items: [
        { name: 'Hatha Yoga (Group)', price: '₹1,200 / month', desc: 'Foundational postures and breathing.', fields: [{ label: 'Duration', value: '1 Month' }, { label: 'Mode', value: 'Group' }] },
        { name: 'Power Yoga', price: '₹1,800 / month', desc: 'Dynamic, strength-building flow.', tags: ['Popular'], fields: [{ label: 'Duration', value: '1 Month' }] },
        { name: 'Prenatal Yoga', price: '₹2,000 / month', desc: 'Safe practice for expecting mothers.', fields: [{ label: 'Duration', value: '1 Month' }] },
        { name: 'Personal Yoga Session', price: '₹500 / session', desc: 'One-on-one guided practice.', fields: [{ label: 'Duration', value: '60 min' }] },
      ],
    },
  },
  education: {
    coaching: {
      catalogNoun: 'courses', coverImage: px(5905445),
      items: [
        { name: 'IIT-JEE Integrated', price: '₹1,40,000', desc: 'Two-year JEE Main + Advanced program.', fields: [{ label: 'Duration', value: '2 Years' }, { label: 'Mode', value: 'Classroom' }] },
        { name: 'NEET Repeater Batch', price: '₹90,000', desc: 'One-year intensive for droppers.', tags: ['Popular'], fields: [{ label: 'Duration', value: '1 Year' }] },
        { name: 'Class 10 Foundation', price: '₹35,000', desc: 'Board + competitive foundation building.', fields: [{ label: 'Duration', value: '1 Year' }] },
        { name: 'Board Crash Course', price: '₹15,000', desc: 'Focused revision before board exams.', fields: [{ label: 'Duration', value: '3 Months' }] },
      ],
      team: [
        { name: 'Mr. Rajesh Verma', role: 'Physics Faculty', note: 'IIT-JEE · 16 yrs' },
        { name: 'Dr. Sunita Rao', role: 'Biology Faculty', note: 'NEET · 12 yrs' },
      ],
    },
    college: {
      catalogNoun: 'programs', coverImage: px(1454360),
      items: [
        { name: 'B.E. Computer Science', price: '₹85,000 / year', desc: 'AICTE-approved four-year engineering degree.', fields: [{ label: 'Duration', value: '4 Years' }, { label: 'Seats', value: '120' }] },
        { name: 'B.Com (General)', price: '₹40,000 / year', desc: 'Commerce degree with accounting and finance.', fields: [{ label: 'Duration', value: '3 Years' }, { label: 'Seats', value: '80' }] },
        { name: 'BBA', price: '₹55,000 / year', desc: 'Business administration with industry projects.', fields: [{ label: 'Duration', value: '3 Years' }] },
        { name: 'MBA', price: '₹1,20,000 / year', desc: 'Postgraduate management with specialisations.', tags: ['Popular'], fields: [{ label: 'Duration', value: '2 Years' }] },
        { name: 'Diploma in Mechanical', price: '₹30,000 / year', desc: 'Hands-on polytechnic diploma programme.', fields: [{ label: 'Duration', value: '3 Years' }] },
      ],
      team: [
        { name: 'Dr. K. Srinivasan', role: 'Principal', note: 'Ph.D · 25 yrs' },
        { name: 'Prof. Meena Iyer', role: 'HOD — CSE', note: 'M.Tech · 18 yrs' },
      ],
    },
  },
};

// Legacy SEO slugs → canonical industry keys (mirrors backend/demo-site aliases), so
// a stored vendor.industry='healthcare' still resolves its catalog after the rename.
const CATALOG_ALIASES: Record<string, string> = { healthcare: 'clinic', beauty: 'salon', fitness: 'gym' };

/** Resolve a catalog for a category + optional subcategory (override merged on top). */
export function resolveCatalog(categoryId: string, subId?: string): CategoryCatalog | undefined {
  const key = CATALOG_ALIASES[categoryId] ?? categoryId;
  const base = DEMO_CATALOG[key];
  if (!base) return undefined;
  const override = subId ? DEMO_SUBCATALOG[key]?.[subId] : undefined;
  return override ? { ...base, ...override } : base;
}
