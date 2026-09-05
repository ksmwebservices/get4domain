import type { EngineSiteData } from '../../types';

/**
 * Real Estate content model — the CONTENT layer, deliberately separate from the
 * design (sections) and automation (actions). The adapter merges a real vendor's
 * CMS + catalogue into this shape and fills gaps from premium seed content, so a
 * sparse live site and the preview both read as a finished developer's website.
 */

export interface ReProject {
  id: string;
  name: string;
  location?: string;
  priceLabel?: string;
  config?: string; // "2 & 3 BHK", "Plots 1200–2400 sqft"
  area?: string;
  status?: string; // "Ready to move", "Under construction", "New launch"
  image?: string;
  tags?: string[];
  description?: string;
}

export interface ReSiteModel {
  brand: {
    name: string; tagline: string; about: string;
    logo?: string; phone?: string; whatsapp?: string; email?: string;
    address?: string; businessHours?: string;
    rera?: string;
  };
  hero: { headline: string; subline: string; highlight: string; image: string };
  stats: { value: string; label: string }[];
  projects: ReProject[];
  propertyTypes: { label: string; blurb: string }[];
  location: { area: string; points: { label: string; distance: string }[]; note: string };
  amenities: { label: string; icon: string }[];
  gallery: string[];
  floorPlans: { config: string; area: string; priceLabel: string }[];
  construction: { phase: string; state: 'done' | 'active' | 'upcoming' }[];
  /** Whether real catalogue content backed the projects (vs pure seed). */
  hasRealProjects: boolean;
}

const IMG = {
  // Clean, relevant property imagery (the earlier washed-out sky exterior on the
  // project card is replaced with a crisp apartment/interior set).
  hero: 'https://images.pexels.com/photos/1546168/pexels-photo-1546168.jpeg?auto=compress&cs=tinysrgb&w=1600',
  p1: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200',
  p2: 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=1200',
  p3: 'https://images.pexels.com/photos/2102587/pexels-photo-2102587.jpeg?auto=compress&cs=tinysrgb&w=1200',
  g1: 'https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=1000',
  g2: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1000',
  g3: 'https://images.pexels.com/photos/439391/pexels-photo-439391.jpeg?auto=compress&cs=tinysrgb&w=1000',
  g4: 'https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1000',
  g5: 'https://images.pexels.com/photos/1571453/pexels-photo-1571453.jpeg?auto=compress&cs=tinysrgb&w=1000',
};

// Reference sample properties (§18): 2 BHK ₹68L, 3 BHK ₹92L, Residential Plot ₹42L.
const SEED_PROJECTS: ReProject[] = [
  { id: 'seed-1', name: '2 BHK Apartment', location: 'Whitefield, Bengaluru', priceLabel: '₹68 L', config: '2 BHK', area: '1,180 sqft', status: 'Ready to move', image: IMG.p1, tags: ['RERA', 'Ready', 'Corner unit'], description: 'Bright, efficient 2 BHK homes in a gated community with a clubhouse and pool.' },
  { id: 'seed-2', name: '3 BHK Apartment', location: 'Sarjapur Road', priceLabel: '₹92 L', config: '3 BHK', area: '1,640 sqft', status: 'Under construction', image: IMG.p2, tags: ['RERA', 'Possession 2027', 'Balcony garden'], description: 'Spacious 3 BHK residences with double-height lobbies and landscaped sky decks.' },
  { id: 'seed-3', name: 'Residential Plot', location: 'Devanahalli', priceLabel: '₹42 L', config: 'Plot 1,200 sqft', area: 'BMRDA approved', status: 'New launch', image: IMG.p3, tags: ['Clear title', 'Near airport', 'Financing'], description: 'Premium plotted development on the northern growth corridor.' },
];

const priceStr = (p?: string | null): string | undefined => {
  if (!p) return undefined;
  const t = p.trim();
  if (!t) return undefined;
  return /^[₹$]/.test(t) ? t : `₹${t}`;
};

