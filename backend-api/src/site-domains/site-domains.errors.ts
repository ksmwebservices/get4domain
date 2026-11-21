/**
 * Stable machine codes of the domain slice (docs/v3/V3_S5_BATCH2.md). A screen switches on `code`, never on the sentence. The HTTP exception filter passes them through
 * (additive to the plan, provisioning and site codes). FEATURE_LOCKED for a plan lock is the existing slice 5.1 code.
 *
 * Uniform refusals: a host that is taken by another vendor, quarantined, or blocked all answer HOST_UNAVAILABLE with the same sentence, so the API is not an oracle
 * for who owns what. A domain id that belongs to another vendor answers DOMAIN_NOT_FOUND, exactly like one that does not exist.
 */
export const DOMAIN_ERROR_CODES = ['SUBDOMAIN_INVALID', 'SUBDOMAIN_RESERVED', 'HOST_UNAVAILABLE', 'SUBDOMAIN_CHANGE_LIMIT', 'DOMAIN_INVALID', 'DOMAIN_NOT_FOUND', 'VERIFY_TOO_SOON', 'DOMAIN_STATE_INVALID', 'DOMAIN_LIMIT_REACHED'] as const;
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export function domainError(code: DomainErrorCode, message: string): { message: string; code: DomainErrorCode } { return { message, code }; }

export const HOST_UNAVAILABLE_MESSAGE = 'That address is not available.';
export const DOMAIN_NOT_FOUND_MESSAGE = 'That domain does not exist.';
