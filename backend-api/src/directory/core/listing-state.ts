/**
 * The public listing state of a business (Wave 2, public site gap G4). Pure.
 *   UNCLAIMED_LISTING  the directory lists it and nobody has claimed it
 *   CLAIMED            the owner has claimed it and no site of theirs is published
 *   LIVE               claimed, with a published site (the visit-site address exists)
 *   DRAFT_SITE         part of the vocabulary but NEVER sent by a public route: a draft site is not public, so a public page cannot know about it
 * The public site draws its calls to action from this one word instead of guessing it from `claimed` and the site address.
 */
export const LISTING_STATES = ['UNCLAIMED_LISTING', 'DRAFT_SITE', 'CLAIMED', 'LIVE'] as const;
export type ListingState = (typeof LISTING_STATES)[number];
export type PublicListingState = Exclude<ListingState, 'DRAFT_SITE'>;

export function publicStateOf(claimed: boolean, hasPublishedSite: boolean): PublicListingState {
  if (!claimed) return 'UNCLAIMED_LISTING';
  return hasPublishedSite ? 'LIVE' : 'CLAIMED';
}
