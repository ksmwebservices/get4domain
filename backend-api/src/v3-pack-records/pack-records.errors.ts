import { HttpException } from '@nestjs/common';

/** Stable machine codes of the pack record store (Wave 2 Part A). A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES. */
export const PACK_RECORD_ERROR_CODES = ['PACK_RECORD_INVALID', 'PACK_RECORD_NOT_FOUND', 'PACK_TAB_NO_RECORDS', 'PACK_TAB_OWNER_ONLY'] as const;
export type PackRecordErrorCode = (typeof PACK_RECORD_ERROR_CODES)[number];

export const recordError = (status: number, code: PackRecordErrorCode, message: string, extra: Record<string, unknown> = {}): HttpException => new HttpException({ message, code, ...extra }, status);
