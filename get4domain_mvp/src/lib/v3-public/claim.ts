import type { ClaimCallResult, ClaimSearchItem, ListingState } from './types';

/**
 * Pure helpers of the claim flow: how a business in the search becomes a listing state, how an API error becomes a registered code, and what counts as "email is switched off".
 */
export const REGISTERED_CODES: readonly string[] = [
  'OTP_INVALID', 'GRANT_INVALID', 'CLAIM_EMAIL_REQUIRED', 'CLAIM_EMAIL_TAKEN', 'CLAIM_NOT_CLAIMED', 'CLAIM_TERMS_REQUIRED', 'CLAIM_GO_LIVE_UNAVAILABLE',
  'DIRECTORY_NOT_FOUND', 'DIRECTORY_GONE', 'DIRECTORY_INVALID', 'DIRECTORY_STATE_INVALID', 'SEO_NOT_FOUND',
];

/** The state of a listing from the public facts: not claimed, claimed with no site yet, or claimed with a site on its subdomain. DRAFT_SITE is never public today (gap G4). */
export function deriveListingState(v: { claimed: boolean; siteState?: string | null; siteUrl?: string | null; draft?: boolean }): ListingState {
  if (v.draft) return 'DRAFT_SITE';
  if (!v.claimed) return 'UNCLAIMED_LISTING';
  return v.siteUrl || v.siteState === 'PRO' ? 'LIVE' : 'CLAIMED';
}

/** Can a claim be started for this state? Only an unclaimed listing. */
export const canClaim = (s: ListingState): boolean => s === 'UNCLAIMED_LISTING';

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** The machine code and message of an API error body, however the exception filter wrapped it. */
export function errorOf(json: unknown): { code: string | null; message: string | null } {
  if (!json || typeof json !== 'object') return { code: null, message: null };
  const o = json as Record<string, unknown>;
  const inner = (o.data && typeof o.data === 'object' ? (o.data as Record<string, unknown>) : null) ?? (o.error && typeof o.error === 'object' ? (o.error as Record<string, unknown>) : null);
  const message = o.message;
  return {
    code: str(o.code) ?? str(inner?.code),
    message: str(message) ?? (Array.isArray(message) ? str(message[0]) : null) ?? str(inner?.message),
  };
}

/**
 * The email code route can answer that email is switched off. The backend registers no code for it yet (gap G12), so any of these counts:
 * HTTP 503, or a code that names mail or email being off or unavailable.
 */
export function isMailOff(status: number, code: string | null): boolean {
  if (status === 503) return true;
  return !!code && /(MAIL|EMAIL)/i.test(code) && /(OFF|DISABLED|UNAVAILABLE)/i.test(code);
}

/** True when the browser got a usable answer, false when the call never reached the API. */
export const reached = (r: ClaimCallResult): boolean => r.status > 0;

/** Search results with claimed businesses kept (shown, not choosable). */
export const choosable = (items: ClaimSearchItem[]): ClaimSearchItem[] => items.filter((i) => canClaim(i.state));

/** Passwords: the backend asks 8 to 128 characters. */
export const passwordOk = (p: string): boolean => p.length >= 8 && p.length <= 128;
export const codeOk = (c: string): boolean => /^\d{6}$/.test(c);
export const emailOk = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
