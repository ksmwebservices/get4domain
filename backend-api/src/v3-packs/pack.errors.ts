import { HttpException } from '@nestjs/common';

/** Stable machine codes of the pack engine. A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES (see v3-business/business.errors.ts). */
export const PACK_ERROR_CODES = ['TAB_LOCKED', 'CAPABILITY_NEEDS_TIER', 'PACK_INVALID', 'PACK_NOT_FOUND', 'PACK_CATEGORY_UNKNOWN', 'PACK_CAPABILITY_UNKNOWN', 'PACK_STARTER_UNKNOWN', 'PACK_ALREADY_SET', 'PACK_MATRIX_INVALID',
  // Part B: the paused plan state and the add-on packs whose price the owner has not set
  'PLAN_NOT_PAUSABLE', 'PLAN_ALREADY_PAUSED', 'PLAN_NOT_PAUSED', 'ADDON_PRICE_PENDING',
  // Wave 2 Part H2: add-on eligibility
  'ADDON_NOT_ELIGIBLE', 'ADDON_ELIGIBILITY_INVALID',
  // S1.7: the public signup took the business category as free text
  'INDUSTRY_NOT_IN_LIST'] as const;
export type PackErrorCode = (typeof PACK_ERROR_CODES)[number];

export const packError = (status: number, code: PackErrorCode, message: string, extra: Record<string, unknown> = {}): HttpException => new HttpException({ message, code, ...extra }, status);
