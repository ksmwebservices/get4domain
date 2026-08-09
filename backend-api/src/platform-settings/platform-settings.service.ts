import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CATEGORY_MAP,
  SETTING_CATEGORIES,
  SettingDefinition,
  findSetting,
} from './platform-settings.constants';
import { decryptSecret, encryptSecret, maskSecret } from './crypto.util';

export interface SettingView {
  category: string;
  key: string;
  label: string;
  secret: boolean;
  status: string;
  maskedValue: string;
  configured: boolean;
  source: 'db' | 'env' | 'none';
}

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private viewFor(
    def: SettingDefinition,
    category: string,
    dbRow: { value: string; status: string } | undefined,
  ): SettingView {
    let displayValue = '';
    let source: 'db' | 'env' | 'none' = 'none';
    let status = 'NOT_CONFIGURED';

    if (dbRow) {
      try {
        displayValue = decryptSecret(dbRow.value);
        source = 'db';
        status = dbRow.status || 'CONFIGURED';
      } catch {
        // Corrupt/tampered value — surface as not configured rather than leak.
        this.logger.warn(`Failed to decrypt ${category}/${def.key}`);
      }
    } else if (process.env[def.envFallback]) {
      displayValue = process.env[def.envFallback] as string;
      source = 'env';
      status = 'ENV_FALLBACK';
    }

    return {
      category,
      key: def.key,
      label: def.label,
      secret: def.secret,
      status,
      maskedValue: def.secret ? maskSecret(displayValue) : displayValue,
      configured: source !== 'none',
      source,
    };
  }

  async getAll(): Promise<{ category: string; label: string; settings: SettingView[] }[]> {
    const rows = await this.prisma.platformSetting.findMany();
    const rowMap = new Map(rows.map((r) => [`${r.category}:${r.key}`, r]));
    return SETTING_CATEGORIES.map((cat) => ({
      category: cat.key,
      label: cat.label,
      settings: cat.settings.map((def) => this.viewFor(def, cat.key, rowMap.get(`${cat.key}:${def.key}`))),
    }));
  }

  async getCategory(category: string): Promise<SettingView[]> {
    const cat = CATEGORY_MAP.get(category);
    if (!cat) {
      throw new NotFoundException(`Unknown settings category: ${category}`);
    }
    const rows = await this.prisma.platformSetting.findMany({ where: { category } });
    const rowMap = new Map(rows.map((r) => [r.key, r]));
    return cat.settings.map((def) => this.viewFor(def, category, rowMap.get(def.key)));
  }

  async setSetting(category: string, key: string, value: string, updatedBy?: string): Promise<SettingView> {
    const def = findSetting(category, key);
    if (!def) {
      throw new BadRequestException(`Unknown setting: ${category}/${key}`);
    }
    const encrypted = encryptSecret(value);
    await this.prisma.platformSetting.upsert({
      where: { category_key: { category, key } },
      create: { category, key, value: encrypted, encrypted: true, status: 'CONFIGURED', updatedBy },
      update: { value: encrypted, status: 'CONFIGURED', updatedBy },
    });
    this.logger.log(`Setting ${category}/${key} updated by ${updatedBy ?? 'unknown'}`);
    const view = this.viewFor(def, category, { value: encrypted, status: 'CONFIGURED' });
    return view;
  }

  /**
   * Basic reachability/config test. Confirms a decryptable value (or env
   * fallback) is present. Real provider pings are added when each provider's
   * live integration is wired (mock-first strategy).
   */
  async testSetting(category: string, key: string): Promise<{ status: 'ok' | 'error'; message: string }> {
    const def = findSetting(category, key);
    if (!def) {
      throw new BadRequestException(`Unknown setting: ${category}/${key}`);
    }
    const value = await this.getResolvedValue(category, key);
    if (!value) {
      return { status: 'error', message: 'Not configured' };
    }
    return { status: 'ok', message: 'Value present (basic check — live provider ping pending real integration)' };
  }

  /**
   * Resolves the effective value for other modules: decrypted DB value if set,
   * otherwise process.env fallback. Returns null if neither is present.
   */
  async getResolvedValue(category: string, key: string): Promise<string | null> {
    const def = findSetting(category, key);
    if (!def) return null;
    const row = await this.prisma.platformSetting.findUnique({
      where: { category_key: { category, key } },
    });
    if (row) {
      try {
        return decryptSecret(row.value);
      } catch {
        this.logger.warn(`Failed to decrypt ${category}/${key}; falling back to env`);
      }
    }
    return process.env[def.envFallback] ?? null;
  }
}
