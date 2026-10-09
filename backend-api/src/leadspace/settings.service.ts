import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_BLOCKLIST } from './leadspace.types';

/** Admin-editable LeadSpace rules. Everything here is data (table g4d_leadspace_settings), never a code constant at the point of use. */
export interface LsSettings {
  /** the same phone asking the same vendor for the same thing inside this window is one lead (no second charge) */
  dedupeWindowHours: number;
  /** a repeat of that inside this window but outside the dedupe window is captured and credited back automatically */
  autoCreditWindowHours: number;
  /** a vendor may dispute a delivered lead for this long */
  disputeWindowHours: number;
  otpTtlMinutes: number;
  otpMaxAttempts: number;
  otpPerPhonePerHour: number;
  otpPerDevicePerHour: number;
  otpPerIpPerHour: number;
  /** wallet low-balance alerts, highest first, in paise */
  lowBalanceThresholdsPaise: number[];
  /** warn when (price charged per verified lead minus cost per lead, after GST) / price falls below this */
  marginFloorPercent: number;
  gstPercent: number;
  refundWindowMonths: number;
  expiryMonths: number;
  globalKillSwitch: boolean;
  pagesPerIpPerDay: number;
  blocklistWords: string[];
  /** daily post cap per channel, per Get4Domain account (an account may override with its own dailyCap) */
  channelDailyCaps: Record<string, number>;
  /** how long a new vendor's posts need an admin's approval */
  manualApprovalDays: number;
  /** a vendor sending more than this many OTPs a day that never complete is flagged */
  vendorSpamOtpPerDay: number;
}

export const LS_DEFAULTS: LsSettings = {
  dedupeWindowHours: 12,
  autoCreditWindowHours: 48,
  disputeWindowHours: 48,
  otpTtlMinutes: 5,
  otpMaxAttempts: 5,
  otpPerPhonePerHour: 3,
  otpPerDevicePerHour: 8,
  otpPerIpPerHour: 20,
  lowBalanceThresholdsPaise: [50000, 20000],
  marginFloorPercent: 50,
  gstPercent: 18,
  refundWindowMonths: 12,
  expiryMonths: 24,
  globalKillSwitch: false,
  pagesPerIpPerDay: 5,
  blocklistWords: DEFAULT_BLOCKLIST,
  channelDailyCaps: { FACEBOOK_PAGE: 3, INSTAGRAM: 3, TELEGRAM: 6, GOOGLE_BUSINESS: 1 },
  manualApprovalDays: 14,
  vendorSpamOtpPerDay: 60,
};

@Injectable()
export class LeadspaceSettingsService {
  private cache: { at: number; value: LsSettings } | null = null;
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<LsSettings> {
    if (this.cache && Date.now() - this.cache.at < 5_000) return this.cache.value;
    const rows = await this.prisma.leadspaceSetting.findMany();
    const merged: Record<string, unknown> = { ...LS_DEFAULTS };
    for (const r of rows) if (r.key in LS_DEFAULTS) merged[r.key] = r.value;
    const value = merged as unknown as LsSettings;
    this.cache = { at: Date.now(), value };
    return value;
  }

  async set(key: keyof LsSettings, value: unknown, by: string): Promise<LsSettings> {
    if (!(key in LS_DEFAULTS)) throw new BadRequestException('That setting does not exist.');
    const model = LS_DEFAULTS[key];
    const bad = new BadRequestException(`The value for ${key} is not in the right form.`);
    if (typeof model === 'boolean' && typeof value !== 'boolean') throw bad;
    if (typeof model === 'number' && !(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000)) throw bad;
    if (Array.isArray(model)) {
      const wantNumbers = typeof model[0] === 'number';
      if (!Array.isArray(value) || value.length > 200 || !value.every((v) => (wantNumbers ? typeof v === 'number' && Number.isFinite(v) && v >= 0 : typeof v === 'string' && v.length <= 60))) throw bad;
    }
    if (!Array.isArray(model) && typeof model === 'object' && !(value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0))) throw bad;
    await this.prisma.leadspaceSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue, updatedBy: by }, update: { value: value as Prisma.InputJsonValue, updatedBy: by } });
    this.cache = null;
    return this.get();
  }

  invalidate(): void { this.cache = null; }
}
