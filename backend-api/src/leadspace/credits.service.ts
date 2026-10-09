import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadDispute, LeadRefundRequest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeadPurseService } from './purse.service';
import { LeadspaceSettingsService } from './settings.service';

export const DISPUTE_REASONS = ['WRONG_NUMBER', 'DUPLICATE', 'SPAM', 'NOT_REAL', 'OTHER'] as const;

/**
 * Invalid-lead credits. Automatic cases (duplicates, the vendor's own number) never reach here because they are not charged in the first place.
 * A vendor may dispute a delivered lead inside the dispute window with a reason; an admin decides in a queue; a credit is a purse ledger row
 * plus an InvalidLeadCredit record, in one transaction, idempotent on the lead id.
 */
@Injectable()
export class LeadCreditsService {
  constructor(private readonly prisma: PrismaService, private readonly purse: LeadPurseService, private readonly settings: LeadspaceSettingsService) {}

  async dispute(vendorId: string, leadId: string, reason: string, note?: string): Promise<LeadDispute> {
    if (!(DISPUTE_REASONS as readonly string[]).includes(reason)) throw new BadRequestException('Choose why this lead is not valid.');
    const lead = await this.prisma.leadEvent.findFirst({ where: { id: leadId, vendorId } });
    if (!lead) throw new NotFoundException('We could not find that lead.');
    if (lead.priceChargedPaise <= 0 || !lead.deliveredAt) throw new BadRequestException('Only a lead that was charged can be disputed.');
    if (lead.status === 'CREDITED') throw new BadRequestException('This lead has already been credited.');
    const s = await this.settings.get();
    if (Date.now() - lead.deliveredAt.getTime() > s.disputeWindowHours * 3_600_000) throw new BadRequestException(`The ${s.disputeWindowHours}-hour window to dispute this lead has passed. Please write to support if you think this is a mistake.`);
    if (await this.prisma.leadDispute.findFirst({ where: { leadId, status: 'OPEN' } })) throw new BadRequestException('This lead is already being reviewed.');
    return this.prisma.$transaction(async (tx) => {
      await tx.leadEvent.update({ where: { id: leadId }, data: { status: 'DISPUTED' } });
      return tx.leadDispute.create({ data: { leadId, vendorId, reason, note: note ? note.slice(0, 500) : null } });
    });
  }

  queue(status = 'OPEN'): Promise<(LeadDispute & { lead?: unknown })[]> {
    return this.prisma.leadDispute.findMany({ where: { status }, orderBy: { createdAt: 'asc' }, take: 200 });
  }

  async decide(disputeId: string, adminId: string, decision: 'CREDIT' | 'REJECT', note?: string): Promise<LeadDispute> {
    const d = await this.prisma.leadDispute.findUnique({ where: { id: disputeId } });
    if (!d) throw new NotFoundException('We could not find that dispute.');
    if (d.status !== 'OPEN') throw new BadRequestException('This dispute has already been decided.');
    const lead = await this.prisma.leadEvent.findUnique({ where: { id: d.leadId } });
    if (!lead) throw new NotFoundException('The lead for this dispute no longer exists.');
    return this.prisma.$transaction(async (tx) => {
      const flip = await tx.leadDispute.updateMany({ where: { id: disputeId, status: 'OPEN' }, data: { status: decision === 'CREDIT' ? 'CREDITED' : 'REJECTED', decidedBy: adminId, decisionNote: note ? note.slice(0, 500) : null, decidedAt: new Date() } });
      if (flip.count !== 1) throw new BadRequestException('This dispute has already been decided.');
      if (decision === 'CREDIT') {
        if (lead.priceChargedPaise > 0) {
          await this.purse.credit(tx, { vendorId: lead.vendorId, amountPaise: lead.priceChargedPaise, reason: 'CREDIT_INVALID', idempotencyKey: `credit:${lead.id}`, refType: 'LeadEvent', refId: lead.id, note: `Invalid lead: ${d.reason}`, createdBy: adminId });
        }
        await tx.invalidLeadCredit.create({ data: { leadId: lead.id, vendorId: lead.vendorId, reason: d.reason === 'NOT_REAL' ? 'SPAM' : d.reason, decidedBy: 'ADMIN', decidedById: adminId, amountPaise: lead.priceChargedPaise, note: note ?? null } });
        await tx.leadEvent.update({ where: { id: lead.id }, data: { status: 'CREDITED' } });
      } else {
        await tx.leadEvent.update({ where: { id: lead.id }, data: { status: 'DELIVERED' } });
      }
      return tx.leadDispute.findUniqueOrThrow({ where: { id: disputeId } });
    });
  }

