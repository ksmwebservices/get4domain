import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { summarise } from './goals';
import { EVENT_LABEL, EventType, maskPhone, normalizePhone } from './leadspace.types';
import { LeadPurseService } from './purse.service';
import { LeadspaceSettingsService } from './settings.service';

export interface LeadRow {
  id: string; type: string; typeLabel: string; status: string; held: boolean;
  customerName: string; customerPhone: string; summary: string; payload: unknown;
  priceChargedPaise: number; orderDecision: string | null; vendorNote: string | null; source: string | null; createdAt: Date; deliveredAt: Date | null; disputeStatus?: string | null;
}

const VENDOR_STATUSES = ['CONTACTED', 'WON', 'LOST'] as const;

/** What a vendor sees. A HELD lead shows a count and a masked contact only: no name, no message, no full number, until a refill releases it. */
export function present(e: LeadEvent): LeadRow {
  const held = e.status === 'HELD';
  const ten = normalizePhone(e.customerPhone);
  return {
    id: e.id, type: e.type, typeLabel: EVENT_LABEL[e.type as EventType] ?? e.type, status: e.status, held,
    customerName: held ? 'Waiting customer' : e.customerName,
    customerPhone: held ? (ten ? maskPhone(ten) : 'hidden') : e.customerPhone,
    summary: held ? 'Refill your wallet to see this request.' : summarise(e.type as EventType, e.payload as Record<string, unknown>),
    payload: held ? null : e.payload,
    priceChargedPaise: e.priceChargedPaise, orderDecision: e.orderDecision, vendorNote: held ? null : e.vendorNote, source: e.source, createdAt: e.createdAt, deliveredAt: e.deliveredAt,
  };
}

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService, private readonly purse: LeadPurseService, private readonly settings: LeadspaceSettingsService) {}

  async list(vendorId: string, q: { status?: string; type?: string; search?: string; from?: string; to?: string; take?: number; skip?: number }): Promise<{ total: number; rows: LeadRow[] }> {
    const where: Prisma.LeadEventWhereInput = { vendorId };
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    const search = (q.search ?? '').trim();
    // Searching never matches a held lead's hidden fields.
    if (search) where.AND = [{ status: { not: 'HELD' } }, { OR: [{ customerName: { contains: search, mode: 'insensitive' } }, { customerPhone: { contains: search.replace(/\D/g, '') || search } }] }];
    const [total, events] = await Promise.all([
      this.prisma.leadEvent.count({ where }),
      this.prisma.leadEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(q.take ?? 50, 200), skip: q.skip ?? 0 }),
    ]);
    const disputes = events.length ? await this.prisma.leadDispute.findMany({ where: { vendorId, leadId: { in: events.map((e) => e.id) } }, orderBy: { createdAt: 'desc' } }) : [];
    return { total, rows: events.map((e) => ({ ...present(e), disputeStatus: disputes.find((d) => d.leadId === e.id)?.status ?? null })) };
  }

  async summary(vendorId: string): Promise<Record<string, unknown>> {
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const week = new Date(day.getTime() - 6 * 86_400_000);
    const month = new Date(day.getTime() - 29 * 86_400_000);
    const count = (where: Prisma.LeadEventWhereInput) => this.prisma.leadEvent.count({ where: { vendorId, ...where } });
    const [today, last7, last30, held, won, contacted, delivered, spent, views, balancePaise, profile, cfg, todayBookings, todayOrders] = await Promise.all([
      count({ createdAt: { gte: day } }), count({ createdAt: { gte: week } }), count({ createdAt: { gte: month } }), count({ status: 'HELD' }),
      count({ status: 'WON' }), count({ status: { in: ['CONTACTED', 'WON', 'LOST'] } }), count({ status: { not: 'HELD' } }),
      this.prisma.leadEvent.aggregate({ where: { vendorId, createdAt: { gte: month } }, _sum: { priceChargedPaise: true } }),
      this.prisma.leadspaceProfile.findUnique({ where: { vendorId }, select: { views: true } }),
      this.purse.balance(vendorId),
      this.prisma.leadspaceProfile.findUnique({ where: { vendorId }, select: { status: true, verificationStatus: true, lowBalanceMode: true, slug: true } }),
      this.settings.get(),
      count({ createdAt: { gte: day }, type: { in: ['BOOKING', 'APPOINTMENT', 'SITE_VISIT'] }, status: { not: 'HELD' } }),
      count({ createdAt: { gte: day }, type: 'CART_ORDER', status: { not: 'HELD' } }),
    ]);
    return { today, last7, last30, held, won, contacted, delivered, spentLast30Paise: spent._sum.priceChargedPaise ?? 0, pageViews: views?.views ?? 0, balancePaise, page: profile, todayBookings, todayOrders, upgradeThreshold: cfg.upgradeLeadThreshold, upgradeSuggested: last30 >= cfg.upgradeLeadThreshold };
  }

  async setStatus(vendorId: string, id: string, status: string, note?: string): Promise<LeadRow> {
    if (!(VENDOR_STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Choose Contacted, Won or Lost.');
    const ev = await this.prisma.leadEvent.findFirst({ where: { id, vendorId } });
    if (!ev) throw new NotFoundException('We could not find that lead.');
    if (ev.status === 'HELD') throw new BadRequestException('Refill your wallet to release this customer first.');
    const updated = await this.prisma.leadEvent.update({ where: { id }, data: { status: ev.status === 'CREDITED' || ev.status === 'DISPUTED' ? ev.status : status, vendorNote: note ? note.slice(0, 500) : ev.vendorNote } });
    return present(updated);
  }

  /** Cart orders: the vendor confirms or declines the verified order request. Payment is between vendor and customer. */
  async decideOrder(vendorId: string, id: string, decision: 'CONFIRMED' | 'DECLINED', note?: string): Promise<LeadRow> {
    const ev = await this.prisma.leadEvent.findFirst({ where: { id, vendorId, type: 'CART_ORDER' } });
    if (!ev) throw new NotFoundException('We could not find that order.');
    if (ev.status === 'HELD') throw new BadRequestException('Refill your wallet to release this order first.');
    return present(await this.prisma.leadEvent.update({ where: { id }, data: { orderDecision: decision, vendorNote: note ? note.slice(0, 500) : ev.vendorNote, status: decision === 'CONFIRMED' ? 'WON' : 'LOST' } }));
  }

  /** CSV of delivered leads only (held leads are never exported). */
  async csv(vendorId: string): Promise<string> {
    const rows = await this.prisma.leadEvent.findMany({ where: { vendorId, status: { not: 'HELD' } }, orderBy: { createdAt: 'desc' }, take: 5000 });
    const NL = String.fromCharCode(10);
    const cell = (v: unknown): string => {
      let s = String(v ?? '').replace(/\r?\n/g, ' ');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['Date', 'Type', 'Name', 'Phone', 'Request', 'Status', 'Charged (Rs)'];
    return [head.join(','), ...rows.map((e) => [e.createdAt.toISOString().slice(0, 16).replace('T', ' '), EVENT_LABEL[e.type as EventType] ?? e.type, e.customerName, e.customerPhone, summarise(e.type as EventType, e.payload as Record<string, unknown>), e.status, (e.priceChargedPaise / 100).toFixed(2)].map(cell).join(','))].join(NL);
  }
}
