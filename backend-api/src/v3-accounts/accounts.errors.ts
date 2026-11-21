import { HttpException } from '@nestjs/common';

/** Stable machine codes of the accounts module. A screen switches on `code`, never on the sentence. The exception filter passes them through (see v3-business/business.errors.ts). */
export const ACCOUNTS_ERROR_CODES = ['ACCOUNTS_INVALID', 'ACCOUNTS_NOT_FOUND'] as const;
export type AccountsErrorCode = (typeof ACCOUNTS_ERROR_CODES)[number];

export const accountsError = (status: number, code: AccountsErrorCode, message: string, extra: Record<string, unknown> = {}): HttpException => new HttpException({ message, code, ...extra }, status);
