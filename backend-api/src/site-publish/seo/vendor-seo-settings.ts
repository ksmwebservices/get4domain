import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PageTemplate } from '../../seo-directory/core/default-templates';
import { resolveSeoCrawlers, resolveSeoTemplates, SEO_CRAWLERS_KEY, SEO_TEMPLATES_KEY } from '../../seo-directory/settings/seo-settings';

export interface VendorSeoSettingsValue { vendorHome: PageTemplate; vendorPage: PageTemplate; crawlers: string[] }

/**
 * What the site build reads from the SEO block (slice 6): the staff-editable vendorHome and vendorPage templates and the list of crawlers robots.txt names. A read only port, so the
 * publisher never depends on the SEO module; absent (tests, older builds) = the build keeps its previous text. Invalid stored values fall back to the defaults (resolve*).
 */
export abstract class VendorSeoSettings { abstract get(): Promise<VendorSeoSettingsValue> }

const TTL_MS = 30_000;
@Injectable()
export class PrismaVendorSeoSettings extends VendorSeoSettings {
  clock: () => number = () => Date.now();
  private cached: { at: number; v: VendorSeoSettingsValue } | null = null;
  constructor(private readonly prisma: PrismaService) { super(); }
  async get(): Promise<VendorSeoSettingsValue> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < TTL_MS) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: [SEO_TEMPLATES_KEY, SEO_CRAWLERS_KEY] } } });
    const by = new Map(rows.map((r) => [r.key, r.valueJson]));
    const t = resolveSeoTemplates(by.get(SEO_TEMPLATES_KEY));
    const v = { vendorHome: t.vendorHome, vendorPage: t.vendorPage, crawlers: resolveSeoCrawlers(by.get(SEO_CRAWLERS_KEY)) };
    this.cached = { at: now, v };
    return v;
  }
}
