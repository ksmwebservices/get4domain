import { HttpException } from '@nestjs/common';

/** Stable machine codes of the Wave 2 Part B vendor routes. A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES. */
export const VENDOR_GAP_ERROR_CODES = ['VENDOR_GAP_INVALID', 'MIGRATION_REQUEST_OPEN', 'PROMO_DRAFT_NOT_FOUND', 'TEAM_MEMBER_NOT_FOUND', 'TEAM_MEMBER_EXISTS', 'PLAN_INVOICE_NOT_FOUND'] as const;
export type VendorGapErrorCode = (typeof VENDOR_GAP_ERROR_CODES)[number];

/** `details` is passed through by the exception filter as the answer's data, so a screen can name each field to fix. */
export const gapError = (status: number, code: VendorGapErrorCode, message: string, details?: Record<string, unknown>): HttpException => new HttpException({ message, code, ...(details ? { details } : {}) }, status);
