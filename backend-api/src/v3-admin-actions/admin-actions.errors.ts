import { HttpException } from '@nestjs/common';

/** Stable machine codes of the staff actions (Amendment 09 Part A, Amendment 11 Q12). Registered with the exception filter in v3-business/business.errors.ts. */
export const ADMIN_ACTION_ERROR_CODES = [
  'ADMIN_INVALID', 'ADMIN_VENDOR_NOT_FOUND', 'ADMIN_NO_CHANGE', 'ADMIN_PLAN_UNKNOWN', 'ADMIN_PLAN_CHANGE_NOT_FOUND', 'ADMIN_PLAN_CHANGE_STATE',
  'ADMIN_MERGE_NOT_ENABLED', 'ADMIN_MERGE_INVALID', 'ADMIN_MERGE_NOT_FOUND', 'ADMIN_MERGE_STATE', 'ADMIN_MERGE_WINDOW_ENDED',
] as const;
export type AdminActionErrorCode = (typeof ADMIN_ACTION_ERROR_CODES)[number];

export const adminError = (status: number, code: AdminActionErrorCode, message: string): HttpException => new HttpException({ message, code }, status);
