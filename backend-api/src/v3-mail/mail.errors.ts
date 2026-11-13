import { HttpException } from '@nestjs/common';

/** Stable machine codes of mail and the enquiry inbox. Registered with the exception filter in v3-business/business.errors.ts. */
export const MAIL_ERROR_CODES = [
  'EMAIL_NOT_LIVE', 'EMAIL_NOT_CONFIGURED', 'EMAIL_FAILED', 'EMAIL_KIND_FORBIDDEN', 'EMAIL_INVALID',
  'INBOX_NOT_FOUND', 'INBOX_INVALID', 'INBOX_NOT_CONFIGURED', 'INBOX_SIGNATURE_INVALID', 'INBOX_VENDOR_UNKNOWN', 'INBOX_PLAN_INACTIVE', 'INBOX_TOO_LARGE', 'INBOX_RATE_LIMITED',
] as const;
export type MailErrorCode = (typeof MAIL_ERROR_CODES)[number];

export const mailError = (status: number, code: MailErrorCode, message: string): HttpException => new HttpException({ message, code }, status);
