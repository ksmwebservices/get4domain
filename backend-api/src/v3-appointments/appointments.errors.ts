import { HttpException } from '@nestjs/common';

/** Stable machine codes of appointments. A screen switches on `code`, never on the sentence. The exception filter passes them through (see v3-business/business.errors.ts). */
export const APPT_ERROR_CODES = ['APPT_INVALID', 'APPT_NOT_FOUND', 'APPT_STATE', 'APPT_SLOT_UNAVAILABLE'] as const;
export type ApptErrorCode = (typeof APPT_ERROR_CODES)[number];

export const apptError = (status: number, code: ApptErrorCode, message: string, extra: Record<string, unknown> = {}): HttpException => new HttpException({ message, code, ...extra }, status);
