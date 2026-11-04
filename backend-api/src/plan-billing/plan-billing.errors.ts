/**
 * Stable machine codes of plan purchases (slice 5.1b). A screen switches on `code`, never on the sentence. The HTTP exception filter passes them through.
 * An order id that belongs to another vendor answers exactly like one that does not exist (ORDER_NOT_FOUND).
 */
export const BILLING_ERROR_CODES = [
  'PAYMENTS_DISABLED', 'PAYMENTS_NOT_CONFIGURED', 'PLAN_NOT_PURCHASABLE', 'TERM_NOT_OFFERED', 'PRICE_NOT_AVAILABLE', 'PLAN_CHANGE_NOT_ALLOWED', 'IDEMPOTENCY_CONFLICT',
  'ORDER_NOT_FOUND', 'ORDER_STATE_INVALID', 'ORDER_NOT_PAYABLE', 'PAYMENT_SIGNATURE_INVALID', 'PAYMENT_NOT_CAPTURED', 'PAYMENT_PROVIDER_ERROR',
] as const;
export type BillingErrorCode = (typeof BILLING_ERROR_CODES)[number];

export function billingError(code: BillingErrorCode, message: string): { message: string; code: BillingErrorCode } { return { message, code }; }

export const ORDER_NOT_FOUND_MESSAGE = 'That order does not exist.';
