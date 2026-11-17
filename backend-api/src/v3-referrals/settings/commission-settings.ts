import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Commission settings (Wave 4 W8, g4d_plan_settings, SUPER_ADMIN through the one plan-settings editing API). Nothing has a default.
 *  - tdsPercent: the TDS percent the owner sets from the CA's advice and applies to a commission payout. EMPTY by default, which means NO TDS is applied until the CA gives the rate. 0 also means none.
 * The app applies the percent it is given and computes no tax law beyond that.
 */
export interface CommissionSettings { tdsPercent: number | null }
export const DEFAULT_COMMISSION_SETTINGS: Readonly<CommissionSettings> = { tdsPercent: null };
export const COMMISSION_SETTING_KEYS = Object.keys(DEFAULT_COMMISSION_SETTINGS) as Array<keyof CommissionSettings>;
export const isCommissionSettingKey = (key: string): key is keyof CommissionSettings => (COMMISSION_SETTING_KEYS as string[]).includes(key);

/** a percent from 0 to 100 with at most 2 decimals */
export const percentOk = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 && Math.round(v * 100) / 100 === v;
export const commissionSettingProblem = (_key: keyof CommissionSettings, v: unknown): string | null => (percentOk(v) ? null : 'must be a percent from 0 to 100 with at most 2 decimals (0 means no TDS)');
export function validateCommissionSetting(key: string, value: unknown): void {
  if (!isCommissionSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = commissionSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}
/** The percent in basis points (10 percent = 1000), or null when unset or 0: no TDS is applied. */
export function tdsBasisPoints(percent: number | null | undefined): number | null { return typeof percent === 'number' && percentOk(percent) && percent > 0 ? Math.round(percent * 100) : null; }

/** What the referral service asks for: the TDS percent as basis points, or null when none is set. */
export abstract class CommissionSettingsPort { abstract tdsPercentBp(): Promise<number | null> }

@Injectable()
export class CommissionSettingsService extends CommissionSettingsPort {
  private cached: { at: number; v: number | null } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) { super(); }
  invalidate(): void { this.cached = null; }
  async tdsPercentBp(): Promise<number | null> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < 5_000) return this.cached.v;
    const row = await this.prisma.v3PlanSetting.findUnique({ where: { key: 'tdsPercent' } });
    const v = row && commissionSettingProblem('tdsPercent', row.valueJson) === null ? tdsBasisPoints(row.valueJson as number) : null;
    this.cached = { at: now, v };
    return v;
  }
}