/** Read a customField by any of several likely keys (real-estate field aliases). */
function cf(fields: Record<string, string> | null, ...keys: string[]): string | undefined {
  if (!fields) return undefined;
  for (const k of keys) {
    const v = fields[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

export function buildReModel(site: EngineSiteData): ReSiteModel {
  const name = site.cms?.businessName || site.vendor.businessName || 'PrimeNest Realty';
  const realProjects: ReProject[] = site.products.map((p) => {
    const f = p.customFields;
    const tags = (cf(f, 'tags') || '').split(',').map((t) => t.trim()).filter(Boolean);
    const status = cf(f, 'status', 'availability', 'possession');
    return {
      id: p.id,
      name: p.name,
      location: cf(f, 'location', 'area', 'address') || undefined,
      priceLabel: priceStr(p.price) || cf(f, 'price'),
      config: cf(f, 'config', 'bhk', 'type', 'configuration'),
      area: cf(f, 'area', 'areaSqft', 'size', 'carpet'),
      status,
      image: p.image || undefined,
      tags: tags.length ? tags : undefined,
      description: p.description || undefined,
    };
  });
  const hasRealProjects = realProjects.length > 0;
  const projects = hasRealProjects ? realProjects : SEED_PROJECTS;

  return {
    brand: {
      name,
      tagline: site.cms?.tagline || 'Landmark addresses, built to endure.',
      about: site.cms?.about ||
        `${name} designs and delivers residences where architecture, location and craftsmanship meet. Every project is RERA-registered, delivered on schedule, and built for families who expect more than square footage.`,
      logo: site.cms?.logo || undefined,
      phone: site.cms?.phone || undefined,
      whatsapp: site.cms?.whatsapp || site.cms?.phone || undefined,
      email: site.cms?.email || undefined,
      address: site.cms?.address || undefined,
      businessHours: site.cms?.businessHours || undefined,
      rera: undefined,
    },
    hero: {
      headline: site.cms?.tagline || 'Find the Right Property.',
      subline: `${name} — a portfolio of RERA-registered apartments, villas and plots across the city's most connected corridors.`,
      highlight: hasRealProjects ? `${projects.length} live ${projects.length === 1 ? 'project' : 'projects'} · RERA registered · Free site visits` : 'RERA registered · On-time delivery · Free site visits',
      image: site.cms?.banner || IMG.hero,
    },
    stats: [
      { value: hasRealProjects ? String(projects.length) : '3', label: 'Live projects' },
      { value: '1,200+', label: 'Families settled' },
      { value: '100%', label: 'On-time delivery' },
      { value: '18 yrs', label: 'Building the city' },
    ],
    projects,
    propertyTypes: [
      { label: 'Apartments', blurb: '2, 3 & 4 BHK in gated towers with clubhouses and sky decks.' },
      { label: 'Villas', blurb: 'Independent homes with private gardens in low-density communities.' },
      { label: 'Plots', blurb: 'Clear-title, approved plots on the city\'s growth corridors.' },
      { label: 'Commercial', blurb: 'Grade-A office and retail addresses for growing businesses.' },
    ],
    location: {
      area: projects[0]?.location || 'Whitefield & the eastern corridor',
      points: [
        { label: 'ITPL / tech parks', distance: '10 min' },
        { label: 'Metro (Purple Line)', distance: '6 min' },
        { label: 'International school', distance: '4 min' },
        { label: 'Multi-speciality hospital', distance: '8 min' },
        { label: 'International airport', distance: '45 min' },
      ],
      note: 'Every project is chosen for connectivity first — because location is the one thing you can never renovate.',
    },
    amenities: [
      { label: 'Clubhouse', icon: 'Building2' }, { label: 'Infinity pool', icon: 'Waves' },
      { label: 'Gymnasium', icon: 'Dumbbell' }, { label: 'Landscaped gardens', icon: 'Trees' },
      { label: '24×7 security', icon: 'ShieldCheck' }, { label: 'Power backup', icon: 'Zap' },
      { label: 'Kids\' play area', icon: 'Baby' }, { label: 'EV charging', icon: 'PlugZap' },
      { label: 'Amphitheatre', icon: 'Drama' }, { label: 'Co-working lounge', icon: 'Laptop' },
      { label: 'Rainwater harvesting', icon: 'CloudRain' }, { label: 'Jogging track', icon: 'Footprints' },
    ],
    gallery: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.p2],
    floorPlans: [
      { config: '2 BHK', area: '1,240 sqft', priceLabel: '₹98 L onwards' },
      { config: '3 BHK', area: '1,860 sqft', priceLabel: '₹1.42 Cr onwards' },
      { config: '4 BHK', area: '2,540 sqft', priceLabel: '₹2.05 Cr onwards' },
    ],
    construction: [
      { phase: 'Land & approvals', state: 'done' },
      { phase: 'Foundation & structure', state: 'done' },
      { phase: 'Finishing & MEP', state: 'active' },
      { phase: 'Handover', state: 'upcoming' },
    ],
    hasRealProjects,
  };
}
