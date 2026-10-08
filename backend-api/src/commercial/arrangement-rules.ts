import { addMonths, GST_PERCENT } from './pricing-math';

/**
 * Special arrangements (Release 1A). PURE rules, no I/O, so every rule can be asserted exhaustively.
 *
 * Standard rule for everyone: annual term, Razorpay only, GST 18% added on top (EXCLUSIVE).
 * Exceptions are allowed ONLY through an active arrangement set by KSM:
 *   1. half-year term  (Essentials and Pro only; never Custom, which is not a term)
 *   2. manual payment channels UPI_QR / OFFLINE (activation or renewal happens only after KSM confirms the money arrived)
 *   3. GST not charged (gstMode NONE), only with a reason and an end date no more than MAX_GST_NONE_MONTHS away
 */

/** Longest a "GST not charged" arrangement may run. One place. */
export const MAX_GST_NONE_MONTHS = 6;
/** Longest any other arrangement may run. One place. */
export const MAX_ARRANGEMENT_MONTHS = 24;
/** The daily job warns KSM this many days before an arrangement ends. */
export const ARRANGEMENT_WARN_DAYS = 15;
export const MANUAL_CHANNELS = ['UPI_QR', 'OFFLINE'] as const;

export type GstModeT = 'EXCLUSIVE' | 'INCLUSIVE' | 'NONE';
export type ChannelT = 'RAZORPAY' | 'UPI_QR' | 'OFFLINE';
export type CycleT = 'MONTHLY' | 'HALF_YEARLY' | 'ANNUAL' | 'CUSTOM_MONTHS';

export interface ArrangementLike {
  allowHalfYear: boolean;
  gstMode: GstModeT;
  allowedChannels: ChannelT[];
  validUntil: Date | null;
  active: boolean;
  endedAt?: Date | null;
}

export interface ArrangementInput {
  allowHalfYear?: boolean;
  gstMode?: GstModeT;
  allowedChannels?: ChannelT[];
  validUntil?: Date | string | null;
  reason?: string;
}

/** An arrangement counts only while it is active, not ended, and `validUntil` has not passed. */
export function isArrangementActive(a: ArrangementLike | null | undefined, now: Date): boolean {
  if (!a || !a.active || a.endedAt) return false;
  return Boolean(a.validUntil && a.validUntil.getTime() > now.getTime());
}

/** The vendor's arrangement that applies now (the newest active one), else null. */
export function pickActive<T extends ArrangementLike & { createdAt?: Date }>(rows: T[], now: Date): T | null {
  const live = rows.filter((r) => isArrangementActive(r, now));
  live.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return live[0] ?? null;
}

/** Validates what KSM typed on the Special arrangements page. Returns a clean value or throws RangeError with a plain sentence. */
export function validateArrangementInput(input: ArrangementInput, now: Date): { allowHalfYear: boolean; gstMode: GstModeT; allowedChannels: ChannelT[]; validUntil: Date; reason: string } {
  const reason = (input.reason ?? '').trim();
  if (reason.length < 10) throw new RangeError('A reason of at least 10 characters is required. It is kept in the audit log.');
  if (reason.length > 300) throw new RangeError('The reason is too long (max 300 characters).');
  const allowHalfYear = Boolean(input.allowHalfYear);
  const gstMode = input.gstMode ?? 'EXCLUSIVE';
  if (!['EXCLUSIVE', 'NONE'].includes(gstMode)) throw new RangeError('An arrangement can only keep the standard GST (18% on top) or switch GST off.');
  const channels = [...new Set(input.allowedChannels ?? [])].filter((c) => c !== 'RAZORPAY');
  if (channels.some((c) => !(MANUAL_CHANNELS as readonly string[]).includes(c))) throw new RangeError('Allowed payment channels are UPI QR and Offline.');
  if (!allowHalfYear && gstMode === 'EXCLUSIVE' && channels.length === 0) throw new RangeError('Choose at least one exception: a half-year term, GST not charged, or a manual payment channel.');

  if (input.validUntil == null || input.validUntil === '') throw new RangeError('An end date is required for every arrangement.');
  const validUntil = input.validUntil instanceof Date ? input.validUntil : new Date(input.validUntil);
  if (Number.isNaN(validUntil.getTime())) throw new RangeError('The end date is not a valid date.');
  if (validUntil.getTime() <= now.getTime()) throw new RangeError('The end date must be in the future.');
  const limit = addMonths(now, gstMode === 'NONE' ? MAX_GST_NONE_MONTHS : MAX_ARRANGEMENT_MONTHS);
  if (validUntil.getTime() > limit.getTime()) {
    throw new RangeError(gstMode === 'NONE' ? `GST not charged can run for at most ${MAX_GST_NONE_MONTHS} months.` : `An arrangement can run for at most ${MAX_ARRANGEMENT_MONTHS} months.`);
  }
  return { allowHalfYear, gstMode, allowedChannels: channels as ChannelT[], validUntil, reason };
}

