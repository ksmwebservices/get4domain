import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SiteLocationRow {
  vendorId: string; addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; pincode: string | null;
  latitude: number | null; longitude: number | null; mapLinkInput: string | null; directionsUrl: string | null; version: number;
}
export type NewSiteLocation = Omit<SiteLocationRow, 'vendorId' | 'version'>;

/** The staff projection of a vendor's live location (slice B2). Prisma below; a memory twin lives in test/support. One row per vendor; a vendor with no location has no row. */
export abstract class SiteLocationStore {
  /** Replaces the vendor's row, or removes it when `row` is null. */
  abstract replace(vendorId: string, version: number, row: NewSiteLocation | null): Promise<void>;
  abstract get(vendorId: string): Promise<SiteLocationRow | null>;
}

@Injectable()
export class PrismaSiteLocationStore extends SiteLocationStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async replace(vendorId: string, version: number, row: NewSiteLocation | null): Promise<void> {
    if (!row) { await this.prisma.v3SiteLocation.deleteMany({ where: { vendorId } }); return; }
    await this.prisma.v3SiteLocation.upsert({ where: { vendorId }, create: { vendorId, version, ...row }, update: { version, ...row } });
  }
  async get(vendorId: string) { return (await this.prisma.v3SiteLocation.findUnique({ where: { vendorId } })) as SiteLocationRow | null; }
}
