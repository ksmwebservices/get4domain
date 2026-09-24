import type { Product } from './products';
import { products as fallbackProducts } from './products';

/** The real vendor/site payload — the SAME shape/endpoint every other live get4domain
 *  vendor site already reads (GET /cms/site/:subdomain). No new backend logic. */
export interface LiveSiteData {
  vendor: { id: string; businessName: string; industry: string; subdomain: string | null };
  cms: {
    businessName: string | null; tagline: string | null; about: string | null;
    logo: string | null; banner: string | null; phone: string | null; whatsapp: string | null;
    email: string | null; address: string | null;
  } | null;
  products: {
    id: string; name: string; description: string | null; price: string | null;
    image: string | null; category: string | null; customFields: Record<string, unknown> | null;
  }[];
  paymentsEnabled?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
export const STEPNROCK_SUBDOMAIN = 'stepnrock';

/** A real vendor category row (GET /cms/vendor/:vendorId/categories) — the same
 *  choke point `CmsService.findOrCreateCategory` writes through on every product
 *  add/edit, so this list always reflects exactly what the vendor's products use. */
export interface LiveCategory {
  id: string;
  name: string;
  nameNormalized: string;
}

/** Fetches a vendor's real categories. Never throws — a network hiccup returns
 *  null so callers can fall back to the static showcase category list, same
 *  graceful-degradation convention as fetchSiteData(). */
export async function fetchVendorCategories(vendorId: string): Promise<LiveCategory[] | null> {
  try {
    const res = await fetch(`${API_BASE}/cms/vendor/${vendorId}/categories`, {
      next: typeof window === 'undefined' ? { revalidate: 60 } : undefined,
      cache: typeof window === 'undefined' ? undefined : 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? json) as LiveCategory[];
  } catch {
    return null;
  }
}

/** Fetches the real Step N Rock vendor/site record. Works from both a server
 *  component (revalidated periodically) and the browser (no-store). Never throws —
 *  a network/vendor-not-yet-created hiccup returns null so callers fall back
 *  gracefully instead of breaking the page. */
export async function fetchSiteData(): Promise<LiveSiteData | null> {
  try {
    const res = await fetch(`${API_BASE}/cms/site/${STEPNROCK_SUBDOMAIN}`, {
      next: typeof window === 'undefined' ? { revalidate: 60 } : undefined,
      cache: typeof window === 'undefined' ? undefined : 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? json) as LiveSiteData;
  } catch {
    return null;
  }
}

/** Parses a real vendor price ("899") into a plain number, same convention as the
 *  uploaded design's own formatPrice (INR). */
function parsePrice(raw: string | null): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Adapts a real vendor product (flat columns: id/name/description/price/image/
 *  category, plus a free-form `customFields` JSON bag) into the uploaded design's own
 *  `Product` shape, so every existing component (ProductCard, PDP, shop filters) keeps
 *  working completely untouched.
 *
 *  Two tiers of fidelity, both safe:
 *   - Step N Rock's own seeded catalogue (24-Sep-2026) stores the FULL original
 *     showcase richness in customFields (gallery/colors/sizes/rating/reviews/
 *     features/originalPrice/isNew/isBestSeller/stockQty) — read back here so the
 *     site renders with zero visual regression versus the old hardcoded fallback.
 *   - Any OTHER real vendor product (today's Website Manager upload is genuinely
 *     single-image, no variants) falls back to the same safe single-option defaults
 *     as before: components index colors[0]/sizes[...] directly with no guard, so
 *     these must never be empty arrays. */
export function adaptLiveProduct(p: LiveSiteData['products'][number]): Product {
  const cf = p.customFields ?? {};
  const image = p.image || 'https://images.pexels.com/photos/1461048/pexels-photo-1461048.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
  const asStringArray = (v: unknown): string[] | undefined => (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined);
  const asColors = (v: unknown): { name: string; hex: string }[] | undefined =>
    Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && 'name' in x && 'hex' in x) ? (v as { name: string; hex: string }[]) : undefined;
  const gallery = asStringArray(cf.gallery);
  const stockQty = typeof cf.stockQty === 'number' ? cf.stockQty : undefined;
  return {
    id: p.id,
    slug: p.id,
    name: p.name,
    brand: typeof cf.brand === 'string' ? cf.brand : 'Step N Rock',
    category: p.category || 'Apparel',
    price: parsePrice(p.price),
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
    stock: stockQty ?? (cf.stock === 'Out of Stock' ? 0 : 10),
  };
}

/** Real catalogue when the vendor has added products; otherwise the original
 *  uploaded showcase data — so the site never looks broken/empty before Suresh adds
 *  his real products, and never breaks if the API is briefly unreachable. */
export function resolveProducts(site: LiveSiteData | null): Product[] {
  if (site && site.products.length > 0) return site.products.map(adaptLiveProduct);
  return fallbackProducts;
}
