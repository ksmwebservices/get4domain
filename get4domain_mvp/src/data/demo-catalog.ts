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
  petcare: {
    flow: 'book-appointment', ctaLabel: 'Book Appointment', catalogNoun: 'services',
    items: [
      { name: 'Vet Consultation', price: '₹500', desc: 'General health check-up for your pet.', fields: [{ label: 'Duration', value: '20 min' }] },
      { name: 'Vaccination', price: 'From ₹600', desc: 'Core and booster shots with reminders.', fields: [{ label: 'Type', value: 'Dog / Cat' }] },
      { name: 'Pet Grooming', price: 'From ₹800', desc: 'Bath, haircut, nail trim and ear cleaning.', tags: ['Popular'], fields: [{ label: 'Duration', value: '60 min' }] },
      { name: 'Deworming & Tick Control', price: '₹400', desc: 'Anti-parasite treatment and advice.', fields: [{ label: 'Duration', value: '15 min' }] },
      { name: 'Boarding (per day)', price: '₹500 / day', desc: 'Safe day/overnight boarding with care.', fields: [{ label: 'Rate', value: 'Per day' }] },
    ],
    team: [
      { name: 'Dr. Sameer Khan', role: 'Veterinary Surgeon (BVSc)', note: 'Small animals · 11 yrs' },
      { name: 'Ritu Sharma', role: 'Certified Pet Groomer', note: '6 yrs' },
    ],
  },
  movers: {
    flow: 'get-quote', ctaLabel: 'Get a Quote', catalogNoun: 'services',
    items: [
      { name: 'Local Home Shifting', price: 'From ₹4,000', desc: 'Within-city shifting with packing and loading.', tags: ['Popular'], fields: [{ label: 'Scope', value: 'Within city' }] },
      { name: 'Intercity Moving', price: 'On survey', desc: 'City-to-city relocation with insured transit.', fields: [{ label: 'Scope', value: 'Interstate' }] },
      { name: 'Office Relocation', price: 'On survey', desc: 'Planned office shifting with minimal downtime.', fields: [{ label: 'Scope', value: 'Commercial' }] },
      { name: 'Vehicle Transport', price: 'From ₹6,000', desc: 'Car and bike transport in covered carriers.', fields: [{ label: 'Type', value: 'Car / Bike' }] },
      { name: 'Packing Material', price: 'On enquiry', desc: 'Boxes, bubble wrap and cartons for sale.', fields: [{ label: 'Type', value: 'Supplies' }] },
    ],
  },
  astrology: {
    flow: 'book-consult', ctaLabel: 'Book Consultation', catalogNoun: 'services',
    items: [
      { name: 'Astrology Consultation', price: '₹1,100', desc: 'Detailed kundli reading with predictions and remedies.', tags: ['Popular'], fields: [{ label: 'Duration', value: '30 min' }, { label: 'Mode', value: 'Phone / Video' }] },
      { name: 'Kundli Matching', price: '₹1,500', desc: 'Horoscope matching for marriage compatibility.', fields: [{ label: 'Duration', value: '40 min' }] },
      { name: 'Numerology Report', price: '₹2,100', desc: 'Name and number analysis with recommendations.', fields: [{ label: 'Type', value: 'Report' }] },
      { name: 'Vastu Consultation', price: 'From ₹3,000', desc: 'Home or office vastu review with remedies.', fields: [{ label: 'Mode', value: 'On-site / Online' }] },
      { name: 'Puja Services', price: 'On enquiry', desc: 'Pandit and puja arrangement with samagri.', fields: [{ label: 'Type', value: 'Ceremony' }] },
    ],
    team: [
      { name: 'Pandit Rakesh Shastri', role: 'Vedic Astrologer', note: 'Jyotish · 20 yrs' },
      { name: 'Guru Ananya Devi', role: 'Numerologist & Tarot', note: '12 yrs' },
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
    dermatology: {
      catalogNoun: 'treatments', coverImage: px(3985163),
      items: [
        { name: 'Dermatologist Consultation', price: '₹600', desc: 'Skin, hair and nail assessment with a treatment plan.', fields: [{ label: 'Duration', value: '20 min' }] },
        { name: 'Acne & Pigmentation Treatment', price: 'From ₹1,500 / session', desc: 'Medical peels and targeted therapy for clear skin.', fields: [{ label: 'Duration', value: '30 min' }] },
        { name: 'Laser Hair Reduction', price: 'From ₹2,000 / session', desc: 'USFDA-approved diode laser, per-area pricing.', tags: ['Popular'], fields: [{ label: 'Sittings', value: '6–8' }] },
        { name: 'Anti-Ageing & Botox', price: 'From ₹8,000', desc: 'Wrinkle reduction, fillers and skin tightening.', fields: [{ label: 'Duration', value: '45 min' }] },
        { name: 'PRP Hair Treatment', price: '₹4,000 / session', desc: 'Platelet-rich plasma for hair fall and regrowth.', fields: [{ label: 'Sittings', value: '4–6' }] },
        { name: 'Hair Transplant (FUE)', price: 'From ₹45,000', desc: 'Follicular unit extraction with natural results.', fields: [{ label: 'Grafts', value: 'Per session' }] },
      ],
      team: [
        { name: 'Dr. Meera Nair', role: 'Dermatologist (MBBS, MD)', note: 'Cosmetology · 12 yrs' },
        { name: 'Dr. Rohan Kapoor', role: 'Hair Transplant Surgeon', note: 'FUE & FUT · 9 yrs' },
      ],
    },
    orthopedic: {
      catalogNoun: 'treatments', coverImage: px(7659564),
      items: [
        { name: 'Orthopaedic Consultation', price: '₹700', desc: 'Assessment for bone, joint and spine problems.', fields: [{ label: 'Duration', value: '20 min' }] },
        { name: 'Digital X-Ray (on site)', price: '₹500', desc: 'Instant digital imaging with same-day reporting.', fields: [{ label: 'Duration', value: '15 min' }] },
        { name: 'Fracture Care & Plaster', price: 'From ₹1,500', desc: 'Casting, splinting and follow-up review.', fields: [{ label: 'Department', value: 'Trauma' }] },
        { name: 'Arthritis & Joint Pain Care', price: 'Consult ₹700', desc: 'Injections, physiotherapy and long-term management.', fields: [{ label: 'Department', value: 'Joint Care' }] },
        { name: 'Knee / Hip Replacement', price: 'Packages from ₹1,80,000', desc: 'Total joint replacement with rehab support.', tags: ['Surgery'], fields: [{ label: 'Stay', value: '3–5 days' }] },
        { name: 'Arthroscopy (Key-hole)', price: 'Packages from ₹90,000', desc: 'Minimally invasive knee and shoulder surgery.', fields: [{ label: 'Department', value: 'Sports Ortho' }] },
      ],
      team: [
        { name: 'Dr. Suresh Iyer', role: 'Orthopaedic Surgeon (MS Ortho)', note: 'Joint replacement · 18 yrs' },
        { name: 'Dr. Priya Menon', role: 'Sports Injury Specialist', note: 'Arthroscopy · 11 yrs' },
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
    'fine-dining': {
      flow: 'reserve-table', ctaLabel: 'Reserve a Table', catalogNoun: 'menu', coverImage: px(67468),
      items: [
        { name: 'Paneer Tikka (Starter)', price: '₹320', desc: 'Char-grilled cottage cheese in tandoori spices.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Starter' }] },
        { name: 'Murgh Malai Kebab', price: '₹380', desc: 'Creamy, mildly spiced chicken kebabs.', tags: ['Non-veg'], fields: [{ label: 'Course', value: 'Starter' }] },
        { name: 'Dal Makhani', price: '₹290', desc: 'Slow-cooked black lentils in butter and cream.', tags: ['Veg', 'Signature'], fields: [{ label: 'Course', value: 'Main' }] },
        { name: 'Hyderabadi Mutton Biryani', price: '₹480', desc: 'Dum-cooked biryani with tender mutton.', tags: ['Non-veg'], fields: [{ label: 'Course', value: 'Main' }] },
        { name: 'Assorted Breads Basket', price: '₹260', desc: 'Naan, laccha paratha and roti selection.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Bread' }] },
        { name: 'Gulab Jamun with Rabri', price: '₹180', desc: 'Warm gulab jamun with saffron rabri.', tags: ['Veg'], fields: [{ label: 'Course', value: 'Dessert' }] },
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
    bridal: {
      catalogNoun: 'packages', coverImage: px(1721558),
      items: [
        { name: 'Bridal Makeup (HD)', price: '₹12,000', desc: 'Complete HD bridal look with draping and hairstyling.', tags: ['Signature'], fields: [{ label: 'Duration', value: '2.5 hrs' }, { label: 'Trial', value: 'Included' }] },
        { name: 'Airbrush Bridal Makeup', price: '₹18,000', desc: 'Long-lasting airbrush finish for the wedding day.', fields: [{ label: 'Duration', value: '3 hrs' }] },
        { name: 'Engagement / Reception Makeup', price: '₹8,000', desc: 'Glam look for engagement or reception.', fields: [{ label: 'Duration', value: '2 hrs' }] },
        { name: 'Party / Guest Makeup', price: '₹3,500', desc: 'Soft glam for family and guests.', fields: [{ label: 'Duration', value: '60 min' }] },
        { name: 'Pre-Bridal Package', price: '₹9,999', desc: 'Facials, clean-up, hair spa and body polishing.', tags: ['Popular'], fields: [{ label: 'Sittings', value: '4–6' }] },
        { name: 'Mehendi (Bridal)', price: 'From ₹5,000', desc: 'Intricate bridal mehendi for hands and feet.', fields: [{ label: 'Duration', value: '3–4 hrs' }] },
      ],
      team: [
        { name: 'Simran Kaur', role: 'Lead Bridal Makeup Artist', note: 'HD & airbrush · 10 yrs' },
        { name: 'Aditi Sharma', role: 'Hair & Draping Stylist', note: '7 yrs' },
      ],
    },
    'mens-grooming': {
      catalogNoun: 'services', coverImage: px(1319460),
      items: [
        { name: 'Haircut & Styling', price: '₹250', desc: 'Precision cut and finish by expert barbers.', fields: [{ label: 'Duration', value: '30 min' }] },
        { name: 'Beard Styling & Shave', price: '₹200', desc: 'Hot-towel shave or beard shaping.', tags: ['Popular'], fields: [{ label: 'Duration', value: '25 min' }] },
        { name: 'Hair Colour (Men)', price: 'From ₹600', desc: 'Global colour or grey coverage.', fields: [{ label: 'Duration', value: '45 min' }] },
        { name: "Men's Facial & Cleanup", price: '₹800', desc: 'De-tan facial and skin cleanup.', fields: [{ label: 'Duration', value: '45 min' }] },
        { name: 'Grooming Membership', price: '₹2,499 / 6 months', desc: 'Unlimited haircuts and beard trims.', tags: ['Membership'], fields: [{ label: 'Validity', value: '6 months' }] },
      ],
      team: [
        { name: 'Rahul Verma', role: 'Master Barber', note: 'Fades & beard · 9 yrs' },
        { name: 'Imran Sheikh', role: 'Senior Stylist', note: 'Colour & styling · 7 yrs' },
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
    'personal-training': {
      catalogNoun: 'packages', coverImage: px(1954524),
      items: [
        { name: 'Free Fitness Consultation', price: '₹0', desc: 'Goal assessment and body analysis.', tags: ['Free'], fields: [{ label: 'Duration', value: '30 min' }] },
        { name: '1-on-1 Personal Training', price: '₹8,000 / month', desc: '12 personalised sessions with your coach.', tags: ['Popular'], fields: [{ label: 'Sessions', value: '12 / month' }] },
        { name: 'Weight-Loss Transformation', price: '₹18,000 / 3 months', desc: 'Training + diet for measurable fat loss.', fields: [{ label: 'Duration', value: '3 Months' }] },
        { name: 'Online Coaching', price: '₹5,000 / month', desc: 'Remote workout and diet plans with check-ins.', fields: [{ label: 'Mode', value: 'Online' }] },
        { name: 'Diet & Nutrition Plan', price: '₹3,000', desc: 'Custom meal plan for your goals.', fields: [{ label: 'Validity', value: '1 Month' }] },
      ],
      team: [
        { name: 'Vikram Singh', role: 'Certified Personal Trainer', note: 'ACE · Fat loss · 9 yrs' },
        { name: 'Neha Gupta', role: 'Sports Nutritionist', note: '7 yrs' },
      ],
    },
    'dance-fitness': {
      catalogNoun: 'classes', coverImage: px(4498482),
      items: [
        { name: 'Zumba (Group Class)', price: '₹1,500 / month', desc: 'High-energy dance cardio, all levels.', tags: ['Popular'], fields: [{ label: 'Duration', value: '1 Month' }, { label: 'Batch', value: 'Morning / Evening' }] },
        { name: 'Aerobics Batch', price: '₹1,200 / month', desc: 'Cardio and toning workouts.', fields: [{ label: 'Duration', value: '1 Month' }] },
        { name: 'Weight-Loss Dance Batch', price: '₹2,000 / month', desc: 'Intensive cardio dance for fat loss.', fields: [{ label: 'Duration', value: '1 Month' }] },
        { name: 'Drop-in Class', price: '₹200 / class', desc: 'Single session, no commitment.', fields: [{ label: 'Duration', value: '60 min' }] },
      ],
      team: [
        { name: 'Pooja Reddy', role: 'Licensed Zumba Instructor', note: 'ZIN · 6 yrs' },
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
  retail: {
    fashion: {
      catalogNoun: 'collection', coverImage: px(996329),
      items: [
        { name: 'Anarkali Kurti Set', price: '₹1,499', desc: 'Flared kurti with dupatta, festive collection.', tags: ['New'], fields: [{ label: 'Category', value: 'Ethnic' }, { label: 'Sizes', value: 'S–XXL' }] },
        { name: 'Cotton Saree', price: '₹1,899', desc: 'Handloom cotton saree with blouse piece.', fields: [{ label: 'Category', value: 'Sarees' }] },
        { name: "Men's Casual Shirt", price: '₹899', desc: 'Slim-fit cotton shirt, multiple colours.', fields: [{ label: 'Category', value: 'Menswear' }, { label: 'Sizes', value: 'M–XXL' }] },
        { name: 'Party Wear Gown', price: '₹2,999', desc: 'Designer gown for receptions and parties.', tags: ['Bestseller'], fields: [{ label: 'Category', value: 'Western' }] },
        { name: 'Kids Ethnic Set', price: '₹1,199', desc: 'Festive kurta-pyjama and lehenga sets.', fields: [{ label: 'Category', value: 'Kidswear' }] },
      ],
    },
    electronics: {
      catalogNoun: 'products', coverImage: px(699122),
      items: [
        { name: 'Smartphone (128 GB)', price: '₹14,999', desc: 'Latest model, no-cost EMI available.', tags: ['EMI'], fields: [{ label: 'Category', value: 'Mobiles' }, { label: 'Warranty', value: '1 Year' }] },
        { name: 'Wireless Earbuds', price: '₹1,799', desc: 'TWS earbuds with 30h battery case.', tags: ['Bestseller'], fields: [{ label: 'Category', value: 'Audio' }] },
        { name: 'LED Smart TV (43")', price: '₹27,999', desc: 'Full-HD smart TV with OTT apps.', fields: [{ label: 'Category', value: 'TV' }, { label: 'Warranty', value: '2 Years' }] },
        { name: 'Laptop (i5, 8GB)', price: '₹45,999', desc: 'Everyday laptop with SSD, exchange offer.', tags: ['Exchange'], fields: [{ label: 'Category', value: 'Computers' }] },
        { name: 'Washing Machine (7 kg)', price: '₹18,499', desc: 'Fully-automatic front load with warranty.', fields: [{ label: 'Category', value: 'Appliances' }] },
      ],
    },
    grocery: {
      flow: 'enquire-order', ctaLabel: 'Order for Delivery', catalogNoun: 'essentials', coverImage: px(264636),
      items: [
        { name: 'Rice (Sona Masoori, 25 kg)', price: '₹1,350', desc: 'Premium daily-use rice, bulk pack.', fields: [{ label: 'Category', value: 'Staples' }] },
        { name: 'Toor Dal (1 kg)', price: '₹150', desc: 'Fresh-stock unpolished toor dal.', fields: [{ label: 'Category', value: 'Pulses' }] },
        { name: 'Fresh Vegetables Combo', price: '₹199', desc: 'Daily basket — onion, tomato, potato and greens.', tags: ['Fresh'], fields: [{ label: 'Category', value: 'Produce' }] },
        { name: 'Cooking Oil (5 L)', price: '₹720', desc: 'Refined sunflower oil can.', fields: [{ label: 'Category', value: 'Oils' }] },
        { name: 'Household Combo', price: '₹499', desc: 'Detergent, soaps and cleaning essentials.', tags: ['Value'], fields: [{ label: 'Category', value: 'Home Care' }] },
      ],
    },
    jewellery: {
      flow: 'enquire', ctaLabel: 'Enquire / Visit Showroom', catalogNoun: 'collection', coverImage: px(1191531),
      items: [
        { name: 'Gold Necklace Set (22K)', price: 'Market rate + making', desc: 'Traditional temple-design necklace with earrings.', tags: ['Hallmarked'], fields: [{ label: 'Purity', value: '22K BIS' }] },
        { name: 'Diamond Ring', price: 'From ₹35,000', desc: 'Certified solitaire and cluster designs.', tags: ['Certified'], fields: [{ label: 'Category', value: 'Diamond' }] },
        { name: 'Bridal Jewellery Set', price: 'On enquiry', desc: 'Complete bridal set — haar, jhumka and maang tikka.', tags: ['Bridal'], fields: [{ label: 'Category', value: 'Bridal' }] },
        { name: 'Silver Payal & Anklets', price: 'From ₹2,500', desc: 'Handcrafted pure-silver anklets.', fields: [{ label: 'Category', value: 'Silver' }] },
        { name: 'Gold Coins (8g)', price: 'Market rate', desc: '24K hallmarked coins for gifting and investment.', fields: [{ label: 'Purity', value: '24K' }] },
      ],
    },
  },
  travel: {
    'holiday-packages': {
      catalogNoun: 'packages', coverImage: px(1450353),
      items: [
        { name: 'Kerala Backwaters', price: '₹18,500 / person', desc: 'Munnar, Alleppey houseboat and Kochi.', tags: ['Bestseller'], fields: [{ label: 'Duration', value: '4N / 5D' }, { label: 'Includes', value: 'Houseboat + Hotels' }] },
        { name: 'Manali–Shimla Hill Tour', price: '₹16,999 / person', desc: 'Snow points, sightseeing and volvo transfers.', fields: [{ label: 'Duration', value: '5N / 6D' }] },
        { name: 'Goa Beach Holiday', price: '₹13,500 / person', desc: 'North & South Goa with cruise and stay.', fields: [{ label: 'Duration', value: '3N / 4D' }] },
        { name: 'Andaman Honeymoon', price: '₹28,000 / couple', desc: 'Havelock, Neil Island and water sports.', tags: ['Honeymoon'], fields: [{ label: 'Duration', value: '5N / 6D' }] },
        { name: 'Rajasthan Heritage', price: '₹22,000 / person', desc: 'Jaipur, Udaipur and Jaisalmer forts.', fields: [{ label: 'Duration', value: '6N / 7D' }] },
      ],
    },
    'cab-rental': {
      flow: 'check-availability', ctaLabel: 'Book a Cab', catalogNoun: 'fleet', coverImage: px(170811),
      items: [
        { name: 'Airport Transfer (Sedan)', price: '₹1,200 one-way', desc: 'Clean AC sedan, on-time pickup, tracked trip.', fields: [{ label: 'Vehicle', value: 'Sedan · 4 seats' }] },
        { name: 'Local City Package (8h/80km)', price: '₹2,200', desc: 'Full-day city sightseeing with driver.', tags: ['Popular'], fields: [{ label: 'Vehicle', value: 'Sedan / SUV' }] },
        { name: 'Outstation SUV', price: '₹14 / km', desc: 'Innova Crysta for long-distance trips.', fields: [{ label: 'Vehicle', value: 'SUV · 7 seats' }] },
        { name: 'Tempo Traveller (Group)', price: '₹22 / km', desc: '12-seater AC for group and corporate travel.', fields: [{ label: 'Vehicle', value: '12 seats' }] },
      ],
      team: [
        { name: 'Toyota Innova Crysta', role: '7-Seater AC', note: 'Ideal for family tours' },
        { name: 'Swift Dzire', role: '4-Seater Sedan', note: 'Airport & city transfers' },
        { name: 'Tempo Traveller', role: '12-Seater AC', note: 'Group & corporate travel' },
      ],
    },
    'visa-ticketing': {
      flow: 'enquire', ctaLabel: 'Enquire Now', catalogNoun: 'services', coverImage: px(346885),
      items: [
        { name: 'Domestic Flight Ticketing', price: 'Service charge ₹250', desc: 'Best fares across all airlines.', fields: [{ label: 'Type', value: 'Domestic' }] },
        { name: 'International Air Tickets', price: 'Service charge ₹500', desc: 'Multi-city and round-trip bookings.', fields: [{ label: 'Type', value: 'International' }] },
        { name: 'Tourist Visa Assistance', price: 'From ₹1,500 + fees', desc: 'Documentation and application support.', tags: ['Popular'], fields: [{ label: 'Type', value: 'Visa' }] },
        { name: 'Passport Assistance', price: 'From ₹800', desc: 'New and renewal application help.', fields: [{ label: 'Type', value: 'Passport' }] },
        { name: 'Travel Insurance', price: 'From ₹450', desc: 'Medical and trip cover for travellers.', fields: [{ label: 'Type', value: 'Insurance' }] },
      ],
    },
    pilgrimage: {
      catalogNoun: 'yatra packages', coverImage: px(6032424),
      items: [
        { name: 'Tirupati Darshan', price: '₹4,999 / person', desc: 'Darshan assistance with stay and transfers.', tags: ['Popular'], fields: [{ label: 'Duration', value: '1N / 2D' }] },
        { name: 'Char Dham Yatra', price: '₹32,000 / person', desc: 'Yamunotri, Gangotri, Kedarnath and Badrinath.', fields: [{ label: 'Duration', value: '9N / 10D' }] },
        { name: 'Vaishno Devi', price: '₹9,999 / person', desc: 'Katra stay, yatra assistance and transfers.', fields: [{ label: 'Duration', value: '2N / 3D' }] },
        { name: 'Kashi–Ayodhya–Prayagraj', price: '₹14,500 / person', desc: 'Temple circuit with guide and stay.', fields: [{ label: 'Duration', value: '4N / 5D' }] },
        { name: 'Rameshwaram–Madurai', price: '₹11,000 / person', desc: 'South India temple tour with darshan help.', fields: [{ label: 'Duration', value: '3N / 4D' }] },
      ],
    },
  },
  professional: {
    'ca-accounting': {
      catalogNoun: 'services', coverImage: px(6863183),
      items: [
        { name: 'GST Registration', price: '₹1,500', desc: 'New GSTIN with end-to-end filing.', fields: [{ label: 'Turnaround', value: '3–5 days' }] },
        { name: 'GST Return Filing', price: '₹1,000 / month', desc: 'Monthly GSTR-1 & 3B filing.', tags: ['Popular'], fields: [{ label: 'Cycle', value: 'Monthly' }] },
        { name: 'Income Tax Return (ITR)', price: '₹2,000', desc: 'Salaried and business ITR filing.', fields: [{ label: 'Turnaround', value: '2–3 days' }] },
        { name: 'Bookkeeping (Monthly)', price: 'From ₹3,000 / month', desc: 'Accounts, ledgers and MIS reports.', fields: [{ label: 'Cycle', value: 'Monthly' }] },
        { name: 'Tax Audit', price: 'On enquiry', desc: 'Statutory and tax audit for businesses.', fields: [{ label: 'Type', value: 'Audit' }] },
      ],
      team: [
        { name: 'CA Ramesh Gupta', role: 'Chartered Accountant', note: 'Tax & Audit · 15 yrs' },
        { name: 'CA Sneha Jain', role: 'GST & Compliance', note: '8 yrs' },
      ],
    },
    legal: {
      catalogNoun: 'practice areas', coverImage: px(5668858),
      items: [
        { name: 'Legal Consultation', price: '₹1,000', desc: 'Confidential first consultation on your matter.', fields: [{ label: 'Duration', value: '30 min' }] },
        { name: 'Property & Documentation', price: 'From ₹3,000', desc: 'Sale deeds, agreements and title verification.', tags: ['Popular'], fields: [{ label: 'Area', value: 'Property' }] },
        { name: 'Family & Divorce Matters', price: 'On enquiry', desc: 'Divorce, custody and maintenance cases.', fields: [{ label: 'Area', value: 'Family' }] },
        { name: 'Civil & Criminal Cases', price: 'On enquiry', desc: 'Representation across courts.', fields: [{ label: 'Area', value: 'Litigation' }] },
        { name: 'Corporate & Contracts', price: 'From ₹5,000', desc: 'Agreements, notices and corporate advisory.', fields: [{ label: 'Area', value: 'Corporate' }] },
      ],
      team: [
        { name: 'Adv. Priya Nair', role: 'Advocate (Property & Civil)', note: 'LLB · 12 yrs' },
        { name: 'Adv. Karan Mehta', role: 'Advocate (Criminal)', note: '10 yrs' },
      ],
    },
    'company-registration': {
      catalogNoun: 'services', coverImage: px(3183197),
      items: [
        { name: 'Private Limited Registration', price: '₹6,999', desc: 'Pvt Ltd incorporation, end to end.', tags: ['Popular'], fields: [{ label: 'Turnaround', value: '7–10 days' }] },
        { name: 'LLP Registration', price: '₹5,999', desc: 'Limited liability partnership setup.', fields: [{ label: 'Turnaround', value: '7–10 days' }] },
        { name: 'Trademark Registration', price: '₹1,999 + govt fee', desc: 'Brand-name and logo trademark filing.', fields: [{ label: 'Type', value: 'IP' }] },
        { name: 'MSME / Udyam Registration', price: '₹999', desc: 'Same-day MSME registration.', fields: [{ label: 'Turnaround', value: '1 day' }] },
        { name: 'Annual ROC Compliance', price: 'From ₹8,000 / year', desc: 'Filings, returns and statutory compliance.', fields: [{ label: 'Cycle', value: 'Annual' }] },
      ],
    },
    insurance: {
      flow: 'enquire', ctaLabel: 'Get Advice', catalogNoun: 'plans', coverImage: px(3760067),
      items: [
        { name: 'Term Life Insurance', price: 'From ₹500 / month', desc: 'High cover, low premium for your family.', tags: ['Popular'], fields: [{ label: 'Type', value: 'Life' }] },
        { name: 'Health / Mediclaim', price: 'From ₹800 / month', desc: 'Family floater with cashless hospitals.', fields: [{ label: 'Type', value: 'Health' }] },
        { name: 'Motor Insurance', price: 'From ₹2,500 / year', desc: 'Car and two-wheeler cover with quick claims.', fields: [{ label: 'Type', value: 'Motor' }] },
        { name: 'Investment (ULIP / Endowment)', price: 'On enquiry', desc: 'Savings-linked plans with life cover.', fields: [{ label: 'Type', value: 'Investment' }] },
      ],
      team: [
        { name: 'Sanjay Malhotra', role: 'Certified Insurance Advisor', note: 'IRDAI · 14 yrs' },
      ],
    },
  },
  petcare: {
    veterinary: {
      catalogNoun: 'services', coverImage: px(6816858),
      items: [
        { name: 'Vet Consultation', price: '₹500', desc: 'General health check-up and diagnosis.', fields: [{ label: 'Duration', value: '20 min' }] },
        { name: 'Vaccination (Dog/Cat)', price: 'From ₹600', desc: 'Core, rabies and booster shots with reminders.', tags: ['Popular'], fields: [{ label: 'Type', value: 'Vaccine' }] },
        { name: 'Deworming & Tick Control', price: '₹400', desc: 'Anti-parasite treatment and prevention.', fields: [{ label: 'Duration', value: '15 min' }] },
        { name: 'Surgery & Neutering', price: 'On enquiry', desc: 'Spay/neuter and minor surgical procedures.', fields: [{ label: 'Type', value: 'Surgery' }] },
        { name: 'Emergency Vet Care', price: 'On call', desc: 'Urgent care for accidents and illness.', tags: ['24/7'], fields: [{ label: 'Availability', value: 'On call' }] },
      ],
      team: [
        { name: 'Dr. Sameer Khan', role: 'Veterinary Surgeon (BVSc)', note: 'Small animals · 11 yrs' },
        { name: 'Dr. Anita Roy', role: 'Veterinary Physician', note: '8 yrs' },
      ],
    },
    grooming: {
      flow: 'book-slot', ctaLabel: 'Book Grooming', catalogNoun: 'packages', coverImage: px(6568461),
      items: [
        { name: 'Bath & Blow Dry', price: '₹600', desc: 'Shampoo, conditioning and blow dry.', fields: [{ label: 'Duration', value: '45 min' }] },
        { name: 'Full Grooming Package', price: '₹1,200', desc: 'Bath, haircut, nail trim and ear cleaning.', tags: ['Popular'], fields: [{ label: 'Duration', value: '90 min' }] },
        { name: 'Nail Trim & Paw Care', price: '₹300', desc: 'Nail clipping and paw pad care.', fields: [{ label: 'Duration', value: '20 min' }] },
        { name: 'De-shedding Treatment', price: '₹900', desc: 'Coat de-shedding for heavy shedders.', fields: [{ label: 'Duration', value: '60 min' }] },
        { name: 'Home Grooming Visit', price: 'From ₹1,500', desc: 'Grooming at your doorstep.', tags: ['Home Visit'], fields: [{ label: 'Duration', value: '90 min' }] },
      ],
      team: [
        { name: 'Ritu Sharma', role: 'Certified Pet Groomer', note: '6 yrs' },
      ],
    },
    boarding: {
      flow: 'check-availability', ctaLabel: 'Check Availability', catalogNoun: 'plans', coverImage: px(1904105),
      items: [
        { name: 'Day Boarding', price: '₹500 / day', desc: 'Supervised daytime care with play and meals.', fields: [{ label: 'Rate', value: 'Per day' }] },
        { name: 'Overnight Boarding', price: '₹800 / night', desc: 'Safe overnight stay with two meals.', tags: ['Popular'], fields: [{ label: 'Rate', value: 'Per night' }] },
        { name: 'Weekly Boarding', price: '₹4,500 / week', desc: 'Discounted week-long stay for holidays.', fields: [{ label: 'Rate', value: 'Per week' }] },
        { name: 'Cat Boarding', price: '₹600 / night', desc: 'Separate, quiet cattery space.', fields: [{ label: 'Rate', value: 'Per night' }] },
      ],
    },
    petshop: {
      flow: 'enquire-order', ctaLabel: 'Order for Delivery', catalogNoun: 'products', coverImage: px(6816856),
      items: [
        { name: 'Premium Dog Food (3 kg)', price: '₹1,200', desc: 'Grain-free nutrition for adult dogs.', tags: ['Bestseller'], fields: [{ label: 'Category', value: 'Food' }] },
        { name: 'Cat Food (1.2 kg)', price: '₹650', desc: 'Complete cat food, chicken flavour.', fields: [{ label: 'Category', value: 'Food' }] },
        { name: 'Chew Toys & Treats', price: 'From ₹150', desc: 'Toys, treats and dental chews.', fields: [{ label: 'Category', value: 'Toys' }] },
        { name: 'Collar, Leash & Harness', price: 'From ₹300', desc: 'Durable walking accessories.', fields: [{ label: 'Category', value: 'Accessories' }] },
        { name: 'Aquarium Starter Kit', price: '₹2,499', desc: 'Tank, filter and starter supplies.', fields: [{ label: 'Category', value: 'Aquarium' }] },
      ],
    },
  },
  movers: {
    'local-shifting': {
      catalogNoun: 'services', coverImage: px(7464230),
      items: [
        { name: '1 BHK Home Shifting', price: 'From ₹4,000', desc: 'Packing, loading and transport within city.', tags: ['Popular'], fields: [{ label: 'Scope', value: 'Within city' }] },
        { name: '2 BHK Home Shifting', price: 'From ₹7,000', desc: 'Full-home packing and careful transport.', fields: [{ label: 'Scope', value: 'Within city' }] },
        { name: '3 BHK / Villa Shifting', price: 'On survey', desc: 'Large-home move with extra crew.', fields: [{ label: 'Scope', value: 'Within city' }] },
        { name: 'Few Items / Single Item', price: 'From ₹1,500', desc: 'Appliance or furniture-only shifting.', fields: [{ label: 'Type', value: 'Partial' }] },
        { name: 'Labour Only (Load/Unload)', price: 'From ₹1,200', desc: 'Manpower for loading and unloading.', fields: [{ label: 'Type', value: 'Labour' }] },
      ],
    },
    intercity: {
      catalogNoun: 'services', coverImage: px(1178448),
      items: [
        { name: 'Intercity 1 BHK Move', price: 'On survey', desc: 'City-to-city home relocation, insured.', tags: ['Insured'], fields: [{ label: 'Scope', value: 'Interstate' }] },
        { name: 'Intercity 2/3 BHK Move', price: 'On survey', desc: 'Dedicated vehicle for long-distance moves.', fields: [{ label: 'Scope', value: 'Interstate' }] },
        { name: 'Shared / Part-load Move', price: 'From ₹8,000', desc: 'Economical shared-truck relocation.', fields: [{ label: 'Type', value: 'Part-load' }] },
        { name: 'Transit Insurance', price: 'From 3% of value', desc: 'Full coverage against transit damage.', fields: [{ label: 'Type', value: 'Insurance' }] },
      ],
    },
    'office-relocation': {
      catalogNoun: 'services', coverImage: px(4483610),
      items: [
        { name: 'Small Office Move', price: 'On survey', desc: 'Up to 10 workstations, weekend move.', fields: [{ label: 'Scope', value: 'Commercial' }] },
        { name: 'Corporate Office Move', price: 'On survey', desc: 'Full office with IT and records handling.', tags: ['Popular'], fields: [{ label: 'Scope', value: 'Commercial' }] },
        { name: 'IT & Server Shifting', price: 'On enquiry', desc: 'Specialised handling for IT equipment.', fields: [{ label: 'Type', value: 'IT' }] },
        { name: 'Records & Document Move', price: 'On enquiry', desc: 'Indexed, secure file relocation.', fields: [{ label: 'Type', value: 'Records' }] },
      ],
    },
    'vehicle-transport': {
      catalogNoun: 'services', coverImage: px(2244746),
      items: [
        { name: 'Car Transport (Local)', price: 'From ₹4,000', desc: 'Within-state car transport in carrier.', fields: [{ label: 'Type', value: 'Car' }] },
        { name: 'Car Transport (Intercity)', price: 'From ₹8,000', desc: 'Enclosed carrier, insured, door-to-door.', tags: ['Insured'], fields: [{ label: 'Type', value: 'Car' }] },
        { name: 'Bike Transport', price: 'From ₹2,500', desc: 'Two-wheeler transport with packing.', fields: [{ label: 'Type', value: 'Bike' }] },
        { name: 'Multi-Vehicle Carrier', price: 'On enquiry', desc: 'For dealers and bulk vehicle movement.', fields: [{ label: 'Type', value: 'Bulk' }] },
      ],
    },
  },
  astrology: {
    astrologer: {
      catalogNoun: 'services', coverImage: px(6980513),
      items: [
        { name: 'Kundli Reading', price: '₹1,100', desc: 'Detailed birth-chart reading with predictions.', tags: ['Popular'], fields: [{ label: 'Duration', value: '30 min' }, { label: 'Mode', value: 'Phone / Video' }] },
        { name: 'Career & Business', price: '₹1,500', desc: 'Guidance on career, job change and business.', fields: [{ label: 'Duration', value: '30 min' }] },
        { name: 'Marriage & Relationship', price: '₹1,500', desc: 'Timing, compatibility and remedies.', fields: [{ label: 'Duration', value: '30 min' }] },
        { name: 'Gemstone Recommendation', price: '₹800', desc: 'Suitable gemstones with wearing guidance.', fields: [{ label: 'Type', value: 'Remedy' }] },
        { name: 'Annual Prediction (Varshphal)', price: '₹2,500', desc: 'Year-ahead forecast report.', fields: [{ label: 'Type', value: 'Report' }] },
      ],
      team: [
        { name: 'Pandit Rakesh Shastri', role: 'Vedic Astrologer', note: 'Jyotish · 20 yrs' },
      ],
    },
    numerology: {
      catalogNoun: 'services', coverImage: px(4132538),
      items: [
        { name: 'Personal Numerology Report', price: '₹2,100', desc: 'Name and birth-number analysis.', tags: ['Popular'], fields: [{ label: 'Type', value: 'Report' }] },
        { name: 'Name Correction', price: '₹3,100', desc: 'Corrected spelling for luck and success.', fields: [{ label: 'Type', value: 'Correction' }] },
        { name: 'Business Name Numerology', price: '₹5,100', desc: 'Lucky brand-name and logo advice.', fields: [{ label: 'Type', value: 'Business' }] },
        { name: 'Compatibility Report', price: '₹2,500', desc: 'Numerology-based relationship match.', fields: [{ label: 'Type', value: 'Report' }] },
      ],
    },
    vastu: {
      flow: 'book-consult', ctaLabel: 'Book Consultation', catalogNoun: 'services', coverImage: px(6580226),
      items: [
        { name: 'Home Vastu Review', price: 'From ₹3,000', desc: 'On-site or online home vastu with remedies.', tags: ['Popular'], fields: [{ label: 'Mode', value: 'On-site / Online' }] },
        { name: 'Office / Shop Vastu', price: 'From ₹5,000', desc: 'Commercial vastu for growth and harmony.', fields: [{ label: 'Mode', value: 'On-site' }] },
        { name: 'Plot / Land Vastu', price: 'From ₹4,000', desc: 'Pre-purchase plot evaluation.', fields: [{ label: 'Type', value: 'Plot' }] },
        { name: 'Factory / Industrial Vastu', price: 'On enquiry', desc: 'Layout and energy planning for units.', fields: [{ label: 'Type', value: 'Industrial' }] },
      ],
    },
    'pandit-puja': {
      flow: 'book-slot', ctaLabel: 'Book a Pandit', catalogNoun: 'ceremonies', coverImage: px(8112199),
      items: [
        { name: 'Griha Pravesh Puja', price: 'From ₹3,100', desc: 'House-warming puja with pandit and samagri.', tags: ['Popular'], fields: [{ label: 'Duration', value: '2–3 hrs' }] },
        { name: 'Satyanarayan Puja', price: 'From ₹2,500', desc: 'Full puja with katha and prasad.', fields: [{ label: 'Duration', value: '2 hrs' }] },
        { name: 'Havan / Hawan', price: 'From ₹3,500', desc: 'Havan for peace, health or new beginnings.', fields: [{ label: 'Duration', value: '2–3 hrs' }] },
        { name: 'Wedding Ceremony', price: 'On enquiry', desc: 'Complete Vedic wedding rituals.', fields: [{ label: 'Type', value: 'Wedding' }] },
        { name: 'Samagri Kit', price: 'From ₹800', desc: 'Puja materials arranged and delivered.', fields: [{ label: 'Type', value: 'Materials' }] },
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
