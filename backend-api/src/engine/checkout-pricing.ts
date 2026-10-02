import * as crypto from 'crypto';

/**
 * Server-authoritative pricing for public-site checkout (security patch 2026-10-02).
 * The browser's per-line `price` is NEVER trusted — every line is resolved against the vendor's
 * own active products in the database and priced from there.
 */

/** A listed price is purchasable only when it is a plain amount ("1299", "₹1,299", "Rs. 499.50"). */
export function parseListedPrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/^\s*(?:₹|Rs\.?|INR)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*$/i);
  if (!m) return null; // ranges, "from ₹x", "on request" → not purchasable online
  const value = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Variant text ("Aero Sneakers — 9 / Black") is stripped to match the catalogue product name. */
export function baseProductName(clientName: string): string {
  return clientName.split(/\s+[—–]\s+/)[0].trim().toLowerCase();
}

export interface PricedLine {
  /** VendorProduct or CatalogItem id the line resolved to. */
  itemId: string;
  source: 'product' | 'catalog';
  /** Only set for CatalogItem lines (the stock-tracked table). */
  catalogItemId: string | null;
  name: string;
  qty: number;
  /** Authoritative per-unit price in paise. */
  unitPaise: number;
}

export function cartTotalPaise(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPaise * l.qty, 0);
}

/** Identity of the cart (what + how many, not prices) — stamped on the Razorpay order. */
export function cartHash(lines: PricedLine[]): string {
  const canon = lines.map((l) => `${l.source}:${l.itemId}x${l.qty}`).sort().join('|');
  return crypto.createHash('sha256').update(canon).digest('hex').slice(0, 32);
}
