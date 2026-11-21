import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Stable machine codes of service requests (slice 5.16c). A screen switches on `code`, never on the sentence. The exception filter passes them through. */
export const SERVICE_REQUEST_ERROR_CODES = [
  'SERVICE_REQUEST_NOT_FOUND', 'SERVICE_REQUEST_STATE', 'SERVICE_REQUEST_BRIEF_INVALID', 'SERVICE_REQUESTS_NOT_CONFIGURED', 'SERVICE_NOT_REQUESTABLE', 'REVISION_LIMIT_REACHED',
  'DELIVERABLE_REQUIRED', 'GRANT_DATE_REQUIRED', 'SERVICE_REQUEST_INVALID',
] as const;
export type RequestErrorCode = (typeof SERVICE_REQUEST_ERROR_CODES)[number];
export const requestError = (code: RequestErrorCode, message: string, extra: Record<string, unknown> = {}): { message: string; code: RequestErrorCode } & Record<string, unknown> => ({ message, code, ...extra });

/** A request that belongs to another vendor answers exactly like one that does not exist. */
export const requestNotFound = (): NotFoundException => new NotFoundException(requestError('SERVICE_REQUEST_NOT_FOUND', 'That request does not exist.'));
export const requestConflict = (code: RequestErrorCode, message: string, extra: Record<string, unknown> = {}): ConflictException => new ConflictException(requestError(code, message, extra));
export const requestInvalid = (code: RequestErrorCode, message: string, extra: Record<string, unknown> = {}): BadRequestException => new BadRequestException(requestError(code, message, extra));
