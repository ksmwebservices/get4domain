import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { KeyedQueue } from '../common/keyed-queue';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../plans/admin/audit.service';
import { addressHasDetail, ListingFacts } from './core/lifecycle-core';
import { AuditEntry, DeletionRequestRow, DeletionStatus, LifecycleStore, LifecycleSubscription, LifecycleVendor, RemovalArgs } from './lifecycle.store';

const toSub = (s: Prisma.V3PlanSubscriptionGetPayload<{ include: { plan: true } }>): LifecycleSubscription => ({
  id: s.id, planKey: s.plan.key, level: s.plan.level as 'FREE' | 'PRO', track: String(s.plan.track).toLowerCase(), status: s.status, termMonths: s.termMonths, endsAt: s.endsAt, graceEndsAt: s.graceEndsAt,
});
const toDel = (r: Prisma.V3AccountDeletionRequestGetPayload<object>): DeletionRequestRow => ({
  id: r.id, vendorId: r.vendorId, status: r.status as DeletionStatus, requestedById: r.requestedById, verifiedAt: r.verifiedAt, executedAt: r.executedAt, executedById: r.executedById, note: r.note, createdAt: r.createdAt,
});

/**
 * Prisma implementation (V3 tables, plus the Vendor row and the directory business that rule 9 needs). Rule (c) of the batch: a per-vendor lock is awaited in the
 * KeyedQueue BEFORE the transaction opens, never inside one.
 */
