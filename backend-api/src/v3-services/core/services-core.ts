/**
 * The pure rules of the service catalogue, the price book and the add-on packs (slice 5.16b). PURE: no database, no Nest, no clock (the caller passes `now`).
 * NOTHING HERE KNOWS A PRICE. A price comes from a row that staff proposed and a SUPER_ADMIN approved with a date; a service without one is "price not set" and cannot be bought with money.
 */
export type PriceStatus = 'PROPOSED' | 'APPROVED' | 'RETIRED';
export interface PriceLite { id: string; amountPaise: number; currency: string; taxCategory: string; taxInclusive: boolean; status: PriceStatus; effectiveFrom: Date | null }

/** The price in force: the APPROVED row with the latest start date that has started. A PROPOSED, RETIRED, undated or not-yet-started row is never in force. */
export function resolvePrice<T extends Pick<PriceLite, 'status' | 'effectiveFrom'>>(rows: readonly T[], now: Date): T | null {
  const live = rows.filter((r) => r.status === 'APPROVED' && r.effectiveFrom !== null && r.effectiveFrom.getTime() <= now.getTime());
  live.sort((a, b) => b.effectiveFrom!.getTime() - a.effectiveFrom!.getTime());
  return live[0] ?? null;
}

export type ApprovalProblem = 'PRICE_NOT_PROPOSED' | 'EFFECTIVE_DATE_REQUIRED' | 'EFFECTIVE_DATE_IN_PAST' | 'EFFECTIVE_DATE_NOT_LATER' | 'EFFECTIVE_DATE_TAKEN';
const CLOCK_SLACK_MS = 60_000;
/**
 * May this PROPOSED row be approved from `effectiveFrom`? It must be proposed, dated, not in the past (a minute of clock difference is forgiven), later than the price in force (or it would
 * never be seen and history would be rewritten), and not the same instant as another row of the same service.
 */
export function approvalProblem(rows: readonly PriceLite[], priceId: string, effectiveFrom: Date | null, now: Date): ApprovalProblem | null {
  const row = rows.find((r) => r.id === priceId);
  if (!row || row.status !== 'PROPOSED') return 'PRICE_NOT_PROPOSED';
  if (!(effectiveFrom instanceof Date) || Number.isNaN(effectiveFrom.getTime())) return 'EFFECTIVE_DATE_REQUIRED';
  if (effectiveFrom.getTime() < now.getTime() - CLOCK_SLACK_MS) return 'EFFECTIVE_DATE_IN_PAST';
  if (rows.some((r) => r.id !== priceId && r.effectiveFrom && r.effectiveFrom.getTime() === effectiveFrom.getTime())) return 'EFFECTIVE_DATE_TAKEN';
  const current = resolvePrice(rows, now);
  if (current && effectiveFrom.getTime() <= current.effectiveFrom!.getTime()) return 'EFFECTIVE_DATE_NOT_LATER';
  return null;
}

// ───────────────────────────────────────────────────────────────────────────────────────── funding (owner rule 1: allowance, then pack, then wallet)
export type FundingKind = 'INCLUDED_ALLOWANCE' | 'PACK' | 'WALLET';
export interface FundingInput {
  /** the plan allowance for this service: the limit staff set on services.included.<KEY> and how many are already used in the current plan term; null = the plan has no such feature */
  allowance: { limit: number | null; used: number } | null;
  /** how many of this service are left in the vendor's packs that have not expired */
  packCount: number;
  /** price plus tax in paise, or null when there is no approved price or the tax cannot be worked out */
  totalMinor: number | null;
  taxProblem?: string | null;
  wallet: { status: 'INACTIVE' | 'ACTIVE' | 'FROZEN'; availablePaise: number } | null;
}
export type FundingChoice =
  | { kind: 'INCLUDED_ALLOWANCE'; remaining: number }
  | { kind: 'PACK'; remaining: number }
  | { kind: 'WALLET'; amountPaise: number }
  | { kind: 'NONE'; reason: 'PRICE_NOT_SET' | 'TAX_NOT_SET' | 'WALLET_NOT_ACTIVE' | 'WALLET_FROZEN' | 'INSUFFICIENT_WALLET'; shortfallPaise?: number; taxProblem?: string };

