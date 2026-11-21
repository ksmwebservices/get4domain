import { createHash } from 'crypto';

/** Pure rules of the requests half of slice 5.14. No clock, randomness source, network or database is read here: the caller passes them in. */

export type RequestKind = 'ENQUIRY' | 'APPOINTMENT' | 'QUOTE' | 'PRODUCT_ENQUIRY' | 'ORDER_REQUEST' | 'ORDER';
export type RequestStatus = 'RECEIVED' | 'DELIVERED' | 'SEEN' | 'RESPONDED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'EXPIRED' | 'SPAM';
export const PUBLIC_KINDS: readonly RequestKind[] = ['ENQUIRY', 'APPOINTMENT', 'QUOTE', 'PRODUCT_ENQUIRY'];

// ── the state machine ───────────────────────────────────────────────────────────────────────────────────────────

const NEXT: Record<RequestStatus, readonly RequestStatus[]> = {
  RECEIVED: ['DELIVERED', 'SEEN', 'RESPONDED', 'SPAM', 'EXPIRED', 'CLOSED'],
  DELIVERED: ['SEEN', 'RESPONDED', 'SPAM', 'EXPIRED', 'CLOSED'],
  SEEN: ['RESPONDED', 'CONFIRMED', 'SPAM', 'EXPIRED', 'CLOSED'],
  RESPONDED: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'EXPIRED'],
  CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CLOSED'],
  IN_PROGRESS: ['COMPLETED', 'CLOSED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [], EXPIRED: [], SPAM: [],
};
export const REQUEST_STATUSES = Object.keys(NEXT) as RequestStatus[];
/** the system moves a request to these; a vendor never sets them by hand */
const SYSTEM_ONLY: readonly RequestStatus[] = ['RECEIVED', 'DELIVERED', 'EXPIRED'];

export function canTransition(from: RequestStatus, to: RequestStatus): boolean { return NEXT[from].includes(to); }
export function vendorMayMove(from: RequestStatus, to: RequestStatus): boolean { return canTransition(from, to) && !SYSTEM_ONLY.includes(to); }
export const isTerminal = (s: RequestStatus): boolean => NEXT[s].length === 0;

// ── expiry and metrics ──────────────────────────────────────────────────────────────────────────────────────────

export function expiresAtFor(created: Date, days: number): Date { return new Date(created.getTime() + days * 86_400_000); }
/** A request nobody answered by its expiry date. A responded request does not expire. */
export function isExpired(r: { status: RequestStatus; expiresAt: Date }, now: Date): boolean {
  return (r.status === 'RECEIVED' || r.status === 'DELIVERED' || r.status === 'SEEN') && now.getTime() >= r.expiresAt.getTime();
}
export function responseMinutes(createdAt: Date, firstResponseAt: Date | null): number | null {
  return firstResponseAt ? Math.max(0, Math.round((firstResponseAt.getTime() - createdAt.getTime()) / 60_000)) : null;
}
export function summarise(rs: ReadonlyArray<{ status: RequestStatus; createdAt: Date; firstResponseAt: Date | null }>): { total: number; awaiting: number; byStatus: Partial<Record<RequestStatus, number>>; responded: number; medianResponseMinutes: number | null } {
  const byStatus: Partial<Record<RequestStatus, number>> = {};
  for (const r of rs) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const times = rs.map((r) => responseMinutes(r.createdAt, r.firstResponseAt)).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const mid = Math.floor(times.length / 2);
  return {
    total: rs.length, byStatus, responded: times.length,
    awaiting: rs.filter((r) => r.status === 'RECEIVED' || r.status === 'DELIVERED' || r.status === 'SEEN').length,
    medianResponseMinutes: times.length === 0 ? null : times.length % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2),
  };
}
/** Requests that still wait for the vendor after `afterMinutes` since they arrived (the nudge). */
export function needsNudge(r: { status: RequestStatus; createdAt: Date; firstResponseAt: Date | null }, now: Date, afterMinutes: number): boolean {
  return (r.status === 'RECEIVED' || r.status === 'DELIVERED' || r.status === 'SEEN') && r.firstResponseAt === null && now.getTime() - r.createdAt.getTime() >= afterMinutes * 60_000;
}

// ── tracking tokens ─────────────────────────────────────────────────────────────────────────────────────────────

/** 32 random bytes: 256 bits, URL safe. Only the hash is stored; a wrong token and an expired one look identical (the service answers the same 404). */
export const newTrackingToken = (rand: (n: number) => Buffer): string => rand(32).toString('base64url');
export const hashTrackingToken = (t: string): string => createHash('sha256').update(`track:${t}`).digest('hex');
export const looksLikeTrackingToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);

