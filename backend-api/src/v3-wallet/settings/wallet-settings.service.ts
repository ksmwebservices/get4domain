import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WALLET_SETTING_KEYS, WalletSettings, resolveWalletSettings } from './wallet-settings';

const TTL_MS = 15_000;

/** Reads the wallet settings from g4d_plan_settings: defaults for anything missing or invalid, kept 15 seconds in process memory (invalidate() after a write). */
@Injectable()
export class WalletSettingsService {
  private cached: { at: number; v: WalletSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void { this.cached = null; }

  async get(): Promise<WalletSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: WALLET_SETTING_KEYS } } });
    const v = resolveWalletSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
