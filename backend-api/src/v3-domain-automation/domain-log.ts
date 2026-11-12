import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DomainLogRow { id: string; at: Date; actionKey: string; actorType: string; actorId: string | null; entityId: string | null; summary: Record<string, unknown> }

/** The per-vendor domain log (owner answer Q12): the vendor's domain events, newest first, with time and actor. A read model over the activity log; nothing is written here. */
export abstract class DomainLogStore {
  abstract forVendor(vendorId: string, skip: number, take: number): Promise<{ items: DomainLogRow[]; total: number }>;
}

@Injectable()
export class PrismaDomainLogStore extends DomainLogStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async forVendor(vendorId: string, skip: number, take: number) {
    const where = { vendorId, actionKey: { startsWith: 'domain.' } };
    const [rows, total] = await Promise.all([this.prisma.v3ActivityLog.findMany({ where, orderBy: [{ at: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3ActivityLog.count({ where })]);
    return { items: rows.map((r) => ({ id: r.id, at: r.at, actionKey: r.actionKey, actorType: r.actorType, actorId: r.actorId, entityId: r.entityId, summary: (r.summaryJson && typeof r.summaryJson === 'object' && !Array.isArray(r.summaryJson) ? r.summaryJson : {}) as Record<string, unknown> })), total };
  }
}

@Injectable()
export class DomainLogService {
  constructor(private readonly store: DomainLogStore) {}
  async forVendor(vendorId: string, page: number, pageSize: number) {
    const { items, total } = await this.store.forVendor(String(vendorId).slice(0, 64), (page - 1) * pageSize, pageSize);
    return { items, page, pageSize, total };
  }
}
