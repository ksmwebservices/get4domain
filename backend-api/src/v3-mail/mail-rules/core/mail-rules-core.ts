/**
 * Pure rules of the mail lanes and promotion limits (Amendment 12 Q3 and Q4), recorded as data. NOTHING here sends: lane 2 and lane 3 sending is a later release, and these functions only answer
 * "what do the recorded rules say". No number is built in: every limit comes from settings and an unset limit answers "not allowed" (never a default).
 */
export const LANE_KEYS = ['SYSTEM', 'VENDOR_OFFICIAL', 'PROMOTIONS'] as const;
export type LaneKey = (typeof LANE_KEYS)[number];
/** Only the promotions lane may ever carry promotion. Lane 1 and lane 2 never do. */
export const lanePromotionAllowed = (k: LaneKey): boolean => k === 'PROMOTIONS';

export const PRICE_KINDS = ['FORWARDING', 'INCLUDED', 'ADD_ON', 'EXTRA'] as const;
export const PRICE_SCOPES = ['ANY', 'PROFESSIONAL', 'ECOMMERCE', 'HANDYMAN'] as const;
export type PriceStatus = 'PENDING' | 'ACTIVE';
export interface MailboxPriceFacts { kind: string; scope: string; pricePaise: number | null; includedCount: number | null; status: PriceStatus }
/** A price can be switched on only when it states what it is: an amount in whole paise (zero is allowed for forwarding and included mailboxes), or a count for an included one. */
export function priceReady(p: MailboxPriceFacts): boolean {
  if (p.status !== 'PENDING') return false;
  if (p.kind === 'INCLUDED') return Number.isInteger(p.includedCount) && (p.includedCount as number) >= 1;
  return Number.isSafeInteger(p.pricePaise) && (p.pricePaise as number) >= 0;
}

export interface PromoLimits {
  perDay: number | null; perMonth: number | null; warmupDaily: number[] | null; complaintPausePercent: number | null; bouncePausePercent: number | null;
}
/**
 * The most a vendor may send today under the recorded rules. A vendor in its warm-up period is held to the warm-up schedule (day 0 is the first send day; past the schedule the normal daily limit applies);
 * the normal daily limit is the ceiling at all times. Any limit that is unset answers 0: no sending is allowed until staff record the rules.
 */
export function dailyAllowance(daysSinceFirstSend: number | null, l: PromoLimits): number {
  if (l.perDay === null) return 0;
  if (l.warmupDaily === null || l.warmupDaily.length === 0) return l.perDay;
  const day = Math.max(0, daysSinceFirstSend ?? 0);   // a vendor that has never sent is on warm-up day 0
  return day >= l.warmupDaily.length ? l.perDay : Math.min(l.warmupDaily[day], l.perDay);
}
/** Whether the complaint or bounce rate has crossed the recorded limit and the vendor's promotions must pause automatically. Unset limits never pause (nothing is sent without rules anyway). */
export function mustPause(r: { complaintPercent: number; bouncePercent: number }, l: Pick<PromoLimits, 'complaintPausePercent' | 'bouncePausePercent'>): { pause: boolean; because: Array<'COMPLAINTS' | 'BOUNCES'> } {
  const because: Array<'COMPLAINTS' | 'BOUNCES'> = [];
  if (l.complaintPausePercent !== null && r.complaintPercent >= l.complaintPausePercent) because.push('COMPLAINTS');
  if (l.bouncePausePercent !== null && r.bouncePercent >= l.bouncePausePercent) because.push('BOUNCES');
  return { pause: because.length > 0, because };
}

/** What a stored opt-in proof must show, as recorded in settings. A contact whose proof lacks a required field cannot be mailed. No required fields recorded means no proof can be complete. */
export function optInProofComplete(proof: Readonly<Record<string, unknown>>, required: readonly string[] | null): { complete: boolean; missing: string[] } {
  if (required === null || required.length === 0) return { complete: false, missing: [] };
  const missing = required.filter((f) => { const v = proof[f]; return v === undefined || v === null || (typeof v === 'string' && v.trim() === ''); });
  return { complete: missing.length === 0, missing };
}
export const OPT_IN_PROOF_FIELDS = ['source', 'consentedAt', 'consentTextVersion', 'addressHash', 'channel'] as const;