// ── consent text ────────────────────────────────────────────────────────────────────────────────────────────────

export const consentTextHash = (text: string): string => createHash('sha256').update(text).digest('hex');
/** The consent a customer gave must refer to the text version that is current NOW; a stale or missing version is refused. */
export function consentValid(c: { contactByBusiness?: unknown; contactByPlatform?: unknown; marketing?: unknown; textVersion?: unknown } | undefined, currentVersion: number): boolean {
  return !!c && c.contactByBusiness === true && c.textVersion === currentVersion && typeof c.contactByPlatform === 'boolean' && typeof c.marketing === 'boolean';
}

// ── payload validation per kind ─────────────────────────────────────────────────────────────────────────────────

const str = (v: unknown, min: number, max: number): string | null => { if (typeof v !== 'string') return null; const t = v.trim().replace(/\s+/g, ' '); return t.length >= min && t.length <= max ? t : null; };
const ALLOWED: Record<string, readonly string[]> = {
  ENQUIRY: ['message'], APPOINTMENT: ['preferredAt', 'service', 'message'], QUOTE: ['service', 'details', 'budget'], PRODUCT_ENQUIRY: ['productRef', 'message'],
};
/** Each public kind has a fixed, small set of fields; an unknown field is refused (nothing is stored that was not asked for). */
export function validatePayload(kind: RequestKind, raw: unknown): { ok: true; payload: Record<string, string> } | { ok: false; errors: string[] } {
  if (!PUBLIC_KINDS.includes(kind)) return { ok: false, errors: ['kind: not a request a visitor can send'] };
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const errors: string[] = []; const out: Record<string, string> = {};
  for (const k of Object.keys(src)) if (!ALLOWED[kind].includes(k)) errors.push(`${k}: not a field of ${kind}`);
  const take = (k: string, min: number, max: number, required: boolean): void => {
    if (src[k] === undefined || src[k] === '') { if (required) errors.push(`${k}: required`); return; }
    const v = str(src[k], min, max); if (!v) errors.push(`${k}: ${min} to ${max} characters`); else out[k] = v;
  };
  if (kind === 'ENQUIRY') take('message', 2, 1000, true);
  if (kind === 'APPOINTMENT') {
    take('service', 2, 120, false); take('message', 2, 1000, false);
    const at = typeof src.preferredAt === 'string' ? Date.parse(src.preferredAt) : NaN;
    if (Number.isNaN(at)) errors.push('preferredAt: a date and time is required'); else out.preferredAt = new Date(at).toISOString();
  }
  if (kind === 'QUOTE') { take('service', 2, 120, true); take('details', 2, 1500, true); take('budget', 1, 60, false); }
  if (kind === 'PRODUCT_ENQUIRY') { take('productRef', 1, 80, true); take('message', 2, 1000, false); }
  return errors.length ? { ok: false, errors } : { ok: true, payload: out };
}

// ── spam ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SpamInput {
  honeypot: unknown; blocked: boolean; duplicateRecent: boolean; fromPhoneLastHour: number; fromIpLastHour: number; text: string;
}
/** A score from 0 to 100 and the reasons. The thresholds are settings (spamScoreOtpThreshold asks for a phone code, spamScoreBlockThreshold stores the request as SPAM and delivers nothing). */
export function spamScore(i: SpamInput): { score: number; reasons: string[] } {
  const reasons: string[] = []; let score = 0;
  if (i.blocked) { score = 100; reasons.push('BLOCKLIST'); }
  if (typeof i.honeypot === 'string' && i.honeypot.trim() !== '') { score = 100; reasons.push('HONEYPOT'); }
  if (i.duplicateRecent) { score += 60; reasons.push('DUPLICATE'); }
  if (i.fromPhoneLastHour >= 3) { score += 40; reasons.push('PHONE_RATE'); }
  if (i.fromIpLastHour >= 10) { score += 30; reasons.push('IP_RATE'); }
  if ((i.text.match(/https?:\/\/|www\./gi) ?? []).length >= 3) { score += 30; reasons.push('LINKS'); }
  return { score: Math.min(100, score), reasons };
}
export function spamDecision(score: number, t: { otp: number; block: number }): 'ACCEPT' | 'ASK_OTP' | 'BLOCK' { return score >= t.block ? 'BLOCK' : score >= t.otp ? 'ASK_OTP' : 'ACCEPT'; }
/** The same sender, the same kind and the same words inside a window is a duplicate. */
export function duplicateKey(phone: string, kind: string, payload: Record<string, string>): string { return createHash('sha256').update(`${phone}|${kind}|${JSON.stringify(payload)}`).digest('hex'); }
