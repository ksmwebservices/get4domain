/**
 * Error vocabulary of the provisioning slice (docs/v3/V3_S3_PROVISIONING.md sections 4 and 8).
 *  - API codes: a screen switches on `code`, never on the sentence; the HTTP exception filter passes these through (additive to PLAN_ERROR_CODES).
 *  - Step codes: what a step records when it fails. The stored message is ALWAYS one of the fixed sentences below, never the original error text, so a
 *    provider's response (which can echo a key, an address or a token) can never reach the database or a log through this path.
 */
export const PROVISIONING_API_ERROR_CODES = ['DUPLICATE_BUSINESS', 'JOB_NOT_FOUND', 'JOB_NOT_RETRYABLE', 'CLAIM_INVALID'] as const;
export type ProvisioningApiErrorCode = (typeof PROVISIONING_API_ERROR_CODES)[number];

const MESSAGES: Record<string, string> = {
  DUPLICATE_BUSINESS: 'A business with this email or phone number already exists.',
  UNKNOWN_TRACK: 'The track is not one of handyman, professional or ecommerce.',
  UNKNOWN_PLAN: 'The Free plan for this track is not set up.',
  UNKNOWN_VENDOR: 'The business record for this job could not be found.',
  LIVE_DISABLED: 'Live email sending is switched off.',
  BAD_ADDRESS: 'The owner email address was refused.',
  ADAPTER_TIMEOUT: 'The email service did not answer in time.',
  DB_BUSY: 'The database was busy. The job will be tried again.',
  LEASE_LOST: 'Another runner took over this job.',
  INVALID_INPUT: 'The business details in this job are not valid.',
  SITE_BUILD_REFUSED: 'The site draft could not be built from the business details.',
  UNEXPECTED: 'An unexpected error stopped this step. The job will be tried again.',
};

export function sanitisedMessage(code: string): string {
  return MESSAGES[code] ?? MESSAGES.UNEXPECTED;
}

/** Thrown by a step. `retryable` = transient (try again later); false = permanent (the job fails at once). */
export class StepError extends Error {
  constructor(readonly code: string, readonly retryable: boolean, readonly extra: Record<string, string> = {}) {
    super(sanitisedMessage(code));
    this.name = 'StepError';
  }
}

export interface Classified { code: string; retryable: boolean }

const DB_TRANSIENT = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2034']);

/** Permanent or transient? Unknown errors are retried until the attempt limit, and recorded only as UNEXPECTED. */
export function classifyError(e: unknown): Classified {
  if (e instanceof StepError) return { code: e.code, retryable: e.retryable };
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && DB_TRANSIENT.has(code)) return { code: 'DB_BUSY', retryable: true };
  return { code: 'UNEXPECTED', retryable: true };
}
