import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join, normalize, sep } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, CommercialAuditService, CommercialMessenger } from './foundation.services';
import { SettlementService } from './settlement.service';
import { PRIVATE_PROOF_DIR } from './pay.service';
import { balanceDue } from './invoice-builder.service';
import { rupees } from './pricing-math';

/** Admin side of UPI/bank-transfer payments: the "Payments to confirm" queue. */
@Injectable()
export class ManualPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: SettlementService,
    private readonly audit: CommercialAuditService,
    private readonly messenger: CommercialMessenger,
  ) {}

  pendingCount(): Promise<number> {
    return this.prisma.manualPaymentSubmission.count({ where: { status: 'SUBMITTED' } });
  }

  /** The review queue. Screenshots are never linked here — only `hasScreenshot`; the file is fetched via an admin-only endpoint. */
  async list(status: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'ALL' = 'SUBMITTED') {
    const rows = await this.prisma.manualPaymentSubmission.findMany({
      where: status === 'ALL' ? {} : { status }, orderBy: { createdAt: status === 'SUBMITTED' ? 'asc' : 'desc' }, take: 200,
    });
    const out = [];
    for (const s of rows) {
      const inv = await this.prisma.invoice.findUnique({ where: { id: s.invoiceId } });
      const vendor = inv ? await this.prisma.vendor.findUnique({ where: { id: inv.vendorId }, select: { id: true, businessName: true, name: true, email: true, phone: true } }) : null;
      const dupAttempts = await this.prisma.commercialAuditLog.count({ where: { entityType: 'ManualPaymentSubmission', entityId: s.id, action: 'payment.duplicate_utr' } });
      out.push({
        id: s.id, status: s.status, utr: s.utr, claimedAmountPaise: s.claimedAmountPaise, confirmedAmountPaise: s.confirmedAmountPaise,
        paidAt: s.paidAt, payerNote: s.payerNote, hasScreenshot: Boolean(s.screenshotUrl), submittedAt: s.createdAt,
        reviewedBy: s.reviewedBy, reviewedAt: s.reviewedAt, reason: s.reason,
        duplicateUtrAttempts: dupAttempts, // a payer tried to reuse this UTR on another/same invoice — flagged for review
        invoice: inv ? { id: inv.id, number: inv.invoiceNumber, totalPaise: inv.totalAmount, paidPaise: inv.paidPaise, balanceDuePaise: balanceDue(inv), status: inv.status, description: inv.description } : null,
        amountMismatch: inv ? s.claimedAmountPaise !== balanceDue(inv) : false,
        vendor,
      });
    }
    return out;
  }

  /** Confirm with the amount ACTUALLY received (from the bank), not the amount the payer claimed. */
  async confirm(id: string, receivedAmountPaise: number, actor: Actor, note?: string) {
    if (!Number.isInteger(receivedAmountPaise) || receivedAmountPaise <= 0 || receivedAmountPaise > 100_00_00_000) throw new BadRequestException('Enter the amount actually received, in whole paise (> 0)');
    const sub = await this.prisma.manualPaymentSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Submission not found');
    if (sub.status === 'CONFIRMED') {
      // Idempotent: confirming twice never applies the money twice.
      const inv = await this.prisma.invoice.findUnique({ where: { id: sub.invoiceId } });
      return { alreadyConfirmed: true, invoiceStatus: inv?.status };
    }
    if (sub.status !== 'SUBMITTED') throw new ConflictException('This submission was already reviewed');

    const claim = await this.prisma.manualPaymentSubmission.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: { status: 'CONFIRMED', confirmedAmountPaise: receivedAmountPaise, reviewedBy: actor.email, reviewedAt: new Date(), reason: note?.slice(0, 300) ?? null },
    });
    if (claim.count === 0) throw new ConflictException('This submission was just reviewed by someone else');

    try {
      const r = await this.settlement.applyPayment(sub.invoiceId, { amountPaise: receivedAmountPaise, via: 'UPI_QR', reference: sub.utr, actor });
      await this.audit.log(actor, 'payment.confirm', 'ManualPaymentSubmission', id, { receivedAmountPaise, claimedAmountPaise: sub.claimedAmountPaise, invoiceStatus: r.invoice.status, overpaymentPaise: r.invoice.overpaymentPaise });
      return { confirmed: true, invoiceStatus: r.invoice.status, balanceDuePaise: balanceDue(r.invoice), overpaymentPaise: r.invoice.overpaymentPaise };
    } catch (e) {
      // The money could not be applied (e.g. the invoice was paid another way meanwhile) — put it back in the queue.
      await this.prisma.manualPaymentSubmission.updateMany({ where: { id, status: 'CONFIRMED' }, data: { status: 'SUBMITTED', confirmedAmountPaise: null, reviewedBy: null, reviewedAt: null, reason: null } });
      throw e;
    }
  }

  async reject(id: string, reason: string, actor: Actor) {
    const why = (reason ?? '').trim();
    if (why.length < 3) throw new BadRequestException('Give the payer a reason for the rejection');
    const sub = await this.prisma.manualPaymentSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Submission not found');
    if (sub.status !== 'SUBMITTED') throw new ConflictException('This submission was already reviewed');
    const claim = await this.prisma.manualPaymentSubmission.updateMany({ where: { id, status: 'SUBMITTED' }, data: { status: 'REJECTED', reason: why.slice(0, 300), reviewedBy: actor.email, reviewedAt: new Date() } });
    if (claim.count === 0) throw new ConflictException('This submission was just reviewed by someone else');

    const inv = await this.prisma.invoice.findUnique({ where: { id: sub.invoiceId } });
    if (inv) {
      const stillPending = await this.prisma.manualPaymentSubmission.count({ where: { invoiceId: inv.id, status: 'SUBMITTED' } });
      if (inv.status === 'PAYMENT_SUBMITTED' && stillPending === 0) {
        await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: inv.paidPaise > 0 ? 'PARTIALLY_PAID' : 'SENT' } });
      }
      const vendor = await this.prisma.vendor.findUnique({ where: { id: inv.vendorId } });
      if (vendor) {
        await this.messenger.send(
          { vendorId: vendor.id, name: vendor.name, email: vendor.email, phone: vendor.phone },
          `We could not confirm your payment for ${inv.invoiceNumber}`,
          `We could not match the payment you submitted (UTR …${sub.utr.slice(-4)}, ${rupees(sub.claimedAmountPaise)}). Reason: ${why}. If you have already paid, please submit the correct UTR from your payment app, or contact us.`,
        );
      }
    }
    await this.audit.log(actor, 'payment.reject', 'ManualPaymentSubmission', id, { reason: why });
    return { rejected: true };
  }

  /** Reads a private proof file. Path-traversal safe; only the exact `private:<invoiceId>/<file>` reference is honoured. */
  async proof(id: string): Promise<{ buffer: Buffer; mime: string }> {
    const sub = await this.prisma.manualPaymentSubmission.findUnique({ where: { id } });
    if (!sub?.screenshotUrl || !sub.screenshotUrl.startsWith('private:')) throw new NotFoundException('No screenshot on this submission');
    const rel = sub.screenshotUrl.slice('private:'.length);
    const root = PRIVATE_PROOF_DIR();
    const full = normalize(join(root, rel));
    if (!full.startsWith(root + sep)) throw new NotFoundException('No screenshot on this submission');
    if (!existsSync(full)) throw new NotFoundException('Screenshot file is missing');
    return { buffer: readFileSync(full), mime: sub.screenshotMime ?? 'application/octet-stream' };
  }
}
