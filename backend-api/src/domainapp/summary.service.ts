import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DomainAppSummary {
  counts: {
    contacts: number;
    catalogItems: number;
    records: number;
    invoices: number;
  };
  recordsByStatus: { status: string; count: number }[];
  revenue: { paid: number; pending: number };
  recentRecords: unknown[];
}

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(vendorId: string): Promise<DomainAppSummary> {
    const [contacts, catalogItems, records, invoices, byStatus, paidAgg, pendingAgg, recentRecords] =
      await Promise.all([
        this.prisma.contact.count({ where: { vendorId } }),
        this.prisma.catalogItem.count({ where: { vendorId } }),
        this.prisma.record.count({ where: { vendorId } }),
        this.prisma.genericInvoice.count({ where: { vendorId } }),
        this.prisma.record.groupBy({
          by: ['status'],
          where: { vendorId },
          _count: { _all: true },
        }),
        this.prisma.genericInvoice.aggregate({
          where: { vendorId, status: 'PAID' },
          _sum: { total: true },
        }),
        this.prisma.genericInvoice.aggregate({
          where: { vendorId, status: 'PENDING' },
          _sum: { total: true },
        }),
        this.prisma.record.findMany({
          where: { vendorId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { contact: true, catalogItem: true },
        }),
      ]);

    return {
      counts: { contacts, catalogItems, records, invoices },
      recordsByStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
      revenue: { paid: paidAgg._sum.total ?? 0, pending: pendingAgg._sum.total ?? 0 },
      recentRecords,
    };
  }
}
