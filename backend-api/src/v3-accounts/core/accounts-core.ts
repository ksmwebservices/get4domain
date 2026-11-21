/**
 * Pure rules of the accounts module (slice 5.23b): how a vendor document becomes a sale record, what an expense or an item must look like, and the GST summary of a period. No clock, no database,
 * no randomness. Money is integer paise. No tax rate lives here: an item's rate must be one of the rates the caller read from the rate table. How the summary maps to a GST return, and the
 * wording of invoices, are OPEN QUESTIONS for the accountant; the summary is a working figure, not a return.
 */
export const EXPENSE_CATEGORIES = ['PURCHASES', 'RENT', 'SALARIES', 'UTILITIES', 'TRAVEL', 'MARKETING', 'OTHER'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const ITEM_KINDS = ['ITEM', 'SERVICE'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

// ── vendor document to sale record ──
export interface DocumentInput {
  id: string; kind: 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'BILL' | 'FEE_RECEIPT'; number: string; totalPaise: number; createdAt: Date; customerName: unknown;
  tax: { taxablePaise: number; taxPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; supply: 'INTRA' | 'INTER' };
}
export interface SaleFields {
  sourceType: 'VENDOR_DOCUMENT'; sourceId: string; number: string; kind: DocumentInput['kind']; soldAt: Date; customerName: string | null;
  taxablePaise: number; taxPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number;
}
/** The money is copied, never recomputed. A document whose parts do not add up is refused (the caller leaves it for a person to look at). */
export function saleFromDocument(d: DocumentInput): SaleFields {
  const t = d.tax;
  if (![d.totalPaise, t.taxablePaise, t.taxPaise, t.cgstPaise, t.sgstPaise, t.igstPaise].every(isMoney)) throw new Error('document money is not whole paise');
  if (t.taxablePaise + t.taxPaise !== d.totalPaise || t.cgstPaise + t.sgstPaise + t.igstPaise !== t.taxPaise) throw new Error('document parts do not add up');
  const name = typeof d.customerName === 'string' && d.customerName.trim() ? d.customerName.trim().slice(0, 120) : null;
  return { sourceType: 'VENDOR_DOCUMENT', sourceId: d.id, number: d.number, kind: d.kind, soldAt: d.createdAt, customerName: name, taxablePaise: t.taxablePaise, taxPaise: t.taxPaise, cgstPaise: t.cgstPaise, sgstPaise: t.sgstPaise, igstPaise: t.igstPaise, totalPaise: d.totalPaise };
}

// ── expenses ──
export interface ExpenseFields { spentOn: string; category: ExpenseCategory; description: string; amountPaise: number; gstPaise: number }
export type Checked<T> = { ok: true; value: T } | { ok: false; problems: string[] };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const daysIn = (y: number, m: number): number => (m === 2 ? (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31);
const validDay = (s: unknown): s is string => {
  if (typeof s !== 'string' || !DAY.test(s)) return false;
  const y = Number(s.slice(0, 4)); const m = Number(s.slice(5, 7)); const d = Number(s.slice(8, 10));
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);
};

/** `amountPaise` is what was paid in all; `gstPaise` is the GST that was part of it (0 when none). */
export function checkExpense(i: { date?: unknown; category?: unknown; description?: unknown; amountPaise?: unknown; gstPaise?: unknown }): Checked<ExpenseFields> {
  const problems: string[] = [];
  if (!validDay(i.date)) problems.push('date: YYYY-MM-DD');
  if (!(EXPENSE_CATEGORIES as readonly unknown[]).includes(i.category)) problems.push('category: not a known category');
  const description = typeof i.description === 'string' ? i.description.trim().replace(/\s+/g, ' ') : '';
  if (description.length < 1 || description.length > 200) problems.push('description: 1 to 200 characters');
  if (!isMoney(i.amountPaise) || i.amountPaise < 1) problems.push('amountPaise: a whole number of paise above zero');
  const gst = i.gstPaise === undefined || i.gstPaise === null ? 0 : i.gstPaise;
  if (!isMoney(gst)) problems.push('gstPaise: a whole number of paise, zero or more');
  else if (isMoney(i.amountPaise) && gst > i.amountPaise) problems.push('gstPaise: cannot be more than the amount');
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { spentOn: i.date as string, category: i.category as ExpenseCategory, description, amountPaise: i.amountPaise as number, gstPaise: gst as number } };
}

// ── items and services ──
export interface ItemFields { kind: ItemKind; name: string; hsnSac: string | null; unit: string | null; pricePaise: number | null; taxRatePercent: number | null }
/** The rate must be one of `allowedRates` (read from the rate table by the caller); with an empty table no rate can be set, and a missing rate simply means "not set yet". */
export function checkItem(i: { kind?: unknown; name?: unknown; hsnSac?: unknown; unit?: unknown; pricePaise?: unknown; taxRatePercent?: unknown }, allowedRates: readonly number[]): Checked<ItemFields> {
  const problems: string[] = [];
  if (!(ITEM_KINDS as readonly unknown[]).includes(i.kind)) problems.push('kind: ITEM or SERVICE');
  const name = typeof i.name === 'string' ? i.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > 120) problems.push('name: 1 to 120 characters');
  const has = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== '';
  let hsnSac: string | null = null;
  if (has(i.hsnSac)) { const h = String(i.hsnSac).trim(); if (/^\d{4}(\d{2}(\d{2})?)?$/.test(h)) hsnSac = h; else problems.push('hsnSac: 4, 6 or 8 digits'); }
  let unit: string | null = null;
  if (has(i.unit)) { const u = String(i.unit).trim(); if (u.length <= 12) unit = u; else problems.push('unit: at most 12 characters'); }
  let pricePaise: number | null = null;
  if (has(i.pricePaise)) { if (isMoney(i.pricePaise)) pricePaise = i.pricePaise; else problems.push('pricePaise: a whole number of paise, zero or more'); }
  let taxRatePercent: number | null = null;
  if (has(i.taxRatePercent)) { if (typeof i.taxRatePercent === 'number' && allowedRates.includes(i.taxRatePercent)) taxRatePercent = i.taxRatePercent; else problems.push('taxRatePercent: not a rate in the rate table'); }
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { kind: i.kind as ItemKind, name, hsnSac, unit, pricePaise, taxRatePercent } };
}

