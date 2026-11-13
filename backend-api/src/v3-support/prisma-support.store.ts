import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessageRow, NewTicket, SupportStore, TicketFilter, TicketRow } from './support.store';

const toMsg = (m: { id: string; ticketId: string; authorType: string; authorId: string | null; body: string; attachmentPictureId: string | null; createdAt: Date }): MessageRow => m;

@Injectable()
export class PrismaSupportStore extends SupportStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async createTicket(d: NewTicket, at: Date) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.v3Ticket.create({ data: { vendorId: d.vendorId, requesterType: d.requesterType, requesterName: d.requesterName, requesterEmail: d.requesterEmail, subject: d.subject, category: d.category, lastMessageAt: at, createdAt: at } });
      const message = await tx.v3TicketMessage.create({ data: { ticketId: ticket.id, authorType: d.requesterType, authorId: d.vendorId, body: d.body, attachmentPictureId: d.attachmentPictureId, createdAt: at } });
      return { ticket, message: toMsg(message) };
    });
  }
  countCreatedSince(by: { vendorId?: string; requesterEmail?: string }, since: Date) {
    return this.prisma.v3Ticket.count({ where: { createdAt: { gte: since }, ...(by.vendorId ? { vendorId: by.vendorId } : {}), ...(by.requesterEmail ? { requesterEmail: by.requesterEmail } : {}) } });
  }
  async listForVendor(vendorId: string, skip: number, take: number) {
    const where = { vendorId, requesterType: 'VENDOR' };
    const [items, total] = await Promise.all([this.prisma.v3Ticket.findMany({ where, orderBy: { lastMessageAt: 'desc' }, skip, take }), this.prisma.v3Ticket.count({ where })]);
    return { items, total };
  }
  async getForVendor(vendorId: string, id: string) {
    const ticket = await this.prisma.v3Ticket.findFirst({ where: { id, vendorId, requesterType: 'VENDOR' }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    return ticket ? { ticket, messages: ticket.messages.map(toMsg) } : null;
  }
  private where(f: TicketFilter): Prisma.V3TicketWhereInput {
    return { ...(f.status ? { status: f.status } : {}), ...(f.vendorId ? { vendorId: f.vendorId } : {}), ...(f.assignedToStaffId ? { assignedToStaffId: f.assignedToStaffId } : {}), ...(f.requesterType ? { requesterType: f.requesterType } : {}) };
  }
  async listAll(f: TicketFilter, skip: number, take: number) {
    const where = this.where(f);
    const [items, total] = await Promise.all([this.prisma.v3Ticket.findMany({ where, orderBy: { lastMessageAt: 'desc' }, skip, take }), this.prisma.v3Ticket.count({ where })]);
    return { items, total };
  }
  async getAny(id: string) {
    const ticket = await this.prisma.v3Ticket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    return ticket ? { ticket, messages: ticket.messages.map(toMsg) } : null;
  }
  async addMessage(scope: { ticketId: string; vendorId?: string }, m: { authorType: string; authorId: string | null; body: string; attachmentPictureId: string | null }, nextStatus: (current: string) => string, at: Date) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.v3Ticket.findFirst({ where: { id: scope.ticketId, ...(scope.vendorId ? { vendorId: scope.vendorId, requesterType: 'VENDOR' } : {}) } });
      if (!t) return null;
      const message = await tx.v3TicketMessage.create({ data: { ticketId: t.id, authorType: m.authorType, authorId: m.authorId, body: m.body, attachmentPictureId: m.attachmentPictureId, createdAt: at } });
      const status = nextStatus(t.status);
      const ticket = await tx.v3Ticket.update({ where: { id: t.id }, data: { status, lastMessageAt: at, resolvedAt: status === 'RESOLVED' ? (t.resolvedAt ?? at) : null } });
      return { ticket, message: toMsg(message) };
    });
  }
  async setStatus(id: string, status: string, expected: string | null, at: Date): Promise<TicketRow | null> {
    const done = await this.prisma.v3Ticket.updateMany({ where: { id, ...(expected ? { status: expected } : {}) }, data: { status, resolvedAt: status === 'RESOLVED' ? at : null } });
    return done.count === 1 ? this.prisma.v3Ticket.findUnique({ where: { id } }) : null;
  }
  async assign(id: string, staffId: string | null) {
    const done = await this.prisma.v3Ticket.updateMany({ where: { id }, data: { assignedToStaffId: staffId } });
    return done.count === 1 ? this.prisma.v3Ticket.findUnique({ where: { id } }) : null;
  }
  async vendorEmail(vendorId: string) { return (await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { email: true } }))?.email ?? null; }
  async pictureExists(vendorId: string, pictureId: string) { return (await this.prisma.v3SitePicture.count({ where: { vendorId, id: pictureId, deletedAt: null } })) === 1; }
  async vendorBySubdomain(subdomain: string) { return (await this.prisma.vendor.findUnique({ where: { subdomain }, select: { id: true, v3SiteRemoval: { select: { vendorId: true } } } }).then((v) => (v && !v.v3SiteRemoval ? v : null)))?.id ?? null; }
}