/** How a request would be paid for. An allowance or a pack was paid for earlier, so it needs no price and no wallet. The wallet pays only when it is ACTIVE and its AVAILABLE money covers the whole amount. */
export function fundingChoice(i: FundingInput): FundingChoice {
  if (i.allowance && i.allowance.limit !== null && i.allowance.used < i.allowance.limit) return { kind: 'INCLUDED_ALLOWANCE', remaining: i.allowance.limit - i.allowance.used };
  if (i.packCount > 0) return { kind: 'PACK', remaining: i.packCount };
  if (i.totalMinor === null) return i.taxProblem ? { kind: 'NONE', reason: 'TAX_NOT_SET', taxProblem: i.taxProblem } : { kind: 'NONE', reason: 'PRICE_NOT_SET' };
  if (!i.wallet || i.wallet.status === 'INACTIVE') return { kind: 'NONE', reason: 'WALLET_NOT_ACTIVE' };
  if (i.wallet.status === 'FROZEN') return { kind: 'NONE', reason: 'WALLET_FROZEN' };
  if (i.wallet.availablePaise < i.totalMinor) return { kind: 'NONE', reason: 'INSUFFICIENT_WALLET', shortfallPaise: i.totalMinor - i.wallet.availablePaise };
  return { kind: 'WALLET', amountPaise: i.totalMinor };
}

// ───────────────────────────────────────────────────────────────────────────────────────── packs
export interface PackItem { serviceKey: string; count: number }
/** null = fine, otherwise a plain sentence. Whole services, whole counts, no repeats, only services that exist. */
export function validatePackItems(items: unknown, knownServiceKeys: ReadonlySet<string>): string | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) return 'A pack lists between 1 and 20 services.';
  const seen = new Set<string>();
  for (const it of items) {
    if (!it || typeof it !== 'object') return 'Each pack item needs a service and a count.';
    const { serviceKey, count } = it as { serviceKey?: unknown; count?: unknown };
    if (typeof serviceKey !== 'string' || !knownServiceKeys.has(serviceKey)) return `"${String(serviceKey)}" is not a service.`;
    if (seen.has(serviceKey)) return `${serviceKey} is listed twice.`;
    seen.add(serviceKey);
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 1000) return `The count for ${serviceKey} must be a whole number from 1 to 1000.`;
  }
  return null;
}

export interface PurchaseLite { id: string; remaining: Record<string, number>; purchasedAt: Date; expiresAt: Date | null }
const live = (p: PurchaseLite, now: Date): boolean => p.expiresAt === null || p.expiresAt.getTime() > now.getTime();
export function packRemainingFor(purchases: readonly PurchaseLite[], serviceKey: string, now: Date): number {
  return purchases.filter((p) => live(p, now)).reduce((t, p) => t + Math.max(0, p.remaining[serviceKey] ?? 0), 0);
}
/** One unit of a service taken from the pack that expires first (a pack that never expires comes last), then the one bought first. Returns the new counts of that purchase, or null when nothing is left. */
export function consumeFromPurchases(purchases: readonly PurchaseLite[], serviceKey: string, now: Date): { purchaseId: string; remaining: Record<string, number> } | null {
  const candidates = purchases.filter((p) => live(p, now) && (p.remaining[serviceKey] ?? 0) > 0)
    .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity) || a.purchasedAt.getTime() - b.purchasedAt.getTime() || (a.id < b.id ? -1 : 1));
  const p = candidates[0];
  return p ? { purchaseId: p.id, remaining: { ...p.remaining, [serviceKey]: p.remaining[serviceKey] - 1 } } : null;
}

