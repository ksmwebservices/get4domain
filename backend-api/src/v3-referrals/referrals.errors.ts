import { HttpException } from '@nestjs/common';

/** Stable machine codes of referrals and commission (Wave 3 Part I). A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES. */
export const REFERRAL_ERROR_CODES = [
  'REFERRAL_SELF_REFERRAL', 'REFERRAL_ATTRIBUTION_EXISTS', 'REFERRAL_ATTRIBUTION_INVALID', 'REFERRAL_VENDOR_NOT_FOUND', 'REFERRAL_PARTNER_INACTIVE', 'REFERRAL_LINK_NOT_FOUND', 'REFERRAL_CODE_FAILED',
  'COMMISSION_SLAB_INVALID', 'COMMISSION_SLAB_NOT_FOUND', 'COMMISSION_MONTH_INVALID', 'COMMISSION_MONTH_NOT_CLOSED', 'COMMISSION_NOTHING_TO_PAY', 'COMMISSION_PAYOUT_EXISTS', 'COMMISSION_PAYOUT_INVALID',
] as const;
export type ReferralErrorCode = (typeof REFERRAL_ERROR_CODES)[number];

/** `details` is passed through by the exception filter as the answer's data. */
export const referralError = (status: number, code: ReferralErrorCode, message: string, details?: Record<string, unknown>): HttpException => new HttpException({ message, code, ...(details ? { details } : {}) }, status);
