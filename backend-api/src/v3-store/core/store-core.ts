/**
 * Pure rules of the store (slice 5.24c, Ecommerce): the checkout decision, product and variant input, stock movements, recorded returns, and the plan and comparison of a stock import.
 * No clock, no database, no randomness. Money is integer paise; a tax rate must be one the caller read from the rate table (none is invented here).
 */
export type Checked<T> = { ok: true; value: T } | { ok: false; problems: string[] };
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

// ── checkout decision ──
export type CheckoutMode = 'ONLINE_UPI' | 'ORDER_REQUEST';
/** Payments are UPI only: an ACTIVE UPI method of the business gives online checkout; anything else (including nothing at all) gives an order request the business settles itself. */
export function checkoutMode(methods: ReadonlyArray<{ kind: string; status: string }>): CheckoutMode {
  return methods.some((m) => m.kind === 'UPI' && m.status === 'ACTIVE') ? 'ONLINE_UPI' : 'ORDER_REQUEST';
}

// ── products and variants ──
const SKU = /^[A-Za-z0-9._-]{1,40}$/;
export interface ProductFields { name: string; description: string | null; sku: string | null; hsnSac: string | null; pricePaise: number; taxRatePercent: number | null; trackStock: boolean }
export interface VariantFields { label: string; sku: string | null; pricePaise: number | null }
const has = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== '';

export function checkProduct(i: { name?: unknown; description?: unknown; sku?: unknown; hsnSac?: unknown; pricePaise?: unknown; taxRatePercent?: unknown; trackStock?: unknown }, allowedRates: readonly number[]): Checked<ProductFields> {
  const problems: string[] = [];
  const name = text(i.name, 120); if (!name) problems.push('name: 1 to 120 characters');
  if (!isInt(i.pricePaise) || i.pricePaise < 1 || i.pricePaise > 1_000_000_000) problems.push('pricePaise: a whole number of paise above zero');
  let sku: string | null = null; if (has(i.sku)) { const s = String(i.sku).trim(); if (SKU.test(s)) sku = s; else problems.push('sku: up to 40 letters, digits, dot, dash or underscore'); }
  let hsnSac: string | null = null; if (has(i.hsnSac)) { const h = String(i.hsnSac).trim(); if (/^\d{4}(\d{2}(\d{2})?)?$/.test(h)) hsnSac = h; else problems.push('hsnSac: 4, 6 or 8 digits'); }
  let taxRatePercent: number | null = null; if (has(i.taxRatePercent)) { if (typeof i.taxRatePercent === 'number' && allowedRates.includes(i.taxRatePercent)) taxRatePercent = i.taxRatePercent; else problems.push('taxRatePercent: not a rate in the rate table'); }
  if (i.trackStock !== undefined && typeof i.trackStock !== 'boolean') problems.push('trackStock: true or false');
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { name, description: text(i.description, 2000) || null, sku, hsnSac, pricePaise: i.pricePaise as number, taxRatePercent, trackStock: i.trackStock !== false } };
}
export function checkVariant(i: { label?: unknown; sku?: unknown; pricePaise?: unknown }): Checked<VariantFields> {
  const problems: string[] = [];
  const label = text(i.label, 80); if (!label) problems.push('label: 1 to 80 characters');
  let sku: string | null = null; if (has(i.sku)) { const s = String(i.sku).trim(); if (SKU.test(s)) sku = s; else problems.push('sku: up to 40 letters, digits, dot, dash or underscore'); }
  let pricePaise: number | null = null; if (has(i.pricePaise)) { if (isInt(i.pricePaise) && i.pricePaise >= 1 && i.pricePaise <= 1_000_000_000) pricePaise = i.pricePaise; else problems.push('pricePaise: a whole number of paise above zero'); }
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { label, sku, pricePaise } };
}

