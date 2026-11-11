import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveWebsiteSettings, WEBSITE_SETTING_KEYS, WebsiteSettings } from './website-settings';

const TTL_MS = 15_000;

/** Reads the Website manager settings from g4d_plan_settings; unset stays null; kept 15 seconds in process memory (invalidate() after a write). */
@Injectable()
export class WebsiteSettingsService {
  private cached: { at: number; v: WebsiteSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<WebsiteSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: WEBSITE_SETTING_KEYS as string[] } } });
    const v = resolveWebsiteSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
