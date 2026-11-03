import { MissingField } from '../site.errors';

/**
 * The indexing rule (docs/v3/V3_S4_RENDERER_PUBLISH.md section 5). A site is noindex until every mandatory fact is there; the function returns the list of
 * what is missing so the dashboard can show it. Pure. Free sites stay noindex until claimed because the claim is what proves an owner stands behind the page.
 */
export interface IndexingInput {
  businessName: string;
  categoryId: string | null;
  /** the owner has claimed the business */
  claimed: boolean;
  /** a verified contact on the claim record: the owner's email proved by using the emailed claim link (phone OTP arrives in slice 5.7) */
  verifiedContact: boolean;
  address: string;
  serviceAreas: number;
  homeContent: boolean;
  forceNoindex: boolean;
}
export interface IndexingResult { indexable: boolean; missing: MissingField[] }

export const MISSING_LABELS: Record<string, string> = {
  BUSINESS_NAME: 'The business needs a name',
  CATEGORY: 'The business needs a category',
  CLAIMED: 'The owner has not claimed this business yet',
  VERIFIED_CONTACT: 'The owner\'s phone or email has not been verified yet',
  ADDRESS_OR_SERVICE_AREA: 'Add an address or the areas you serve',
  HOME_CONTENT: 'The home page needs a short description and at least one service or photo',
  FORCE_NOINDEX: 'Search engines are switched off for this site by Get4Domain staff',
};
const m = (code: string): MissingField => ({ code, label: MISSING_LABELS[code] });

export function evaluateIndexing(i: IndexingInput): IndexingResult {
  const missing: MissingField[] = [];
  if (!i.businessName.trim()) missing.push(m('BUSINESS_NAME'));
  if (!i.categoryId) missing.push(m('CATEGORY'));
  if (!i.claimed) missing.push(m('CLAIMED'));
  if (!i.verifiedContact) missing.push(m('VERIFIED_CONTACT'));
  if (!i.address.trim() && i.serviceAreas < 1) missing.push(m('ADDRESS_OR_SERVICE_AREA'));
  if (!i.homeContent) missing.push(m('HOME_CONTENT'));
  if (i.forceNoindex) missing.push(m('FORCE_NOINDEX'));
  return { indexable: missing.length === 0, missing };
}

/** The home page has something to say: a tagline or about text, and at least one service or photo. */
export function homeContentOk(c: { site?: { tagline?: unknown }; about?: { text?: unknown }; items?: unknown[]; gallery?: unknown[] }): boolean {
  const text = String(c.site?.tagline ?? '').trim() !== '' || String(c.about?.text ?? '').trim() !== '';
  return text && ((c.items?.length ?? 0) > 0 || (c.gallery?.length ?? 0) > 0);
}

/** The hard minimums that block a publish (nothing meaningful can be rendered without them); everything else only makes the site noindex. */
export const BLOCKING_MISSING = ['BUSINESS_NAME', 'CATEGORY'];
