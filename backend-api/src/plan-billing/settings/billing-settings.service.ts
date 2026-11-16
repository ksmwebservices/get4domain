import { Injectable, Optional } from '@nestjs/common';
import { FirmService } from '../../v3-firm/firm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BILLING_SETTING_KEYS, BillingSettings, resolveBillingSettings } from './billing-settings';

const TTL_MS = 15_000;
const EXTRA_KEYS = ['graceDays', 'upgradeProration', 'renewalReminderDays'];

/** Reads the billing settings (and the three slice 5.1 keys it needs) from g4d_plan_settings, defaults for anything missing or invalid, kept for 15 seconds. */
@Injectable()
export class BillingSettingsService {
  private cached: { at: number; v: BillingSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService, @Optional() private readonly firm?: FirmService) {}

  invalidate(): void { this.cached = null; }

  /**
   * The stored settings with the SELLER of the invoice taken from the firm profile (v3-firm), so the plan invoice and the wallet tax invoice print the same company as every other document. The three
   * seller keys that used to be stored here are no longer read when the profile is present; an unset GSTIN is an empty text, which the invoice page leaves out.
   */
  async get(): Promise<BillingSettings> {
    const v = await this.stored();
    if (!this.firm) return v;
    const f = await this.firm.seller();
    return { ...v, invoiceSellerName: f.name, invoiceSellerAddress: f.address, invoiceSellerGstin: f.gstin };
  }

  private async stored(): Promise<BillingSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: [...BILLING_SETTING_KEYS, ...EXTRA_KEYS] } } });
    const v = resolveBillingSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
