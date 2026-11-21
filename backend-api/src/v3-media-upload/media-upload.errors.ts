import { HttpException } from '@nestjs/common';

/** Stable machine codes of the Wave 2 Part D upload. A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES. */
export const MEDIA_UPLOAD_ERROR_CODES = ['UPLOAD_NOT_CONFIGURED', 'UPLOAD_EMPTY', 'UPLOAD_TOO_LARGE', 'UPLOAD_TYPE_NOT_ALLOWED', 'UPLOAD_TYPE_MISMATCH', 'UPLOAD_UNSAFE', 'UPLOAD_INVALID', 'UPLOAD_ALT_INVALID', 'UPLOAD_NOT_FOUND', 'UPLOAD_LISTING_NOT_FOUND'] as const;
export type MediaUploadErrorCode = (typeof MEDIA_UPLOAD_ERROR_CODES)[number];

const STATUS: Readonly<Record<MediaUploadErrorCode, number>> = {
  UPLOAD_NOT_CONFIGURED: 503, UPLOAD_EMPTY: 400, UPLOAD_TOO_LARGE: 413, UPLOAD_TYPE_NOT_ALLOWED: 415, UPLOAD_TYPE_MISMATCH: 415, UPLOAD_UNSAFE: 422, UPLOAD_INVALID: 422, UPLOAD_ALT_INVALID: 400, UPLOAD_NOT_FOUND: 404, UPLOAD_LISTING_NOT_FOUND: 404,
};
export const uploadError = (code: MediaUploadErrorCode, message: string, details?: Record<string, unknown>): HttpException => new HttpException({ message, code, ...(details ? { details } : {}) }, STATUS[code]);
