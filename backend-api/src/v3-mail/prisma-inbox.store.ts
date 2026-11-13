import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InboxStore, InboxVendor, NewInbox } from './inbox.store';

@Injectable()
export class PrismaInboxStore extends InboxStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async vendorBySubdomain(subdomain: string): Promise<InboxVendor | null> {
    const v = await this.prisma.vendor.findUnique({ where: { subdomain }, select: { id: true, email: true, status: true, v3SiteRemoval: { select: { vendorId: true } } } });
    return v && !v.v3SiteRemoval ? { id: v.id, email: v.email, status: String(v.status) } : null;
  }
  async insertIfNew(vendorId: string, d: NewInbox, at: Date) {
    try { return { row: await this.prisma.v3InboxMessage.create({ data: { vendorId, ...d, createdAt: at } }), created: true }; }
    catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && d.messageIdHdr) {
        const first = await this.prisma.v3InboxMessage.findFirst({ where: { vendorId, messageIdHdr: d.messageIdHdr } });
        if (first) return { row: first, created: false };
      }
      throw e;
    }
  }
  countSince(vendorId: string, since: Date) { return this.prisma.v3InboxMessage.count({ where: { vendorId, createdAt: { gte: since } } }); }
  async list(vendorId: string, f: { state?: string; excludeHeld?: boolean }, skip: number, take: number) {
    const where: Prisma.V3InboxMessageWhereInput = { vendorId, ...(f.state ? { state: f.state } : f.excludeHeld ? { state: { not: 'HELD' } } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3InboxMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }), this.prisma.v3InboxMessage.count({ where })]);
    return { items, total };
  }
  get(vendorId: string, id: string) { return this.prisma.v3InboxMessage.findFirst({ where: { vendorId, id } }); }
  async setState(vendorId: string, id: string, state: string, at: Date) {
    const done = await this.prisma.v3InboxMessage.updateMany({ where: { vendorId, id, state: { not: 'HELD' } }, data: { state, ...(state === 'READ' ? { readAt: at } : {}) } });
    return done.count === 1 ? this.get(vendorId, id) : null;
  }
  async setForward(vendorId: string, id: string, status: string, at: Date | null) { await this.prisma.v3InboxMessage.updateMany({ where: { vendorId, id }, data: { forwardStatus: status, forwardedAt: at } }); }
  countHeld(vendorId: string) { return this.prisma.v3InboxMessage.count({ where: { vendorId, state: 'HELD' } }); }
  async releaseHeld(vendorId: string, _at: Date) { return (await this.prisma.v3InboxMessage.updateMany({ where: { vendorId, state: 'HELD' }, data: { state: 'NEW' } })).count; }
}
