import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerStatus } from './core/referral-core';
import { AttributionRow, LedgerRow, LinkRow, PayoutRow, ReferralsStore, SlabRow, VendorFacts } from './referrals.store';

const isUnique = (e: unknown): boolean => (e as { code?: string })?.code === 'P2002';
const toLink = (r: { id: string; partnerId: string; code: string; active: boolean; createdById: string | null; disabledAt: Date | null; createdAt: Date }): LinkRow => ({ ...r });
const toAttr = (r: { id: string; vendorId: string; partnerId: string; linkId: string | null; source: string; setById: string | null; reason: string | null; createdAt: Date }): AttributionRow => ({ ...r, source: r.source as AttributionRow['source'] });
const toSlab = (r: { id: string; minVendors: number; maxVendors: number | null; amountPerVendorMinor: number; effectiveFrom: Date; createdById: string | null }): SlabRow => ({ ...r });
const toLine = (r: { id: string; partnerId: string; vendorId: string; month: string; orderId: string; qualifiedAt: Date; amountMinor: number | null; status: string; flagged: boolean; flagReason: string | null; approvedAt: Date | null; payoutId: string | null; createdAt: Date }): LedgerRow => ({ ...r, status: r.status as LedgerStatus });
const toPayout = (r: { id: string; partnerId: string; month: string; totalMinor: number; status: string; reference: string; paidById: string | null; paidAt: Date; createdAt: Date }): PayoutRow => ({ ...r });

