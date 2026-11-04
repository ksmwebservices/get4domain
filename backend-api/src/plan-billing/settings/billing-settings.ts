import { BadRequestException } from '@nestjs/common';

/** Editable settings of slice 5.1b (g4d_plan_settings, edited through the existing plan-settings API). graceDays, upgradeProration and renewalReminderDays are the slice 5.1 keys and are read as they are. */
export interface BillingOwnSettings {
  /** off (default): no order can be created. test: the Razorpay TEST adapter is used, and only if test keys are in the environment. live: refused unless the owner sets the environment flag later (and no live adapter exists in this slice). */
  paymentsMode: 'off' | 'test' | 'live';
  /** how long an order stays payable */
  orderExpiryMinutes: number;
  /** false (default): the reminder cron does nothing */
  renewalRemindersEnabled: boolean;
  /** printed at the start of every invoice number */
  invoiceNumberPrefix: string;
  /** seller details printed on the invoice; EMPTY until the owner supplies them (nothing is invented) */
  invoiceSellerName: string;
  invoiceSellerAddress: string;
  invoiceSellerGstin: string;
}
export interface BillingSettings extends BillingOwnSettings { graceDays: number; upgradeProration: 'NONE' | 'PRORATE'; renewalReminderDays: number[] }

export const DEFAULT_BILLING_SETTINGS: Readonly<BillingOwnSettings> = {
  paymentsMode: 'off', orderExpiryMinutes: 30, renewalRemindersEnabled: false, invoiceNumberPrefix: 'INV', invoiceSellerName: '', invoiceSellerAddress: '', invoiceSellerGstin: '',
};
export const BILLING_SETTING_KEYS = Object.keys(DEFAULT_BILLING_SETTINGS) as Array<keyof BillingOwnSettings>;
export const isBillingSettingKey = (key: string): key is keyof BillingOwnSettings => (BILLING_SETTING_KEYS as string[]).includes(key);

const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const text = (v: unknown, max: number): boolean => typeof v === 'string' && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);

export function billingSettingProblem(key: keyof BillingOwnSettings, value: unknown): string | null {
  switch (key) {
    case 'paymentsMode': return value === 'off' || value === 'test' || value === 'live' ? null : 'must be "off", "test" or "live"';
    case 'orderExpiryMinutes': return intIn(value, 5, 1440) ? null : 'must be a whole number of minutes from 5 to 1440';
    case 'renewalRemindersEnabled': return typeof value === 'boolean' ? null : 'must be true or false';
    case 'invoiceNumberPrefix': return typeof value === 'string' && /^[A-Z0-9]{1,8}$/.test(value) ? null : 'must be 1 to 8 capital letters or digits';
    case 'invoiceSellerName': return text(value, 120) ? null : 'must be plain text of up to 120 characters';
    case 'invoiceSellerAddress': return text(value, 400) ? null : 'must be plain text of up to 400 characters';
    case 'invoiceSellerGstin': return typeof value === 'string' && (value === '' || /^[0-9A-Z]{15}$/.test(value)) ? null : 'must be empty or 15 capital letters and digits';
  }
}

export function validateBillingSetting(key: string, value: unknown): void {
  if (!isBillingSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = billingSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

/** Defaults overlaid with valid stored values, plus the three slice 5.1 keys this slice reads (with the same defaults the seed documents). */
export function resolveBillingSettings(stored: ReadonlyMap<string, unknown>): BillingSettings {
  const out: Record<string, unknown> = { ...DEFAULT_BILLING_SETTINGS };
  for (const key of BILLING_SETTING_KEYS) if (stored.has(key) && billingSettingProblem(key, stored.get(key)) === null) out[key] = stored.get(key);
  const grace = stored.get('graceDays'); const proration = stored.get('upgradeProration'); const days = stored.get('renewalReminderDays');
  out.graceDays = intIn(grace, 0, 365) ? grace : 7;
  out.upgradeProration = proration === 'PRORATE' ? 'PRORATE' : 'NONE';
  out.renewalReminderDays = Array.isArray(days) && days.length <= 10 && days.every((n) => intIn(n, 0, 365)) ? days : [14, 7, 1];
  return out as unknown as BillingSettings;
}
