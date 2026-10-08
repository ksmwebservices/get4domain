import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADDON_KEYS,
  AVAILABLE_ADDONS,
  AVAILABLE_MODULES,
  AddonDefinition,
  ModuleDefinition,
  MODULE_KEYS,
  NAV_V2_DEFAULT_FROM,
} from './addons.constants';

export interface AddonState extends AddonDefinition {
  enabled: boolean;
}
export interface ModuleState extends ModuleDefinition {
  enabled: boolean;
}

@Injectable()
export class AddonsService {
  constructor(private readonly prisma: PrismaService) {}

  listAddons(): AddonDefinition[] {
    return AVAILABLE_ADDONS;
  }

  listModules(): ModuleDefinition[] {
    return AVAILABLE_MODULES;
  }

  async getVendorAddons(vendorId: string): Promise<AddonState[]> {
    const rows = await this.prisma.vendorAddon.findMany({ where: { vendorId } });
    const byKey = new Map(rows.map((r) => [r.addonKey, r.enabled]));
    // Dashboard v2 is ON by default only for vendors created after the release; an explicit row (set by KSM's script) always wins.
    const navV2Default = byKey.has('nav_v2') ? false : await this.navV2DefaultFor(vendorId);
    return AVAILABLE_ADDONS.map((def) => ({
      ...def,
      enabled: byKey.has(def.key) ? Boolean(byKey.get(def.key)) : def.key === 'nav_v2' ? navV2Default : def.defaultEnabled,
    }));
  }

  /** True when the vendor was created on/after NAV_V2_DEFAULT_FROM (and no explicit nav_v2 row exists). */
  async navV2DefaultFor(vendorId: string): Promise<boolean> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { createdAt: true } });
    return Boolean(v && v.createdAt.getTime() >= new Date(NAV_V2_DEFAULT_FROM).getTime());
  }

  async getVendorModules(vendorId: string): Promise<ModuleState[]> {
    const rows = await this.prisma.vendorModule.findMany({ where: { vendorId } });
    const byKey = new Map(rows.map((r) => [r.moduleKey, r.enabled]));
    return AVAILABLE_MODULES.map((def) => ({
      ...def,
      enabled: byKey.has(def.key) ? Boolean(byKey.get(def.key)) : def.defaultEnabled,
    }));
  }

  async setAddon(vendorId: string, addonKey: string, enabled: boolean): Promise<AddonState[]> {
    if (!ADDON_KEYS.has(addonKey)) {
      throw new BadRequestException(`Unknown addon: ${addonKey}`);
    }
    await this.prisma.vendorAddon.upsert({
      where: { vendorId_addonKey: { vendorId, addonKey } },
      create: { vendorId, addonKey, enabled },
      update: { enabled },
    });
    return this.getVendorAddons(vendorId);
  }

  async setModule(vendorId: string, moduleKey: string, enabled: boolean): Promise<ModuleState[]> {
    if (!MODULE_KEYS.has(moduleKey)) {
      throw new BadRequestException(`Unknown module: ${moduleKey}`);
    }
    await this.prisma.vendorModule.upsert({
      where: { vendorId_moduleKey: { vendorId, moduleKey } },
      create: { vendorId, moduleKey, enabled },
      update: { enabled },
    });
    return this.getVendorModules(vendorId);
  }
}
