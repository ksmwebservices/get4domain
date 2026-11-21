import { HttpException } from '@nestjs/common';

/** Stable machine codes of the Wave 2 Part C admin routes. A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES. */
export const ADMIN_GAP_ERROR_CODES = ['ADMIN_GAP_INVALID', 'ADMIN_VENDOR_NOT_FOUND', 'OFFLINE_AMOUNT_MISMATCH', 'GO_LIVE_BLOCKED'] as const;
export type AdminGapErrorCode = (typeof ADMIN_GAP_ERROR_CODES)[number];

/** `details` is passed through by the exception filter as the answer's data. */
export const adminGapError = (status: number, code: AdminGapErrorCode, message: string, details?: Record<string, unknown>): HttpException => new HttpException({ message, code, ...(details ? { details } : {}) }, status);
