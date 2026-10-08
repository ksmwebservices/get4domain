import type { Product } from './products';

/** The real vendor/site payload — the SAME shape/endpoint every other live get4domain
 *  vendor site already reads (GET /cms/site/:subdomain). The API sends a WHITELISTED
 *  product (see backend `toPublicProduct`): availability + a purchase cap, never raw stock. */
export interface LiveSiteData {
  vendor: { id: string; businessName: string; industry: string; subdomain: string | null };
  cms: {
    businessName: string | null; tagline: string | null; about: string | null;
    logo: string | null; banner: string | null; phone: string | null; whatsapp: string | null;
    email: string | null; address: string | null;
  } | null;
  products: LiveProduct[];
  paymentsEnabled?: boolean;
  /** ONLINE = vendor's own Razorpay; ORDER_REQUEST = shop confirms and collects payment itself; NONE = no checkout. */
  checkoutMode?: 'ONLINE' | 'ORDER_REQUEST' | 'NONE';
}

export interface LiveProduct {
  id: string; name: string; description: string | null; price: string | null;
  priceAmount?: number | null;
  image: string | null; category: string | null; categoryId?: string | null;
  customFields: Record<string, unknown> | null;
  availability?: 'in' | 'low' | 'out';
  maxQty?: number;
  createdAt?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
export const STEPNROCK_SUBDOMAIN = 'stepnrock';
export const API_ORIGIN = API_BASE;

/** How stale a server-rendered page may be. A change made in the dashboard is on the live site within this many
 *  seconds (the dispatch asks for ≤ 60; 30 leaves headroom for the regeneration itself). Browser fetches are never cached. */
export const LIVE_REFRESH_SECONDS = 30;

/** A real vendor category row (GET /cms/vendor/:vendorId/categories, already sorted by the vendor's chosen order, hidden ones removed). */
export interface LiveCategory {
  id: string;
  name: string;
  nameNormalized: string;
}

function cacheOptions(): { next?: { revalidate: number }; cache?: 'no-store' } {
  return typeof window === 'undefined' ? { next: { revalidate: LIVE_REFRESH_SECONDS } } : { cache: 'no-store' };
}

/** Fetches a vendor's real categories. Never throws — a network hiccup returns null so callers can degrade gracefully. */
export async function fetchVendorCategories(vendorId: string): Promise<LiveCategory[] | null> {
  try {
    const res = await fetch(`${API_BASE}/cms/vendor/${vendorId}/categories`, cacheOptions());
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? json) as LiveCategory[];
  } catch {
    return null;
  }
}

/** Fetches the real Step N Rock vendor/site record. Works from both a server component (revalidated every
 *  LIVE_REFRESH_SECONDS) and the browser (no-store). Never throws — null means "could not reach the shop's data". */
// In the browser, several components (header, footer, page) ask at once: share the request that is already in flight (never a stale answer).
let inFlight: Promise<LiveSiteData | null> | null = null;

export function fetchSiteData(): Promise<LiveSiteData | null> {
  if (typeof window === 'undefined') return fetchSiteDataOnce();
  if (!inFlight) inFlight = fetchSiteDataOnce().finally(() => { inFlight = null; });
  return inFlight;
}

async function fetchSiteDataOnce(): Promise<LiveSiteData | null> {
  try {
    const res = await fetch(`${API_BASE}/cms/site/${STEPNROCK_SUBDOMAIN}`, cacheOptions());
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? json) as LiveSiteData;
  } catch {
    return null;
  }
}

/** Parses a real vendor price ("899", "₹1,299") into a plain number (INR). */
export function parsePrice(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Names the dashboard lets a vendor type for a colour → a swatch. Unknown names get a neutral grey (still selectable by name). */
const COLOUR_HEX: Record<string, string> = {
  black: '#1a1a1a', white: '#f5f5f5', red: '#dc2626', blue: '#2563eb', navy: '#1e3a8a', green: '#16a34a', olive: '#6b7a2f',
  yellow: '#eab308', orange: '#ea580c', pink: '#ec4899', purple: '#7c3aed', brown: '#78350f', tan: '#c8a27a', beige: '#d6c3a3',
  grey: '#6b7280', gray: '#6b7280', silver: '#c0c0c8', gold: '#d4af37', maroon: '#7f1d1d', cream: '#f3ead7', multi: '#9ca3af',
};
const NEUTRAL_HEX = '#9ca3af';

/** Colours come in two shapes: the seeded showcase `{name, hex}` objects and the plain strings the dashboard writes. */
export function asColors(v: unknown): { name: string; hex: string }[] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  const out: { name: string; hex: string }[] = [];
  for (const x of v) {
    if (typeof x === 'string' && x.trim()) out.push({ name: x.trim(), hex: COLOUR_HEX[x.trim().toLowerCase()] ?? NEUTRAL_HEX });
    else if (x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string') {
      const o = x as { name: string; hex?: unknown };
      out.push({ name: o.name, hex: typeof o.hex === 'string' ? o.hex : COLOUR_HEX[o.name.toLowerCase()] ?? NEUTRAL_HEX });
    }
  }
  return out.length ? out : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return out.length ? out : undefined;
}

/** Adapts a real vendor product into the uploaded design's `Product` shape, so every existing component keeps working.
 *  Components index colors[0]/sizes[...] directly with no guard, so these must never be empty arrays. */
export function adaptLiveProduct(p: LiveProduct): Product {
  const cf = p.customFields ?? {};
  const image = p.image || 'https://images.pexels.com/photos/1461048/pexels-photo-1461048.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
  const gallery = asStringArray(cf.gallery);
  const availability = p.availability ?? 'in';
  return {
    id: p.id,
    slug: p.id,
    name: p.name,
    brand: typeof cf.brand === 'string' ? cf.brand : 'Step N Rock',
    category: p.category || 'Apparel',
    price: typeof p.priceAmount === 'number' && p.priceAmount > 0 ? p.priceAmount : parsePrice(p.price),
    originalPrice: typeof cf.originalPrice === 'number' ? cf.originalPrice : undefined,
    image,
    gallery: gallery && gallery.length ? gallery : [image],
    colors: asColors(cf.colors) ?? [{ name: 'Default', hex: '#1a1a1a' }],
    sizes: asStringArray(cf.sizes) ?? ['Standard'],
    rating: typeof cf.rating === 'number' ? cf.rating : 0,
    reviews: typeof cf.reviews === 'number' ? cf.reviews : 0,
    description: p.description || '',
    features: asStringArray(cf.features) ?? [],
    isNew: cf.isNew === true,
    isBestSeller: cf.isBestSeller === true,
    availability,
    maxQty: availability === 'out' ? 0 : Math.max(1, Math.min(10, typeof p.maxQty === 'number' ? p.maxQty : 10)),
  };
}

/** What the shop actually sells: exactly what the API returned — even when that is nothing (a shop that deleted everything
 *  must not resurrect made-up showcase products). When the data could not be reached (null) the list is empty and callers
 *  show a "couldn't load, try again" state; the old dollar-priced showcase is never shown as if it were orderable. */
export function resolveProducts(site: LiveSiteData | null): Product[] {
  return site ? site.products.map(adaptLiveProduct) : [];
}
