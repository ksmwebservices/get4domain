import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_PROVISIONING_SETTINGS, provisioningSettingProblem } from '../../provisioning/settings/provisioning-settings';
import { DIRECTORY_SETTING_KEYS, DirectorySettings, resolveDirectorySettings } from './directory-settings';

const TTL_MS = 30_000;

/** Reads the directory settings from g4d_plan_settings, defaults for anything missing or invalid, kept for 30 seconds. */
@Injectable()
export class DirectorySettingsService {
  private cached: { at: number; v: DirectorySettings } | null = null;
  private url: { at: number; v: string } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void { this.cached = null; this.url = null; }

  async get(): Promise<DirectorySettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: DIRECTORY_SETTING_KEYS } } });
    const v = resolveDirectorySettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }

  /** The public address of the app (the slice 5.3 setting publicAppUrl) for links in messages. No trailing slash. */
  async readPublicAppUrl(): Promise<string> {
    const now = this.clock();
    if (this.url && now - this.url.at < TTL_MS) return this.url.v;
    const row = await this.prisma.v3PlanSetting.findUnique({ where: { key: 'publicAppUrl' } });
    const ok = row && provisioningSettingProblem('publicAppUrl', row.valueJson) === null;
    const v = String(ok ? row!.valueJson : DEFAULT_PROVISIONING_SETTINGS.publicAppUrl).replace(/\/+$/, '');
    this.url = { at: now, v };
    return v;
  }
}
