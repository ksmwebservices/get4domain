import { Injectable, NotFoundException } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { renderInvoiceHtml } from './templates/invoice.template';

const GST_RATE = 0.18;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber();
    const gstAmount = Math.round(dto.amount * GST_RATE);
    const totalAmount = dto.amount + gstAmount;

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 7);

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        vendorId: dto.vendorId,
        subscriptionId: dto.subscriptionId,
        description: dto.description,
        amount: dto.amount,
        gstAmount,
        totalAmount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : defaultDueDate,
      },
    });
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: { invoiceNumber: { startsWith: `INV-${year}-` } },
    });
    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${year}-${sequence}`;
  }

  findAll(): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByVendor(vendorId: string): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Invoice & { vendor: { email: string; name: string; businessName: string } }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { vendor: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async generatePDF(id: string): Promise<string> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { vendor: true } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return renderInvoiceHtml(invoice, invoice.vendor);
  }

  async sendInvoiceEmail(id: string): Promise<{ sent: boolean }> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { vendor: true } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const html = renderInvoiceHtml(invoice, invoice.vendor);
    await this.emailService.sendInvoiceEmail(invoice.vendor, invoice, html);
    return { sent: true };
  }

  async sendPaymentLink(id: string): Promise<{ shortUrl: string }> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { vendor: true } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return this.paymentsService.generatePaymentLink(invoice.id, invoice.totalAmount, invoice.vendor.email);
  }

  async markAsPaid(id: string, paymentId: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { vendor: true } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), razorpayPaymentId: paymentId },
      include: { vendor: true, subscription: true },
    });

    await this.emailService.sendPaymentConfirmation(updated.vendor, updated, updated.subscription);
    return updated;
  }
}
