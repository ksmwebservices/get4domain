import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, GenericInvoice } from '@prisma/client';
import Razorpay from 'razorpay';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGenericInvoiceDto, InvoiceLineItemDto } from './dto/invoice.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { Paginated } from './contacts.service';
import { renderGenericInvoiceHtml } from './templates/generic-invoice.template';

@Injectable()
export class DomainAppInvoicesService {
  private readonly logger = new Logger(DomainAppInvoicesService.name);
  private readonly razorpay: Razorpay | null;

  constructor(private readonly prisma: PrismaService) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
  }

  private computeTotals(items: InvoiceLineItemDto[], gstRate: number) {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const gstAmount = Math.round(((subtotal * gstRate) / 100) * 100) / 100;
    const total = Math.round((subtotal + gstAmount) * 100) / 100;
    return { subtotal, gstAmount, total };
  }

  private async nextInvoiceNumber(vendorId: string): Promise<string> {
    const count = await this.prisma.genericInvoice.count({ where: { vendorId } });
    const seq = String(count + 1).padStart(5, '0');
    return `INV-${vendorId.slice(0, 6).toUpperCase()}-${seq}`;
  }

  async create(vendorId: string, dto: CreateGenericInvoiceDto): Promise<GenericInvoice> {
    const contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, vendorId } });
    if (!contact) {
      throw new BadRequestException('contactId does not belong to this vendor');
    }
    if (dto.recordId) {
      const record = await this.prisma.record.findFirst({ where: { id: dto.recordId, vendorId } });
      if (!record) {
        throw new BadRequestException('recordId does not belong to this vendor');
      }
    }

    const gstRate = dto.gstRate ?? 0;
    const { subtotal, gstAmount, total } = this.computeTotals(dto.items, gstRate);
    const invoiceNumber = await this.nextInvoiceNumber(vendorId);

    return this.prisma.genericInvoice.create({
      data: {
        vendorId,
        contactId: dto.contactId,
        recordId: dto.recordId,
        invoiceNumber,
        items: dto.items as unknown as Prisma.InputJsonValue,
        subtotal,
        gstRate,
        gstAmount,
        total,
        status: 'PENDING',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async findAll(vendorId: string, query: ListQueryDto): Promise<Paginated<GenericInvoice>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.GenericInvoiceWhereInput = { vendorId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { contact: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.genericInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { contact: true },
      }),
      this.prisma.genericInvoice.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(vendorId: string, id: string): Promise<GenericInvoice> {
    const invoice = await this.prisma.genericInvoice.findFirst({
      where: { id, vendorId },
      include: { contact: true, record: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async renderPdfHtml(vendorId: string, id: string): Promise<string> {
    const invoice = await this.prisma.genericInvoice.findFirst({
      where: { id, vendorId },
      include: { contact: true, vendor: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return renderGenericInvoiceHtml(invoice, invoice.vendor, invoice.contact);
  }

  async sendLink(vendorId: string, id: string): Promise<{ paymentLink: string; razorpayLinkId: string }> {
    const invoice = await this.findOne(vendorId, id);
    if (!this.razorpay) {
      throw new BadRequestException('Razorpay is not configured on this environment');
    }
    const contact = await this.prisma.contact.findUnique({ where: { id: invoice.contactId } });

    const link = await this.razorpay.paymentLink.create({
      amount: Math.round(invoice.total * 100),
      currency: 'INR',
      description: `Invoice ${invoice.invoiceNumber}`,
      customer: {
        name: contact?.name ?? 'Customer',
        contact: contact?.phone,
        email: contact?.email ?? undefined,
      },
      notify: { sms: Boolean(contact?.phone), email: Boolean(contact?.email) },
      notes: { vendorId, invoiceId: invoice.id },
    });

    await this.prisma.genericInvoice.update({
      where: { id },
      data: { razorpayLinkId: link.id },
    });

    this.logger.log(`Payment link created for invoice ${invoice.invoiceNumber}`);
    return { paymentLink: String(link.short_url), razorpayLinkId: String(link.id) };
  }

  async markPaid(vendorId: string, id: string): Promise<GenericInvoice> {
    await this.findOne(vendorId, id);
    return this.prisma.genericInvoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }
}
