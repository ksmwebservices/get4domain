import { HttpException } from '@nestjs/common';

/** Stable machine codes of the customer list. A screen switches on `code`, never on the sentence. The exception filter passes them through (see v3-business/business.errors.ts). */
export const CUSTOMER_ERROR_CODES = ['CUSTOMER_INVALID', 'CUSTOMER_NOT_FOUND', 'CUSTOMER_EXISTS', 'CUSTOMER_CONSENT_LOCKED'] as const;
export type CustomerErrorCode = (typeof CUSTOMER_ERROR_CODES)[number];

export const customerError = (status: number, code: CustomerErrorCode, message: string, extra: Record<string, unknown> = {}): HttpException => new HttpException({ message, code, ...extra }, status);
