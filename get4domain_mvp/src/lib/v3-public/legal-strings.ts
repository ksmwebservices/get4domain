import type { LegalDocDef } from './legal-meta';
import { ACCEPTABLE_USE } from './legal-text/acceptable-use';
import { COOKIES } from './legal-text/cookies';
import { DELIVERY } from './legal-text/delivery';
import { DISCLAIMER } from './legal-text/disclaimer';
import { LISTING } from './legal-text/listing';
import { PARTNER } from './legal-text/partner';
import { PAYMENTS } from './legal-text/payments';
import { PRIVACY } from './legal-text/privacy';
import { REFUND } from './legal-text/refund';
import { TERMS } from './legal-text/terms';

/**
 * Every word of the legal and company pages (the strings module of dispatch D1). The long texts sit one per file in `legal-text/` and are gathered here,
 * so the copy rules (`__tests__/legal-copy-rules.test.ts`) walk one object.
 *
 * Rules: plain English, short sentences; never the words workspace, BOS or LeadSpace; "enquiries" not "leads"; no digits and no time words in policy text, except the two grievance timelines "48 hours" and "one month" (owner defaults of dispatch D2); no discount, coupon or offer unless to say there is none;
 * no ranking claim, no invented company fact, no professional claim. The text is a DRAFT until a lawyer in India has reviewed it (docs/v3/LEGAL_REVIEW.md).
 */
export const LEGAL_DOCS: readonly LegalDocDef[] = [TERMS, PRIVACY, REFUND, PAYMENTS, DELIVERY, ACCEPTABLE_USE, COOKIES, DISCLAIMER, LISTING, PARTNER];

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