// ── date range ──
const IST_MS = 330 * 60_000;
export type RangeResult = { ok: true; fromMs: number; toMs: number } | { ok: false };
/** Whole India days as epoch milliseconds: from the start of `from` to the end of `to`, end exclusive. At most 366 days. */
export function parseRange(from: unknown, to: unknown): RangeResult {
  if (!validDay(from) || !validDay(to)) return { ok: false };
  const a = Date.parse(`${from}T00:00:00Z`) - IST_MS; const b = Date.parse(`${to}T00:00:00Z`) + 86_400_000 - IST_MS;
  if (b <= a || b - a > 366 * 86_400_000) return { ok: false };
  return { ok: true, fromMs: a, toMs: b };
}

// ── GST summary ──
export interface TaxProfileInput { gstRegistered: boolean; compositionScheme: boolean; gstin: string | null; stateCode: string | null }
export interface GstSummary {
  registered: boolean; composition: boolean; gstin: string | null; stateCode: string | null; note: 'NOT_REGISTERED' | null; invoiceCount: number;
  salesTotalPaise: number; taxablePaise: number; notTaxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; outputTaxPaise: number; inputTaxPaise: number; netTaxPaise: number; expenseTotalPaise: number;
}
/**
 * A working summary of a period from the sale records and the expenses, using the vendor's own tax profile. Not registered: no tax is reported. Composition: no input tax credit is claimed.
 * Net tax can be negative (credit); it is a figure to show the accountant, not a return.
 */
export function gstSummary(sales: ReadonlyArray<Pick<SaleFields, 'kind' | 'taxablePaise' | 'taxPaise' | 'cgstPaise' | 'sgstPaise' | 'igstPaise' | 'totalPaise'>>, expenses: ReadonlyArray<{ amountPaise: number; gstPaise: number }>, p: TaxProfileInput): GstSummary {
  const sum = (f: (s: (typeof sales)[number]) => number): number => sales.reduce((a, s) => a + f(s), 0);
  const registered = p.gstRegistered;
  const taxed = sales.filter((s) => s.kind === 'TAX_INVOICE');
  const tsum = (f: (s: (typeof sales)[number]) => number): number => taxed.reduce((a, s) => a + f(s), 0);
  const output = registered ? tsum((s) => s.taxPaise) : 0;
  const input = registered && !p.compositionScheme ? expenses.reduce((a, e) => a + e.gstPaise, 0) : 0;
  return {
    registered, composition: registered && p.compositionScheme, gstin: p.gstin, stateCode: p.stateCode, note: registered ? null : 'NOT_REGISTERED', invoiceCount: sales.length,
    salesTotalPaise: sum((s) => s.totalPaise), taxablePaise: sum((s) => s.taxablePaise), notTaxablePaise: sales.filter((s) => s.kind !== 'TAX_INVOICE').reduce((a, s) => a + s.totalPaise, 0),
    cgstPaise: registered ? tsum((s) => s.cgstPaise) : 0, sgstPaise: registered ? tsum((s) => s.sgstPaise) : 0, igstPaise: registered ? tsum((s) => s.igstPaise) : 0,
    outputTaxPaise: output, inputTaxPaise: input, netTaxPaise: output - input, expenseTotalPaise: expenses.reduce((a, e) => a + e.amountPaise, 0),
  };
}
