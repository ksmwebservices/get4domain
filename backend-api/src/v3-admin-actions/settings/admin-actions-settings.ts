import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Staff action settings (g4d_plan_settings, SUPER_ADMIN). Merging two listings stays OFF until staff set how many days a merge can be undone: the amendment says 30 and the owner has not confirmed it,
 * so no number is built in (an unset value refuses the merge, it never falls back to a default).
 */
export interface AdminActionsSettings {
  /** days after a merge during which SUPER_ADMIN can undo it; null = merging is switched off */
  adminMergeReversalDays: number | null;
}
export const DEFAULT_ADMIN_ACTIONS_SETTINGS: Readonly<AdminActionsSettings> = { adminMergeReversalDays: null };
export const ADMIN_ACTIONS_SETTING_KEYS = Object.keys(DEFAULT_ADMIN_ACTIONS_SETTINGS) as Array<keyof AdminActionsSettings>;
export const isAdminActionsSettingKey = (key: string): key is keyof AdminActionsSettings => (ADMIN_ACTIONS_SETTING_KEYS as string[]).includes(key);
export const adminActionsSettingProblem = (_k: keyof AdminActionsSettings, v: unknown): string | null => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 && v <= 3650 ? null : 'must be a whole number of days from 1 to 3650');
export function validateAdminActionsSetting(key: string, value: unknown): void {
  if (!isAdminActionsSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = adminActionsSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}
export function resolveAdminActionsSettings(rows: Map<string, unknown>): AdminActionsSettings {
  const out = { ...DEFAULT_ADMIN_ACTIONS_SETTINGS } as unknown as Record<string, unknown>;
  for (const k of ADMIN_ACTIONS_SETTING_KEYS) if (rows.has(k) && adminActionsSettingProblem(k, rows.get(k)) === null) out[k] = rows.get(k);
  return out as unknown as AdminActionsSettings;
}

@Injectable()
export class AdminActionsSettingsService {
  private cached: { at: number; v: AdminActionsSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<AdminActionsSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < 15_000) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: ADMIN_ACTIONS_SETTING_KEYS as string[] } } });
    const v = resolveAdminActionsSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
