import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PageSeoRow { vendorId: string; pageKey: string; seoTitle: string; seoDescription: string; shareImageRef: string | null; customTitle: boolean; customDescription: boolean; version: number }
export type NewPageSeoRow = Omit<PageSeoRow, 'vendorId' | 'version'>;

/** The staff projection of per-page SEO (slice B1). Prisma below; a memory twin lives in test/support. Writes are always for one vendor; reads name the vendor or are the staff report. */
export abstract class PageSeoStore {
  /** Replaces every row of one vendor with `rows`, in one transaction. */
  abstract replaceForVendor(vendorId: string, version: number, rows: readonly NewPageSeoRow[]): Promise<void>;
  abstract listForVendor(vendorId: string): Promise<PageSeoRow[]>;
  /** The staff report's source: rows of one vendor, or of all vendors (bounded). */
  abstract listAll(vendorId: string | undefined, take: number): Promise<PageSeoRow[]>;
}

@Injectable()
export class PrismaPageSeoStore extends PageSeoStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async replaceForVendor(vendorId: string, version: number, rows: readonly NewPageSeoRow[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.v3PageSeo.deleteMany({ where: { vendorId } }),
      this.prisma.v3PageSeo.createMany({ data: rows.map((r) => ({ vendorId, version, ...r })) }),
    ]);
  }
  async listForVendor(vendorId: string) { return (await this.prisma.v3PageSeo.findMany({ where: { vendorId }, orderBy: { pageKey: 'asc' } })) as PageSeoRow[]; }
  async listAll(vendorId: string | undefined, take: number) { return (await this.prisma.v3PageSeo.findMany({ where: vendorId ? { vendorId } : {}, orderBy: [{ vendorId: 'asc' }, { pageKey: 'asc' }], take })) as PageSeoRow[]; }
}
