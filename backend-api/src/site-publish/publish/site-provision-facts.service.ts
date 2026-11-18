import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Why a site is not there yet: a status word and a CODE, never an error text (the registration hook stores only codes). */
export interface ProvisionFacts { siteProvisionStatus: string | null; siteProvisionCode: string | null; siteProvisionFailedAt: string | null }
export interface AdminSiteFacts extends ProvisionFacts { status: string | null; subdomain: string | null; address: string | null }

/** B5.4 / B5.5: read-only facts about how a vendor's site came to be, kept apart from SiteSettingsService so the two controllers can add them to their answers. */
@Injectable()
export class SiteProvisionFacts {
  constructor(private readonly prisma: PrismaService) {}

  async provision(vendorId: string): Promise<ProvisionFacts> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { siteProvisionStatus: true, siteProvisionCode: true, siteProvisionFailedAt: true } });
    return { siteProvisionStatus: v?.siteProvisionStatus ?? null, siteProvisionCode: v?.siteProvisionCode ?? null, siteProvisionFailedAt: v?.siteProvisionFailedAt?.toISOString() ?? null };
  }

  /** The staff view: the vendor's status, its free address and the address shown on the site, with the provision facts. */
  async forAdmin(vendorId: string): Promise<AdminSiteFacts> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { status: true, subdomain: true, siteProvisionStatus: true, siteProvisionCode: true, siteProvisionFailedAt: true, cms: { select: { address: true } } } });
    return {
      status: v?.status ?? null, subdomain: v?.subdomain ?? null, address: v?.cms?.address ?? null,
      siteProvisionStatus: v?.siteProvisionStatus ?? null, siteProvisionCode: v?.siteProvisionCode ?? null, siteProvisionFailedAt: v?.siteProvisionFailedAt?.toISOString() ?? null,
    };
  }
}
