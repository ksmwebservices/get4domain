/**
 * Retail industry — product + cart types.
 *
 * A `RetailProduct` normalizes TWO very different sources into one shape:
 *  - a real vendor's catalogue (`EngineSiteData.products`) — flat: id/name/description/
 *    price/image/category, no variants, no gallery (today's Website Manager upload is
 *    single-image-per-product — see data.ts for the mapping);
 *  - the curated demo/seed catalogue (`demo-catalog.ts`) — richer copy (tags, fields)
 *    that we lightly enrich with sizes/colours for the fashion sub-vertical so the demo
 *    shows the full shopping experience (grid → PDP with variants → cart).
 * Every UI piece below renders from this ONE shape and simply omits what's absent
 * (no colours → no swatches, no gallery → single image) rather than assuming either
 * source's full richness.
 */
export interface RetailProductColor {
  name: string;
  hex: string;
}

export interface RetailProduct {
  /** Stable id. For real vendor products this IS the CatalogItem id — passed through to
   *  checkout as `catalogItemId` so stock decrements against the real record. Demo/seed
   *  products get a synthetic id and are never sent as `catalogItemId`. */
  id: string;
  isRealProduct: boolean;
  name: string;
  category?: string;
  description?: string;
  /** Parsed numeric price, or null when the price isn't a fixed number (e.g. "On
   *  enquiry", "Market rate + making") — those products show an Enquire CTA instead of
   *  Add to cart, matching how real retail (jewellery, bespoke) actually prices. */
  price: number | null;
  priceLabel: string;
  originalPrice?: number;
  image: string;
  gallery: string[];
  colors?: RetailProductColor[];
  sizes?: string[];
  rating?: number;
  reviews?: number;
  badge?: string;
  inStock: boolean;
}

/** A cart line. Composite identity (`lineId`) matches the reference design: the same
 *  product in a different size/colour is a separate line. */
export interface RetailCartLine {
  lineId: string;
  productId: string;
  catalogItemId?: string;
  name: string;
  price: number;
  image: string;
  size?: string;
  color?: string;
  qty: number;
}
