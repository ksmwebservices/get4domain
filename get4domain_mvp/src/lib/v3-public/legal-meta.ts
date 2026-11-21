/**
 * Shared facts of the legal and company pages: one effective date and one version for every page, and the shape of a policy document.
 * The text itself lives in legal-strings.ts (the strings module). Pure: no framework import.
 *
 * The effective date is the date the text was drafted. The owner sets it again on the day the flag is turned on, after a lawyer in India has reviewed the text.
 */
export const LEGAL_EFFECTIVE_DATE = '2026-11-17';
export const LEGAL_VERSION = '1.0 (draft)';

/** One heading of a policy: plain paragraphs, then an optional list. */
export interface LegalSection {
  /** anchor id, lowercase letters and hyphens */
  id: string;
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
}

/** One policy page. `path` is the public address on the main host (also the canonical path). */
export interface LegalDocDef {
  path: string;
  title: string;
  /** without the brand; the brand is added when the whole title fits in 60 characters */
  metaTitle: string;
  metaDescription: string;
  intro: string;
  /** print the grievance officer block (timelines and details) on this page when the firm data exists */
  showGrievance?: boolean;
  sections: readonly LegalSection[];
}

/** 2026-11-17 as "17 November 2026" (fixed zone, so the same text on every server). */
export function formatEffectiveDate(iso: string = LEGAL_EFFECTIVE_DATE): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
