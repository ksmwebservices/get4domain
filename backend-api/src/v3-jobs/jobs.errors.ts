import { HttpException } from '@nestjs/common';

/** Stable machine codes of jobs and quotes. A screen switches on `code`, never on the sentence. The exception filter passes them through (see v3-business/business.errors.ts). */
export const JOBS_ERROR_CODES = ['JOBS_INVALID', 'JOBS_NOT_FOUND', 'JOBS_STATE', 'JOBS_PAYMENT_ONLY', 'JOBS_QUOTE_EXPIRED', 'JOBS_NOT_PAID'] as const;
export type JobsErrorCode = (typeof JOBS_ERROR_CODES)[number];

export const jobsError = (status: number, code: JobsErrorCode, message: string, extra: Record<string, unknown> = {}): HttpException => new HttpException({ message, code, ...extra }, status);
