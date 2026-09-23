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
  // Footwear — UK shoe sizes, not clothing sizes.
  Sneakers: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
  Running: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
  Formal: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'],
  Sandals: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
  "Women's": ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8'],
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
  // Fashion + footwear are the two sub-verticals with real size/colour options in the
  // reference's own product data — enrich only these so the demo shows the full
  // selector UX where it's genuinely applicable (a bag of rice has no "size").
  const hasVariants = subId === 'fashion' || subId === 'footwear';
  // Footwear has exactly ONE verified on-topic stock photo (the sub's own cover —
  // an actual pair of boots); cycling the generic retail pool for it would show MORE
  // mismatched (clothing/electronics) photos, not fewer, so it stays cover-first. Every
  // other sub cycles the pool first for grid variety, with the cover as a 2nd shot.
  const preferCover = subId === 'footwear';
  return items.map((item, i) => {
    const { price, label } = parsePrice(item.price);
    const fields = fieldsToMap(item);
    const category = fields.Category;
    const gallery = preferCover
      ? [item.image ?? catalog?.coverImage ?? IMG.retail[i % IMG.retail.length], IMG.retail[(i + 1) % IMG.retail.length]]
      : [item.image ?? IMG.retail[i % IMG.retail.length], catalog?.coverImage ?? IMG.retail[(i + 1) % IMG.retail.length]];
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
      colors: hasVariants ? DEMO_COLOR_SETS[i % DEMO_COLOR_SETS.length] : undefined,
      sizes: hasVariants ? (category && DEMO_SIZE_SETS[category] ? DEMO_SIZE_SETS[category] : ['S', 'M', 'L', 'XL']) : undefined,
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
