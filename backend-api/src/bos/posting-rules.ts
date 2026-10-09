import { ACC, accountForMode } from './chart';

/**
 * Posting rules: how each business document becomes a BALANCED set of journal lines. PURE (no I/O) so the whole rule book is
 * asserted by tests: every document type balances, and a reversal nets every account to zero.
 */

export interface DraftLine { accountCode: string; partyId?: string | null; debitPaise: number; creditPaise: number }

export class UnbalancedEntryError extends Error {}

const dr = (accountCode: string, amount: number, partyId?: string | null): DraftLine[] => (amount > 0 ? [{ accountCode, partyId: partyId ?? null, debitPaise: amount, creditPaise: 0 }] : []);
const cr = (accountCode: string, amount: number, partyId?: string | null): DraftLine[] => (amount > 0 ? [{ accountCode, partyId: partyId ?? null, debitPaise: 0, creditPaise: amount }] : []);

export function assertBalanced(lines: DraftLine[]): DraftLine[] {
  const d = lines.reduce((a, l) => a + l.debitPaise, 0);
  const c = lines.reduce((a, l) => a + l.creditPaise, 0);
  if (d !== c) throw new UnbalancedEntryError(`Journal does not balance: debit ${d} vs credit ${c}`);
  if (lines.some((l) => l.debitPaise < 0 || l.creditPaise < 0 || (l.debitPaise > 0 && l.creditPaise > 0))) throw new UnbalancedEntryError('A journal line must be a debit or a credit, never negative');
  return lines;
}

/** Swap debits and credits: the entry that cancels `lines` out. */
export const reverseLines = (lines: DraftLine[]): DraftLine[] => lines.map((l) => ({ ...l, debitPaise: l.creditPaise, creditPaise: l.debitPaise }));

export interface TaxAmounts { cgstPaise: number; sgstPaise: number; igstPaise: number }
export interface DocAmounts extends TaxAmounts {
  /** Taxable value of everything on the document, shipping included. */
  taxablePaise: number;
  roundOffPaise: number;
  totalPaise: number;
}

/** Positive round-off adds to the total (the customer pays a little more); it is income. A negative one is a small cost. */
const roundOffSide = (amount: number, income: boolean): DraftLine[] => (amount === 0 ? [] : (amount > 0) === income ? cr(ACC.ROUND_OFF, Math.abs(amount)) : dr(ACC.ROUND_OFF, Math.abs(amount)));

export function salesInvoiceLines(d: DocAmounts & { partyId?: string | null; cogsPaise: number }): DraftLine[] {
  return assertBalanced([
    ...dr(ACC.RECEIVABLES, d.totalPaise, d.partyId),
    ...cr(ACC.SALES, d.taxablePaise),
    ...cr(ACC.OUTPUT_CGST, d.cgstPaise), ...cr(ACC.OUTPUT_SGST, d.sgstPaise), ...cr(ACC.OUTPUT_IGST, d.igstPaise),
    ...roundOffSide(d.roundOffPaise, true),
    ...dr(ACC.COGS, d.cogsPaise), ...cr(ACC.STOCK, d.cogsPaise),
  ]);
}

/** Credit note: undoes (part of) a sale. `restockedCostPaise` = cost of the goods that went back on the shelf. */
export function creditNoteLines(d: DocAmounts & { partyId?: string | null; restockedCostPaise: number }): DraftLine[] {
  return assertBalanced([
    ...cr(ACC.RECEIVABLES, d.totalPaise, d.partyId),
    ...dr(ACC.SALES_RETURNS, d.taxablePaise),
    ...dr(ACC.OUTPUT_CGST, d.cgstPaise), ...dr(ACC.OUTPUT_SGST, d.sgstPaise), ...dr(ACC.OUTPUT_IGST, d.igstPaise),
    ...roundOffSide(d.roundOffPaise, false),
    ...dr(ACC.STOCK, d.restockedCostPaise), ...cr(ACC.COGS, d.restockedCostPaise),
  ]);
}

