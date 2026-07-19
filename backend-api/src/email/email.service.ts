import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { Vendor, Invoice, Subscription, SupportTicket } from '@prisma/client';

const formatDate = (date: Date | null | undefined): string =>
  date ? new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

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
      subject: 'Welcome to Get4Domain - Your Login Credentials',
      html: `
        <p>Dear ${vendor.name},</p>
        <p>Your Get4Domain vendor account has been created.</p>
        <p>
          Login URL: <a href="${this.frontendUrl}/login">${this.frontendUrl}/login</a><br/>
          Email: ${vendor.email}<br/>
          Password: ${plainPassword}
        </p>
        <p>Please change your password after first login.</p>
        <p>Your business dashboard: <a href="${this.frontendUrl}/dashboard">${this.frontendUrl}/dashboard</a></p>
        <p>Team Get4Domain</p>
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

  async sendPaymentConfirmation(vendor: Vendor, invoice: Invoice, subscription?: Subscription | null): Promise<void> {
    const planRow = subscription
      ? `
        <tr><td style="padding:6px 0;color:#64748b;">Plan</td><td style="padding:6px 0;text-align:right;">${subscription.plan} (${subscription.product})</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Subscription Period</td><td style="padding:6px 0;text-align:right;">${formatDate(subscription.startDate)} – ${formatDate(subscription.endDate)}</td></tr>
      `
      : '';

    await this.send({
      to: vendor.email,
      subject: `Invoice ${invoice.invoiceNumber} Payment Confirmed - Get4Domain`,
      html: `
        <p>Hi ${vendor.name},</p>
        <p>We've received your payment for invoice <strong>${invoice.invoiceNumber}</strong>. Here are your GST invoice details:</p>
        <table width="100%" style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 0;color:#64748b;">Description</td><td style="padding:6px 0;text-align:right;">${invoice.description}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Subtotal</td><td style="padding:6px 0;text-align:right;">₹${(invoice.amount / 100).toFixed(2)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">GST (18%)</td><td style="padding:6px 0;text-align:right;">₹${(invoice.gstAmount / 100).toFixed(2)}</td></tr>
          <tr style="font-weight:700;"><td style="padding:6px 0;">Total Paid</td><td style="padding:6px 0;text-align:right;">₹${(invoice.totalAmount / 100).toFixed(2)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Paid On</td><td style="padding:6px 0;text-align:right;">${formatDate(invoice.paidAt)}</td></tr>
          ${planRow}
        </table>
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
