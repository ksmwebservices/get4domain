import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PictureRow { id: string; vendorId: string; storagePath: string; url: string; contentType: string; bytes: number; width: number; height: number; altText: string; sha256: string; uploadedByType: 'SYSTEM' | 'STAFF' | 'VENDOR'; uploadedById: string | null; createdAt: Date; deletedAt: Date | null }
export type NewPicture = Omit<PictureRow, 'id' | 'createdAt' | 'deletedAt'>;
export interface BannerRow { id: string; categoryId: string; storagePath: string; url: string; contentType: string; bytes: number; width: number; height: number; altText: string; hasPeople: boolean; sourceUrl: string; author: string; licenceName: string; obtainedOn: string; sha256: string; active: boolean; createdAt: Date }
export type NewBanner = Omit<BannerRow, 'id' | 'createdAt' | 'active'>;

/** Pictures (per vendor) and the Banner Library (platform data). Prisma below; a memory twin lives in test/support. Every picture query names the vendor. */
export abstract class MediaStore {
  abstract findPictureBySha(vendorId: string, sha256: string): Promise<PictureRow | null>;
  abstract createPicture(p: NewPicture): Promise<PictureRow>;
  abstract revivePicture(vendorId: string, id: string, altText: string): Promise<PictureRow | null>;
  abstract getPicture(vendorId: string, id: string): Promise<PictureRow | null>;
  abstract listPictures(vendorId: string): Promise<PictureRow[]>;
  abstract softDeletePicture(vendorId: string, id: string, at: Date): Promise<boolean>;
  abstract listBanners(f: { categoryId?: string; activeOnly?: boolean }): Promise<BannerRow[]>;
  abstract getBanner(id: string): Promise<BannerRow | null>;
  abstract upsertBanner(b: NewBanner): Promise<{ row: BannerRow; created: boolean }>;
  abstract setBannerActive(id: string, active: boolean): Promise<BannerRow | null>;
}

@Injectable()
export class PrismaMediaStore extends MediaStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async findPictureBySha(vendorId: string, sha256: string) { return (await this.prisma.v3SitePicture.findUnique({ where: { vendorId_sha256: { vendorId, sha256 } } })) as PictureRow | null; }
  async createPicture(p: NewPicture) { return (await this.prisma.v3SitePicture.create({ data: p })) as PictureRow; }
  async revivePicture(vendorId: string, id: string, altText: string) {
    const done = await this.prisma.v3SitePicture.updateMany({ where: { vendorId, id }, data: { deletedAt: null, altText } });
    return done.count ? this.getPicture(vendorId, id) : null;
  }
  async getPicture(vendorId: string, id: string) { return (await this.prisma.v3SitePicture.findFirst({ where: { vendorId, id, deletedAt: null } })) as PictureRow | null; }
  async listPictures(vendorId: string) { return (await this.prisma.v3SitePicture.findMany({ where: { vendorId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 500 })) as PictureRow[]; }
  async softDeletePicture(vendorId: string, id: string, at: Date) { return (await this.prisma.v3SitePicture.updateMany({ where: { vendorId, id, deletedAt: null }, data: { deletedAt: at } })).count === 1; }
  async listBanners(f: { categoryId?: string; activeOnly?: boolean }) { return (await this.prisma.v3BannerImage.findMany({ where: { ...(f.categoryId ? { categoryId: f.categoryId } : {}), ...(f.activeOnly ? { active: true } : {}) }, orderBy: [{ categoryId: 'asc' }, { createdAt: 'asc' }], take: 1000 })) as BannerRow[]; }
  async getBanner(id: string) { return (await this.prisma.v3BannerImage.findUnique({ where: { id } })) as BannerRow | null; }
  async upsertBanner(b: NewBanner) {
    const had = await this.prisma.v3BannerImage.findUnique({ where: { categoryId_sha256: { categoryId: b.categoryId, sha256: b.sha256 } } });
    const row = await this.prisma.v3BannerImage.upsert({ where: { categoryId_sha256: { categoryId: b.categoryId, sha256: b.sha256 } }, create: b, update: { altText: b.altText, hasPeople: b.hasPeople, sourceUrl: b.sourceUrl, author: b.author, licenceName: b.licenceName, obtainedOn: b.obtainedOn } });
    return { row: row as BannerRow, created: !had };
  }
  async setBannerActive(id: string, active: boolean) { const d = await this.prisma.v3BannerImage.updateMany({ where: { id }, data: { active } }); return d.count ? this.getBanner(id) : null; }
}
