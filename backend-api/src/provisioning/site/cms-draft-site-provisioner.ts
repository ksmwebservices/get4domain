import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PackConfig } from '../../site-doc/pack.types';
import { StarterService } from '../../site-doc/starter.service';
import { CreateDraftSiteInput, SiteProvisioner } from './site-provisioner';

/**
 * The real adapter for slice 5.3: builds the draft through the EXISTING site code. The site is the vendor's VendorCMS row with siteStatus DRAFT; its content
 * comes from the category pack's starter content (StarterService.seed in 'draft' mode, which only fills empty fields, so running it twice is safe). A category
 * with no pack, a disabled pack or a pack without starter content gets the neutral default: an empty DRAFT site the vendor fills in.
 *
 * It does not create the site_doc_v2 add-on row: that table is legacy (decision D1). Whether the renderer needs it is a slice 5.4 question (design note D-4).
 */
@Injectable()
export class CmsDraftSiteProvisioner extends SiteProvisioner {
  constructor(private readonly prisma: PrismaService, private readonly starter: StarterService) { super(); }

  async createDraftSite(i: CreateDraftSiteInput): Promise<{ siteId: string }> {
    const pack = await this.prisma.categoryPack.findUnique({ where: { key: i.category } });
    const seedable = pack !== null && pack.enabled && Boolean((pack.config as unknown as PackConfig | null)?.seed);
    // create-or-keep: an existing site keeps its status (it may have been published since); a new one is always DRAFT
    const cms = await this.prisma.vendorCMS.upsert({
      where: { vendorId: i.vendorId },
      create: { vendorId: i.vendorId, siteStatus: 'DRAFT', businessName: i.businessName, ...(i.phone ? { phone: i.phone } : {}), ...(seedable ? { packKey: pack!.key } : {}) },
      update: {},
    });
    if (seedable) await this.starter.seed(i.vendorId, pack!.key, { businessName: i.businessName, city: i.city, phone: i.phone }, 'draft');
    return { siteId: cms.id };
  }
}
