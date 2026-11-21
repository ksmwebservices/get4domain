import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { validNameServers } from '../core/registrar-core';

/**
 * Editable settings of slice 5.6d (stored in g4d_plan_settings). NOTHING here has an invented default: an unset value switches its feature off or refuses it until staff set it
 * (stop-line 6). Edited through the one plan-settings API by SUPER_ADMIN.
 */
export interface RegistrarSettings {
  /** the name servers a new domain is pointed at so the site works (two to five host names); null = purchases are refused */
  registrarNameServers: string[] | null;
  /** the reseller balance below which purchases are blocked and staff are alerted, in whole paise; null = purchases are refused */
  registrarMinBalancePaise: number | null;
  /** how long an identity OTP lives, in seconds; null = OTPs cannot be sent */
  identityOtpTtlSeconds: number | null;
  /** wrong tries allowed per OTP; null = OTPs cannot be checked */
  identityOtpMaxAttempts: number | null;
  /** least time between two OTPs to the same vendor and channel; null = no limit set */
  identityOtpMinIntervalSeconds: number | null;
  /** the biggest identity document in bytes; null = uploads are refused */
  identityDocMaxBytes: number | null;
  /** how long an identity document is kept after approval or rejection; null = no purge runs (decided by counsel) */
  identityDocRetentionDays: number | null;
  /** days before expiry at which the vendor is told (for example 60, 30, 7); null = no alerts */
  domainExpiryAlertDays: number[] | null;
  /** the daily reconciliation runs only when this is true */
  registrarReconcileEnabled: boolean;
  /** an order left unsettled for longer than this many minutes is looked at by recovery; null = only staff trigger it */
  registrarRecoverAfterMinutes: number | null;
}
export const DEFAULT_REGISTRAR_SETTINGS: Readonly<RegistrarSettings> = {
  registrarNameServers: null, registrarMinBalancePaise: null, identityOtpTtlSeconds: null, identityOtpMaxAttempts: null, identityOtpMinIntervalSeconds: null, identityDocMaxBytes: null,
  identityDocRetentionDays: null, domainExpiryAlertDays: null, registrarReconcileEnabled: false, registrarRecoverAfterMinutes: null,
};
export const REGISTRAR_SETTING_KEYS = Object.keys(DEFAULT_REGISTRAR_SETTINGS) as Array<keyof RegistrarSettings>;
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

export function registrarSettingProblem(key: keyof RegistrarSettings, v: unknown): string | null {
  switch (key) {
    case 'registrarNameServers': return validNameServers(v as string[]) ? null : 'must be a list of two to five host names';
    case 'domainExpiryAlertDays': return Array.isArray(v) && v.length > 0 && v.length <= 10 && new Set(v).size === v.length && v.every(whole) ? null : 'must be a list of different whole numbers of days';
    case 'registrarReconcileEnabled': return typeof v === 'boolean' ? null : 'must be true or false';
    default: return whole(v) ? null : 'must be a whole number above zero';
  }
}
export const isRegistrarSettingKey = (key: string): key is keyof RegistrarSettings => (REGISTRAR_SETTING_KEYS as string[]).includes(key);
export function validateRegistrarSetting(key: string, value: unknown): void {
  if (!isRegistrarSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = registrarSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}
export function resolveRegistrarSettings(rows: Map<string, unknown>): RegistrarSettings {
  const out = { ...DEFAULT_REGISTRAR_SETTINGS } as unknown as Record<string, unknown>;
  for (const k of REGISTRAR_SETTING_KEYS) if (rows.has(k) && registrarSettingProblem(k, rows.get(k)) === null) out[k] = rows.get(k);
  return out as unknown as RegistrarSettings;
}

@Injectable()
export class RegistrarSettingsService {
  private cached: { at: number; v: RegistrarSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<RegistrarSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < 15_000) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: REGISTRAR_SETTING_KEYS as string[] } } });
    const v = resolveRegistrarSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
