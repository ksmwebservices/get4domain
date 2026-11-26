import { BadRequestException, Injectable } from '@nestjs/common';
import { CASH_MAX_AGE_DAYS } from '../../plan-billing/core/cash-core';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Telecaller settings (E9c, g4d_plan_settings, changed by SUPER_ADMIN through PUT /v3/admin/plan-settings/:key). The two starting values are owner decisions of 26 Nov 2026.
 *  - telecallerDailyCap: the most new businesses one telecaller may create in a day (India time).
 *  - telecallerCashOverdueDays: cash an admin has not confirmed after this many days is shown as overdue. It is a notice only: nothing is cancelled or blocked.
 * No pay amount is a setting and none is written in code: pay is stored per telecaller and the commission tiers are the owner's slab rows.
 */
export interface TelecallerSettings { telecallerDailyCap: number; telecallerCashOverdueDays: number }
export const DEFAULT_TELECALLER_SETTINGS: Readonly<TelecallerSettings> = { telecallerDailyCap: 20, telecallerCashOverdueDays: 60 };
export const TELECALLER_SETTING_KEYS = Object.keys(DEFAULT_TELECALLER_SETTINGS) as Array<keyof TelecallerSettings>;
export const isTelecallerSettingKey = (key: string): key is keyof TelecallerSettings => (TELECALLER_SETTING_KEYS as string[]).includes(key);

export const telecallerSettingProblem = (key: keyof TelecallerSettings, v: unknown): string | null => {
  if (!(typeof v === 'number' && Number.isInteger(v) && v >= 1)) return 'must be a whole number above zero';
  // a telecaller's cash record closes after CASH_MAX_AGE_DAYS: a limit that long or longer could never show anything as overdue
  return key === 'telecallerCashOverdueDays' && v >= CASH_MAX_AGE_DAYS ? `must be less than ${CASH_MAX_AGE_DAYS}` : null;
};

export function validateTelecallerSetting(key: string, value: unknown): void {
  if (!isTelecallerSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = telecallerSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

/** Stored values over the defaults; an invalid stored value falls back to the default, so the cap can never be switched off by a bad row. */
export function resolveTelecallerSettings(stored: Map<string, unknown>): TelecallerSettings {
  const out = { ...DEFAULT_TELECALLER_SETTINGS };
  for (const key of TELECALLER_SETTING_KEYS) { const v = stored.get(key); if (v !== undefined && telecallerSettingProblem(key, v) === null) out[key] = v as number; }
  return out;
}

/** Read fresh each time: it is asked once per business creation and per monitor view, and a change should apply at once. */
@Injectable()
export class TelecallerSettingsService {
  constructor(private readonly prisma: PrismaService) {}
  async get(): Promise<TelecallerSettings> {
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: TELECALLER_SETTING_KEYS as string[] } } });
    return resolveTelecallerSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
  }
}
