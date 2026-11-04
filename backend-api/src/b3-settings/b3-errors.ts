/**
 * Stable machine codes of Batch 3 (docs/v3/V3_S6_BATCH3.md). A screen switches on `code`, never on the sentence. Public routes answer uniformly where the dispatch says so.
 */
export const B3_ERROR_CODES = [
  // 5.1d lifecycle
  'LIFECYCLE_NO_SUBSCRIPTION', 'LIFECYCLE_STATE_INVALID', 'LIFECYCLE_REASON_REQUIRED', 'LIFECYCLE_NOT_EMPTY', 'DELETION_CODE_SENT', 'DELETION_CONFIRM_REQUIRED', 'DELETION_NO_PHONE', 'DELETION_CODE_INVALID', 'DELETION_NOT_FOUND',
  // 5.6b canonical
  'CANONICAL_NOT_FOUND',
  // 5.13a seeded sites
  'SEEDED_INVALID', 'SEEDED_DUPLICATE', 'SEEDED_DNC', 'SEEDED_NOT_FOUND', 'SEEDED_CONSENT_REQUIRED', 'SEEDED_REMOVED',
  // 5.14 requests and orders
  'REQUEST_INVALID', 'REQUEST_NOT_FOUND', 'REQUEST_STATE_INVALID', 'PAYMENT_METHOD_INVALID', 'ORDER_INVALID', 'STOCK_UNAVAILABLE', 'OFFER_INVALID',
  // 5.15 terms
  'TERMS_NOT_FOUND', 'TERMS_PLACEHOLDER', 'TERMS_STATE_INVALID', 'TERMS_ACCEPTANCE_REQUIRED',
] as const;
export type B3ErrorCode = (typeof B3_ERROR_CODES)[number];

export function b3Error(code: B3ErrorCode, message: string, extra: Record<string, unknown> = {}): { message: string; code: B3ErrorCode } & Record<string, unknown> { return { message, code, ...extra }; }
