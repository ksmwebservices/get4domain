import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { mergeQueue, MergedQueue, QueueItem, QueueKind } from './onboarding-core';

/** A bound on each source, so the screen never reads an unbounded table. */
const SOURCE_TAKE = 500;

/**
 * The onboarding queue (slice 5.13b): a READ model over the tables that already exist, so nothing is copied. Seeded sites that are still SEEDED or INVITED (a removed business is never listed again),
 * claim links that are still waiting and not expired, and vendors with no published site that were not removed. No contact detail is returned: the screen opens the vendor for that.
 */
@Injectable()
export class OnboardingQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async list(f: { page: number; pageSize: number; kind?: QueueKind }, now: Date): Promise<MergedQueue> {
    const [seeded, claims, fresh] = await Promise.all([
      this.prisma.v3SeededSite.findMany({ where: { lifecycle: { in: ['SEEDED', 'INVITED'] }, removedAt: null }, include: { vendor: { select: { businessName: true } } }, orderBy: { createdAt: 'asc' }, take: SOURCE_TAKE }),
      this.prisma.v3ClaimToken.findMany({ where: { status: 'ACTIVE', purpose: 'CLAIM', expiresAt: { gt: now } }, include: { vendor: { select: { businessName: true } } }, orderBy: { createdAt: 'asc' }, take: SOURCE_TAKE }),
      this.prisma.vendor.findMany({ where: { v3SitePublications: { none: { status: 'PUBLISHED' } }, v3SeededSite: { is: null } }, select: { id: true, businessName: true, createdAt: true, status: true }, orderBy: { createdAt: 'asc' }, take: SOURCE_TAKE }),
    ]);
    const items: QueueItem[] = [
      ...seeded.map((s): QueueItem => ({ kind: 'SEEDED', vendorId: s.vendorId, businessName: s.vendor.businessName, state: s.lifecycle, since: s.createdAt, detail: {} })),
      ...claims.map((c): QueueItem => ({ kind: 'CLAIM', vendorId: c.vendorId, businessName: c.vendor.businessName, state: 'CLAIM_LINK_WAITING', since: c.createdAt, detail: { expiresAt: c.expiresAt.toISOString() } })),
      ...fresh.map((v): QueueItem => ({ kind: 'NEW_VENDOR', vendorId: v.id, businessName: v.businessName, state: String(v.status), since: v.createdAt, detail: {} })),
    ];
    return mergeQueue(items, f.page, f.pageSize, f.kind);
  }
}
