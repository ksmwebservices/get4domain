import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DomainLogRow { id: string; at: Date; actionKey: string; actorType: string; actorId: string | null; entityId: string | null; summary: Record<string, unknown> }

/** The per-vendor domain log (owner answer Q12): the vendor's domain events, newest first, with time and actor. A read model over the activity log; nothing is written here. */
export abstract class DomainLogStore {
  /** `entityId` keeps one domain's events; `actionPrefix` narrows the kind (default every `domain.` event). The vendor is always in the where clause. */
  abstract forVendor(vendorId: string, skip: number, take: number, opts?: { entityId?: string; actionPrefix?: string }): Promise<{ items: DomainLogRow[]; total: number }>;
}

@Injectable()
export class PrismaDomainLogStore extends DomainLogStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async forVendor(vendorId: string, skip: number, take: number, opts: { entityId?: string; actionPrefix?: string } = {}) {
    const where = { vendorId, actionKey: { startsWith: opts.actionPrefix ?? 'domain.' }, ...(opts.entityId ? { entityId: opts.entityId } : {}) };
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

  /** C8: the subdomain log of one vendor, apart from the custom-domain events (staff). */
  async subdomainsForVendor(vendorId: string, page: number, pageSize: number) {
    const { items, total } = await this.store.forVendor(String(vendorId).slice(0, 64), (page - 1) * pageSize, pageSize, { actionPrefix: 'domain.subdomain' });
    return { items, page, pageSize, total };
  }

  /**
   * B2: the log of ONE of the vendor's own domains, as the vendor's screen needs it: when, what the check found and how many tries. The caller has already confirmed the domain is theirs. A staff member's id
   * is never shown: `by` is only YOU, GET4DOMAIN or SYSTEM.
   */
  async forDomainMine(vendorId: string, domainId: string, page: number, pageSize: number) {
    const { items, total } = await this.store.forVendor(String(vendorId).slice(0, 64), (page - 1) * pageSize, pageSize, { entityId: String(domainId).slice(0, 64) });
    const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v.slice(0, 80) : null);
    return {
      items: items.map((r) => ({ at: r.at, action: r.actionKey, result: str(r.summary.result) ?? str(r.summary.status), attempts: typeof r.summary.attempts === 'number' ? r.summary.attempts : null, by: r.actorType === 'VENDOR' ? 'YOU' : r.actorType === 'STAFF' ? 'GET4DOMAIN' : 'SYSTEM' })),
      page, pageSize, total,
    };
  }
}
