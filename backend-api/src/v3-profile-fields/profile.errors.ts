import { HttpException } from '@nestjs/common';

/** Stable machine codes of the Wave 2 Part E profile fields. A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES. */
export const PROFILE_ERROR_CODES = ['PROFILE_INVALID', 'PROFILE_CATEGORY_UNKNOWN', 'PROFILE_NO_CATEGORY', 'PROFILE_GATED', 'PROFILE_LISTING_NOT_FOUND', 'PROFILE_FIELD_INVALID'] as const;
export type ProfileErrorCode = (typeof PROFILE_ERROR_CODES)[number];
const STATUS: Readonly<Record<ProfileErrorCode, number>> = { PROFILE_INVALID: 400, PROFILE_CATEGORY_UNKNOWN: 404, PROFILE_NO_CATEGORY: 409, PROFILE_GATED: 403, PROFILE_LISTING_NOT_FOUND: 404, PROFILE_FIELD_INVALID: 400 };

/** `details` is passed through by the exception filter as the answer's data, so a screen can name each field to fix. */
export const profileError = (code: ProfileErrorCode, message: string, details?: Record<string, unknown>): HttpException => new HttpException({ message, code, ...(details ? { details } : {}) }, STATUS[code]);
