import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PayStatus } from './core/pay-core';
import { NewPayRequest, PayCodeTaken, PayRequestRow, PaymentRow, PaymentsStore } from './payments.store';

const toRow = (r: Prisma.V3PaymentRequestGetPayload<object>): PayRequestRow => ({ ...r, status: r.status as PayStatus });
const toPayment = (p: Prisma.V3PaymentGetPayload<object>): PaymentRow => ({ id: p.id, paymentRequestId: p.paymentRequestId, vendorId: p.vendorId, amountPaise: p.amountPaise, level: p.level, provider: p.provider, providerPaymentId: p.providerPaymentId, utr: p.utr, confirmedBy: p.confirmedBy as 'VENDOR' | 'GATEWAY', confirmedAt: p.confirmedAt, idempotencyKey: p.idempotencyKey });

@Injectable()
export class PrismaPaymentsStore extends PaymentsStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async create(d: NewPayRequest): Promise<PayRequestRow> {
    try { return toRow(await this.prisma.v3PaymentRequest.create({ data: { ...d } })); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new PayCodeTaken(); throw e; }
  }
  async byCode(code: string): Promise<PayRequestRow | null> { const r = await this.prisma.v3PaymentRequest.findUnique({ where: { code } }); return r ? toRow(r) : null; }
  async byId(id: string, vendorId: string): Promise<PayRequestRow | null> { const r = await this.prisma.v3PaymentRequest.findFirst({ where: { id, vendorId } }); return r ? toRow(r) : null; }
  async list(vendorId: string, f: { status?: PayStatus; orderId?: string; skip: number; take: number }): Promise<{ items: PayRequestRow[]; total: number }> {
    const where: Prisma.V3PaymentRequestWhereInput = { vendorId, ...(f.status ? { status: f.status } : {}), ...(f.orderId ? { orderId: f.orderId } : {}) };
    const [items, total] = await this.prisma.$transaction([this.prisma.v3PaymentRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: f.skip, take: f.take }), this.prisma.v3PaymentRequest.count({ where })]);
    return { items: items.map(toRow), total };
  }
  async customerTaps(id: string, utr: string | null, now: Date): Promise<PayRequestRow | null> {
    const res = await this.prisma.v3PaymentRequest.updateMany({ where: { id, status: 'AWAITING' }, data: { status: 'CUSTOMER_SAYS_PAID', customerSaidAt: now, customerUtr: utr } });
    return res.count === 1 ? toRow(await this.prisma.v3PaymentRequest.findUniqueOrThrow({ where: { id } })) : null;
  }
  async cancel(id: string, vendorId: string): Promise<PayRequestRow | null> {
    const res = await this.prisma.v3PaymentRequest.updateMany({ where: { id, vendorId, status: { in: ['AWAITING', 'CUSTOMER_SAYS_PAID'] } }, data: { status: 'CANCELLED' } });
    return res.count === 1 ? toRow(await this.prisma.v3PaymentRequest.findUniqueOrThrow({ where: { id } })) : null;
  }
  async expire(id: string, now: Date): Promise<boolean> { return (await this.prisma.v3PaymentRequest.updateMany({ where: { id, status: 'AWAITING', expiresAt: { lte: now } }, data: { status: 'EXPIRED' } })).count === 1; }
  async expirable(now: Date, limit: number): Promise<PayRequestRow[]> { return (await this.prisma.v3PaymentRequest.findMany({ where: { status: 'AWAITING', expiresAt: { lte: now } }, orderBy: { expiresAt: 'asc' }, take: limit })).map(toRow); }
  async confirmPaid(id: string, vendorId: string, p: { utr: string | null; idempotencyKey: string | null; now: Date }): Promise<{ request: PayRequestRow; payment: PaymentRow; alreadyPaid: boolean } | null> {
    return this.prisma.$transaction(async (tx) => {
      const cur = await tx.v3PaymentRequest.findFirst({ where: { id, vendorId } });
      if (!cur || cur.status === 'CANCELLED') return null;
      const res = await tx.v3PaymentRequest.updateMany({ where: { id, vendorId, status: { in: ['AWAITING', 'CUSTOMER_SAYS_PAID', 'EXPIRED'] } }, data: { status: 'PAID' } });
      if (res.count !== 1) {
        const existing = await tx.v3Payment.findUnique({ where: { paymentRequestId: id } });
        return existing ? { request: toRow(cur), payment: toPayment(existing), alreadyPaid: true } : null;
      }
      const payment = await tx.v3Payment.create({ data: { paymentRequestId: id, vendorId, amountPaise: cur.amountPaise, level: 1, provider: 'UPI_MANUAL', providerPaymentId: id, utr: p.utr ?? cur.customerUtr, confirmedBy: 'VENDOR', confirmedAt: p.now, idempotencyKey: p.idempotencyKey } });
      return { request: toRow(await tx.v3PaymentRequest.findUniqueOrThrow({ where: { id } })), payment: toPayment(payment), alreadyPaid: false };
    });
  }
  async paymentOf(requestId: string, vendorId: string): Promise<PaymentRow | null> { const p = await this.prisma.v3Payment.findFirst({ where: { paymentRequestId: requestId, vendorId } }); return p ? toPayment(p) : null; }
  async requestOfPayment(paymentId: string, vendorId: string): Promise<PayRequestRow | null> { const p = await this.prisma.v3Payment.findFirst({ where: { id: paymentId, vendorId }, include: { request: true } }); return p ? toRow(p.request) : null; }
}
