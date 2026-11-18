import { PublicListing } from './duplicate.store';

export const DUPLICATE_CODES = ['DUPLICATE_BUSINESS', 'DUPLICATE_POSSIBLE', 'DUPLICATE_OVERRIDE_FORBIDDEN', 'DUPLICATE_OVERRIDE_REASON_REQUIRED', 'DUPLICATE_REVIEW_PENDING', 'DUPLICATE_REVIEW_NOT_FOUND', 'DUPLICATE_REVIEW_DECIDED'] as const;
export type DuplicateCode = (typeof DUPLICATE_CODES)[number];

export function duplicateError(code: DuplicateCode, message: string, extra: Record<string, unknown> = {}): { message: string; code: DuplicateCode } & Record<string, unknown> { return { message, code, ...extra }; }

/** The sentence a visitor sees for a strong match. It says nothing about WHICH detail matched or whose business it is. */
export const DUPLICATE_BLOCKED_MESSAGE = 'A business with these details already exists. Sign in to your account, or claim the listing if it is yours.';
/** The sentence for a possible match: only public listing facts follow it. */
export const DUPLICATE_POSSIBLE_MESSAGE = 'We found a business that looks like yours. Is this your business? If it is, claim it instead of making a second site.';

/** Where a visitor goes to claim a listing: the public claim start (POST with the listing's slug). Present only for a listing nobody has claimed. */
export const claimRoute = (l: PublicListing | undefined): { businessSlug: string; startPath: string } | null => (l && l.claimable ? { businessSlug: l.slug, startPath: '/v3/claim/start' } : null);