export interface SpecToCheck {
  planKey?: string | null;
  billingCycle?: CycleT | null;
  gstMode: GstModeT;
  channels: ChannelT[];
}

/** Every way a deal/invoice spec steps outside the standard rule without an arrangement that allows it. Empty = fine. */
export function arrangementViolations(spec: SpecToCheck, arrangement: ArrangementLike | null, now: Date): string[] {
  const live = isArrangementActive(arrangement, now) ? arrangement : null;
  const out: string[] = [];
  if (spec.planKey && spec.billingCycle === 'HALF_YEARLY') {
    if (!['WORKSPACE', 'BOS'].includes(spec.planKey)) out.push('A half-year term is only for the Essentials and Pro plans.');
    else if (!live?.allowHalfYear) out.push('A half-year term needs a special arrangement for this client (Admin > Pricing > Special arrangements).');
  }
  if (spec.gstMode === 'NONE' && live?.gstMode !== 'NONE') out.push('Charging no GST needs a special arrangement with a reason and an end date (Admin > Pricing > Special arrangements).');
  for (const ch of spec.channels) {
    if ((MANUAL_CHANNELS as readonly string[]).includes(ch) && !live?.allowedChannels.includes(ch)) {
      out.push(`${ch === 'UPI_QR' ? 'Manual UPI QR payment' : 'Offline payment'} needs a special arrangement for this client; everyone else pays through Razorpay.`);
    }
  }
  return out;
}

/** The GST an invoice issued with gstMode NONE would have carried (18% of the net), and the line printed on it. */
export function shadowGst(netPaise: number, validUntil: Date | null): { gstForgonePaise: number; gstNote: string } {
  const gstForgonePaise = Math.round((netPaise * GST_PERCENT) / 100);
  const until = validUntil ? validUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'the arrangement ends';
  return { gstForgonePaise, gstNote: `GST not charged — special arrangement until ${until}` };
}

export interface TermBilling { billingCycle: CycleT; cycleMonths: number; gstMode: GstModeT; allowedChannels: ChannelT[]; planKey: string }
export interface RenewalBilling { billingCycle: CycleT; months: number; gstMode: GstModeT; channels: ChannelT[]; reverted: string[]; arrangement: ArrangementLike | null }

/**
 * What the next (renewal) invoice may look like. With an active arrangement the current terms may continue as far as the arrangement allows;
 * otherwise anything outside the standard rule reverts: half-year -> ANNUAL (12 months), GST NONE -> EXCLUSIVE, UPI/offline -> Razorpay only.
 * `reverted` lists what changed, for the audit log and KSM's notification. Pure.
 */
export function renewalBilling(term: TermBilling, arrangement: ArrangementLike | null, now: Date): RenewalBilling {
  const live = isArrangementActive(arrangement, now) ? arrangement : null;
  const reverted: string[] = [];
  let billingCycle = term.billingCycle;
  let months = term.cycleMonths;
  if (billingCycle === 'HALF_YEARLY' && !live?.allowHalfYear) { billingCycle = 'ANNUAL'; months = 12; reverted.push('half-year term -> annual'); }
  let gstMode = term.gstMode;
  if (gstMode === 'NONE' && live?.gstMode !== 'NONE') { gstMode = 'EXCLUSIVE'; reverted.push('GST not charged -> GST 18% on top'); }
  let channels = (term.allowedChannels.length ? term.allowedChannels : ['RAZORPAY']) as ChannelT[];
  const allowedManual = live?.allowedChannels ?? [];
  const kept = channels.filter((c) => c === 'RAZORPAY' || allowedManual.includes(c));
  if (kept.length !== channels.length) reverted.push('manual payment channels -> Razorpay only');
  channels = kept.length ? kept : ['RAZORPAY'];
  return { billingCycle, months, gstMode, channels, reverted, arrangement: live };
}

export type ExpiryAction = 'NONE' | 'WARN' | 'EXPIRED';

/** What the daily job should do for one arrangement today. Idempotent: it never repeats a notice that was already sent. */
export function expiryAction(a: { active: boolean; endedAt?: Date | null; validUntil: Date; expiryWarnedAt?: Date | null; expiredNotifiedAt?: Date | null }, now: Date): ExpiryAction {
  if (!a.active || a.endedAt) return 'NONE';
  if (a.validUntil.getTime() <= now.getTime()) return a.expiredNotifiedAt ? 'NONE' : 'EXPIRED';
  const warnFrom = new Date(a.validUntil.getTime() - ARRANGEMENT_WARN_DAYS * 86_400_000);
  if (now.getTime() >= warnFrom.getTime() && !a.expiryWarnedAt) return 'WARN';
  return 'NONE';
}
