import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

/** Stable machine codes of the Website manager (slices 5.5 to 5.13b). The exception filter passes only listed codes through, so a screen can switch on `code`. Add every new code here. */
export const WEBSITE_ERROR_CODES = [
  'ACT_ON_BEHALF_EXPIRED', 'ACT_ON_BEHALF_FORBIDDEN', 'ACT_ON_BEHALF_INVALID', 'ACT_ON_BEHALF_NOT_CONFIGURED', 'ACT_ON_BEHALF_VENDOR_NOT_FOUND', 'ACT_ON_BEHALF_WRONG_ROUTE', 'ACT_ON_BEHALF_WRONG_VENDOR',
  'ALT_REQUIRED', 'BANNER_NOT_AVAILABLE', 'CONSENT_REQUIRED', 'DRAFT_BUSY', 'DUPLICATE_TITLE', 'FEATURE_LOCKED', 'FIELD_INVALID', 'FIELD_LOCKED', 'LIMIT_REACHED', 'LINK_HAS_NO_COORDINATES', 'LINK_HOST_NOT_ALLOWED',
  'LIST_TOO_LONG', 'LOCATION_COORDS_INCOMPLETE', 'MEDIA_INVALID', 'MEDIA_IN_USE', 'MEDIA_NOT_CONFIGURED', 'MEDIA_NOT_FOUND', 'MEDIA_TOO_LARGE', 'MEDIA_TYPE_MISMATCH', 'MEDIA_TYPE_NOT_ALLOWED', 'NAME_NOT_ALLOWED',
  'NAV_INVALID', 'NOTHING_TO_PUBLISH', 'NO_THEME', 'REASON_REQUIRED', 'REVIEW_HOST_NOT_ALLOWED', 'REVIEW_REQUIRED', 'SECTION_REQUIRED', 'SECTION_UNKNOWN', 'SESSION_ACTIVE', 'SESSION_NOT_FOUND', 'SHORT_LINK_NOT_EXPANDED',
  'SLUG_INVALID', 'STORAGE_NOT_CONFIGURED', 'SUBMISSION_NOT_FOUND', 'SUBMISSION_NOT_OPEN', 'SUBMISSION_PENDING', 'TESTIMONIALS_NOT_CONFIGURED', 'VERSION_NOT_FOUND', 'WORDING_NOT_ALLOWED',
] as const;

/** Error bodies of the Website manager: a stable `code`, a plain message, and (for a field problem) the field name. The submitted text is never echoed back. */
export const wmBody = (code: string, message: string, extra: Record<string, unknown> = {}) => ({ success: false, code, message, ...extra });

export const fieldProblem = (code: string, message: string, field?: string): BadRequestException => new BadRequestException(wmBody(code, message, field ? { field } : {}));
export const wordingProblem = (field: string): UnprocessableEntityException => new UnprocessableEntityException(wmBody('WORDING_NOT_ALLOWED', 'That text promises results or a ranking, or carries a price or a retired product name. Say what you do instead.', { field }));
export const locked = (feature: string, upsellText: string | null): ForbiddenException => new ForbiddenException(wmBody('FEATURE_LOCKED', 'This is part of the Pro plan.', { feature, upsellText }));
export const limitReached = (list: string, limit: number): ConflictException => new ConflictException(wmBody('LIMIT_REACHED', `Your plan allows ${limit} here.`, { field: list, limit }));
export const staleDraft = (): ConflictException => new ConflictException(wmBody('DRAFT_BUSY', 'Your draft was being saved at the same moment. Try again.'));
export const nothingToPublish = (): ConflictException => new ConflictException(wmBody('NOTHING_TO_PUBLISH', 'There are no changes to publish.'));
export const versionNotFound = (): NotFoundException => new NotFoundException(wmBody('VERSION_NOT_FOUND', 'That version of the site does not exist.'));
export const reviewRequired = (): ConflictException => new ConflictException(wmBody('REVIEW_REQUIRED', 'Your edits are sent to our team for review before they go live. Use Submit for review.'));

export const testimonialsNotConfigured = (): ConflictException => new ConflictException(wmBody('TESTIMONIALS_NOT_CONFIGURED', 'Testimonials are not switched on yet.'));

/** Media problems carry the HTTP status that fits their code. */
const MEDIA_STATUS: Readonly<Record<string, number>> = { MEDIA_NOT_CONFIGURED: 409, MEDIA_TOO_LARGE: 413, MEDIA_IN_USE: 409, MEDIA_NOT_FOUND: 404, BANNER_NOT_AVAILABLE: 404 };
export function mediaProblem(code: string, message: string, field?: string): HttpException {
  return new HttpException(wmBody(code, message, field ? { field } : {}), MEDIA_STATUS[code] ?? 422);
}