@Injectable()
export class PrismaReferralsStore extends ReferralsStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async createLink(partnerId: string, code: string, createdById: string | null): Promise<LinkRow | null> {
    try { return toLink(await this.prisma.referralLink.create({ data: { partnerId, code, createdById } })); } catch (e) { if (isUnique(e)) return null; throw e; }
  }
  async getLinkByCode(code: string) { const r = await this.prisma.referralLink.findUnique({ where: { code } }); return r ? toLink(r) : null; }
  async getLink(id: string) { const r = await this.prisma.referralLink.findUnique({ where: { id } }); return r ? toLink(r) : null; }
  async listLinks(partnerId: string) { return (await this.prisma.referralLink.findMany({ where: { partnerId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })).map(toLink); }
  async setLinkActive(id: string, active: boolean, at: Date) {
    try { return toLink(await this.prisma.referralLink.update({ where: { id }, data: { active, disabledAt: active ? null : at } })); } catch (e) { if ((e as { code?: string }).code === 'P2025') return null; throw e; }
  }

  async getAttribution(vendorId: string) { const r = await this.prisma.referralAttribution.findUnique({ where: { vendorId } }); return r ? toAttr(r) : null; }
  async createAttribution(r: Omit<AttributionRow, 'id' | 'createdAt'>) {
    try { return { created: true, row: toAttr(await this.prisma.referralAttribution.create({ data: r })) }; }
    catch (e) { if (isUnique(e)) return { created: false, row: toAttr(await this.prisma.referralAttribution.findUniqueOrThrow({ where: { vendorId: r.vendorId } })) }; throw e; }
  }
  async replaceAttribution(vendorId: string, patch: { partnerId: string; linkId: string | null; source: 'ADMIN_CHANGE'; setById: string | null; reason: string | null }) {
    try { return toAttr(await this.prisma.referralAttribution.update({ where: { vendorId }, data: patch })); } catch (e) { if ((e as { code?: string }).code === 'P2025') return null; throw e; }
  }
  async attributionsOfPartner(partnerId: string, skip: number, take: number) {
    const [rows, total] = await Promise.all([
      this.prisma.referralAttribution.findMany({ where: { partnerId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
      this.prisma.referralAttribution.count({ where: { partnerId } }),
    ]);
    const facts = await Promise.all(rows.map((r) => this.vendorFacts(r.vendorId)));
    return { items: rows.map((r, i) => ({ ...toAttr(r), vendor: facts[i] })), total };
  }
  async vendorFacts(vendorId: string): Promise<VendorFacts | null> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, email: true, phone: true, businessName: true } });
    if (!v) return null;
    const biz = await this.prisma.v3DirectoryBusiness.findUnique({ where: { vendorId }, select: { addressJson: true } });
    const a = biz?.addressJson as { state?: unknown } | null;
    return { id: v.id, email: v.email, phone: v.phone, businessName: v.businessName, state: typeof a?.state === 'string' && a.state.trim() ? a.state.trim() : null };
  }

  async listSlabs() { return (await this.prisma.commissionSlab.findMany({ orderBy: [{ effectiveFrom: 'asc' }, { minVendors: 'asc' }, { id: 'asc' }] })).map(toSlab); }
  async getSlab(id: string) { const r = await this.prisma.commissionSlab.findUnique({ where: { id } }); return r ? toSlab(r) : null; }
  async createSlab(r: Omit<SlabRow, 'id'>) { return toSlab(await this.prisma.commissionSlab.create({ data: r })); }
  async updateSlab(id: string, r: Partial<Omit<SlabRow, 'id'>>) {
    try { return toSlab(await this.prisma.commissionSlab.update({ where: { id }, data: r })); } catch (e) { if ((e as { code?: string }).code === 'P2025') return null; throw e; }
  }

  async getLineByVendor(vendorId: string) { const r = await this.prisma.commissionLedger.findUnique({ where: { vendorId } }); return r ? toLine(r) : null; }
  async createLine(r: Parameters<ReferralsStore['createLine']>[0]) {
    try { return { created: true, row: toLine(await this.prisma.commissionLedger.create({ data: r })) }; }
    catch (e) { if (isUnique(e)) return { created: false, row: toLine(await this.prisma.commissionLedger.findUniqueOrThrow({ where: { vendorId: r.vendorId } })) }; throw e; }
  }
  async linesOfMonth(month: string) { return (await this.prisma.commissionLedger.findMany({ where: { month }, orderBy: { id: 'asc' } })).map(toLine); }
  async linesOfPartnerMonth(partnerId: string, month: string) { return (await this.prisma.commissionLedger.findMany({ where: { partnerId, month }, orderBy: { id: 'asc' } })).map(toLine); }
  async listLines(q: { month?: string; partnerId?: string; status?: LedgerStatus; skip: number; take: number }) {
    const where: Prisma.CommissionLedgerWhereInput = { ...(q.month ? { month: q.month } : {}), ...(q.partnerId ? { partnerId: q.partnerId } : {}), ...(q.status ? { status: q.status } : {}) };
    const [rows, total] = await Promise.all([this.prisma.commissionLedger.findMany({ where, orderBy: [{ month: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }], skip: q.skip, take: q.take }), this.prisma.commissionLedger.count({ where })]);
    return { items: rows.map(toLine), total };
  }
  async approveLines(items: Array<{ id: string; amountMinor: number }>, at: Date): Promise<number> {
    if (items.length === 0) return 0;
    return this.prisma.$transaction(async (tx) => {
      let n = 0;
      for (const i of items) n += (await tx.commissionLedger.updateMany({ where: { id: i.id, status: 'ACCRUED' }, data: { status: 'APPROVED', amountMinor: i.amountMinor, approvedAt: at } })).count;
      return n;
    });
  }
  async reverseLine(vendorId: string, reason: string) {
    const cur = await this.prisma.commissionLedger.findUnique({ where: { vendorId } });
    if (!cur) return null;
    if (cur.status === 'REVERSED') return toLine(cur);
    return toLine(await this.prisma.commissionLedger.update({ where: { vendorId }, data: { status: 'REVERSED', flagged: true, flagReason: reason.slice(0, 300) } }));
  }

  async getPayout(partnerId: string, month: string) { const r = await this.prisma.commissionPayout.findUnique({ where: { partnerId_month: { partnerId, month } } }); return r ? toPayout(r) : null; }
  async createPayout(p: { partnerId: string; month: string; totalMinor: number; reference: string; paidById: string | null; paidAt: Date }, lineIds: string[]) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.commissionPayout.create({ data: { ...p, status: 'PAID' } });
        const n = (await tx.commissionLedger.updateMany({ where: { id: { in: lineIds }, status: 'APPROVED', partnerId: p.partnerId, month: p.month }, data: { status: 'PAID', payoutId: row.id } })).count;
        if (n !== lineIds.length) throw new Error('the ledger changed while the payout was being recorded');   // rolls the whole unit back
        return toPayout(row);
      });
    } catch (e) { if (isUnique(e)) return null; throw e; }
  }
  async listPayouts(q: { partnerId?: string; month?: string; skip: number; take: number }) {
    const where: Prisma.CommissionPayoutWhereInput = { ...(q.partnerId ? { partnerId: q.partnerId } : {}), ...(q.month ? { month: q.month } : {}) };
    const [rows, total] = await Promise.all([this.prisma.commissionPayout.findMany({ where, orderBy: [{ month: 'desc' }, { paidAt: 'desc' }, { id: 'asc' }], skip: q.skip, take: q.take }), this.prisma.commissionPayout.count({ where })]);
    return { items: rows.map(toPayout), total };
  }
}
