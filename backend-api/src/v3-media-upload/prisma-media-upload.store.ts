import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaRow, MediaUploadStore, NewMedia } from './media-upload.store';

type Row = { id: string; vendorId: string | null; scopeKey: string; ownerKind: string; kind: string; contentType: string; bytes: number; sha256: string; width: number | null; height: number | null; key: string; url: string; altText: string | null; status: string; uploadedByType: string; uploadedById: string | null; createdAt: Date; removedAt: Date | null };
const shape = (r: Row): MediaRow => ({ ...r, ownerKind: r.ownerKind as MediaRow['ownerKind'], kind: r.kind as MediaRow['kind'], status: r.status as MediaRow['status'] });

@Injectable()
export class PrismaMediaUploadStore extends MediaUploadStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async findBySha(scopeKey: string, sha256: string): Promise<MediaRow | null> { const r = await this.prisma.v3Media.findUnique({ where: { scopeKey_sha256: { scopeKey, sha256 } } }); return r ? shape(r) : null; }
  async create(row: NewMedia): Promise<MediaRow> {
    return shape(await this.prisma.v3Media.create({ data: { ...row, ownerKind: row.ownerKind, kind: row.kind } }));
  }
  async revive(scopeKey: string, id: string, altText: string | null): Promise<MediaRow | null> {
    const done = await this.prisma.v3Media.updateMany({ where: { id, scopeKey }, data: { status: 'ACTIVE', removedAt: null, altText } });
    return done.count === 1 ? this.get(scopeKey, id) : null;
  }
  async list(scopeKey: string, skip: number, take: number): Promise<{ items: MediaRow[]; total: number }> {
    const where = { scopeKey, status: 'ACTIVE' };
    const [items, total] = await Promise.all([this.prisma.v3Media.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3Media.count({ where })]);
    return { items: items.map(shape), total };
  }
  async get(scopeKey: string, id: string): Promise<MediaRow | null> { const r = await this.prisma.v3Media.findFirst({ where: { id, scopeKey } }); return r ? shape(r) : null; }
  async softRemove(scopeKey: string, id: string, at: Date): Promise<boolean> {
    return (await this.prisma.v3Media.updateMany({ where: { id, scopeKey, status: 'ACTIVE' }, data: { status: 'REMOVED', removedAt: at } })).count === 1;
  }
  async vendorOfListing(seededSiteId: string): Promise<string | null> {
    const r = await this.prisma.v3SeededSite.findUnique({ where: { id: seededSiteId }, select: { vendorId: true, lifecycle: true } });
    return r && r.lifecycle !== 'REMOVED' ? r.vendorId : null;
  }
}
