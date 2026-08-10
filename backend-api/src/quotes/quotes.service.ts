import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Quote } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationService, Channel } from '../communication/communication.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communication: CommunicationService,
  ) {}

  async create(sentBy: string, dto: CreateQuoteDto): Promise<Quote> {
    // Resolve recipient — from the prospect fields, falling back to the vendor.
    let email = dto.prospectEmail;
    let phone = dto.prospectPhone;
    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
      if (!vendor) throw new BadRequestException('Vendor not found');
      email = email ?? vendor.email;
      phone = phone ?? vendor.phone ?? undefined;
    }

    const channel = dto.channel as Channel;
    const to = channel === 'email' ? email : phone;
    if (!to) {
      throw new BadRequestException(
        channel === 'email' ? 'An email address is required for the email channel' : 'A phone number is required for this channel',
      );
    }

    const quote = await this.prisma.quote.create({
      data: {
        vendorId: dto.vendorId,
        prospectName: dto.prospectName,
        prospectPhone: dto.prospectPhone,
        prospectEmail: dto.prospectEmail,
        quoteType: dto.quoteType,
        itemLabel: dto.itemLabel,
        amount: dto.amount,
        notes: dto.notes,
        channel: dto.channel,
        status: 'sent',
        sentBy,
      },
    });

    // Deliver via the shared Communication Hub infrastructure.
    await this.communication.send(sentBy, channel, to, dto.message, dto.subject ?? `Quote from Get4Domain — ${dto.itemLabel}`);

    return quote;
  }

  findAll(): Promise<Quote[]> {
    return this.prisma.quote.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updateStatus(id: string, status: string): Promise<Quote> {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    return this.prisma.quote.update({ where: { id }, data: { status } });
  }
}
