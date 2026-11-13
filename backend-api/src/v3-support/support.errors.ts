import { HttpException } from '@nestjs/common';

/** Stable machine codes of support tickets. Registered with the exception filter in v3-business/business.errors.ts. */
export const SUPPORT_ERROR_CODES = ['TICKET_INVALID', 'TICKET_NOT_FOUND', 'TICKET_RATE_LIMITED', 'TICKET_NOT_CONFIGURED', 'TICKET_ATTACHMENT_INVALID', 'TICKET_STATE_CHANGED'] as const;
export type SupportErrorCode = (typeof SUPPORT_ERROR_CODES)[number];

export const supportError = (status: number, code: SupportErrorCode, message: string): HttpException => new HttpException({ message, code }, status);
