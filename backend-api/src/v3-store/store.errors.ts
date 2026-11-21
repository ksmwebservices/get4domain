import { HttpException } from '@nestjs/common';

/** Stable machine codes of the store. A screen switches on `code`, never on the sentence. The exception filter passes them through (see v3-business/business.errors.ts). */
export const STORE_ERROR_CODES = ['STORE_INVALID', 'STORE_NOT_FOUND', 'STORE_SKU_TAKEN', 'STORE_NOT_TRACKED', 'STORE_STOCK_INSUFFICIENT'] as const;
export type StoreErrorCode = (typeof STORE_ERROR_CODES)[number];

export const storeError = (status: number, code: StoreErrorCode, message: string, extra: Record<string, unknown> = {}): HttpException => new HttpException({ message, code, ...extra }, status);
