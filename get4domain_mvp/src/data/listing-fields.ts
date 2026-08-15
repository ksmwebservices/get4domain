// Per-category structured input schema for a vendor's website listings — the same
// rich field sets the demo sites use (demo-catalog.ts), expressed as editable inputs.
// Values are stored on VendorProduct.customFields (Json) and rendered on the live
// /site/[subdomain] pages via the same DemoCatalogGrid the demo sites use.

export interface ListingField {
  key: string;
  label: string;
  type?: 'text' | 'select';
  options?: string[];
  placeholder?: string;
}

const GENERIC: ListingField[] = [
  { key: 'detail', label: 'Key detail', placeholder: 'e.g. what makes this stand out' },
  { key: 'duration', label: 'Duration / Timeline', placeholder: 'e.g. 2 weeks' },
];

// Keyed by category id (industry-content ids). Categories not listed use GENERIC.
const FIELDS: Record<string, ListingField[]> = {
  realestate: [
    { key: 'area', label: 'Area', placeholder: 'e.g. 1,050 sqft' },
    { key: 'config', label: 'Configuration', placeholder: 'e.g. 2 Bed · 2 Bath' },
    { key: 'type', label: 'Listing type', type: 'select', options: ['For Sale', 'For Rent', 'For Lease', 'Plot'] },
  ],
  restaurant: [
    { key: 'course', label: 'Course', type: 'select', options: ['Starter', 'Main Course', 'South Indian', 'Dessert', 'Beverage', 'Snacks'] },
    { key: 'diet', label: 'Dietary', type: 'select', options: ['Veg', 'Non-veg', 'Vegan', 'Egg'] },
    { key: 'serves', label: 'Serves', placeholder: 'e.g. 1–2' },
  ],
  clinic: [
    { key: 'duration', label: 'Duration', placeholder: 'e.g. 30 min' },
    { key: 'department', label: 'Department', placeholder: 'e.g. Dental' },
  ],
  diagnostics: [
    { key: 'report', label: 'Report time', placeholder: 'e.g. Same day' },
    { key: 'sample', label: 'Sample', placeholder: 'e.g. Blood' },
  ],
  hotel: [
    { key: 'occupancy', label: 'Occupancy', placeholder: 'e.g. 2 Adults' },
    { key: 'amenities', label: 'Amenities', placeholder: 'e.g. AC · WiFi · Breakfast' },
  ],
  salon: [
    { key: 'duration', label: 'Duration', placeholder: 'e.g. 45 min' },
  ],
  gym: [
    { key: 'duration', label: 'Duration', placeholder: 'e.g. 1 Month' },
    { key: 'includes', label: 'Includes', placeholder: 'e.g. Gym + Cardio' },
  ],
  education: [
    { key: 'duration', label: 'Duration', placeholder: 'e.g. 2 Years' },
    { key: 'seats', label: 'Seats', placeholder: 'e.g. 40' },
  ],
  coaching: [
    { key: 'duration', label: 'Duration', placeholder: 'e.g. 1 Year' },
    { key: 'mode', label: 'Mode', type: 'select', options: ['Classroom', 'Online', 'Hybrid'] },
  ],
  travel: [
    { key: 'duration', label: 'Duration', placeholder: 'e.g. 3N / 4D' },
    { key: 'includes', label: 'Includes', placeholder: 'e.g. Stay + Cab' },
  ],
  automobile: [
    { key: 'duration', label: 'Duration', placeholder: 'e.g. 4 hrs' },
    { key: 'warranty', label: 'Warranty', placeholder: 'e.g. 1,000 km' },
  ],
  retail: [
    { key: 'category', label: 'Category', placeholder: 'e.g. Apparel' },
    { key: 'stock', label: 'Availability', type: 'select', options: ['In Stock', 'Made to Order', 'Out of Stock'] },
  ],
  photography: [
    { key: 'duration', label: 'Duration', placeholder: 'e.g. Full day' },
    { key: 'deliverables', label: 'Deliverables', placeholder: 'e.g. 300+ edited + album' },
  ],
  events: [
    { key: 'capacity', label: 'Capacity', placeholder: 'e.g. 300 guests' },
    { key: 'includes', label: 'Includes', placeholder: 'e.g. Decor + Stage' },
  ],
  logistics: [
    { key: 'coverage', label: 'Coverage', placeholder: 'e.g. Pan-India' },
  ],
  technology: [
    { key: 'duration', label: 'Timeline', placeholder: 'e.g. 2–3 weeks' },
  ],
  construction: [
    { key: 'scope', label: 'Scope', placeholder: 'e.g. Turnkey' },
    { key: 'duration', label: 'Timeline', placeholder: 'e.g. 8–12 months' },
  ],
  finance: [
    { key: 'type', label: 'Type', placeholder: 'e.g. Advisory' },
  ],
  professional: [
    { key: 'duration', label: 'Turnaround', placeholder: 'e.g. 7–10 days' },
  ],
  agriculture: [
    { key: 'unit', label: 'Unit', placeholder: 'e.g. 50 kg bag' },
    { key: 'coverage', label: 'Coverage', placeholder: 'e.g. 1 acre' },
  ],
};

// Legacy SEO slugs → canonical industry keys, so a stored vendor.industry='healthcare'
// still gets the right field set after the Aug 2026 key standardization.
const FIELD_ALIASES: Record<string, string> = { healthcare: 'clinic', beauty: 'salon', fitness: 'gym' };

export function getListingFields(categoryId?: string): ListingField[] {
  if (!categoryId) return GENERIC;
  const key = FIELD_ALIASES[categoryId] ?? categoryId;
  return FIELDS[key] || GENERIC;
}