/** Purchase bill: stock lines go to Stock, other lines to Purchases, input GST is claimable, the supplier is owed the total. */
export function purchaseBillLines(d: DocAmounts & { partyId?: string | null; stockTaxablePaise: number }): DraftLine[] {
  const other = d.taxablePaise - d.stockTaxablePaise;
  return assertBalanced([
    ...dr(ACC.STOCK, d.stockTaxablePaise), ...dr(ACC.PURCHASES, other),
    ...dr(ACC.INPUT_CGST, d.cgstPaise), ...dr(ACC.INPUT_SGST, d.sgstPaise), ...dr(ACC.INPUT_IGST, d.igstPaise),
    ...roundOffSide(d.roundOffPaise, false),
    ...cr(ACC.PAYABLES, d.totalPaise, d.partyId),
  ]);
}

/** A receipt: money in. Part applied to invoices clears receivables; the rest is an advance the customer has paid. */
export function receiptLines(d: { partyId?: string | null; mode: string; amountPaise: number; allocatedPaise: number }): DraftLine[] {
  return assertBalanced([
    ...dr(accountForMode(d.mode), d.amountPaise),
    ...cr(ACC.RECEIVABLES, d.allocatedPaise, d.partyId),
    ...cr(ACC.CUSTOMER_ADVANCES, d.amountPaise - d.allocatedPaise, d.partyId),
  ]);
}

/** Money paid to a supplier. */
export function paymentOutLines(d: { partyId?: string | null; mode: string; amountPaise: number; allocatedPaise: number }): DraftLine[] {
  return assertBalanced([
    ...dr(ACC.PAYABLES, d.allocatedPaise, d.partyId),
    ...dr(ACC.SUPPLIER_ADVANCES, d.amountPaise - d.allocatedPaise, d.partyId),
    ...cr(accountForMode(d.mode), d.amountPaise),
  ]);
}

/** An advance the customer paid earlier is later applied to an invoice: customer advances → receivables. */
export function advanceAppliedLines(d: { partyId?: string | null; amountPaise: number }): DraftLine[] {
  return assertBalanced([...dr(ACC.CUSTOMER_ADVANCES, d.amountPaise, d.partyId), ...cr(ACC.RECEIVABLES, d.amountPaise, d.partyId)]);
}

/** An advance paid to a supplier earlier is applied to one of their bills: payables down, supplier advances down. */
export function supplierAdvanceAppliedLines(d: { partyId?: string | null; amountPaise: number }): DraftLine[] {
  return assertBalanced([...dr(ACC.PAYABLES, d.amountPaise, d.partyId), ...cr(ACC.SUPPLIER_ADVANCES, d.amountPaise, d.partyId)]);
}

export function expenseLines(d: TaxAmounts & { category: string; taxablePaise: number; totalPaise: number; paymentMode: string; supplierId?: string | null }): DraftLine[] {
  return assertBalanced([
    ...dr(d.category, d.taxablePaise),
    ...dr(ACC.INPUT_CGST, d.cgstPaise), ...dr(ACC.INPUT_SGST, d.sgstPaise), ...dr(ACC.INPUT_IGST, d.igstPaise),
    ...(d.paymentMode === 'CREDIT' ? cr(ACC.PAYABLES, d.totalPaise, d.supplierId) : cr(accountForMode(d.paymentMode), d.totalPaise)),
  ]);
}

/** Stock written off (damage, loss, recount down) at cost, or a gain (recount up). `valuePaise` is signed: negative = loss. */
export function stockAdjustmentLines(valuePaise: number): DraftLine[] {
  if (valuePaise === 0) return [];
  const v = Math.abs(valuePaise);
  return assertBalanced(valuePaise < 0 ? [...dr(ACC.STOCK_LOSS, v), ...cr(ACC.STOCK, v)] : [...dr(ACC.STOCK, v), ...cr(ACC.STOCK_LOSS, v)]);
}

/** Opening balances: stock at cost against owner capital; customer/supplier openings against capital too. */
export function openingLines(d: { stockPaise: number; receivables: { partyId: string; amountPaise: number }[]; payables: { partyId: string; amountPaise: number }[] }): DraftLine[] {
  const lines: DraftLine[] = [...dr(ACC.STOCK, d.stockPaise)];
  let net = d.stockPaise;
  for (const r of d.receivables) { lines.push(...dr(ACC.RECEIVABLES, r.amountPaise, r.partyId)); net += r.amountPaise; }
  for (const p of d.payables) { lines.push(...cr(ACC.PAYABLES, p.amountPaise, p.partyId)); net -= p.amountPaise; }
  return assertBalanced([...lines, ...(net >= 0 ? cr(ACC.CAPITAL, net) : dr(ACC.CAPITAL, -net))]);
}
