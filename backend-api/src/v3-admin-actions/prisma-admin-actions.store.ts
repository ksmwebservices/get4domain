import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActionsStore, MergeRow, NewPlanChange, PlanChangeRow, VisitRow } from './admin-actions.store';

type MergeDb = Prisma.V3ListingMergeGetPayload<object>;
const idsOf = (v: Prisma.JsonValue): string[] => { const o = v as { customerIds?: unknown } | null; return Array.isArray(o?.customerIds) ? (o!.customerIds as unknown[]).filter((x): x is string => typeof x === 'string') : []; };
const toMerge = (m: MergeDb): MergeRow => ({ id: m.id, keepVendorId: m.keepVendorId, mergedVendorId: m.mergedVendorId, reason: m.reason, actorId: m.actorId, status: m.status, moved: { customerIds: idsOf(m.movedJson) }, conflicts: Array.isArray(m.conflictsJson) ? (m.conflictsJson as unknown as Array<{ id: string; because: string }>) : [], reversibleUntil: m.reversibleUntil, reversedAt: m.reversedAt, reversedBy: m.reversedBy, reverseReason: m.reverseReason, createdAt: m.createdAt });

@Injectable()
export class PrismaAdminActionsStore extends AdminActionsStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async vendor(id: string) { return this.prisma.vendor.findUnique({ where: { id }, select: { id: true, businessName: true, email: true } }); }
  async planExists(key: string) { return (await this.prisma.v3Plan.count({ where: { key } })) === 1; }
  async rename(vendorId: string, oldName: string, newName: string, reason: string, actorId: string | null, at: Date) {
    await this.prisma.$transaction([
      this.prisma.v3BusinessNameHistory.create({ data: { vendorId, oldName, newName, reason, actorId, createdAt: at } }),
      this.prisma.vendor.update({ where: { id: vendorId }, data: { businessName: newName } }),
    ]);
  }
  async nameHistory(vendorId: string, skip: number, take: number) {
    const [items, total] = await Promise.all([this.prisma.v3BusinessNameHistory.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, skip, take }), this.prisma.v3BusinessNameHistory.count({ where: { vendorId } })]);
    return { items, total };
  }
  async payeeNames(vendorId: string) {
    const rows = await this.prisma.v3VendorPaymentMethod.findMany({ where: { vendorId, kind: 'UPI', status: 'ACTIVE' }, select: { payeeName: true } });
    return rows.map((r) => r.payeeName).filter((n): n is string => !!n);
  }

  async createPlanChange(d: NewPlanChange): Promise<PlanChangeRow> { return this.prisma.v3ScheduledPlanChange.create({ data: { ...d } }); }
  async listPlanChanges(vendorId: string, skip: number, take: number) {
    const [items, total] = await Promise.all([this.prisma.v3ScheduledPlanChange.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, skip, take }), this.prisma.v3ScheduledPlanChange.count({ where: { vendorId } })]);
    return { items, total };
  }
  getPlanChange(id: string) { return this.prisma.v3ScheduledPlanChange.findUnique({ where: { id } }); }
  duePlanChanges(now: Date, limit: number) { return this.prisma.v3ScheduledPlanChange.findMany({ where: { status: 'PENDING', effectiveAt: { lte: now } }, orderBy: { effectiveAt: 'asc' }, take: limit }); }
  async claimPlanChange(id: string) { return (await this.prisma.v3ScheduledPlanChange.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPLYING' } })).count === 1; }
  async finishPlanChange(id: string, status: 'APPLIED' | 'FAILED', at: Date, error: string | null) { await this.prisma.v3ScheduledPlanChange.updateMany({ where: { id, status: 'APPLYING' }, data: { status, appliedAt: status === 'APPLIED' ? at : null, error } }); }
  async cancelPlanChange(id: string) { return (await this.prisma.v3ScheduledPlanChange.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELLED' } })).count === 1; }

  async customersOf(vendorId: string) { return this.prisma.v3Customer.findMany({ where: { vendorId }, select: { id: true, phoneKey: true, emailKey: true } }); }
  async applyMerge(d: { keepVendorId: string; mergedVendorId: string; reason: string; actorId: string | null; customerIds: string[]; conflicts: Array<{ id: string; because: string }>; reversibleUntil: Date }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.v3Customer.updateMany({ where: { id: { in: d.customerIds }, vendorId: d.mergedVendorId }, data: { vendorId: d.keepVendorId } });
      await tx.v3CustomerSource.updateMany({ where: { customerId: { in: d.customerIds }, vendorId: d.mergedVendorId }, data: { vendorId: d.keepVendorId } });
      return toMerge(await tx.v3ListingMerge.create({ data: { keepVendorId: d.keepVendorId, mergedVendorId: d.mergedVendorId, reason: d.reason, actorId: d.actorId, movedJson: { customerIds: d.customerIds } as Prisma.InputJsonValue, conflictsJson: d.conflicts as unknown as Prisma.InputJsonValue, reversibleUntil: d.reversibleUntil } }));
    }, { maxWait: 15_000, timeout: 60_000 });
  }
  async getMerge(id: string) { const m = await this.prisma.v3ListingMerge.findUnique({ where: { id } }); return m ? toMerge(m) : null; }
  async listMerges(vendorId: string | null, skip: number, take: number) {
    const where: Prisma.V3ListingMergeWhereInput = vendorId ? { OR: [{ keepVendorId: vendorId }, { mergedVendorId: vendorId }] } : {};
    const [items, total] = await Promise.all([this.prisma.v3ListingMerge.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }), this.prisma.v3ListingMerge.count({ where })]);
    return { items: items.map(toMerge), total };
  }
  async reverseMerge(id: string, actorId: string | null, reason: string, at: Date) {
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.v3ListingMerge.findUnique({ where: { id } }); if (!m || m.status !== 'APPLIED') return null;
      const ids = idsOf(m.movedJson);
      const back = await tx.v3Customer.updateMany({ where: { id: { in: ids }, vendorId: m.keepVendorId }, data: { vendorId: m.mergedVendorId } });
      await tx.v3CustomerSource.updateMany({ where: { customerId: { in: ids }, vendorId: m.keepVendorId }, data: { vendorId: m.mergedVendorId } });
      const marked = await tx.v3ListingMerge.updateMany({ where: { id, status: 'APPLIED' }, data: { status: 'REVERSED', reversedAt: at, reversedBy: actorId, reverseReason: reason } });
      if (marked.count !== 1) return null;
      return { restored: back.count, left: ids.length - back.count };
    }, { maxWait: 15_000, timeout: 60_000 });
  }

  async addVisits(vendorId: string, rows: ReadonlyArray<VisitRow>) {
    for (const r of rows) {
      const go = () => this.prisma.v3HostVisitDaily.upsert({ where: { host_day: { host: r.host, day: r.day } }, create: { vendorId, host: r.host, day: r.day, count: r.count }, update: { count: { increment: r.count } } });
      try { await go(); } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') await go(); else throw e; }   // two writers made the row at once: the second becomes an increment
    }
  }
  async visitsOf(vendorId: string, fromDay: string, toDay: string) {
    const rows = await this.prisma.v3HostVisitDaily.findMany({ where: { vendorId, day: { gte: fromDay, lte: toDay } }, orderBy: [{ day: 'asc' }, { host: 'asc' }], select: { host: true, day: true, count: true } });
    return rows;
  }
}
