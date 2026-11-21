import { createHmac, timingSafeEqual } from 'crypto';
import { ResolvedEntitlements } from '../../plans/entitlements/entitlement-engine';

/** Pure rules of mail (Amendment 12 Q3 and Q5). No clock reads, no network, no environment reads except through functions that take `env`. */
export type Env = Readonly<Record<string, string | undefined>>;

/**
 * THE HARD RULE (Amendment 12 Q3): lane 1 (system) and lane 2 (vendor official) can never carry promotion. The set of kinds a lane may send is closed and has no promotional member;
 * a kind that is not on the list is refused by `assertTransactional` before any adapter is called, and a message always has exactly one recipient (no bulk).
 */
export const LANE1_KINDS = ['OTP', 'RECEIPT', 'ACCOUNT_NOTICE', 'ENQUIRY_FORWARD'] as const;
export const LANE2_KINDS = ['ENQUIRY_REPLY', 'QUOTATION', 'ORDER'] as const;
export type Lane1Kind = (typeof LANE1_KINDS)[number];
export type MailLane = 'SYSTEM' | 'VENDOR_OFFICIAL';
export const KINDS_BY_LANE: Readonly<Record<MailLane, readonly string[]>> = { SYSTEM: LANE1_KINDS, VENDOR_OFFICIAL: LANE2_KINDS };

export interface OutboundEmail { lane: MailLane; kind: string; to: string; subject: string; text: string; replyTo?: string | null; fromName?: string | null }

export const looksLikeEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(v);
/** Header injection: a subject or a name may not carry a line break. */
export const hasLineBreak = (v: string): boolean => /[\r\n]/.test(v);

export type MailProblem = { code: 'EMAIL_KIND_FORBIDDEN' | 'EMAIL_INVALID'; message: string };
export function assertTransactional(m: OutboundEmail): MailProblem | null {
  if (!KINDS_BY_LANE[m.lane]?.includes(m.kind)) return { code: 'EMAIL_KIND_FORBIDDEN', message: 'That kind of message cannot be sent from this lane.' };
  if (!looksLikeEmail(m.to) || (m.replyTo != null && !looksLikeEmail(m.replyTo))) return { code: 'EMAIL_INVALID', message: 'A message goes to exactly one valid address.' };
  if (hasLineBreak(m.subject) || (m.fromName != null && hasLineBreak(m.fromName)) || m.subject.length === 0 || m.subject.length > 200) return { code: 'EMAIL_INVALID', message: 'The subject is not valid.' };
  return null;
}

const on = (v: string | undefined): boolean => v === 'true';
/** Both flags default OFF. EMAIL_LIVE_SEND lets one-time codes and receipts out; EMAIL_FORWARD_LIVE lets enquiry forwarding out. */
export const mailFlags = (env: Env): { send: boolean; forward: boolean } => ({ send: on(env.EMAIL_LIVE_SEND), forward: on(env.EMAIL_FORWARD_LIVE) });
export const flagFor = (kind: string, env: Env): boolean => (kind === 'ENQUIRY_FORWARD' ? mailFlags(env).forward : mailFlags(env).send);

// ── the enquiry inbox ──
const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** `anything@acme.get4domain.com` belongs to the business whose subdomain is `acme`. Anything else (the bare base domain, a deeper name, another domain) belongs to nobody. */
export function subdomainOfAddress(to: string, baseDomain: string): string | null {
  const at = to.lastIndexOf('@'); if (at < 1) return null;
  const host = to.slice(at + 1).trim().toLowerCase(); const base = baseDomain.toLowerCase();
  if (!host.endsWith(`.${base}`)) return null;
  const sub = host.slice(0, host.length - base.length - 1);
  return SUBDOMAIN.test(sub) ? sub : null;
}

/** A vendor can use the inbox while the plan stands: an active or grace-period subscription on a V3 plan that is not suspended. */
export const planActive = (e: Pick<ResolvedEntitlements, 'mode' | 'suspended' | 'subscriptionStatus'>): boolean => e.mode === 'V3' && !e.suspended && (e.subscriptionStatus === 'ACTIVE' || e.subscriptionStatus === 'GRACE');

/** Signed request from the Cloudflare Email Worker: header `t=<unix seconds>,v1=<hex hmac-sha256 of "<t>.<raw body>">`. Replays older than the tolerance are refused. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;
export function signatureHeader(secret: string, rawBody: string, nowSeconds: number): string {
  return `t=${nowSeconds},v1=${createHmac('sha256', secret).update(`${nowSeconds}.${rawBody}`).digest('hex')}`;
}
export function verifySignature(secret: string | undefined, header: string | undefined, rawBody: string, nowSeconds: number): boolean {
  if (!secret || !header) return false;
  const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header); if (!m) return false;
  if (Math.abs(nowSeconds - Number(m[1])) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const want = createHmac('sha256', secret).update(`${m[1]}.${rawBody}`).digest(); const got = Buffer.from(m[2], 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

export interface InboundInput { to: string; from: string; fromName: string | null; subject: string; text: string; messageId: string | null; spamScore: number | null; sizeBytes: number }
export type InboundCheck = { ok: true; value: InboundInput } | { ok: false; problems: string[] };
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);
export function checkInbound(b: Record<string, unknown>): InboundCheck {
  const problems: string[] = [];
  const to = str(b.to, 254)?.trim().toLowerCase() ?? ''; const from = str(b.from, 254)?.trim().toLowerCase() ?? '';
  if (!looksLikeEmail(to)) problems.push('to is not a valid address'); if (!looksLikeEmail(from)) problems.push('from is not a valid address');
  const subject = (str(b.subject, 998) ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  const text = str(b.text, 5_000_000); if (text === null) problems.push('text is missing or too long');
  const fromName = b.fromName == null ? null : str(b.fromName, 200)?.replace(/[\r\n]+/g, ' ').trim() || null;
  const messageId = b.messageId == null ? null : str(b.messageId, 300);
  const spamScore = b.spamScore == null ? null : typeof b.spamScore === 'number' && Number.isFinite(b.spamScore) ? b.spamScore : NaN;
  if (Number.isNaN(spamScore)) problems.push('spamScore is not a number');
  const size = Number(b.sizeBytes); if (!Number.isInteger(size) || size < 0) problems.push('sizeBytes is not a whole number');
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { to, from, fromName, subject, text: text!, messageId, spamScore, sizeBytes: size } };
}

export type SpamVerdict = 'CLEAN' | 'SPAM';
/** A message scoring above the threshold is kept but marked SPAM and never forwarded. No score means no verdict is invented: CLEAN. */
export const spamVerdict = (score: number | null, threshold: number): SpamVerdict => (score !== null && score > threshold ? 'SPAM' : 'CLEAN');
export const underRateLimit = (countInWindow: number, limit: number): boolean => countInWindow < limit;

/** The forwarded text: the original message, introduced by who it came from. Reply-To carries the original sender, so a plain reply reaches them. */
export function forwardText(m: { from: string; fromName: string | null; subject: string; text: string }): string {
  return `New enquiry from ${m.fromName ? `${m.fromName} <${m.from}>` : m.from}\n\n${m.text}`;
}
export const forwardSubject = (s: string): string => (s ? `Enquiry: ${s}` : 'Enquiry').slice(0, 200);
