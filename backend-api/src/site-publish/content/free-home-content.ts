/**
 * S1.2: the home content of a Free site, built from what the vendor typed at registration. PURE: details in, plain text out. Nothing here is invented about the business: no claim, price, year,
 * rating, availability or coverage. It states only what the vendor gave (name, the category as typed, city, area, pincode) and names the kind of work in general words for the vendor's track.
 * The e-mail address is never an input. The result fills only EMPTY fields (the caller decides), is marked as sample text so the vendor's own words replace it, and is the same text on every run.
 */
export interface FreeHomeInput {
  businessName: string;
  /** the category exactly as typed at registration (it may not be in the category list) */
  categoryText: string | null;
  track: string | null;
  city?: string | null; area?: string | null; pincode?: string | null;
}

export interface FreeHomeContent { tagline: string; about: string; services: Array<{ name: string; description: string }> }

/** Generic services per track: the kind of work, in general words, with no price and no promise. */
export const TRACK_SERVICES: Readonly<Record<string, ReadonlyArray<{ name: string; description: string }>>> = {
  handyman: [
    { name: 'Repairs and maintenance', description: 'Fixing and looking after things around the home or workplace.' },
    { name: 'Installation and fitting', description: 'Putting in new fittings, fixtures and equipment.' },
    { name: 'Inspection and advice', description: 'Looking at a problem and explaining what is needed.' },
    { name: 'Site visits', description: 'Visits to the place where the work is needed.' },
  ],
  professional: [
    { name: 'Consultation', description: 'A first conversation to understand what you need.' },
    { name: 'Advice and guidance', description: 'Clear advice based on your situation.' },
    { name: 'Documents and paperwork', description: 'Help with the papers a service involves.' },
    { name: 'Follow-up', description: 'Support after the first meeting or service.' },
  ],
  ecommerce: [
    { name: 'Our products', description: 'The things this shop sells.' },
    { name: 'Everyday items', description: 'Items for regular use.' },
    { name: 'Gifts', description: 'Items that suit gifting.' },
    { name: 'Ask about availability', description: 'Ask the shop what is in stock.' },
  ],
};
const DEFAULT_TRACK = 'handyman';

const clean = (s: string | null | undefined, max: number): string => String(s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const trackOf = (t: string | null): string => (t && TRACK_SERVICES[t.toLowerCase()] ? t.toLowerCase() : DEFAULT_TRACK);

/** "Madurai", "Anna Nagar, Madurai", "Anna Nagar, Madurai 625001" from whichever parts exist; empty when none. */
export function placeLine(i: Pick<FreeHomeInput, 'city' | 'area' | 'pincode'>): string {
  const area = clean(i.area, 60); const city = clean(i.city, 60); const pin = /^\d{6}$/.test(clean(i.pincode, 10)) ? clean(i.pincode, 10) : '';
  const head = [area, city].filter(Boolean).join(', ');
  return [head, pin].filter(Boolean).join(' ');
}

export function buildFreeHomeContent(i: FreeHomeInput): FreeHomeContent {
  const name = clean(i.businessName, 120) || 'This business';
  const cat = clean(i.categoryText, 80);
  const place = placeLine(i);
  const city = clean(i.city, 60);
  const tagline = cat ? `${cat}${city ? ` in ${city}` : ''}` : `${name}${city ? `, ${city}` : ''}`;
  const kind = cat ? `a ${cat.charAt(0).toLowerCase()}${cat.slice(1)} business` : 'a local business';
  const about = `${name} is ${kind}${place ? ` based in ${place}` : ''}. This page gives the basic details of the business. The owner can add more about their work, services and contact options by completing the profile.`;
  return { tagline: tagline.slice(0, 160), about, services: TRACK_SERVICES[trackOf(i.track)].map((s) => ({ ...s })) };
}