// ── stock movements ──
/** SALE is not on this list: a sale takes stock through the order path (Stage 9), never by hand. */
export const MOVEMENT_REASONS = ['OPENING', 'RECEIPT', 'ADJUSTMENT', 'COUNT', 'RETURN', 'IMPORT'] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];
export function checkMovement(i: { delta?: unknown; reason?: unknown; note?: unknown }): Checked<{ delta: number; reason: MovementReason; note: string | null }> {
  const problems: string[] = [];
  if (!isInt(i.delta) || i.delta === 0 || Math.abs(i.delta) > 1_000_000) problems.push('delta: a whole number other than zero, at most one million either way');
  if (!(MOVEMENT_REASONS as readonly unknown[]).includes(i.reason)) problems.push('reason: not a known reason');
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { delta: i.delta as number, reason: i.reason as MovementReason, note: text(i.note, 300) || null } };
}

// ── returns ──
export function checkReturn(i: { reason?: unknown; amountPaise?: unknown; note?: unknown }): Checked<{ reason: string; amountPaise: number; note: string | null }> {
  const problems: string[] = [];
  const reason = text(i.reason, 300); if (!reason) problems.push('reason: 1 to 300 characters');
  const amount = i.amountPaise === undefined || i.amountPaise === null ? 0 : i.amountPaise;
  if (!isInt(amount) || amount < 0 || amount > 1_000_000_000) problems.push('amountPaise: a whole number of paise, zero or more');
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { reason, amountPaise: amount as number, note: text(i.note, 300) || null } };
}

// ── stock import (Step N Rock readiness) ──
export interface ImportRow { index: number; key: string; sourceId: string; sku: string; kind: 'OPENING' | 'MOVEMENT'; qty: number; note: string | null }
export interface ImportTotals { rows: number; quantity: number; skus: number }
export interface ImportPlan { accepted: ImportRow[]; rejected: Array<{ index: number; reason: string }>; sourceTotals: ImportTotals }
/**
 * Reads rows of legacy stock (opening balances and movements). Each row is keyed by its source id (`import:<id>`), so running it again changes nothing. A bad row is rejected with a reason and the rest
 * are planned. `sourceTotals` is what was read, to compare with the database afterwards.
 */
export function planStockImport(raw: unknown): ImportPlan {
  const accepted: ImportRow[] = []; const rejected: ImportPlan['rejected'] = []; const seen = new Set<string>();
  (Array.isArray(raw) ? raw : []).forEach((r: Record<string, unknown>, index) => {
    const sourceId = typeof r?.sourceId === 'string' ? r.sourceId.trim() : ''; const sku = typeof r?.sku === 'string' ? r.sku.trim() : '';
    const reject = (reason: string): void => { rejected.push({ index, reason }); };
    if (!sourceId || sourceId.length > 80) return reject('NO_SOURCE_ID');
    if (seen.has(sourceId)) return reject('DUPLICATE_SOURCE_ID');
    if (!sku || sku.length > 40) return reject('NO_SKU');
    if (r.kind !== 'OPENING' && r.kind !== 'MOVEMENT') return reject('UNKNOWN_KIND');
    if (!isInt(r.qty) || Math.abs(r.qty) > 1_000_000_000) return reject('QTY_NOT_WHOLE');
    if (r.kind === 'OPENING' && r.qty < 0) return reject('OPENING_NEGATIVE');
    seen.add(sourceId); accepted.push({ index, key: `import:${sourceId}`, sourceId, sku, kind: r.kind, qty: r.qty, note: text(r.note, 300) || null });
  });
  return { accepted, rejected, sourceTotals: { rows: accepted.length, quantity: accepted.reduce((a, r) => a + r.qty, 0), skus: new Set(accepted.map((r) => r.sku)).size } };
}
export function compareImport(source: ImportTotals, db: ImportTotals): { rowsMatch: boolean; quantityMatch: boolean; skusMatch: boolean; ok: boolean } {
  const rowsMatch = source.rows === db.rows; const quantityMatch = source.quantity === db.quantity; const skusMatch = source.skus === db.skus;
  return { rowsMatch, quantityMatch, skusMatch, ok: rowsMatch && quantityMatch && skusMatch };
}
