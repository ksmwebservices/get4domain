/**
 * The pure rules of a service request (slice 5.16c). PURE: no database, no Nest, no clock (the caller passes `now`). Nothing here knows a price.
 *
 * The life of a request:  REQUESTED -> ACCEPTED -> IN_PRODUCTION -> READY_FOR_REVIEW -> APPROVED, with REVISION_REQUESTED looping back to IN_PRODUCTION, and REJECTED_BY_TEAM or CANCELLED as the ends
 * that cost the vendor nothing. Money (owner rule 1): a wallet-funded request HOLDS the amount when it is made, CHARGES that hold when the vendor APPROVES the work, and RELEASES it on cancel or
 * rejection. Nothing is charged for work the vendor has not approved.
 */
export const REQUEST_STATUSES = ['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED_BY_TEAM', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const TERMINAL_STATUSES: readonly RequestStatus[] = ['APPROVED', 'REJECTED_BY_TEAM', 'CANCELLED'];
export type RequestActor = 'VENDOR' | 'TEAM' | 'SYSTEM';
export type FundingKind = 'INCLUDED_ALLOWANCE' | 'PACK' | 'WALLET';

const EDGES: Record<RequestStatus, Partial<Record<RequestStatus, readonly RequestActor[]>>> = {
  REQUESTED: { ACCEPTED: ['TEAM'], REJECTED_BY_TEAM: ['TEAM'], CANCELLED: ['VENDOR'] },
  ACCEPTED: { IN_PRODUCTION: ['TEAM'], REJECTED_BY_TEAM: ['TEAM'], CANCELLED: ['VENDOR'] },
  IN_PRODUCTION: { READY_FOR_REVIEW: ['TEAM'], REJECTED_BY_TEAM: ['TEAM'] },
  READY_FOR_REVIEW: { APPROVED: ['VENDOR', 'SYSTEM'], REVISION_REQUESTED: ['VENDOR'], REJECTED_BY_TEAM: ['TEAM'] },
  REVISION_REQUESTED: { IN_PRODUCTION: ['TEAM'], REJECTED_BY_TEAM: ['TEAM'] },
  APPROVED: {}, REJECTED_BY_TEAM: {}, CANCELLED: {},
};
export const allowedNext = (from: RequestStatus, by: RequestActor): RequestStatus[] => (Object.entries(EDGES[from] ?? {}) as Array<[RequestStatus, readonly RequestActor[]]>).filter(([, who]) => who.includes(by)).map(([to]) => to);

export type TransitionProblem = 'NOT_ALLOWED' | 'DELIVERABLE_REQUIRED' | 'GRANT_DATE_REQUIRED' | 'REVISION_LIMIT' | 'REASON_REQUIRED';
export interface TransitionInput {
  from: RequestStatus; to: RequestStatus; by: RequestActor; hasDeliverable: boolean; serviceKey: string; grantEndsAt: Date | null; revisionsUsed: number; maxRevisions: number | null; reason: string | null;
}
/** May this step be taken by this actor now? The conditions are the ones the owner named: a deliverable to review, the end date of the promotion, the revision limit staff set, and a reason for a rejection. */
export function checkTransition(i: TransitionInput): { ok: true } | { ok: false; problem: TransitionProblem } {
  if (!allowedNext(i.from, i.by).includes(i.to)) return { ok: false, problem: 'NOT_ALLOWED' };
  if (i.to === 'READY_FOR_REVIEW') {
    if (!i.hasDeliverable) return { ok: false, problem: 'DELIVERABLE_REQUIRED' };
    if (i.serviceKey === 'CUSTOM_DOMAIN_PROMOTION' && !i.grantEndsAt) return { ok: false, problem: 'GRANT_DATE_REQUIRED' };
  }
  if (i.to === 'REVISION_REQUESTED' && (i.maxRevisions === null || i.revisionsUsed >= i.maxRevisions)) return { ok: false, problem: 'REVISION_LIMIT' };
  if (i.to === 'REJECTED_BY_TEAM' && !(typeof i.reason === 'string' && i.reason.trim().length >= 5)) return { ok: false, problem: 'REASON_REQUIRED' };
  return { ok: true };
}

export type MoneyEffect = 'NONE' | 'RELEASE_HOLD' | 'CHARGE_HOLD' | 'CONSUME_PACK';
export function moneyEffect(funding: FundingKind, to: RequestStatus): MoneyEffect {
  if (to === 'APPROVED') return funding === 'WALLET' ? 'CHARGE_HOLD' : funding === 'PACK' ? 'CONSUME_PACK' : 'NONE';
  if ((to === 'CANCELLED' || to === 'REJECTED_BY_TEAM') && funding === 'WALLET') return 'RELEASE_HOLD';
  return 'NONE';
}

// ───────────────────────────────────────────────────────────────────────────────────────── the brief
const HOST = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const THEME_KEY = /^[a-z0-9][a-z0-9-]{1,60}$/;
const ALWAYS = ['details', 'contact', 'notes'] as const;
const EXTRA: Record<string, readonly string[]> = { DOMAIN_CONNECT_HELP: ['domain'], CUSTOM_DOMAIN_PROMOTION: ['domain'], THEME_SWITCH: ['themeKey'], SOCIAL_MANAGEMENT_REQUEST: ['platform'] };
const plain = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max && !/[<>]/.test(v);

/** The vendor's brief for a service: plain words only, the fields that service uses and no others. Returns plain problems; empty = fine. */
export function validateBrief(serviceKey: string, brief: unknown): string[] {
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) return ['Tell us what you need in the details.'];
  const b = brief as Record<string, unknown>; const out: string[] = [];
  const allowed = new Set<string>([...ALWAYS, ...(EXTRA[serviceKey] ?? [])]);
  for (const k of Object.keys(b)) if (!allowed.has(k)) out.push(`"${k}" is not used for this service.`);
  if (!plain(b.details, 10, 2000)) out.push('The details must be 10 to 2000 plain characters.');
  if (b.contact !== undefined && !plain(b.contact, 1, 200)) out.push('The contact line must be up to 200 plain characters.');
  if (b.notes !== undefined && !plain(b.notes, 1, 1000)) out.push('The notes must be up to 1000 plain characters.');
  if ((EXTRA[serviceKey] ?? []).includes('domain') && !(typeof b.domain === 'string' && HOST.test(b.domain))) out.push('The domain must be a host name such as shop.example.com (no http:// and no path).');
  if (serviceKey === 'THEME_SWITCH' && !(typeof b.themeKey === 'string' && THEME_KEY.test(b.themeKey))) out.push('Choose a theme.');
  if (serviceKey === 'SOCIAL_MANAGEMENT_REQUEST' && !plain(b.platform, 2, 40)) out.push('Say which platform the post is for.');
  return out;
}

// ───────────────────────────────────────────────────────────────────────────────────────── timers
const DAY_MS = 86_400_000;
/** Auto-approval is OFF unless staff switch it on AND set the number of days; then work that has waited that long in review is approved for the vendor. */
export function isAutoApprovable(r: { status: RequestStatus; readyAt: Date | null }, now: Date, s: { enabled: boolean; afterDays: number | null }): boolean {
  if (!s.enabled || s.afterDays === null || r.status !== 'READY_FOR_REVIEW' || !r.readyAt) return false;
  return now.getTime() - r.readyAt.getTime() >= s.afterDays * DAY_MS;
}
/** Past its SLA: the due time has gone, the team has the ball (not waiting for the vendor), the request is open, and the breach has not been marked yet. */
export function isSlaBreached(r: { status: RequestStatus; slaDueAt: Date | null; slaBreachedAt: Date | null }, now: Date): boolean {
  if (!r.slaDueAt || r.slaBreachedAt) return false;
  if (!(['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'REVISION_REQUESTED'] as RequestStatus[]).includes(r.status)) return false;
  return now.getTime() > r.slaDueAt.getTime();
}
