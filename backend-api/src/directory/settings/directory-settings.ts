import { BadRequestException } from '@nestjs/common';

/** Editable settings of slice 5.7 (stored in g4d_plan_settings, edited through the existing plan-settings API). Every default is documented here. */
export interface DirectorySettings {
  /** page size when the caller gives none, and the hard cap on what a caller may ask for */
  directoryPageSizeDefault: number;
  directoryPageSizeMax: number;
  /** one sponsored item is shown before every N organic results; organic order is never changed */
  directorySponsoredEvery: number;
  /** a business page needs at least this many characters of description to be indexable */
  directoryMinDescriptionChars: number;
  /** false (default): an UNCLAIMED business page is noindex until its owner has claimed it (consent) */
  directoryIndexUnclaimed: boolean;
  /** a location or category page with fewer businesses than this is noindex (thin) */
  directoryThinPageMinBusinesses: number;
  /** public read cache lifetime in seconds (ETag revalidation always works) */
  directoryCacheSeconds: number;
  otpExpiryMinutes: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  otpMaxPerPhonePerHour: number;
  otpMaxPerIpPerHour: number;
  /** sandbox (default): the message is kept in the database and nothing is sent. live also needs the environment flag SMS_LIVE_ENABLED=true, set by the owner later. */
  smsAdapterMode: 'sandbox' | 'live';
  /** how long the account-setup grant that follows a successful claim stays valid */
  accountSetupGrantMinutes: number;
  removalLinkExpiryDays: number;
}

export const DEFAULT_DIRECTORY_SETTINGS: Readonly<DirectorySettings> = {
  directoryPageSizeDefault: 20,
  directoryPageSizeMax: 50,
  directorySponsoredEvery: 5,
  directoryMinDescriptionChars: 40,
  directoryIndexUnclaimed: false,
  directoryThinPageMinBusinesses: 3,
  directoryCacheSeconds: 300,
  otpExpiryMinutes: 10,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  otpMaxPerPhonePerHour: 5,
  otpMaxPerIpPerHour: 20,
  smsAdapterMode: 'sandbox',
  accountSetupGrantMinutes: 30,
  removalLinkExpiryDays: 14,
};

export const DIRECTORY_SETTING_KEYS = Object.keys(DEFAULT_DIRECTORY_SETTINGS) as Array<keyof DirectorySettings>;
export const isDirectorySettingKey = (key: string): key is keyof DirectorySettings => (DIRECTORY_SETTING_KEYS as string[]).includes(key);

const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

export function directorySettingProblem(key: keyof DirectorySettings, value: unknown): string | null {
  switch (key) {
    case 'directoryPageSizeDefault': return intIn(value, 1, 100) ? null : 'must be a whole number from 1 to 100';
    case 'directoryPageSizeMax': return intIn(value, 1, 100) ? null : 'must be a whole number from 1 to 100';
    case 'directorySponsoredEvery': return intIn(value, 1, 100) ? null : 'must be a whole number from 1 to 100';
    case 'directoryMinDescriptionChars': return intIn(value, 0, 2000) ? null : 'must be a whole number from 0 to 2000';
    case 'directoryIndexUnclaimed': return typeof value === 'boolean' ? null : 'must be true or false';
    case 'directoryThinPageMinBusinesses': return intIn(value, 0, 1000) ? null : 'must be a whole number from 0 to 1000';
    case 'directoryCacheSeconds': return intIn(value, 0, 86_400) ? null : 'must be a whole number of seconds from 0 to 86400';
    case 'otpExpiryMinutes': return intIn(value, 1, 60) ? null : 'must be a whole number of minutes from 1 to 60';
    case 'otpMaxAttempts': return intIn(value, 1, 10) ? null : 'must be a whole number from 1 to 10';
    case 'otpResendCooldownSeconds': return intIn(value, 0, 3600) ? null : 'must be a whole number of seconds from 0 to 3600';
    case 'otpMaxPerPhonePerHour': return intIn(value, 1, 100) ? null : 'must be a whole number from 1 to 100';
    case 'otpMaxPerIpPerHour': return intIn(value, 1, 1000) ? null : 'must be a whole number from 1 to 1000';
    case 'smsAdapterMode': return value === 'sandbox' || value === 'live' ? null : 'must be "sandbox" or "live"';
    case 'accountSetupGrantMinutes': return intIn(value, 1, 1440) ? null : 'must be a whole number of minutes from 1 to 1440';
    case 'removalLinkExpiryDays': return intIn(value, 1, 365) ? null : 'must be a whole number of days from 1 to 365';
  }
}

export function validateDirectorySetting(key: string, value: unknown): void {
  if (!isDirectorySettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = directorySettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

/** Defaults overlaid with the stored values that pass validation; a default page size above the cap falls back to the cap. */
export function resolveDirectorySettings(stored: ReadonlyMap<string, unknown>): DirectorySettings {
  const out: Record<string, unknown> = { ...DEFAULT_DIRECTORY_SETTINGS };
  for (const key of DIRECTORY_SETTING_KEYS) if (stored.has(key) && directorySettingProblem(key, stored.get(key)) === null) out[key] = stored.get(key);
  const r = out as unknown as DirectorySettings;
  if (r.directoryPageSizeDefault > r.directoryPageSizeMax) r.directoryPageSizeDefault = r.directoryPageSizeMax;
  return r;
}
