import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { Vendor, Invoice, SupportTicket } from '@prisma/client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;
  private readonly frontendUrl: string;
  private readonly adminEmail: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromAddress = process.env.COMPANY_EMAIL ? `Get4Domain <${process.env.COMPANY_EMAIL}>` : 'Get4Domain <onboarding@get4domain.com>';
    this.frontendUrl = process.env.FRONTEND_URL ?? 'https://get4domain.com';
    this.adminEmail = process.env.ADMIN_EMAIL ?? 'admin@get4domain.com';
  }

  async sendWelcomeEmail(vendor: Vendor, plainPassword: string): Promise<void> {
    await this.send({
      to: vendor.email,
      subject: `Welcome to Get4Domain, ${vendor.businessName}`,
      html: `
        <h2>Welcome to Get4Domain, ${vendor.name}!</h2>
        <p>Your vendor account for <strong>${vendor.businessName}</strong> has been created.</p>
        <p><strong>Login email:</strong> ${vendor.email}<br/>
        <strong>Temporary password:</strong> ${plainPassword}</p>
        <p><a href="${this.frontendUrl}/login">Log in to your dashboard</a></p>
        <p>Please change your password after your first login.</p>
      `,
    });
  }

  async sendInvoiceEmail(vendor: Vendor, invoice: Invoice, pdfHtml: string): Promise<void> {
    await this.send({
      to: vendor.email,
      subject: `Invoice ${invoice.invoiceNumber} from Get4Domain`,
      html: `
        <p>Hi ${vendor.name},</p>
        <p>Your invoice <strong>${invoice.invoiceNumber}</strong> for ₹${(invoice.totalAmount / 100).toFixed(2)} is ready.</p>
        <p>${invoice.description}</p>
        <hr/>
        ${pdfHtml}
      `,
    });
  }

  async sendPaymentConfirmation(vendor: Vendor, invoice: Invoice): Promise<void> {
    await this.send({
      to: vendor.email,
      subject: `Payment received — Invoice ${invoice.invoiceNumber}`,
      html: `
        <p>Hi ${vendor.name},</p>
        <p>We've received your payment of ₹${(invoice.totalAmount / 100).toFixed(2)} for invoice <strong>${invoice.invoiceNumber}</strong>.</p>
        <p>Thank you for being a Get4Domain vendor.</p>
      `,
    });
  }

  async sendSupportTicketConfirmation(vendor: Vendor, ticket: SupportTicket): Promise<void> {
    await this.send({
      to: vendor.email,
      subject: `Support ticket received: ${ticket.subject}`,
      html: `
        <p>Hi ${vendor.name},</p>
        <p>We've received your support ticket regarding <strong>${ticket.subject}</strong> (category: ${ticket.category}).</p>
        <p>Our team will respond as soon as possible.</p>
      `,
    });
  }

  async sendAdminNotification(subject: string, body: string): Promise<void> {
    await this.send({
      to: this.adminEmail,
      subject,
      html: `<p>${body}</p>`,
    });
  }

  private async send(params: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${params.to}: ${params.subject}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}
