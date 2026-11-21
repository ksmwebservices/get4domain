import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { B3_SETTING_KEYS, B3Settings, resolveB3Settings } from './b3-settings';

const TTL_MS = 15_000;

/** Reads the Batch 3 settings from g4d_plan_settings; defaults for anything missing or invalid; kept 15 seconds in process memory (invalidate() after a write). */
@Injectable()
export class B3SettingsService {
  private cached: { at: number; v: B3Settings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void { this.cached = null; }

  async get(): Promise<B3Settings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: B3_SETTING_KEYS } } });
    const v = resolveB3Settings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
