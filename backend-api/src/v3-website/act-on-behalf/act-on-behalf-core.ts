/**
 * Act on behalf of a vendor (slice 5.13b), pure. A staff member opens a SESSION for one vendor with a written reason; the vendor is told; every request the staff member makes inside it names the
 * session in a header and is logged against that vendor with the session id, so the vendor sees every action. A session ends by itself after a staff setting (no default). Inside a session staff can
 * never CHANGE a payment method, a bank detail, a UPI id, a payee or a password. Reading the masked view stays allowed.
 */
export const SESSION_HEADER = 'x-act-on-behalf-session';

const FORBIDDEN_WORDS = /(payment-method|payment-request|upi|bank|password|payee)/i;

/** True when a request must be refused inside a session: any change (not a read) on a route whose path names one of the forbidden things. Route parameters (":upi") are not path words. */
export function isForbiddenInSession(method: string, routePattern: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
  return routePattern.split('/').filter((s) => s && !s.startsWith(':')).some((s) => FORBIDDEN_WORDS.test(s));
}

/** The staff roles that may end a session that is not their own. A list, not an inline role check: who may do what stays in data (the role matrix decides who may reach the route at all). */
export const MAY_END_ANY_SESSION: readonly string[] = ['SUPER_ADMIN'];

export type SessionState = 'ACTIVE' | 'ENDED' | 'EXPIRED';

/** ENDED once someone ended it; EXPIRED from the moment its time is up (the moment itself counts as expired); else ACTIVE. */
export function stateOf(s: { endedAt: Date | null; expiresAt: Date }, now: Date): SessionState {
  if (s.endedAt) return 'ENDED';
  return now.getTime() >= s.expiresAt.getTime() ? 'EXPIRED' : 'ACTIVE';
}

export const expiryFor = (start: Date, minutes: number): Date => new Date(start.getTime() + minutes * 60_000);
