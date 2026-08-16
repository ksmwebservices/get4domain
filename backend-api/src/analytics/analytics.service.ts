import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UsageCounts {
  leads: number; calls: number; aiGenerations: number; messages: number; campaigns: number; listings: number;
}
export interface VendorUsageRow extends UsageCounts {
  vendorId: string; businessName: string; industry: string | null; total: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string): { createdAt?: { gte?: Date; lte?: Date } } {
    if (!from && !to) return {};
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (from) createdAt.gte = new Date(from);
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); createdAt.lte = t; }
    return { createdAt };
  }

  /** One vendor's tool usage. leads/calls/AI/messages/campaigns are period-scoped;
   *  listings is a current total. All derived from existing vendor-scoped tables —
   *  no usage-events table (verified against the schema). */
  async usage(vendorId: string, from?: string, to?: string): Promise<UsageCounts> {
    const r = this.range(from, to);
    const [leads, calls, aiGenerations, messages, campaigns, listings] = await Promise.all([
      this.prisma.campaignLead.count({ where: { vendorId, ...r } }),
      this.prisma.callLog.count({ where: { vendorId, ...r } }),
      this.prisma.walletTransaction.count({ where: { vendorId, service: { startsWith: 'ai_' }, ...r } }),
      this.prisma.message.count({ where: { vendorId, direction: 'out', ...r } }),
      this.prisma.campaignPage.count({ where: { vendorId, ...r } }),
      this.prisma.vendorProduct.count({ where: { vendorId } }),
    ]);
    return { leads, calls, aiGenerations, messages, campaigns, listings };
  }

  /** Admin cross-vendor utilization (2E admin half / 2F). One grouped query per tool,
   *  merged per vendor. Sandbox vendors excluded. */
  async allUsage(from?: string, to?: string): Promise<VendorUsageRow[]> {
    const r = this.range(from, to);
    const [vendors, leadsG, callsG, aiG, msgG, campG, listG] = await Promise.all([
      this.prisma.vendor.findMany({ where: { isSandbox: false }, select: { id: true, businessName: true, industry: true } }),
      this.prisma.campaignLead.groupBy({ by: ['vendorId'], _count: { _all: true }, where: r }),
      this.prisma.callLog.groupBy({ by: ['vendorId'], _count: { _all: true }, where: r }),
      this.prisma.walletTransaction.groupBy({ by: ['vendorId'], _count: { _all: true }, where: { service: { startsWith: 'ai_' }, ...r } }),
      this.prisma.message.groupBy({ by: ['vendorId'], _count: { _all: true }, where: { direction: 'out', ...r } }),
      this.prisma.campaignPage.groupBy({ by: ['vendorId'], _count: { _all: true }, where: r }),
      this.prisma.vendorProduct.groupBy({ by: ['vendorId'], _count: { _all: true } }),
    ]);

    const toMap = (g: { vendorId: string; _count: { _all: number } }[]): Record<string, number> =>
      g.reduce<Record<string, number>>((acc, row) => { acc[row.vendorId] = row._count._all; return acc; }, {});
    const leads = toMap(leadsG), calls = toMap(callsG), ai = toMap(aiG), msg = toMap(msgG), camp = toMap(campG), list = toMap(listG);

    return this.mergeUsage(vendors, { leads, calls, ai, msg, camp, list });
  }

  /** Platform-wide accounting AGGREGATE for admin (2F): totals only — invoices
   *  issued + GST collected + gross revenue across all vendors. Deliberately does
   *  NOT expose any individual vendor's private expenses/bookkeeping. */
  async platformAccounting(): Promise<{ invoicesIssued: number; gstCollected: number; revenueGross: number; paidCount: number }> {
    const invoices = await this.prisma.genericInvoice.findMany({
      where: { vendor: { isSandbox: false } },
      select: { gstAmount: true, total: true, paidAt: true },
    });
    const paid = invoices.filter((i) => i.paidAt);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      invoicesIssued: invoices.length,
      paidCount: paid.length,
      gstCollected: round2(paid.reduce((s, i) => s + i.gstAmount, 0)),
      revenueGross: round2(paid.reduce((s, i) => s + i.total, 0)),
    };
  }

  private mergeUsage(
    vendors: { id: string; businessName: string; industry: string | null }[],
    m: { leads: Record<string, number>; calls: Record<string, number>; ai: Record<string, number>; msg: Record<string, number>; camp: Record<string, number>; list: Record<string, number> },
  ): VendorUsageRow[] {
    const { leads, calls, ai, msg, camp, list } = m;
    return vendors.map((v) => {
      const counts: UsageCounts = {
        leads: leads[v.id] ?? 0, calls: calls[v.id] ?? 0, aiGenerations: ai[v.id] ?? 0,
        messages: msg[v.id] ?? 0, campaigns: camp[v.id] ?? 0, listings: list[v.id] ?? 0,
      };
      const total = counts.leads + counts.calls + counts.aiGenerations + counts.messages + counts.campaigns;
      return { vendorId: v.id, businessName: v.businessName, industry: v.industry, ...counts, total };
    }).sort((a, b) => b.total - a.total);
  }
}
