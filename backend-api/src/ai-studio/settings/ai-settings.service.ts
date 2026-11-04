import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_SETTING_KEYS, AiSettings, resolveAiSettings } from './ai-settings';

const TTL_MS = 15_000;

/** Reads the AI Studio settings from g4d_plan_settings, defaults for anything missing or invalid, kept for 15 seconds. */
@Injectable()
export class AiSettingsService {
  private cached: { at: number; v: AiSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<AiSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: AI_SETTING_KEYS } } });
    const v = resolveAiSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
