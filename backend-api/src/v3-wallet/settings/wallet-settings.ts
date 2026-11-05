import { BadRequestException } from '@nestjs/common';

/**
 * Editable settings of the wallet and the services built on it (Batch 4). They live in g4d_plan_settings and are edited through the existing plan-settings API
 * (PUT /v3/admin/plan-settings/:key, SUPER_ADMIN only), registered in plans/admin/extra-settings.ts.
 *
 * NOTHING HERE IS INVENTED: a limit or a count that the owner has not decided has NO default (it reads as null) and the feature that needs it refuses to run until staff set it.
 *   walletTopupMinPaise / walletTopupMaxPaise: until both are set no top-up can be made.
 *   serviceMaxRevisions: until it is set no service request can be made.
 * The only value with a default is the one the owner decided: credit lasts 365 days from the top-up (a change applies to NEW top-ups only).
 */
export interface WalletSettings {
  walletTopupMinPaise: number | null;
  walletTopupMaxPaise: number | null;
  /** how long credit lasts from the day it is added (owner decision: 365). A change applies to new top-ups only. */
  walletCreditValidityDays: number;
  /** printed at the start of a top-up receipt number */
  walletReceiptPrefix: string;
  /** Get4Domain's GST state code (two digits). EMPTY until the owner supplies it: the tax rule cannot choose IGST or CGST plus SGST without it. */
  walletSellerStateCode: string;
  /** false (default): the expiry cron does nothing (staff can still run it by hand) */
  walletExpiryTickEnabled: boolean;
}

export const DEFAULT_WALLET_SETTINGS: Readonly<WalletSettings> = {
  walletTopupMinPaise: null, walletTopupMaxPaise: null, walletCreditValidityDays: 365, walletReceiptPrefix: 'RCT', walletSellerStateCode: '', walletExpiryTickEnabled: false,
};
export const WALLET_SETTING_KEYS = Object.keys(DEFAULT_WALLET_SETTINGS) as Array<keyof WalletSettings>;
export const isWalletSettingKey = (key: string): key is keyof WalletSettings => (WALLET_SETTING_KEYS as string[]).includes(key);

const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
/** An Int column holds up to 2,147,483,647 paise; the ceiling keeps every wallet number far inside it. */
const MAX_PAISE = 100_000_000;

export function walletSettingProblem(key: keyof WalletSettings, value: unknown): string | null {
  switch (key) {
    case 'walletTopupMinPaise': case 'walletTopupMaxPaise': return intIn(value, 100, MAX_PAISE) ? null : `must be a whole number of paise from 100 to ${MAX_PAISE}`;
    case 'walletCreditValidityDays': return intIn(value, 1, 3650) ? null : 'must be a whole number of days from 1 to 3650';
    case 'walletReceiptPrefix': return typeof value === 'string' && /^[A-Z0-9]{1,8}$/.test(value) ? null : 'must be 1 to 8 capital letters or digits';
    case 'walletSellerStateCode': return typeof value === 'string' && (value === '' || /^[0-9]{2}$/.test(value)) ? null : 'must be empty or a two-digit state code';
    case 'walletExpiryTickEnabled': return typeof value === 'boolean' ? null : 'must be true or false';
  }
}

export function validateWalletSetting(key: string, value: unknown): void {
  if (!isWalletSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = walletSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

/** Defaults overlaid with valid stored values. A stored minimum above the maximum is treated as "not configured" (null for both), so a wrong pair can never let a top-up through. */
export function resolveWalletSettings(stored: ReadonlyMap<string, unknown>): WalletSettings {
  const out: Record<string, unknown> = { ...DEFAULT_WALLET_SETTINGS };
  for (const key of WALLET_SETTING_KEYS) if (stored.has(key) && walletSettingProblem(key, stored.get(key)) === null) out[key] = stored.get(key);
  const o = out as unknown as WalletSettings;
  if (o.walletTopupMinPaise !== null && o.walletTopupMaxPaise !== null && o.walletTopupMinPaise > o.walletTopupMaxPaise) { o.walletTopupMinPaise = null; o.walletTopupMaxPaise = null; }
  return o;
}
