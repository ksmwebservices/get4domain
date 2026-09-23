import type { EngineSiteData } from '../../types';
import type { KitBrand } from '../../kit/model';
import { IMG } from '../../kit/content';
import { resolveCatalog, type DemoListing } from '@/data/demo-catalog';
import type { RetailProduct, RetailProductColor } from './types';

/** Parses a price string from either source into a fixed number (cart-purchasable) or
 *  null (enquiry-only — "Market rate", "On enquiry", "Price on request"). Real vendor
 *  prices are plain numbers ("1499"); demo/seed prices are pre-formatted ("₹1,499",
 *  "From ₹35,000"). Either way the ORIGINAL string is kept as the display label. */
function parsePrice(raw?: string | null): { price: number | null; label: string } {
  const t = (raw ?? '').trim();
  if (!t) return { price: null, label: 'Price on request' };
  const digits = t.replace(/[^\d.]/g, '');
  const n = digits ? parseFloat(digits) : NaN;
  const hasNumber = Number.isFinite(n) && n > 0;
  const startsWithDigit = /^\d/.test(t);
  const label = /^[₹$]/.test(t) || !startsWithDigit ? t : `₹${t}`;
  return { price: hasNumber ? n : null, label };
}

export function buildRetailBrand(site: EngineSiteData, defaults: { name: string; tagline: string; about: string }): KitBrand {
  const cms = site.cms;
  return {
    name: cms?.businessName || site.vendor.businessName || defaults.name,
    tagline: cms?.tagline || defaults.tagline,
    about: cms?.about || defaults.about,
    logo: cms?.logo || undefined,
    phone: cms?.phone || undefined,
    whatsapp: cms?.whatsapp || cms?.phone || undefined,
    email: cms?.email || undefined,
    address: cms?.address || undefined,
    businessHours: cms?.businessHours || undefined,
  };
}

// Small, plausible colour sets used ONLY to enrich the seed/demo catalogue (fashion
// sub-vertical) so the demo showcases the swatch selector — never applied to a real
// vendor's product, which has no colour data today (see listing-fields.ts: retail's
// only custom fields are category + stock availability).
const DEMO_COLOR_SETS: RetailProductColor[][] = [
  [{ name: 'Maroon', hex: '#7f1d3a' }, { name: 'Navy', hex: '#1e3a5f' }, { name: 'Mustard', hex: '#c98a1f' }],
  [{ name: 'Black', hex: '#18181b' }, { name: 'White', hex: '#f5f5f4' }, { name: 'Sky Blue', hex: '#5b9bd5' }],
  [{ name: 'Emerald', hex: '#146c43' }, { name: 'Blush Pink', hex: '#e8a0bf' }],
];
const DEMO_SIZE_SETS: Record<string, string[]> = {
  Ethnic: ['S', 'M', 'L', 'XL', 'XXL'],
  Sarees: ['Free Size'],
  Menswear: ['M', 'L', 'XL', 'XXL'],
  Western: ['XS', 'S', 'M', 'L'],
  Kidswear: ['2-4y', '4-6y', '6-8y', '8-10y'],
};

/** Reads the "Category"/"Sizes"/"Warranty" style fields the demo catalogue attaches
 *  to each item (see demo-catalog.ts DemoListing.fields) into a lookup by label. */
function fieldsToMap(item: DemoListing): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of item.fields ?? []) out[f.label] = f.value;
  return out;
}

function demoProductsFor(subId: string | undefined, seedName: string): RetailProduct[] {
  const catalog = resolveCatalog('retail', subId);
  const items = catalog?.items ?? [];
  const isFashion = subId === 'fashion';
  return items.map((item, i) => {
    const { price, label } = parsePrice(item.price);
    const fields = fieldsToMap(item);
    const category = fields.Category;
    // Cycle the curated retail photo pool for grid variety; the sub's own cover image
    // (already wired as the hero banner) leads as the primary shot for every item —
    // honest, since these are stock photos, not per-product vendor uploads (Step 3).
    const gallery = [item.image ?? catalog?.coverImage ?? IMG.retail[i % IMG.retail.length], IMG.retail[(i + 1) % IMG.retail.length]];
    return {
      id: `demo-${subId ?? 'retail'}-${i}`,
      isRealProduct: false,
      name: item.name,
      category,
      description: item.desc,
      price,
      priceLabel: label,
      image: gallery[0],
      gallery,
      colors: isFashion ? DEMO_COLOR_SETS[i % DEMO_COLOR_SETS.length] : undefined,
      sizes: isFashion ? (category && DEMO_SIZE_SETS[category] ? DEMO_SIZE_SETS[category] : ['S', 'M', 'L', 'XL']) : undefined,
      badge: item.tags?.[0],
      inStock: fields.Availability !== 'Out of Stock',
    };
  });
  // seedName kept for future use if a sub ever needs a bespoke fallback business name.
  void seedName;
}

/** Real vendor products (Website Manager → My Products) → RetailProduct. Single image,
 *  no variants — exactly what today's upload flow provides (Step 3: reuse, don't
 *  parallel-build). `id` is passed through as `catalogItemId` at checkout so stock
 *  decrements against the real CatalogItem row. */
function realProductsFor(site: EngineSiteData): RetailProduct[] {
  return site.products.map((p) => {
    const { price, label } = parsePrice(p.price);
    const stock = p.customFields?.stock;
    const image = p.image || IMG.retail[0];
    return {
      id: p.id,
      isRealProduct: true,
      name: p.name,
      category: p.category || undefined,
      description: p.description || undefined,
      price,
      priceLabel: label,
      image,
      gallery: [image],
      badge: stock === 'Made to Order' ? 'Made to order' : undefined,
      inStock: stock !== 'Out of Stock',
    };
  });
}

/** The catalogue this render should show: real vendor products win when the vendor has
 *  added any (live sites with a populated catalogue); otherwise the curated demo/seed
 *  catalogue for the active sub-vertical (or the general retail set with no subId). */
export function buildRetailCatalog(site: EngineSiteData, subId: string | undefined, seedName: string): RetailProduct[] {
  if (site.products.length > 0) return realProductsFor(site);
  return demoProductsFor(subId, seedName);
}
