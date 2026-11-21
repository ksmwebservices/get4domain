import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PROVISIONING_SETTING_KEYS, ProvisioningSettings, resolveProvisioningSettings } from './provisioning-settings';

/** Reads the provisioning settings from g4d_plan_settings (V3 table), defaults for anything missing or invalid. */
@Injectable()
export class ProvisioningSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ProvisioningSettings> {
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: PROVISIONING_SETTING_KEYS } } });
    return resolveProvisioningSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
  }
}
