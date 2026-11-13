import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Support settings (g4d_plan_settings, SUPER_ADMIN). Nothing has a default: an unset limit keeps the feature it guards off. */
export interface SupportSettings {
  /** most tickets one business may open in an hour; null = business tickets cannot be opened */
  ticketCreatePerHour: number | null;
  /** most tickets one visitor email address may open in an hour through the public form; null = the public form is off */
  ticketPublicPerHour: number | null;
}
export const DEFAULT_SUPPORT_SETTINGS: Readonly<SupportSettings> = { ticketCreatePerHour: null, ticketPublicPerHour: null };
export const SUPPORT_SETTING_KEYS = Object.keys(DEFAULT_SUPPORT_SETTINGS) as Array<keyof SupportSettings>;
export const isSupportSettingKey = (key: string): key is keyof SupportSettings => (SUPPORT_SETTING_KEYS as string[]).includes(key);
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
export const supportSettingProblem = (_key: keyof SupportSettings, v: unknown): string | null => (whole(v) ? null : 'must be a whole number above zero');
export function validateSupportSetting(key: string, value: unknown): void {
  if (!isSupportSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = supportSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}
export function resolveSupportSettings(rows: Map<string, unknown>): SupportSettings {
  const out = { ...DEFAULT_SUPPORT_SETTINGS } as unknown as Record<string, unknown>;
  for (const k of SUPPORT_SETTING_KEYS) if (rows.has(k) && supportSettingProblem(k, rows.get(k)) === null) out[k] = rows.get(k);
  return out as unknown as SupportSettings;
}

@Injectable()
export class SupportSettingsService {
  private cached: { at: number; v: SupportSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<SupportSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < 15_000) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: SUPPORT_SETTING_KEYS as string[] } } });
    const v = resolveSupportSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
