import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BILLING_SETTING_KEYS, BillingSettings, resolveBillingSettings } from './billing-settings';

const TTL_MS = 15_000;
const EXTRA_KEYS = ['graceDays', 'upgradeProration', 'renewalReminderDays'];

/** Reads the billing settings (and the three slice 5.1 keys it needs) from g4d_plan_settings, defaults for anything missing or invalid, kept for 15 seconds. */
@Injectable()
export class BillingSettingsService {
  private cached: { at: number; v: BillingSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void { this.cached = null; }

  async get(): Promise<BillingSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: [...BILLING_SETTING_KEYS, ...EXTRA_KEYS] } } });
    const v = resolveBillingSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
