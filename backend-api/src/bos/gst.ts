/**
 * Vendor-side GST math (Full BOS). PURE: no I/O, integer paise, so every rule can be asserted against a hand-computed table.
 *
 * This is the VENDOR's tax on the VENDOR's customers. It is deliberately separate from `commercial/pricing-math.ts`, which is
 * Get4Domain's own GST on what a vendor pays Get4Domain.
 *
 * Rules:
 *  - The amount a user types per line (qty × rate − line discount) is EX-tax (EXCLUSIVE) or tax-INCLUSIVE (INCLUSIVE).
 *  - A document discount is shared across the lines in proportion to their amounts (largest remainder, so the shares add up exactly)
 *    BEFORE tax, because GST is charged on the discounted value.
 *  - Inside the vendor's state: CGST + SGST, each half (CGST gets the rounded-down half). Outside: IGST.
 *  - taxKind NONE = bill of supply: no tax at all.
 *  - Optional round-off to the nearest rupee on the document total, shown as its own line.
 */

export type TaxKind = 'GST' | 'NONE';
export type PriceMode = 'EXCLUSIVE' | 'INCLUSIVE';

export interface TaxContext {
  taxKind: TaxKind;
  priceMode: PriceMode;
  /** true = buyer is in the vendor's state (CGST+SGST); false = IGST. */
  intraState: boolean;
}

export interface LineInput {
  qty: number;
  ratePaise: number;
  discountPaise?: number;
  gstRate: number;
}

export interface LineTax {
  /** qty × rate − line discount, as entered. */
  enteredPaise: number;
  /** After the share of the document discount. */
  netEnteredPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

export interface DocumentTotals {
  lines: LineTax[];
  /** Sum of the entered line amounts before the document discount (as entered). */
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  shipping: LineTax | null;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
}

export const toPaise = (rupees: number): number => Math.round(rupees * 100);

/** Share `amount` across `weights` so the shares add up to exactly `amount` (largest remainder). */
export function share(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (amount === 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const floors = raw.map((r) => Math.floor(r));
  let left = amount - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < order.length && left > 0; k += 1, left -= 1) floors[order[k].i] += 1;
  return floors;
}

function taxOf(netEntered: number, rate: number, ctx: TaxContext): { taxable: number; tax: number } {
  if (ctx.taxKind === 'NONE' || rate <= 0) return { taxable: netEntered, tax: 0 };
  if (ctx.priceMode === 'INCLUSIVE') {
    const taxable = Math.round((netEntered * 100) / (100 + rate));
    return { taxable, tax: netEntered - taxable };
  }
  return { taxable: netEntered, tax: Math.round((netEntered * rate) / 100) };
}

function splitTax(tax: number, ctx: TaxContext): { cgst: number; sgst: number; igst: number } {
  if (tax === 0) return { cgst: 0, sgst: 0, igst: 0 };
  if (!ctx.intraState) return { cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst, igst: 0 };
}

export function computeLine(entered: number, netEntered: number, rate: number, ctx: TaxContext): LineTax {
  const { taxable, tax } = taxOf(netEntered, rate, ctx);
  const s = splitTax(tax, ctx);
  return { enteredPaise: entered, netEnteredPaise: netEntered, taxablePaise: taxable, cgstPaise: s.cgst, sgstPaise: s.sgst, igstPaise: s.igst, totalPaise: taxable + tax };
}

export function computeDocument(
  lines: LineInput[], ctx: TaxContext,
  opts: { discountPaise?: number; shippingPaise?: number; shippingGstRate?: number; roundOff?: boolean } = {},
): DocumentTotals {
  const entered = lines.map((l) => {
    if (!(l.qty > 0)) throw new RangeError('Quantity must be more than zero');
    if (!Number.isInteger(l.ratePaise) || l.ratePaise < 0) throw new RangeError('Rate must be a whole number of paise, zero or more');
    const gross = Math.round(l.qty * l.ratePaise);
    const disc = l.discountPaise ?? 0;
    if (!Number.isInteger(disc) || disc < 0 || disc > gross) throw new RangeError('A line discount cannot be more than the line amount');
    if (!(l.gstRate >= 0 && l.gstRate <= 100)) throw new RangeError('GST rate must be between 0 and 100');
    return gross - disc;
  });
  const subtotal = entered.reduce((a, b) => a + b, 0);
  const docDiscount = opts.discountPaise ?? 0;
  if (!Number.isInteger(docDiscount) || docDiscount < 0 || docDiscount > subtotal) throw new RangeError('The discount cannot be more than the bill amount');
  const shares = share(docDiscount, entered);
  const taxed = lines.map((l, i) => computeLine(entered[i], entered[i] - shares[i], l.gstRate, ctx));

  const shippingPaise = opts.shippingPaise ?? 0;
  if (!Number.isInteger(shippingPaise) || shippingPaise < 0) throw new RangeError('Shipping must be a whole number of paise, zero or more');
  const shipping = shippingPaise > 0 ? computeLine(shippingPaise, shippingPaise, opts.shippingGstRate ?? 0, ctx) : null;

  const all = shipping ? [...taxed, shipping] : taxed;
  const sum = (f: (t: LineTax) => number): number => all.reduce((a, t) => a + f(t), 0);
  const total = sum((t) => t.totalPaise);
  const rounded = opts.roundOff ? Math.round(total / 100) * 100 : total;
  return {
    lines: taxed, subtotalPaise: subtotal, discountPaise: docDiscount, shippingPaise, shipping,
    taxablePaise: sum((t) => t.taxablePaise), cgstPaise: sum((t) => t.cgstPaise), sgstPaise: sum((t) => t.sgstPaise), igstPaise: sum((t) => t.igstPaise),
    roundOffPaise: rounded - total, totalPaise: rounded,
  };
}

/** Normalised state name for comparing places of supply ("Tamil Nadu" == " tamil nadu "). */
export const normState = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Inside the vendor's state? Unknown buyer state counts as inside (a counter sale to a walk-in). */
export function isIntraState(vendorState: string | null | undefined, buyerState: string | null | undefined): boolean {
  const b = normState(buyerState);
  if (!b) return true;
  const v = normState(vendorState);
  if (!v) return true;
  return v === b;
}

export interface HsnRow { hsn: string; gstRate: number; qty: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }

/** HSN summary over document lines (GSTR-1 table 12 shape). */
export function hsnSummary(lines: { hsn?: string | null; gstRate: number; qty: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }[]): HsnRow[] {
  const map = new Map<string, HsnRow>();
  for (const l of lines) {
    const hsn = (l.hsn ?? '').trim() || '(none)';
    const key = `${hsn}|${l.gstRate}`;
    const r = map.get(key) ?? { hsn, gstRate: l.gstRate, qty: 0, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
    r.qty += l.qty; r.taxablePaise += l.taxablePaise; r.cgstPaise += l.cgstPaise; r.sgstPaise += l.sgstPaise; r.igstPaise += l.igstPaise;
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.gstRate - b.gstRate);
}

/** Indian financial year label for a date ("26-27" for 1 Apr 2026 – 31 Mar 2027), using the IST calendar day. */
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const startYear = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

/** [start, end) of a financial year label ("26-27") in UTC instants for the IST calendar. */
export function financialYearRange(fy: string): { from: Date; to: Date } {
  const start = 2000 + Number(fy.slice(0, 2));
  return { from: new Date(Date.UTC(start, 3, 1) - 330 * 60_000), to: new Date(Date.UTC(start + 1, 3, 1) - 330 * 60_000) };
}
