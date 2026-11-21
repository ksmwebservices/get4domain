/** Stable machine codes of AI Studio (slice 5.11). A screen switches on `code`, never on the sentence. FEATURE_LOCKED and LIMIT_REACHED are the existing slice 5.1 plan codes. */
export const AI_ERROR_CODES = ['AI_INVALID', 'AI_NOT_CONFIGURED', 'AI_PROVIDER_ERROR', 'AI_PROVIDER_NOT_FOUND', 'AI_PROVIDER_EXISTS', 'AI_PROMPT_INVALID', 'AI_PROMPT_NOT_FOUND', 'AI_IDEMPOTENCY_CONFLICT'] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];
export function aiError(code: AiErrorCode, message: string): { message: string; code: AiErrorCode } { return { message, code }; }
export const AI_LABEL = 'AI-generated suggestion. Read it and edit it before you use it; it is not published for you.';
