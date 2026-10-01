import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma, Quote } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationService, Channel } from '../communication/communication.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { CreateProposalDto, ProposalLineItemDto } from './dto/create-proposal.dto';
import { renderProposalHtml } from './templates/proposal.template';

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

  async findOne(id: string): Promise<Quote> {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  /**
   * Save a multi-line Managed Services proposal as a draft against a lead.
   * Unlike create() (single-item quote, sent immediately via Communication Hub),
   * nothing is dispatched here — the admin reviews/shares it separately.
   */
  async createProposal(sentBy: string, dto: CreateProposalDto): Promise<Quote> {
    const amount = dto.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
    const itemLabel = dto.items.length === 1 ? dto.items[0].label : `${dto.items[0].label} + ${dto.items.length - 1} more`;
    return this.prisma.quote.create({
      data: {
        leadId: dto.leadId,
        prospectName: dto.prospectName,
        prospectPhone: dto.prospectPhone,
        prospectEmail: dto.prospectEmail,
        quoteType: 'custom',
        itemLabel,
        amount,
        notes: dto.notes,
        channel: 'email',
        status: 'draft',
        sentBy,
        items: dto.items as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /** Renders the proposal as printable HTML (browser print-to-PDF, same
   *  convention as invoices/business documents — no server-side PDF dependency). */
  async generatePdfHtml(id: string): Promise<string> {
    const quote = await this.findOne(id);
    const items = (quote.items as unknown as ProposalLineItemDto[] | null) ?? [
      { label: quote.itemLabel, qty: 1, rate: quote.amount },
    ];
    return renderProposalHtml(quote, items);
  }

  async createShareLink(id: string): Promise<{ shareToken: string }> {
    const quote = await this.findOne(id);
    const shareToken = quote.shareToken ?? randomBytes(16).toString('hex');
    if (!quote.shareToken) {
      await this.prisma.quote.update({ where: { id }, data: { shareToken } });
    }
    return { shareToken };
  }

  async findByShareToken(token: string): Promise<Quote> {
    const quote = await this.prisma.quote.findUnique({ where: { shareToken: token } });
    if (!quote) throw new NotFoundException('Proposal not found');
    return quote;
  }

  async respondByShareToken(token: string, status: 'accepted' | 'declined'): Promise<Quote> {
    const quote = await this.findByShareToken(token);
    return this.prisma.quote.update({ where: { id: quote.id }, data: { status } });
  }
}
