/**
 * MR Travels — real website content captured for the Get4Domain vendor migration.
 *
 * Sourced from the live public site (https://mrtravels.get4domain.com) and the
 * MR Travels repo `frontend/lib/constants.ts` (BRAND). This is the genuine
 * business identity + marketing copy. The live operational DB held only
 * placeholder catalog data (1 test package, 1 test vehicle) — see
 * docs/LEGACY_MIGRATION_MRTRAVELS_CONTENT.md — so the product catalog below is
 * the service set the public site advertises, plus the one real (test) package,
 * ready for the owner to refine in the vendor dashboard.
 *
 * NOTE: GST 33ABCDE1234F1Z5 looks like a placeholder — intentionally left OUT of
 * the CMS/SEO here; set the real GSTIN via the vendor dashboard before invoicing.
 */

export const MRTRAVELS_THEME = {
  name: 'MR Travels — Heritage Gold',
  industry: 'travel',
  // Warm gold + deep teal — evokes South-India temple/heritage travel; CSS-var driven.
  cssVars: { '--primary': '#0f766e', '--accent': '#d97706', '--radius': '14px' },
  isDefault: false,
};

export const MRTRAVELS_CMS = {
  businessName: 'M.R. Travels & Tours',
  tagline: 'Your Journey, Our Priority',
  about:
    'M.R. Travels & Tours was founded in 2010 in Thirukazhukundram with a single ' +
    'bus and a big dream — to provide the most reliable, comfortable and affordable ' +
    'travel services in Chengalpattu District.\n\n' +
    'Today we operate a fleet of 12+ modern AC coaches and serve thousands of happy ' +
    'travellers every year across Tamil Nadu, Andhra Pradesh, Karnataka and Kerala. ' +
    'Our fleet includes AC coaches, mini buses, tempo travellers and premium cars — ' +
    'all maintained to the highest standards, GPS-tracked and sanitised.\n\n' +
    'Whether you are planning a temple pilgrimage, a family vacation, a corporate ' +
    'outing, or need reliable employee transport, our experienced drivers know every ' +
    'route across South India and get you there safely and on time. 24/7 support, ' +
    'on-time pickup and drop, guaranteed.',
  phone: '99521 09224',
  whatsapp: '919952109224',
  email: 'mrtravelstours@gmail.com',
  address: 'Thirukazhukundram, Chengalpattu District, Tamil Nadu',
  logo: '/mainlogo_mrtravel.png', // owner should re-upload via the dashboard (asset lives in the legacy app)
  banner: 'https://images.pexels.com/photos/2901209/pexels-photo-2901209.jpeg?auto=compress&cs=tinysrgb&w=1600',
  seoTitle: 'M.R. Travels & Tours — Tamil Nadu & South India Travel, Tours & Vehicle Rental',
  seoDesc:
    'Reliable AC coach, mini bus, tempo traveller & car rental with experienced ' +
    'drivers across Tamil Nadu, Chennai, Andhra, Karnataka & Kerala. Temple tours, ' +
    'family & corporate packages, airport transfers, monthly & school bus contracts. ' +
    '24/7. Established 2010, Thirukazhukundram.',
  seoKeywords:
    'MR Travels and Tours, Tamil Nadu tour packages, AC coach rental Chennai, temple ' +
    'tour Tamil Nadu, corporate transport Chennai, school bus contract, airport pickup ' +
    'Chennai, tempo traveller rental, Tirupati tour package, Ooty tour package, ' +
    'Rameswaram tour package, Thirukazhukundram travels, Chengalpattu travels',
  googleMaps: '',
};

/** VendorProduct rows. `customFields` uses the travel listing-fields keys
 *  (duration, includes) + optional `tags`. Prices are strings (schema is String?). */
export const MRTRAVELS_PRODUCTS: Array<{
  name: string;
  description: string;
  price?: string;
  category?: string;
  image?: string;
  customFields?: Record<string, string>;
}> = [
  // The one real (placeholder) package that exists in the legacy DB today.
  {
    name: 'Munnar Hill Station Tour',
    description: 'Scenic hill-station getaway to Munnar with stay and meals. (Migrated from the legacy site — owner to refine itinerary.)',
    price: '8000',
    category: 'Tour Package',
    image: 'https://images.pexels.com/photos/2901209/pexels-photo-2901209.jpeg?auto=compress&cs=tinysrgb&w=1200',
    customFields: { duration: '3D / 2N', includes: 'Hotel + Meals', tags: 'Hill Station, Family' },
  },
  // Service catalogue advertised on the public site (6 headline services).
  {
    name: 'Domestic Tour Packages',
    description: 'Curated tour packages covering the best destinations across Tamil Nadu and South India — family packages, group tours, temple tours and custom itineraries.',
    price: 'On Request',
    category: 'Tour Package',
    image: 'https://images.pexels.com/photos/35990/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=1200',
    customFields: { includes: 'Family, Group, Temple, Custom', tags: 'Packages' },
  },
  {
    name: 'Corporate Employee Transportation',
    description: 'Reliable monthly bus contracts for corporate employee pickup and drop — dedicated vehicles, GPS tracking and punctual service.',
    price: 'On Request',
    category: 'Corporate',
    image: 'https://images.pexels.com/photos/2070485/pexels-photo-2070485.jpeg?auto=compress&cs=tinysrgb&w=1200',
    customFields: { includes: 'Monthly contracts, GPS, Dedicated vehicles', tags: 'Corporate' },
  },
  {
    name: 'School & College Tours & Contracts',
    description: 'Safe and educational tours for students, plus school and college bus contracts — safety first, experienced drivers.',
    price: 'On Request',
    category: 'Education',
    image: 'https://images.pexels.com/photos/4647/road-travel-vacation-bus.jpg?auto=compress&cs=tinysrgb&w=1200',
    customFields: { includes: 'Educational tours, School & College bus contracts', tags: 'Education' },
  },
  {
    name: 'Vehicle Rental',
    description: 'Wide range of vehicles for rent — from sedans to AC coaches — with experienced drivers. AC coaches, mini buses, tempo travellers, SUVs & sedans.',
    price: 'On Request',
    category: 'Rental',
    image: 'https://images.pexels.com/photos/375464/pexels-photo-375464.jpeg?auto=compress&cs=tinysrgb&w=1200',
    customFields: { includes: 'AC Coach, Mini Bus, Tempo, SUV, Sedan', tags: 'Rental' },
  },
  {
    name: 'Airport Pickup & Drop',
    description: 'On-time airport transfers to and from Chennai Airport with flight tracking — 24/7 service, clean vehicles, professional drivers.',
    price: 'On Request',
    category: 'Transfer',
    image: 'https://images.pexels.com/photos/1590362891991-f776e747a588.jpeg?auto=compress&cs=tinysrgb&w=1200',
    customFields: { includes: '24/7, Flight tracking', tags: 'Airport' },
  },
  {
    name: 'Custom Tour Planning',
    description: 'Tailor-made tour itineraries designed around your preferences and budget — flexible, multi-destination, all-inclusive options.',
    price: 'On Request',
    category: 'Tour Package',
    image: 'https://images.pexels.com/photos/2901209/pexels-photo-2901209.jpeg?auto=compress&cs=tinysrgb&w=1200',
    customFields: { includes: 'Flexible, Multi-destination, All-inclusive', tags: 'Custom' },
  },
];
