import { BadRequestException, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';

export type AiProviderName = 'openai' | 'anthropic';
export type AiErrorKind = 'INVALID_KEY' | 'NO_CREDIT' | 'RATE_LIMIT' | 'CONTENT_BLOCKED' | 'TIMEOUT' | 'UNAVAILABLE';

/** A failed provider call, already classified. `detail` is for server logs and ai-health only — never shown to a vendor. */
export class AiProviderError extends Error {
  constructor(readonly provider: AiProviderName, readonly kind: AiErrorKind, readonly status: number | null, readonly detail: string) {
    super(`${provider} ${kind}${status ? ` (HTTP ${status})` : ''}`);
  }
}

/**
 * What went wrong, from the HTTP status and body (or the thrown error for a timeout / network failure).
 * Order matters: OpenAI reports "out of credit" as HTTP 429, so quota is tested BEFORE rate limit.
 */
export function classifyProviderError(status: number | null, body: string, thrown?: unknown): AiErrorKind {
  if (thrown !== undefined && status === null) {
    const name = thrown instanceof Error ? thrown.name : '';
    const msg = thrown instanceof Error ? thrown.message.toLowerCase() : String(thrown).toLowerCase();
    if (name === 'AbortError' || name === 'TimeoutError' || msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) return 'TIMEOUT';
    return 'UNAVAILABLE';
  }
  const b = (body || '').toLowerCase();
  if (status === 401 || status === 403 || b.includes('invalid_api_key') || b.includes('incorrect api key') || b.includes('authentication_error') || b.includes('invalid x-api-key')) return 'INVALID_KEY';
  if (status === 402 || b.includes('insufficient_quota') || b.includes('billing_hard_limit') || b.includes('exceeded your current quota') || b.includes('credit balance is too low') || b.includes('billing_not_active')) return 'NO_CREDIT';
  if (b.includes('content_policy_violation') || b.includes('content_filter') || b.includes('safety system') || b.includes('rejected as a result of our safety')) return 'CONTENT_BLOCKED';
  if (status === 429 || status === 529 || b.includes('rate_limit') || b.includes('overloaded')) return 'RATE_LIMIT';
  if (status === 408 || status === 504) return 'TIMEOUT';
  return 'UNAVAILABLE';
}

/** What the VENDOR is told. Specific enough to act on, never naming keys, providers' accounts or internals. */
export const VENDOR_MESSAGE: Record<AiErrorKind, string> = {
  INVALID_KEY: 'AI Studio is unavailable right now because of a setup problem on our side. We have been alerted — nothing was charged to your wallet.',
  NO_CREDIT: 'AI Studio is paused because our AI provider account is out of credit. We have been alerted — nothing was charged to your wallet.',
  RATE_LIMIT: 'AI Studio is very busy right now. Please try again in a minute — nothing was charged to your wallet.',
  CONTENT_BLOCKED: 'The AI declined this request because of its content rules. Please reword it (for example, avoid real people, brands or sensitive topics) and try again — nothing was charged.',
  TIMEOUT: 'The AI took too long to answer. Please try again — nothing was charged to your wallet.',
  UNAVAILABLE: 'AI Studio is temporarily unavailable. Please try again shortly — nothing was charged to your wallet.',
};

/** HTTP exception for a classified failure: the vendor-facing message plus a machine code in `details` (the screen can branch on it). */
export function toVendorException(kind: AiErrorKind): HttpException {
  const body = { message: VENDOR_MESSAGE[kind], code: `AI_${kind}`, details: { code: `AI_${kind}` } };
  if (kind === 'CONTENT_BLOCKED') return new BadRequestException(body);
  if (kind === 'RATE_LIMIT') return new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
  return new ServiceUnavailableException(body);
}

/** Of several provider failures, the one to report: a content block wins (it is the vendor's to fix), otherwise the first provider tried. */
export function pickError(errors: AiProviderError[]): AiProviderError {
  return errors.find((e) => e.kind === 'CONTENT_BLOCKED') ?? errors[0];
}
