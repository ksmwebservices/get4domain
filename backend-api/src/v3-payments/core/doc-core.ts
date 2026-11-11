/**
 * Slice 5.17d: the pure rules for the vendor's receipts and invoices. No clock, randomness or I/O. Money is integer paise; every split is exact (the parts always add up to the whole).
 * Wording and the treatment of advance receipts are OPEN QUESTIONS for the accountant (docs/v3/V3_PAYMENTS_AND_RECEIPTS.md); nothing here invents a tax rate: a rate always comes in with the line.
 */

export type DocKind = 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'BILL' | 'FEE_RECEIPT';

/** GST state codes (reference data, not a rate). */
const STATE_CODES: ReadonlySet<string> = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '97',
]);
export const isStateCode = (v: unknown): v is string => typeof v === 'string' && STATE_CODES.has(v);

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** The 15th character of a GSTIN, from the first 14 (the published mod 36 check). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) { const v = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2); sum += Math.floor(v / 36) + (v % 36); }
  return CHARS[(36 - (sum % 36)) % 36];
}
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function validateGstin(v: unknown): { ok: true; gstin: string; stateCode: string } | { ok: false } {
  if (typeof v !== 'string') return { ok: false };
  const g = v.trim().toUpperCase();
  if (!GSTIN_RE.test(g) || !isStateCode(g.slice(0, 2)) || gstinCheckChar(g.slice(0, 14)) !== g[14]) return { ok: false };
  return { ok: true, gstin: g, stateCode: g.slice(0, 2) };
}
export const stateCodeOfGstin = (v: unknown): string | null => { const r = validateGstin(v); return r.ok ? r.stateCode : null; };

/**
 * The type of document. GST registered and not composition gives a tax invoice (this holds for the Professional tier too: the law needs it); composition gives a bill of supply; not
 * registered gives a bill, or a fee receipt on the Professional tier. A vendor that says composition without being registered is treated as not registered.
 */
export function decideDocumentKind(i: { gstRegistered: boolean; composition: boolean; tier: 'PROFESSIONAL' | 'OTHER' }): DocKind {
  if (i.gstRegistered) return i.composition ? 'BILL_OF_SUPPLY' : 'TAX_INVOICE';
  return i.tier === 'PROFESSIONAL' ? 'FEE_RECEIPT' : 'BILL';
}

/** Same state: CGST plus SGST. Different state: IGST. Either state unknown: assumed same state and FLAGGED so the vendor can see it. */
export function chooseSupply(vendorState: string | null, customerState: string | null): { type: 'INTRA' | 'INTER'; assumed: boolean } {
  if (!vendorState || !customerState) return { type: 'INTRA', assumed: true };
  return { type: vendorState === customerState ? 'INTRA' : 'INTER', assumed: false };
}

export interface DocLineIn { name: string; qty: number; taxablePaise: number; taxPercent: number; taxPaise: number }
export interface DocLine { name: string; qty: number; taxablePaise: number; taxPercent: number; taxPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; amountPaise: number }
export interface DocBuilt { lines: DocLine[]; taxablePaise: number; taxPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number }

/** CGST gets the lower half and SGST the rest, so an odd paise goes to SGST. (OPEN QUESTION for the accountant.) */
const split = (tax: number, supply: { type: 'INTRA' | 'INTER' }): { cgst: number; sgst: number; igst: number } => {
  if (supply.type === 'INTER') return { cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.floor(tax / 2); return { cgst, sgst: tax - cgst, igst: 0 };
};

/**
 * Builds the lines and totals. A tax invoice shows taxable value and the tax split per line. Every other kind shows each line at what was charged (taxable plus tax) with NO tax lines.
 * The total must equal what was paid; otherwise null and the caller keeps the payment and raises a flag.
 */
export function buildDocument(i: { kind: DocKind; lines: readonly DocLineIn[]; supply: { type: 'INTRA' | 'INTER'; assumed: boolean }; paidPaise: number }): DocBuilt | null {
  if (!i.lines.length) return null;
  const lines: DocLine[] = [];
  for (const l of i.lines) {
    if (![l.qty, l.taxablePaise, l.taxPaise].every((n) => Number.isSafeInteger(n) && n >= 0) || l.qty < 1) return null;
    if (i.kind === 'TAX_INVOICE') {
      const s = split(l.taxPaise, i.supply);
      lines.push({ name: l.name, qty: l.qty, taxablePaise: l.taxablePaise, taxPercent: l.taxPercent, taxPaise: l.taxPaise, cgstPaise: s.cgst, sgstPaise: s.sgst, igstPaise: s.igst, amountPaise: l.taxablePaise + l.taxPaise });
    } else {
      const amount = l.taxablePaise + l.taxPaise;
      lines.push({ name: l.name, qty: l.qty, taxablePaise: amount, taxPercent: 0, taxPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, amountPaise: amount });
    }
  }
  const sum = (f: (l: DocLine) => number): number => lines.reduce((a, l) => a + f(l), 0);
  const out: DocBuilt = { lines, taxablePaise: sum((l) => l.taxablePaise), taxPaise: sum((l) => l.taxPaise), cgstPaise: sum((l) => l.cgstPaise), sgstPaise: sum((l) => l.sgstPaise), igstPaise: sum((l) => l.igstPaise), totalPaise: sum((l) => l.amountPaise) };
  return out.totalPaise === i.paidPaise ? out : null;
}

/** The financial year key of a moment, India time (UTC+5:30), starting on 1 April: 2 April 2026 is "2627". */
export function financialYearKey(at: Date): string {
  const ist = new Date(at.getTime() + 330 * 60_000); const y = ist.getUTCFullYear(); const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start % 100).padStart(2, '0')}${String((start + 1) % 100).padStart(2, '0')}`;
}
/** At most 16 characters (the invoice-number rule): prefix up to 6, 4 for the year, a dash and 5 digits (more digits only after 99999). */
export const formatDocNumber = (prefix: string, fyKey: string, seq: number): string => `${prefix}${fyKey}-${String(seq).padStart(5, '0')}`;
/** 0 to 6 capital letters or digits; empty or missing gives INV; anything else is null. */
export function normaliseInvoicePrefix(v: unknown): string | null {
  if (v === undefined || v === null) return 'INV';
  if (typeof v !== 'string') return null;
  const t = v.trim().toUpperCase(); if (!t) return 'INV';
  return /^[A-Z0-9]{1,6}$/.test(t) ? t : null;
}

const KIND_WORDS: Readonly<Record<DocKind, string>> = { TAX_INVOICE: 'tax invoice', BILL_OF_SUPPLY: 'bill of supply', BILL: 'bill', FEE_RECEIPT: 'fee receipt' };
export const kindWords = (k: DocKind): string => KIND_WORDS[k];
/** The message that carries the public link. Business name, kind, number, amount and link; never a case, file, medical or personal detail. */
export const docMessageText = (i: { businessName: string; kind: DocKind; number: string; amountText: string; link: string }): string => `${i.businessName} has issued ${KIND_WORDS[i.kind]} ${i.number} for Rs ${i.amountText}. View it here: ${i.link}`;
