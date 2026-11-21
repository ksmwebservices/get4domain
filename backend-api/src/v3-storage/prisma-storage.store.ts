import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessAction, AccessEntry, AccessRow, StorageAccessStore } from './storage.ports';

@Injectable()
export class PrismaStorageAccessStore extends StorageAccessStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async record(e: AccessEntry, at: Date): Promise<void> {
    await this.prisma.v3StorageAccess.create({ data: { vendorId: e.vendorId, bucket: e.bucket, objectKey: e.objectKey, action: e.action, actorType: e.actorType, actorId: e.actorId, purpose: e.purpose, createdAt: at } });
  }
  async list(vendorId: string, skip: number, take: number): Promise<{ items: AccessRow[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.v3StorageAccess.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.v3StorageAccess.count({ where: { vendorId } }),
    ]);
    return { items: rows.map((r) => ({ id: r.id, vendorId: r.vendorId, bucket: 'PRIVATE' as const, objectKey: r.objectKey, action: r.action as AccessAction, actorType: r.actorType, actorId: r.actorId, purpose: r.purpose, createdAt: r.createdAt })), total };
  }
}
