/**
 * Names and prices of the retired Workspace / BOS / LeadSpace plans and the old positioning line (V3 positioning, docs/v3/SEO_0_PLAN.md §1).
 * They, and ANY rupee amount, must not appear in page metadata, structured data or llms.txt. Visible page copy is a separate, queued rewrite (Q-SEO-1), so code that
 * turns that copy into structured data uses this to leave out anything that still says them. `scripts/seo-check.mjs` carries the same list.
 */
export const RETIRED_WORDING = /Workspace|\bBOS\b|LeadSpace|Identity Partner|online identity|Business Operating System|₹\s?\d|\bRs\.?\s?\d|\bINR\s?\d|\b\d[\d,]*\s?\/\s?(?:mo|month|yr|year)\b/i;

export function hasRetiredWording(text: string): boolean {
  return RETIRED_WORDING.test(text);
}
