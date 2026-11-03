import { BadRequestException } from '@nestjs/common';
import { validateProvisioningSetting } from '../../provisioning/settings/provisioning-settings';
import { planError } from '../plans.errors';

/** Pure validators for the admin writes. They throw 400 with a stable code where the design note names one. */
export const FEATURE_KEY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
export const SELLABLE_TERMS = [3, 6, 12];
export const FEATURE_STATES = ['ACTIVE', 'LIMITED', 'LOCKED_PREVIEW', 'HIDDEN'] as const;
export const DISCOUNT_TERMS = [1, 3, 6, 12];

export function validateAmount(amountPaise: unknown): number {
  if (typeof amountPaise !== 'number' || !Number.isInteger(amountPaise) || amountPaise < 0) {
    throw new BadRequestException(planError('INVALID_AMOUNT', 'The amount must be a whole number of paise, 0 or more.'));
  }
  return amountPaise;
}

export function validateTerm(termMonths: unknown, allowMonthly: boolean): number {
  const allowed = allowMonthly ? [1, ...SELLABLE_TERMS] : SELLABLE_TERMS;
  if (typeof termMonths !== 'number' || !allowed.includes(termMonths)) {
    throw new BadRequestException(planError('INVALID_TERM', `The term must be ${allowed.join(', ')} months.`));
  }
  return termMonths;
}

export function requireReason(reason: unknown): string {
  if (typeof reason !== 'string' || reason.trim().length < 3) throw new BadRequestException(planError('REASON_REQUIRED', 'A reason is required.'));
  return reason.trim();
}

export interface MatrixRowInput { featureKey: string; state: string; limitValue?: number | null; enumValue?: string | null; upsellText?: string | null }

export function validateMatrixRow(r: MatrixRowInput): void {
  if (!FEATURE_KEY.test(r.featureKey ?? '')) throw new BadRequestException(`"${r.featureKey}" is not a feature key.`);
  if (!(FEATURE_STATES as readonly string[]).includes(r.state)) throw new BadRequestException(`${r.featureKey}: "${r.state}" is not a state.`);
  const hasLimit = r.limitValue !== undefined && r.limitValue !== null;
  if (hasLimit && !(Number.isInteger(r.limitValue) && (r.limitValue as number) >= 0)) throw new BadRequestException(`${r.featureKey}: the limit must be a whole number, 0 or more.`);
  if (r.state === 'LIMITED' && !hasLimit) throw new BadRequestException(`${r.featureKey}: a LIMITED feature needs a limit.`);
  if (r.state === 'LOCKED_PREVIEW' && !(r.upsellText ?? '').trim()) throw new BadRequestException(`${r.featureKey}: a locked preview needs upsell text.`);
}

export interface DiscountInput { type: string; percentOff?: number | null; amountOffPaise?: number | null; conditions?: Record<string, unknown> | null }
export function validateDiscount(d: DiscountInput): void {
  const hasPct = d.percentOff !== undefined && d.percentOff !== null;
  const hasAmt = d.amountOffPaise !== undefined && d.amountOffPaise !== null;
  if (hasPct === hasAmt) throw new BadRequestException('Give exactly one of percentOff and amountOffPaise.');
  if (hasPct && !(d.percentOff! >= 0 && d.percentOff! <= 100)) throw new BadRequestException('percentOff must be 0 to 100.');
  if (hasAmt) validateAmount(d.amountOffPaise);
  if (d.type === 'TERM' && !DISCOUNT_TERMS.includes(Number(d.conditions?.termMonths))) throw new BadRequestException(planError('INVALID_TERM', `A TERM discount needs conditions.termMonths in ${DISCOUNT_TERMS.join(', ')}.`));
}

export function validateTaxRate(ratePercent: unknown): number {
  if (typeof ratePercent !== 'number' || !(ratePercent >= 0 && ratePercent <= 100)) throw new BadRequestException('The tax rate must be between 0 and 100.');
  return ratePercent;
}

const DOWNGRADE = ['FALL_TO_FREE', 'KEEP_UNTIL_REPLACED'];
const PRORATION = ['NONE', 'PRORATE'];
const intIn = (v: unknown, min: number, max: number): boolean => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** The value of one plan setting. An unknown key is refused (settings are a fixed vocabulary, plus baseMonthlyPaise.<plan key>). */
export function validateSettingValue(key: string, value: unknown): void {
  const bad = (what: string): never => { throw new BadRequestException(`${key}: ${what}`); };
  if (/^baseMonthlyPaise\.[a-z][a-z0-9_]*$/.test(key)) { if (!intIn(value, 0, 100_000_000)) bad('must be a whole number of paise, 0 or more'); return; }
  switch (key) {
    case 'graceDays': if (!intIn(value, 0, 365)) bad('must be a whole number of days from 0 to 365'); return;
    case 'allowMonthly': case 'registrationProvisioning': if (typeof value !== 'boolean') bad('must be true or false'); return;
    case 'renewalReminderDays': if (!Array.isArray(value) || value.length > 10 || !value.every((n) => intIn(n, 0, 365))) bad('must be a list of up to 10 day counts'); return;
    case 'downgradeBehaviour': if (!DOWNGRADE.includes(String(value))) bad(`must be one of ${DOWNGRADE.join(', ')}`); return;
    case 'upgradeProration': if (!PRORATION.includes(String(value))) bad(`must be one of ${PRORATION.join(', ')}`); return;
    default: validateProvisioningSetting(key, value);   // slice 5.3 keys; an unknown key is refused there with the same message
  }
}

/** Calendar months added to a date (UTC); the day is clamped to the end of a shorter month. */
export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}
