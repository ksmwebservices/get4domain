/**
 * Stable machine codes of the directory slice (docs/v3/V3_S5_BATCH2.md). A screen switches on `code`, never on the sentence. The HTTP exception filter passes them through.
 * Public routes answer uniformly: an unknown, expired, used or revoked token, a wrong phone or a wrong code all give the same body, so nothing can be learned from them.
 */
export const DIRECTORY_ERROR_CODES = ['DIRECTORY_NOT_FOUND', 'DIRECTORY_SLUG_TAKEN', 'DIRECTORY_INVALID', 'DIRECTORY_STATE_INVALID', 'DIRECTORY_PROFILE_MISSING', 'OTP_INVALID', 'REMOVAL_INVALID', 'REMOVAL_NOT_CONFIRMED', 'GRANT_INVALID', 'DIRECTORY_GONE',
  // Part B (B7): account setup and approval after a claim
  'CLAIM_EMAIL_REQUIRED', 'CLAIM_EMAIL_TAKEN', 'CLAIM_NOT_CLAIMED', 'CLAIM_TERMS_REQUIRED', 'CLAIM_GO_LIVE_UNAVAILABLE'] as const;
export type DirectoryErrorCode = (typeof DIRECTORY_ERROR_CODES)[number];

export function directoryError(code: DirectoryErrorCode, message: string): { message: string; code: DirectoryErrorCode } { return { message, code }; }

export const OTP_INVALID_MESSAGE = 'That code is not valid.';
export const OTP_SENT_MESSAGE = 'If this link is valid, a code has been sent to the phone number we have for this business.';
export const OTP_SENT_EMAIL_MESSAGE = 'If this link is valid, a code has been sent to the email address we have for this business.';
export const REMOVAL_ACCEPTED_MESSAGE = 'If this business is listed and has a phone number on file, we have sent it a link to confirm the request.';
export const REMOVAL_INVALID_MESSAGE = 'This link is not valid.';
export const GRANT_INVALID_MESSAGE = 'This link is not valid.';
