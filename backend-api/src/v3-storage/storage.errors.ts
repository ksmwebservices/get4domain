import { HttpException } from '@nestjs/common';

/** Stable machine codes of storage. A screen switches on `code`, never on the sentence. Registered with the exception filter in v3-business/business.errors.ts. */
export const STORAGE_ERROR_CODES = ['STORAGE_NOT_CONFIGURED', 'STORAGE_TOO_LARGE', 'STORAGE_TYPE_REFUSED', 'STORAGE_UNREADABLE', 'STORAGE_SCAN_UNAVAILABLE', 'STORAGE_FAILED', 'STORAGE_KEY_INVALID'] as const;
export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[number];

export const storageError = (status: number, code: StorageErrorCode, message: string): HttpException => new HttpException({ message, code }, status);
