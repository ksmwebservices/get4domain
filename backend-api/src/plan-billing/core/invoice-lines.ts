/**
 * The lines of a plan invoice (Wave 3 Part D). PURE, integer minor units. A line for the plan and its term, a line for the tax the order's quote recorded (only when there is tax), and the total. The amounts
 * come from the order's own price snapshot, never recomputed, so the invoice always shows what was charged.
 */
export interface InvoiceLine { key: 'PLAN' | 'TAX' | 'TOTAL'; description: string; amountMinor: number }
export interface QuoteForLines { base?: number; taxableMinor?: number; taxMinor?: number; taxName?: string; taxRatePercent?: number; creditPaise?: number }

export function invoiceLines(planName: string, termMonths: number, q: QuoteForLines, totalMinor: number): InvoiceLine[] {
  const before = typeof q.taxableMinor === 'number' ? q.taxableMinor : typeof q.base === 'number' ? q.base : totalMinor - (typeof q.taxMinor === 'number' ? q.taxMinor : 0);
  const lines: InvoiceLine[] = [{ key: 'PLAN', description: `${planName} plan, ${termMonths} months`, amountMinor: before }];
  if (typeof q.taxMinor === 'number' && q.taxMinor > 0) lines.push({ key: 'TAX', description: `${q.taxName ?? 'Tax'}${typeof q.taxRatePercent === 'number' ? ` at ${q.taxRatePercent}%` : ''}`, amountMinor: q.taxMinor });
  lines.push({ key: 'TOTAL', description: 'Total paid', amountMinor: totalMinor });
  return lines;
}
