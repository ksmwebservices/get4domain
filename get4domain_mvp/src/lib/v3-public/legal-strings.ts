import type { LegalDocDef } from './legal-meta';
import { DISCLAIMER } from './legal-text/disclaimer';

/**
 * Every word of the legal and company pages (the strings module of dispatch D1). The long texts sit one per file in `legal-text/` and are gathered here,
 * so the copy rules (`__tests__/legal-copy-rules.test.ts`) walk one object.
 *
 * Rules: plain English, short sentences; never the words workspace, BOS or LeadSpace; "enquiries" not "leads"; no digits and no time words in policy text
 * (where a rule normally needs a number it says "as shown at checkout or as agreed in writing"); no discount, coupon or offer unless to say there is none;
 * no ranking claim, no invented company fact, no professional claim. The text is a DRAFT until a lawyer in India has reviewed it (docs/v3/LEGAL_REVIEW.md).
 */
export const LEGAL_DOCS: readonly LegalDocDef[] = [DISCLAIMER];

export const LEGAL_UI = {
  contents: 'Contents',
  effective: 'Effective',
  version: 'Version',
  otherPolicies: 'Other policies',
  companyHeading: 'Company details',
  rows: { name: 'Legal name', address: 'Registered office', gstin: 'GSTIN', cin: 'CIN', supportEmail: 'Support email', supportPhone: 'Support phone' },
  policiesNavLabel: 'Policies',
  contentsNavLabel: 'On this page',
  footerLegalLabel: 'Legal',
} as const;

/** The company pages that are not policy documents (their own components), with the policies, in footer order. */
export const COMPANY_LINKS: ReadonlyArray<{ path: string; label: string }> = [
  { path: '/about', label: 'About' },
  { path: '/contact', label: 'Contact' },
];
