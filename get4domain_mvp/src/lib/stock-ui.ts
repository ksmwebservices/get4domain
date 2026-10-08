// Pure helpers for the stock screens (kept out of the components so they can be tested without a browser).

export type AdjustMode = 'add' | 'remove' | 'set';
export type StockReason = 'SHOP_SALE' | 'DAMAGE' | 'RETURN' | 'RECOUNT' | 'OPENING' | 'ADJUSTMENT' | 'ONLINE_ORDER' | 'CANCEL';

/** Which reasons make sense for each direction — must match the server's rules (backend stock-rules.ts reasonAllowsMode). */
export const REASONS_BY_MODE: Record<AdjustMode, StockReason[]> = {
  add: ['RETURN', 'OPENING', 'ADJUSTMENT'],
  remove: ['SHOP_SALE', 'DAMAGE', 'ADJUSTMENT'],
  set: ['RECOUNT', 'OPENING'],
};

export const REASON_LABEL: Record<StockReason, string> = {
  SHOP_SALE: 'Shop sale',
  DAMAGE: 'Damage or loss',
  RETURN: 'Return',
  RECOUNT: 'Recount',
  OPENING: 'Opening stock',
  ADJUSTMENT: 'Other adjustment',
  ONLINE_ORDER: 'Website order',
  CANCEL: 'Order cancelled',
};

/** Same rules as the server: whole numbers; add/remove need > 0; set may be 0; never below 0. Returns a message or null. */
export function validateAdjust(mode: AdjustMode, quantity: number, current: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 0) return 'Enter a whole number.';
  if (mode !== 'set' && quantity === 0) return 'Enter a quantity above 0.';
  if (mode === 'remove' && quantity > current) return `You only have ${current} in stock — you can't remove ${quantity}.`;
  return null;
}

export type Availability = 'in' | 'low' | 'out' | 'hidden';

export interface StockShape { active: boolean; status?: string | null; trackStock?: boolean | null; stockQty?: number | null; reorderLevel?: number | null }

/** The state the vendor sees on a product card — same buckets the shopper gets (backend availabilityOf). */
export function stockState(p: StockShape): Availability {
  const status = !p.active || p.status === 'HIDDEN' || p.status === 'inactive' || p.status === 'draft' || p.status === 'archived' ? 'HIDDEN' : p.status === 'OUT_OF_STOCK' || p.status === 'out_of_stock' ? 'OUT_OF_STOCK' : 'AVAILABLE';
  if (status === 'HIDDEN') return 'hidden';
  if (status === 'OUT_OF_STOCK') return 'out';
  if (!p.trackStock) return 'in';
  const qty = p.stockQty ?? 0;
  if (qty <= 0) return 'out';
  if (p.reorderLevel != null && qty <= p.reorderLevel) return 'low';
  return 'in';
}

export const STATE_LABEL: Record<Availability, string> = { in: 'In stock', low: 'Low stock', out: 'Out of stock', hidden: 'Hidden' };
export const STATE_CLASS: Record<Availability, string> = {
  in: 'bg-success-50 text-success-700',
  low: 'bg-amber-50 text-amber-700',
  out: 'bg-error-50 text-error-700',
  hidden: 'bg-slate-100 text-slate-500',
};

/** Client-side check before we even upload — the server enforces the same list and limit. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
export function checkImageFile(file: { type: string; size: number; name?: string }): string | null {
  if (!UPLOAD_TYPES.includes(file.type)) return 'Please choose a png, jpg, webp or gif image.';
  if (file.size > UPLOAD_MAX_BYTES) return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB. Please use a smaller one.`;
  if (file.size === 0) return 'That file is empty.';
  return null;
}

/** Move one item left (-1) or right (+1) in a list; returns a new array (unchanged at the ends). */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const out = [...list];
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

/** Make the gallery item at `index` the main image: returns the new main image and the gallery with the old main in its place. */
export function makeMain(main: string, gallery: string[], index: number): { image: string; gallery: string[] } {
  if (index < 0 || index >= gallery.length) return { image: main, gallery };
  const next = [...gallery];
  const picked = next[index];
  if (main) next[index] = main; else next.splice(index, 1);
  return { image: picked, gallery: next };
}