@Injectable()
export class PrismaLifecycleStore extends LifecycleStore {
  private readonly queue = new KeyedQueue();
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService) { super(); }

  private async audit(tx: Prisma.TransactionClient, a: AuditEntry): Promise<void> { await this.audits.record(tx, a.actor, a.action, a.entityType, a.entityId, a.before ?? null, a.after ?? null); }

  async vendor(vendorId: string): Promise<LifecycleVendor | null> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, status: true, businessName: true, phone: true, email: true } });
    return v ? { id: v.id, status: String(v.status), businessName: v.businessName ?? '', phone: v.phone ?? null, email: v.email } : null;
  }

  async setVendorStatus(vendorId: string, status: 'ACTIVE' | 'SUSPENDED', audit: AuditEntry): Promise<void> {
    await this.queue.run(`lifecycle:${vendorId}`, () => this.prisma.$transaction(async (tx) => {
      await tx.vendor.update({ where: { id: vendorId }, data: { status } });
      await this.audit(tx, audit);
    }, { maxWait: 15_000 }));
  }

  async currentSubscription(vendorId: string): Promise<LifecycleSubscription | null> {
    const cur = await this.prisma.v3PlanSubscription.findUnique({ where: { currentVendorId: vendorId }, include: { plan: true } });
    const s = cur ?? (await this.prisma.v3PlanSubscription.findFirst({ where: { vendorId }, orderBy: { createdAt: 'desc' }, include: { plan: true } }));
    return s ? toSub(s) : null;
  }

  async latestProSubscription(vendorId: string): Promise<LifecycleSubscription | null> {
    const s = await this.prisma.v3PlanSubscription.findFirst({ where: { vendorId, plan: { level: 'PRO' } }, orderBy: { createdAt: 'desc' }, include: { plan: true } });
    return s ? toSub(s) : null;
  }

  async setGraceEnd(subscriptionId: string, graceEndsAt: Date, audit: AuditEntry): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.v3PlanSubscription.update({ where: { id: subscriptionId }, data: { graceEndsAt } });
      await this.audit(tx, audit);
    });
  }

  async listingFacts(vendorId: string): Promise<ListingFacts> {
    const b = await this.prisma.v3DirectoryBusiness.findUnique({ where: { vendorId }, include: { _count: { select: { services: true, media: true } } } });
    if (!b) return { hasListing: false, phone: null, addressDetail: false, description: null, services: 0, media: 0 };
    return { hasListing: true, phone: b.phoneE164, addressDetail: addressHasDetail(b.addressJson), description: b.descriptionText, services: b._count.services, media: b._count.media };
  }

  async isRemoved(vendorId: string): Promise<boolean> { return !!(await this.prisma.v3SiteRemoval.findUnique({ where: { vendorId }, select: { vendorId: true } })); }

  async recordAudit(a: AuditEntry): Promise<void> { await this.prisma.$transaction((tx) => this.audit(tx, a)); }

  async pendingDeletion(vendorId: string): Promise<DeletionRequestRow | null> {
    const r = await this.prisma.v3AccountDeletionRequest.findUnique({ where: { pendingVendorId: vendorId } });
    return r ? toDel(r) : null;
  }

  async createDeletion(d: { vendorId: string; requestedById: string | null; verifiedAt: Date; audit: AuditEntry }): Promise<DeletionRequestRow> {
    return this.queue.run(`lifecycle:${d.vendorId}`, () => this.prisma.$transaction(async (tx) => {
      const open = await tx.v3AccountDeletionRequest.findUnique({ where: { pendingVendorId: d.vendorId } });
      if (open) return toDel(open);
      const r = await tx.v3AccountDeletionRequest.create({ data: { vendorId: d.vendorId, pendingVendorId: d.vendorId, requestedById: d.requestedById, verifiedAt: d.verifiedAt } });
      await this.audit(tx, { ...d.audit, entityId: r.id, after: { vendorId: d.vendorId, status: 'PENDING' } });
      return toDel(r);
    }, { maxWait: 15_000 }));
  }

  async getDeletion(id: string): Promise<DeletionRequestRow | null> { const r = await this.prisma.v3AccountDeletionRequest.findUnique({ where: { id } }); return r ? toDel(r) : null; }

  async listDeletions(f: { status?: DeletionStatus; skip: number; take: number }): Promise<{ items: DeletionRequestRow[]; total: number }> {
    const where: Prisma.V3AccountDeletionRequestWhereInput = f.status ? { status: f.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.v3AccountDeletionRequest.findMany({ where, orderBy: { createdAt: 'asc' }, skip: f.skip, take: f.take }),
      this.prisma.v3AccountDeletionRequest.count({ where }),
    ]);
    return { items: items.map(toDel), total };
  }

  async executeRemoval(a: RemovalArgs): Promise<{ alreadyRemoved: boolean }> {
    return this.queue.run(`lifecycle:${a.vendorId}`, () => this.prisma.$transaction(async (tx) => {
      const existing = await tx.v3SiteRemoval.findUnique({ where: { vendorId: a.vendorId } });
      const now = new Date();
      if (a.deletionRequestId) {
        await tx.v3AccountDeletionRequest.updateMany({ where: { id: a.deletionRequestId, status: 'PENDING' }, data: { status: 'EXECUTED', pendingVendorId: null, executedAt: now, executedById: a.executedBy, note: a.reason } });
      }
      if (existing) return { alreadyRemoved: true };
      await tx.v3SiteRemoval.create({ data: { vendorId: a.vendorId, kind: a.kind, reason: a.reason, phoneHash: a.phoneHash, requestedBy: a.requestedBy, removedAt: now } });
      if (a.phoneHash) {
        await tx.v3DncRegister.upsert({ where: { phoneHash: a.phoneHash }, create: { phoneHash: a.phoneHash, reason: a.reason, source: a.registerSource ?? 'REMOVAL', addedBy: a.executedBy }, update: {} });
      }
      // the directory listing is hidden for good (status REMOVED, noindex; the public API answers 410); the row itself is kept as the record
      await tx.v3DirectoryBusiness.updateMany({ where: { vendorId: a.vendorId }, data: { status: 'REMOVED', indexable: false, removedAt: now } });
      await this.audit(tx, a.audit);
      return { alreadyRemoved: false };
    }, { maxWait: 15_000 }));
  }
}