// ───────────────────────────────────────────────────────────────────────────────────────── plan state and track
export type ServicePlanRule = 'PRO_ACTIVE_OR_GRACE' | 'ANY';
export interface PlanSnapshot { level: 'FREE' | 'PRO' | null; subscriptionStatus: 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED' | null; suspended: boolean }
/** PRO_ACTIVE_OR_GRACE (the default): only while the Pro plan is ACTIVE or in grace, and the vendor is not suspended. ANY: in every plan state (the balance is never stuck behind a lapsed plan). */
export function planStateAllows(rule: ServicePlanRule, s: PlanSnapshot): boolean {
  if (rule === 'ANY') return true;
  return s.level === 'PRO' && !s.suspended && (s.subscriptionStatus === 'ACTIVE' || s.subscriptionStatus === 'GRACE');
}
export const trackAllows = (trackScope: readonly string[], track: string | null): boolean => trackScope.length === 0 || (track !== null && trackScope.includes(track));

// ───────────────────────────────────────────────────────────────────────────────────────── what staff may write
const DONE_BY = ['VENDOR', 'TEAM', 'EITHER']; const DELIVERY = ['INSTANT', 'TEAM_REQUEST']; const RULES = ['PRO_ACTIVE_OR_GRACE', 'ANY'];
const NO_MARKUP = /[<>]/;
const textOk = (v: unknown, min: number, max: number): boolean => typeof v === 'string' && v.trim().length >= min && v.length <= max && !NO_MARKUP.test(v);

export interface ServiceInput {
  key?: string; name?: string; shortDescription?: string; includesText?: string; approvalText?: string; kind?: string; doneBy?: string; deliveryKind?: string; planStateRule?: string;
  trackScope?: string[]; publicVisible?: boolean; sortOrder?: number;
}
/** A list of plain problems; empty = fine. With `partial` only the fields present are checked, and the key can never change. */
export function validateServiceInput(i: ServiceInput, o: { partial?: boolean } = {}): string[] {
  const out: string[] = []; const has = (k: keyof ServiceInput): boolean => !o.partial || i[k] !== undefined;
  if (o.partial && i.key !== undefined) out.push('The key cannot be changed.');
  if (!o.partial && !(typeof i.key === 'string' && /^[A-Z][A-Z0-9_]{2,40}$/.test(i.key))) out.push('The key must be 3 to 41 capital letters, digits or underscores, starting with a letter.');
  if (has('name') && !textOk(i.name, 2, 80)) out.push('The name must be 2 to 80 plain characters.');
  if (has('shortDescription') && !textOk(i.shortDescription, 5, 200)) out.push('The short description must be 5 to 200 plain characters.');
  if (has('includesText') && !textOk(i.includesText, 5, 800)) out.push('What the service includes must be 5 to 800 plain characters.');
  if (has('approvalText') && !textOk(i.approvalText, 5, 600)) out.push('How approval works must be 5 to 600 plain characters.');
  if (has('kind') && i.kind !== undefined && !(typeof i.kind === 'string' && /^[A-Z][A-Z0-9_]{1,30}$/.test(i.kind))) out.push('The kind must be capital letters, digits or underscores.');
  if (has('doneBy') && i.doneBy !== undefined && !DONE_BY.includes(i.doneBy)) out.push('Done by must be VENDOR, TEAM or EITHER.');
  if (has('deliveryKind') && i.deliveryKind !== undefined && !DELIVERY.includes(i.deliveryKind)) out.push('Delivery must be INSTANT or TEAM_REQUEST.');
  if (has('planStateRule') && i.planStateRule !== undefined && !RULES.includes(i.planStateRule)) out.push('The plan-state rule must be PRO_ACTIVE_OR_GRACE or ANY.');
  if (has('trackScope') && i.trackScope !== undefined && !(Array.isArray(i.trackScope) && i.trackScope.length <= 10 && i.trackScope.every((t) => typeof t === 'string' && /^[a-z_]{2,30}$/.test(t)))) out.push('The track scope is a list of track names (empty means every track).');
  if (has('publicVisible') && i.publicVisible !== undefined && typeof i.publicVisible !== 'boolean') out.push('Public visibility must be true or false.');
  if (has('sortOrder') && i.sortOrder !== undefined && !(typeof i.sortOrder === 'number' && Number.isInteger(i.sortOrder) && i.sortOrder >= 0 && i.sortOrder <= 100_000)) out.push('The sort order must be a whole number.');
  return out;
}
