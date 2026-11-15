import { HttpException } from '@nestjs/common';

/** Stable machine codes of the listing import. A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES. */
export const IMPORT_ERROR_CODES = ['IMPORT_INVALID', 'IMPORT_BLOCKED'] as const;
export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[number];
const STATUS: Readonly<Record<ImportErrorCode, number>> = { IMPORT_INVALID: 400, IMPORT_BLOCKED: 409 };

/** `details` is passed through by the exception filter as the answer's data (the full report for IMPORT_BLOCKED, so the screen can show every bad row). */
export const importError = (code: ImportErrorCode, message: string, details?: Record<string, unknown>): HttpException => new HttpException({ message, code, ...(details ? { details } : {}) }, STATUS[code]);
