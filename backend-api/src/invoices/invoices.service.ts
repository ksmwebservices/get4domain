import { Injectable, NotFoundException } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PaymentsService } from '../payments/payments.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { renderInvoiceHtml, InvoiceCompany } from './templates/invoice.template';

const GST_RATE = 0.18;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly paymentsService: PaymentsService,
    private readonly settings: PlatformSettingsService,
  ) {}

  /** Company invoice details from Admin → Integrations (env fallback in template). */
  async resolveCompany(): Promise<Partial<InvoiceCompany>> {
    const [name, gstin, pan, address, phone, email, logoUrl] = await Promise.all([
      this.settings.getResolvedValue('company', 'name'),
      this.settings.getResolvedValue('company', 'gstin'),
      this.settings.getResolvedValue('company', 'pan'),
      this.settings.getResolvedValue('company', 'address'),
      this.settings.getResolvedValue('company', 'phone'),
      this.settings.getResolvedValue('company', 'email'),
      this.settings.getResolvedValue('company', 'logo_url'),
    ]);
    return {
      name: name ?? undefined, gstin: gstin ?? undefined, pan: pan ?? undefined,
      address: address ?? undefined, phone: phone ?? undefined, email: email ?? undefined,
      logoUrl: logoUrl ?? undefined,
    };
  }

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
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { vendor: true, subscription: true } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return renderInvoiceHtml(invoice, invoice.vendor, {
      company: await this.resolveCompany(),
      nextRenewal: invoice.subscription?.endDate ?? null,
    });
  }

  async sendInvoiceEmail(id: string): Promise<{ sent: boolean }> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { vendor: true, subscription: true } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const html = renderInvoiceHtml(invoice, invoice.vendor, {
      company: await this.resolveCompany(),
      nextRenewal: invoice.subscription?.endDate ?? null,
    });
    await this.emailService.sendInvoiceEmail(invoice.vendor, invoice, html);
    return { sent: true };
  }

  /**
   * Auto-generate a PAID GST invoice for a successful wallet top-up and email it.
   * The top-up amount the vendor paid is GST-INCLUSIVE, so GST is back-calculated
   * (taxable = total / 1.18) — the invoice total always equals the amount charged.
   * Best-effort: never throws (a failure must not undo the wallet credit).
   */
  async createPaidTopupInvoice(
    vendorId: string,
    paidPaise: number,
    credits: number,
    paymentId?: string,
  ): Promise<Invoice | null> {
    try {
      const taxable = Math.round(paidPaise / (1 + GST_RATE));
      const gstAmount = paidPaise - taxable;
      const invoiceNumber = await this.generateInvoiceNumber();
      const description = `Wallet top-up — ₹${(paidPaise / 100).toFixed(2)} paid, ${(credits / 100).toFixed(2)} credits added`;

      const invoice = await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          vendorId,
          description,
          amount: taxable,
          gstAmount,
          totalAmount: paidPaise,
          status: 'PAID',
          paidAt: new Date(),
          razorpayPaymentId: paymentId,
        },
        include: { vendor: true },
      });

      await this.prisma.platformIncome.create({
        data: { vendorId, invoiceId: invoice.id, amount: paidPaise, source: 'wallet_topup', description },
      });

      const html = renderInvoiceHtml(invoice, invoice.vendor, {
        company: await this.resolveCompany(),
        paymentMode: 'Wallet Top-up (Razorpay)',
        lineItems: [{ description, price: taxable, discount: 0 }],
      });
      await this.emailService.sendInvoiceEmail(invoice.vendor, invoice, html);
      return invoice;
    } catch {
      return null;
    }
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
