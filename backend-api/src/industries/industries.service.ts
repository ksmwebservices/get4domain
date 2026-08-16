import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  INDUSTRY_CONFIGS,
  IndustryConfig,
  getIndustryConfigWithSkin,
  resolveIndustryKey,
  listIndustries,
} from '../config/industries';
import { PrismaService } from '../prisma/prisma.service';

/** 3C per-vendor override shape (all optional, layered on the industry skin). */
export interface VendorConfigOverride {
  accentColor?: string;
  accentColorDark?: string;
  welcomeText?: string;
  websiteTemplate?: string;
}

@Injectable()
export class IndustriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** All full industry configs (used for admin dropdowns / previews). */
  findAll(): IndustryConfig[] {
    return Object.values(INDUSTRY_CONFIGS);
  }

  /** Lightweight list (key/label/icon) for signup + admin dropdowns. */
  findAllSummary(): { key: string; label: string; icon: string }[] {
    return listIndustries();
  }

  /**
   * Single industry config, used heavily by the frontend to drive per-vendor
   * dashboard rendering. Unknown keys fall back to `general`, except an
   * explicit lookup of a non-existent, non-general key returns 404.
   */
  findOne(key: string): IndustryConfig {
    if (!resolveIndustryKey(key)) {
      throw new NotFoundException(`Unknown industry: ${key}`);
    }
    return getIndustryConfigWithSkin(key);
  }

  /** 3C — the caller vendor's resolved config: industry skin baseline + their
   *  admin-set per-vendor override merged on top (DB-driven, applied live). */
  async resolveForVendor(vendorId: string): Promise<IndustryConfig> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    const cfg = getIndustryConfigWithSkin(vendor?.industry ?? 'general');
    const ov = (vendor?.configOverride ?? null) as VendorConfigOverride | null;
    if (!ov) return cfg;
    return {
      ...cfg,
      ...(ov.websiteTemplate ? { websiteTemplate: ov.websiteTemplate } : {}),
      skin: cfg.skin
        ? {
            ...cfg.skin,
            ...(ov.accentColor ? { accentColor: ov.accentColor } : {}),
            ...(ov.accentColorDark ? { accentColorDark: ov.accentColorDark } : {}),
            ...(ov.welcomeText ? { welcomeText: ov.welcomeText } : {}),
          }
        : cfg.skin,
    };
  }

  /** Admin: read a vendor's override. */
  async getOverride(vendorId: string): Promise<VendorConfigOverride> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!v) throw new NotFoundException('Vendor not found');
    return (v.configOverride ?? {}) as VendorConfigOverride;
  }

  /** Admin: set a vendor's override (applied live, no redeploy). */
  async setOverride(vendorId: string, override: VendorConfigOverride): Promise<VendorConfigOverride> {
    const v = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { configOverride: override as unknown as Prisma.InputJsonValue },
    });
    return (v.configOverride ?? {}) as VendorConfigOverride;
  }
}
