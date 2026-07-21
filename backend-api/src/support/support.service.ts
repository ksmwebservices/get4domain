import { Injectable, NotFoundException } from '@nestjs/common';
import { SupportTicket } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly whatsappService: WhatsAppService,
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

    await this.notificationsService.notifyAdmin(
      'new_support_ticket',
      'New Support Ticket',
      `${ticket.vendor.businessName}: ${ticket.subject}`,
      { priority: 'HIGH', actionRequired: true, actionType: 'view_ticket', actionData: { ticketId: ticket.id } },
    );

    const adminWhatsApp = process.env.ADMIN_WHATSAPP_NUMBER ?? process.env.COMPANY_PHONE;
    if (adminWhatsApp) {
      await this.whatsappService.sendTemplate(adminWhatsApp, 'new_support_ticket', [ticket.vendor.businessName, ticket.subject]);
    }

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
    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: { adminReply, status: 'IN_PROGRESS' },
      include: { vendor: true },
    });

    await this.emailService.sendSupportReplyEmail(ticket.vendor, ticket);
    await this.notificationsService.notifyVendor(
      ticket.vendorId,
      'support_reply',
      'Support ticket reply',
      `We replied to your ticket "${ticket.subject}"`,
      { actionType: 'view_ticket', actionData: { ticketId: ticket.id } },
    );

    if (ticket.vendor.phone) {
      await this.whatsappService.sendTemplate(ticket.vendor.phone, 'support_reply', [ticket.vendor.name, ticket.subject]);
    }

    return ticket;
  }

  async resolve(id: string): Promise<SupportTicket> {
    await this.findOne(id);
    return this.prisma.supportTicket.update({ where: { id }, data: { status: 'RESOLVED' } });
  }
}
