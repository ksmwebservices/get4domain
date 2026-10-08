/**
 * Pure stock / availability rules for VendorProduct (Stepnrock handover, 2026-10-08).
 * No I/O: everything the dashboard, the public site API and the order paths agree on lives here.
 */

export type ProductStatus = 'AVAILABLE' | 'OUT_OF_STOCK' | 'HIDDEN';
export type Availability = 'in' | 'low' | 'out';

export const PRODUCT_STATUSES: readonly ProductStatus[] = ['AVAILABLE', 'OUT_OF_STOCK', 'HIDDEN'];

/** Most a shopper may add in one order line when stock is plentiful / not tracked. A purchase limit, not the stock level. */
export const MAX_ORDER_QTY = 10;

export interface StockFields {
  active: boolean;
  status: string | null | undefined;
  trackStock: boolean;
  stockQty: number | null | undefined;
  reorderLevel: number | null | undefined;
}

/** Canonical status from the stored string (legacy rows hold lower-case 'active' / 'inactive' / 'out_of_stock' …) and `active`. */
export function normaliseStatus(raw: string | null | undefined, active: boolean): ProductStatus {
  const v = (raw ?? '').trim().toUpperCase();
  if (v === 'OUT_OF_STOCK') return 'OUT_OF_STOCK';
  if (v === 'HIDDEN' || v === 'INACTIVE' || v === 'ARCHIVED' || v === 'DRAFT') return 'HIDDEN';
  if (!active) return 'HIDDEN';
  return 'AVAILABLE';
}

/** What the `active` boolean (the flag live readers filter on) must be for a status. */
export const activeFor = (status: ProductStatus): boolean => status !== 'HIDDEN';

/**
 * Availability a shopper may see. `null` = not shown at all (hidden). Tracked stock decides in/low/out;
 * an explicit OUT_OF_STOCK status wins; untracked products are always "in".
 */
export function availabilityOf(p: StockFields): Availability | null {
  const status = normaliseStatus(p.status, p.active);
  if (status === 'HIDDEN') return null;
  if (status === 'OUT_OF_STOCK') return 'out';
  if (!p.trackStock) return 'in';
  const qty = p.stockQty ?? 0;
  if (qty <= 0) return 'out';
  if (p.reorderLevel != null && p.reorderLevel > 0 && qty <= p.reorderLevel) return 'low';
  return 'in';
}

/** Per-line purchase cap shown to shoppers (never the raw stock figure beyond "low"). */
export function maxOrderQty(p: StockFields): number {
  const a = availabilityOf(p);
  if (a === null || a === 'out') return 0;
  if (!p.trackStock) return MAX_ORDER_QTY;
  const qty = p.stockQty ?? 0;
  return Math.max(0, Math.min(qty, MAX_ORDER_QTY));
}

/** Keys inside the free-form `customFields` blob that are internal and never leave the server. */
const INTERNAL_CUSTOM_KEYS = new Set([
  'stockqty', 'stock', 'reorderlevel', 'sku', 'cost', 'costprice', 'supplier', 'margin', 'internalnote', 'internalnotes', 'barcode',
]);

export function sanitiseCustomFields(cf: unknown): Record<string, unknown> | null {
  if (!cf || typeof cf !== 'object' || Array.isArray(cf)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cf as Record<string, unknown>)) {
    if (!INTERNAL_CUSTOM_KEYS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

/** Row shape needed to build the public product (an explicit select — see PUBLIC_PRODUCT_SELECT). */
export interface PublicProductRow extends StockFields {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  priceAmount: number | null;
  image: string | null;
  category: string | null;
  categoryId: string | null;
  unit: string | null;
  customFields: unknown;
  createdAt: Date;
}

/** The ONLY columns the public API may read from VendorProduct. */
export const PUBLIC_PRODUCT_SELECT = {
  id: true, name: true, description: true, price: true, priceAmount: true, image: true, category: true, categoryId: true,
  unit: true, customFields: true, createdAt: true,
  // stock inputs are selected only to derive `availability` / `maxQty`; they are NOT returned
  active: true, status: true, trackStock: true, stockQty: true, reorderLevel: true,
} as const;

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  priceAmount: number | null;
  image: string | null;
  category: string | null;
  categoryId: string | null;
  unit: string | null;
  customFields: Record<string, unknown> | null;
  availability: Availability;
  /** Purchase limit for one order line (0 when out of stock). Not the stock level. */
  maxQty: number;
  createdAt: Date;
}

/** Whitelisted public view of a product, or `null` when it must not be shown. No internal field can leak through this. */
export function toPublicProduct(row: PublicProductRow): PublicProduct | null {
  const availability = availabilityOf(row);
  if (availability === null) return null;
  return {
    id: row.id, name: row.name, description: row.description, price: row.price, priceAmount: row.priceAmount ?? null,
    image: row.image, category: row.category, categoryId: row.categoryId, unit: row.unit,
    customFields: sanitiseCustomFields(row.customFields), availability, maxQty: maxOrderQty(row), createdAt: row.createdAt,
  };
}

/** Rules for manual stock changes: which direction each reason may move the quantity. */
export type AdjustMode = 'add' | 'remove' | 'set';
export type AdjustReason = 'SHOP_SALE' | 'DAMAGE' | 'RETURN' | 'RECOUNT' | 'OPENING' | 'ADJUSTMENT';

const REASON_MODES: Record<AdjustReason, AdjustMode[]> = {
  SHOP_SALE: ['remove'],
  DAMAGE: ['remove'],
  RETURN: ['add'],
  RECOUNT: ['set'],
  OPENING: ['set', 'add'],
  ADJUSTMENT: ['add', 'remove', 'set'],
};

export function reasonAllowsMode(reason: AdjustReason, mode: AdjustMode): boolean {
  return REASON_MODES[reason]?.includes(mode) ?? false;
}

/** Quantity validation for an adjustment request. Returns an error message or null. */
export function validateAdjustQuantity(mode: AdjustMode, quantity: number): string | null {
  if (!Number.isInteger(quantity)) return 'Quantity must be a whole number';
  if (quantity < 0 || quantity > 1_000_000) return 'Quantity must be between 0 and 1,000,000';
  if ((mode === 'add' || mode === 'remove') && quantity === 0) return 'Enter a quantity above 0';
  return null;
}
