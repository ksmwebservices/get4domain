import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

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