  // — refunds. Unused balance can be taken back inside the refund window, less the payment fee; the rules are admin settings. —

  async requestRefund(vendorId: string, note?: string): Promise<LeadRefundRequest> {
    const s = await this.settings.get();
    const balance = await this.purse.balance(vendorId);
    if (balance <= 0) throw new BadRequestException('There is no unused balance to refund.');
    if (await this.prisma.leadRefundRequest.findFirst({ where: { vendorId, status: { in: ['REQUESTED', 'APPROVED'] } } })) throw new BadRequestException('A refund request is already open for your wallet.');
    const since = new Date(); since.setMonth(since.getMonth() - s.refundWindowMonths);
    const refillable = await this.prisma.leadPurseEntry.aggregate({ where: { vendorId, reason: 'REFILL', createdAt: { gte: since } }, _sum: { amountPaise: true } });
    if (!(refillable._sum.amountPaise ?? 0)) throw new BadRequestException(`Refunds are available for refills made in the last ${s.refundWindowMonths} months.`);
    return this.prisma.leadRefundRequest.create({ data: { vendorId, amountPaise: Math.min(balance, refillable._sum.amountPaise ?? 0), note: note ? note.slice(0, 500) : null } });
  }

  refunds(status?: string): Promise<LeadRefundRequest[]> { return this.prisma.leadRefundRequest.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200 }); }

  /** Admin approves: the purse is debited now (so it cannot be spent twice); the payout itself is made in the Razorpay dashboard and marked PAID. */
  async decideRefund(id: string, adminId: string, decision: 'APPROVE' | 'REJECT' | 'PAID', paymentFeePaise = 0): Promise<LeadRefundRequest> {
    const r = await this.prisma.leadRefundRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('We could not find that refund request.');
    if (decision === 'PAID') {
      if (r.status !== 'APPROVED') throw new BadRequestException('Approve the request before marking it paid.');
      return this.prisma.leadRefundRequest.update({ where: { id }, data: { status: 'PAID', decidedBy: adminId, decidedAt: new Date() } });
    }
    if (r.status !== 'REQUESTED') throw new BadRequestException('This request has already been decided.');
    if (decision === 'REJECT') return this.prisma.leadRefundRequest.update({ where: { id }, data: { status: 'REJECTED', decidedBy: adminId, decidedAt: new Date() } });
    if (!Number.isInteger(paymentFeePaise) || paymentFeePaise < 0 || paymentFeePaise >= r.amountPaise) throw new BadRequestException('Enter the payment fee in whole paise, less than the refund.');
    return this.prisma.$transaction(async (tx) => {
      const d = await this.purse.debit(tx, { vendorId: r.vendorId, amountPaise: r.amountPaise, reason: 'REFUND', idempotencyKey: `refund:${r.id}`, refType: 'LeadRefundRequest', refId: r.id, createdBy: adminId, note: `Refund less payment fee ${paymentFeePaise}` });
      if (!d.ok) throw new BadRequestException('The wallet no longer has this much balance. Reject the request or ask the vendor to file a new one.');
      return tx.leadRefundRequest.update({ where: { id }, data: { status: 'APPROVED', paymentFeePaise, decidedBy: adminId, decidedAt: new Date() } });
    });
  }

  /** Admin sweep (also runnable on a schedule): balance older than the expiry window is written off in the ledger. Dry run unless apply is true. */
  async expirySweep(apply: boolean, adminId: string): Promise<{ vendors: number; paise: number; applied: boolean }> {
    const s = await this.settings.get();
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - s.expiryMonths);
    const purses = await this.prisma.leadPurse.findMany({ where: { balancePaise: { gt: 0 } } });
    let vendors = 0; let paise = 0;
    for (const p of purses) {
      const recent = await this.prisma.leadPurseEntry.count({ where: { vendorId: p.vendorId, createdAt: { gte: cutoff }, reason: { in: ['REFILL', 'LEAD_CHARGE'] } } });
      if (recent > 0) continue;
      vendors++; paise += p.balancePaise;
      if (apply) await this.prisma.$transaction(async (tx) => { await this.purse.debit(tx, { vendorId: p.vendorId, amountPaise: p.balancePaise, reason: 'EXPIRY', idempotencyKey: `expiry:${p.vendorId}:${new Date().toISOString().slice(0, 10)}`, createdBy: adminId, note: 'Unused balance expired' }); });
    }
    return { vendors, paise, applied: apply };
  }
}
