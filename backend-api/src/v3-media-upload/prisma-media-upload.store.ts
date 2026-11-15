import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaRow, MediaUploadStore, NewMedia } from './media-upload.store';

type Row = { groupToken: string | null; id: string; vendorId: string | null; scopeKey: string; ownerKind: string; kind: string; contentType: string; bytes: number; sha256: string; width: number | null; height: number | null; key: string; url: string; altText: string | null; status: string; uploadedByType: string; uploadedById: string | null; createdAt: Date; removedAt: Date | null };
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
  async setGroup(scopeKey: string, id: string, groupToken: string): Promise<void> { await this.prisma.v3Media.updateMany({ where: { id, scopeKey }, data: { groupToken } }); }
  async attachDrafts(staffId: string, groupToken: string, vendorId: string, at: Date): Promise<{ attached: MediaRow[]; skipped: MediaRow[]; alreadyAttached: number }> {
    const from = `draft:${staffId}`; const to = `vendor:${vendorId}`;
    return this.prisma.$transaction(async (tx) => {
      const drafts = await tx.v3Media.findMany({ where: { scopeKey: from, groupToken, uploadedById: staffId, status: 'ACTIVE', vendorId: null }, orderBy: { createdAt: 'asc' } });
      const attached: MediaRow[] = []; const skipped: MediaRow[] = [];
      for (const d of drafts) {
        const have = await tx.v3Media.findUnique({ where: { scopeKey_sha256: { scopeKey: to, sha256: d.sha256 } } });
        if (have) { await tx.v3Media.update({ where: { id: d.id }, data: { status: 'REMOVED', removedAt: at } }); skipped.push(shape({ ...d, status: 'REMOVED', removedAt: at })); continue; }
        const moved = await tx.v3Media.update({ where: { id: d.id }, data: { vendorId, scopeKey: to, ownerKind: 'VENDOR_SITE' } });
        attached.push(shape(moved));
      }
      const already = await tx.v3Media.count({ where: { scopeKey: to, groupToken, uploadedById: staffId, status: 'ACTIVE' } });
      return { attached, skipped, alreadyAttached: Math.max(0, already - attached.length) };
    });
  }
  async vendorOfListing(seededSiteId: string): Promise<string | null> {
    const r = await this.prisma.v3SeededSite.findUnique({ where: { id: seededSiteId }, select: { vendorId: true, lifecycle: true } });
    return r && r.lifecycle !== 'REMOVED' ? r.vendorId : null;
  }
}
