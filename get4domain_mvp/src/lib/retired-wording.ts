/**
 * Names and prices of the retired Workspace / BOS / LeadSpace plans and the old positioning line (V3 positioning, docs/v3/SEO_0_PLAN.md §1).
 * They must not appear in page metadata, structured data or llms.txt. Visible page copy is a separate, queued rewrite (Q-SEO-1), so code that
 * turns that copy into structured data uses this to leave out anything that still says them. `scripts/seo-check.mjs` carries the same list.
 */
export const RETIRED_WORDING = /Workspace|\bBOS\b|LeadSpace|₹\s?999\b|₹\s?1,?999\b|\b11,?988\b|\b23,?988\b|Identity Partner/i;

export function hasRetiredWording(text: string): boolean {
  return RETIRED_WORDING.test(text);
}
