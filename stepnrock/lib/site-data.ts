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
    image: string | null; category: string | null; customFields: Record<string, string> | null;
  }[];
  paymentsEnabled?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
export const STEPNROCK_SUBDOMAIN = 'stepnrock';

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

/** Adapts a real vendor CatalogItem (flat: id/name/description/price/image/category/
 *  customFields, no variants, single image — today's Website Manager upload is
 *  single-image-per-product) into the uploaded design's own `Product` shape, so every
 *  existing component (ProductCard, PDP, shop filters) keeps working completely
 *  untouched. Missing fields get the SAME kind of safe single-option defaults used
 *  elsewhere in this codebase (never an empty colors/sizes array — components index
 *  colors[0]/sizes[...] directly with no guard). */
export function adaptLiveProduct(p: LiveSiteData['products'][number]): Product {
  const image = p.image || 'https://images.pexels.com/photos/1461048/pexels-photo-1461048.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
  const stockField = p.customFields?.stock;
  return {
    id: p.id,
    slug: p.id,
    name: p.name,
    brand: 'Step N Rock',
    category: p.category || 'apparel',
    price: parsePrice(p.price),
    image,
    gallery: [image],
    colors: [{ name: 'Default', hex: '#1a1a1a' }],
    sizes: ['Standard'],
    rating: 0,
    reviews: 0,
    description: p.description || '',
    features: [],
    isNew: p.customFields?.tags?.toLowerCase().includes('new') ?? false,
    isBestSeller: p.customFields?.tags?.toLowerCase().includes('bestseller') ?? false,
    stock: stockField === 'Out of Stock' ? 0 : 10,
  };
}

/** Real catalogue when the vendor has added products; otherwise the original
 *  uploaded showcase data — so the site never looks broken/empty before Suresh adds
 *  his real products, and never breaks if the API is briefly unreachable. */
export function resolveProducts(site: LiveSiteData | null): Product[] {
  if (site && site.products.length > 0) return site.products.map(adaptLiveProduct);
  return fallbackProducts;
}
