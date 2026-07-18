import { Injectable, NotFoundException } from '@nestjs/common';
import { SupportTicket } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(vendorId: string, dto: CreateTicketDto): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.create({
      data: { vendorId, ...dto },
      include: { vendor: true },
    });

    await this.emailService.sendSupportTicketConfirmation(ticket.vendor, ticket);
    await this.emailService.sendAdminNotification(
      `New support ticket: ${ticket.subject}`,
      `${ticket.vendor.businessName} (${ticket.vendor.email}) opened a ${ticket.category} ticket: ${ticket.message}`,
    );

    return ticket;
  }

  findAll(): Promise<SupportTicket[]> {
    return this.prisma.supportTicket.findMany({
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByVendor(vendorId: string): Promise<SupportTicket[]> {
    return this.prisma.supportTicket.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }
    return ticket;
  }

  async reply(id: string, adminReply: string): Promise<SupportTicket> {
    await this.findOne(id);
    return this.prisma.supportTicket.update({
      where: { id },
      data: { adminReply, status: 'IN_PROGRESS' },
    });
  }

  async resolve(id: string): Promise<SupportTicket> {
    await this.findOne(id);
    return this.prisma.supportTicket.update({ where: { id }, data: { status: 'RESOLVED' } });
  }
}
