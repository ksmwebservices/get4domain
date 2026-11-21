import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_SETTING_KEYS, DomainSettings, resolveDomainSettings } from './domain-settings';

const TTL_MS = 30_000;

/** Reads the domain settings from g4d_plan_settings, defaults for anything missing or invalid, kept for 30 seconds (the by-host path reads them on every uncached lookup). */
@Injectable()
export class DomainSettingsService {
  private cached: { at: number; v: DomainSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void { this.cached = null; }

  async get(): Promise<DomainSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: DOMAIN_SETTING_KEYS } } });
    const v = resolveDomainSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
