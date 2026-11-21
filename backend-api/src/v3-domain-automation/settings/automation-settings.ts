import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';

/** Editable settings of slice 5.6c (stored in g4d_plan_settings). Nothing here has an invented default: unset means off or not shown. */
export interface AutomationSettings {
  /** the host a vendor's CNAME points at (the Cloudflare fallback origin); null = the connection record is not shown and automatic connection cannot start */
  customHostnameTarget: string | null;
  /** the background watcher runs only when this is true */
  connectionWatcherEnabled: boolean;
  /** after this many checks without an active certificate a connection needs attention; null = it keeps waiting */
  connectionMaxChecks: number | null;
  /** the least time between two "check now" calls on one connection; null = no limit set */
  connectionCheckMinIntervalSeconds: number | null;
}
export const DEFAULT_AUTOMATION_SETTINGS: Readonly<AutomationSettings> = { customHostnameTarget: null, connectionWatcherEnabled: false, connectionMaxChecks: null, connectionCheckMinIntervalSeconds: null };
export const AUTOMATION_SETTING_KEYS = Object.keys(DEFAULT_AUTOMATION_SETTINGS) as Array<keyof AutomationSettings>;

const HOST = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

export function automationSettingProblem(key: keyof AutomationSettings, v: unknown): string | null {
  switch (key) {
    case 'customHostnameTarget': return typeof v === 'string' && HOST.test(v) ? null : 'must be a host name such as edge.example.com';
    case 'connectionWatcherEnabled': return typeof v === 'boolean' ? null : 'must be true or false';
    default: return whole(v) ? null : 'must be a whole number above zero';
  }
}

export const isAutomationSettingKey = (key: string): key is keyof AutomationSettings => (AUTOMATION_SETTING_KEYS as string[]).includes(key);
export function validateAutomationSetting(key: string, value: unknown): void {
  if (!isAutomationSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = automationSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

export function resolveAutomationSettings(rows: Map<string, unknown>): AutomationSettings {
  const out: AutomationSettings = { ...DEFAULT_AUTOMATION_SETTINGS };
  for (const k of AUTOMATION_SETTING_KEYS) if (rows.has(k) && automationSettingProblem(k, rows.get(k)) === null) (out as unknown as Record<string, unknown>)[k] = rows.get(k);
  return out;
}

@Injectable()
export class AutomationSettingsService {
  private cached: { at: number; v: AutomationSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<AutomationSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < 15_000) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: AUTOMATION_SETTING_KEYS as string[] } } });
    const v = resolveAutomationSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
