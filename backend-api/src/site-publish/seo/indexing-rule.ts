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
  /**
   * Set for a SEEDED or INVITED site (slice 5.13a). Such a site has no owner yet, so the claim checks do not apply; instead it stays noindex unless the setting
   * seededSiteIndexingMode is QUALITY and the quality check passes (owner rule 8: default OFF until counsel approves).
   */
  seeded?: { mode: 'OFF' | 'QUALITY'; qualityOk: boolean };
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
  SEEDED_INDEXING_OFF: 'Pages created from public information are not offered to search engines yet',
  SEEDED_QUALITY: 'This page does not yet meet the quality bar for search engines',
};
const m = (code: string): MissingField => ({ code, label: MISSING_LABELS[code] });

/** The checklist wording: the positive sentence for each check, shown with a tick when it is met. */
export const CHECK_LABELS: Record<string, string> = {
  BUSINESS_NAME: 'Business name added', CATEGORY: 'Category chosen', CLAIMED: 'Owner has claimed the business', VERIFIED_CONTACT: 'Owner contact verified',
  ADDRESS_OR_SERVICE_AREA: 'Address or service area added', HOME_CONTENT: 'Home page has a description and at least one service or photo', FORCE_NOINDEX: 'Search engines not switched off by staff',
  SEEDED_INDEXING_OFF: 'Indexing of pages made from public information is switched on', SEEDED_QUALITY: 'Page meets the quality bar',
};
export interface ChecklistItem { code: string; label: string; done: boolean }
export interface Readiness { indexable: boolean; checklist: ChecklistItem[]; publishedIndexable: boolean | null; needsRebuild: boolean }

/** Every check of the rule in order, each with a tick: a seeded page is judged by the setting and the quality check, any other by the claim. */
export function indexingChecklist(missing: ReadonlyArray<{ code: string }>, seeded: boolean): ChecklistItem[] {
  const open = new Set(missing.map((m) => m.code));
  const codes = ['BUSINESS_NAME', 'CATEGORY', ...(seeded ? ['SEEDED_INDEXING_OFF', 'SEEDED_QUALITY'] : ['CLAIMED', 'VERIFIED_CONTACT']), 'ADDRESS_OR_SERVICE_AREA', 'HOME_CONTENT', 'FORCE_NOINDEX'];
  return codes.map((code) => ({ code, label: CHECK_LABELS[code], done: !open.has(code) }));
}

/** What staff see: the checklist, whether the site is ready to be indexed, whether the PUBLISHED page already is, and whether a rebuild is still needed (ready, but the page still says noindex). */
export function readiness(missing: ReadonlyArray<{ code: string }>, seeded: boolean, publishedIndexable: boolean | null): Readiness {
  const indexable = missing.length === 0;
  return { indexable, checklist: indexingChecklist(missing, seeded), publishedIndexable, needsRebuild: indexable && publishedIndexable === false };
}

export function evaluateIndexing(i: IndexingInput): IndexingResult {
  const missing: MissingField[] = [];
  if (!i.businessName.trim()) missing.push(m('BUSINESS_NAME'));
  if (!i.categoryId) missing.push(m('CATEGORY'));
  if (i.seeded) {
    // a seeded page has no owner to claim it: the setting and the quality check decide instead
    if (i.seeded.mode !== 'QUALITY') missing.push(m('SEEDED_INDEXING_OFF'));
    else if (!i.seeded.qualityOk) missing.push(m('SEEDED_QUALITY'));
  } else {
    if (!i.claimed) missing.push(m('CLAIMED'));
    if (!i.verifiedContact) missing.push(m('VERIFIED_CONTACT'));
  }
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
