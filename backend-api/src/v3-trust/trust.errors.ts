import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

/** Stable machine codes of trust and safety (slice 5.21). A screen switches on `code`, never on the sentence. The exception filter passes them through. */
export const TRUST_ERROR_CODES = [
  'TRUST_INVALID', 'TRUST_NOT_FOUND', 'TRUST_STALE', 'TAKEDOWN_REASON_REQUIRED', 'TAKEDOWN_FORBIDDEN', 'TAKEDOWN_TARGET_UNKNOWN', 'TAKEDOWN_ALREADY_ACTIVE', 'TAKEDOWN_NOT_ACTIVE', 'BLOCK_EXISTS', 'TERM_EXISTS',
] as const;
export type TrustErrorCode = (typeof TRUST_ERROR_CODES)[number];
const body = (code: TrustErrorCode, message: string): { message: string; code: TrustErrorCode } => ({ message, code });
export const trustInvalid = (message: string): BadRequestException => new BadRequestException(body('TRUST_INVALID', message));
export const trustNotFound = (what: string): NotFoundException => new NotFoundException(body('TRUST_NOT_FOUND', `That ${what} does not exist.`));
export const trustStale = (): ConflictException => new ConflictException(body('TRUST_STALE', 'Someone else changed this just now. Reload it and try again.'));
export const takedownReasonRequired = (): BadRequestException => new BadRequestException(body('TAKEDOWN_REASON_REQUIRED', 'A written reason is required.'));
export const takedownForbidden = (): ForbiddenException => new ForbiddenException(body('TAKEDOWN_FORBIDDEN', 'Only a super administrator can do this.'));
export const takedownTargetUnknown = (): NotFoundException => new NotFoundException(body('TAKEDOWN_TARGET_UNKNOWN', 'There is no business or listing like that.'));
export const takedownAlreadyActive = (): ConflictException => new ConflictException(body('TAKEDOWN_ALREADY_ACTIVE', 'A takedown is already in force for this business.'));
export const takedownNotActive = (): ConflictException => new ConflictException(body('TAKEDOWN_NOT_ACTIVE', 'That takedown is not in force.'));
export const blockExists = (): ConflictException => new ConflictException(body('BLOCK_EXISTS', 'That value is already on the block list.'));
export const termExists = (): ConflictException => new ConflictException(body('TERM_EXISTS', 'That phrase is already in the list.'));
