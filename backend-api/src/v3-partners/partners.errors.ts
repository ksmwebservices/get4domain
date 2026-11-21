import { HttpException } from '@nestjs/common';

/** Stable machine codes of the referral partner routes (Wave 3 Parts A and I). A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES. */
export const PARTNER_ERROR_CODES = ['PARTNER_INVALID', 'PARTNER_NOT_FOUND', 'PARTNER_EMAIL_TAKEN', 'PARTNER_STAFF_LINK_INVALID', 'PARTNER_ONLY', 'PARTNER_SCOPE_REFUSED'] as const;
export type PartnerErrorCode = (typeof PARTNER_ERROR_CODES)[number];

/** `details` is passed through by the exception filter as the answer's data. */
export const partnerError = (status: number, code: PartnerErrorCode, message: string, details?: Record<string, unknown>): HttpException => new HttpException({ message, code, ...(details ? { details } : {}) }, status);
