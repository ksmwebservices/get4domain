import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { Invoice, Subscription, Vendor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { renderInvoiceHtml, InvoiceCompany } from '../invoices/templates/invoice.template';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

type PaidInvoice = Invoice & { vendor: Vendor; subscription: Subscription | null };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly whatsappService: WhatsAppService,
    private readonly settings: PlatformSettingsService,
  ) {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    });
  }

  /** Company invoice details from Admin → Integrations (env fallback in template). */
  private async resolveCompany(): Promise<Partial<InvoiceCompany>> {
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

  async createOrder(dto: CreateOrderDto) {
    return this.razorpay.orders.create({
      amount: dto.amount,
      currency: dto.currency ?? 'INR',
      receipt: dto.receipt,
    });
  }

  async verifyPayment(dto: VerifyPaymentDto): Promise<{ verified: boolean }> {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== dto.razorpaySignature) {
      throw new BadRequestException('Payment signature verification failed');
    }

    const invoice = await this.prisma.invoice.update({
      where: { id: dto.invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        razorpayOrderId: dto.razorpayOrderId,
        razorpayPaymentId: dto.razorpayPaymentId,
      },
      include: { vendor: true, subscription: true },
    });

    await this.finalizePayment(invoice);

    return { verified: true };
  }

  async generatePaymentLink(invoiceId: string, amount: number, vendorEmail: string): Promise<{ shortUrl: string }> {
    this.assertRazorpayConfigured();

    let paymentLink: { id: string; short_url: string };
    try {
      paymentLink = await this.razorpay.paymentLink.create({
        amount,
        currency: 'INR',
        customer: { email: vendorEmail },
        notify: { email: true, sms: false },
        // reference_id must be unique per payment link on the Razorpay account.
        // Reusing the bare invoice id makes every re-send fail with
        // "Payment link with reference id already exists"; suffix keeps it unique.
        reference_id: `${invoiceId}-${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL ?? 'https://get4domain.com'}/dashboard/billing`,
        callback_method: 'get',
      });
    } catch (err) {
      throw this.toPaymentGatewayError(err, 'create payment link');
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { razorpayOrderId: paymentLink.id },
    });

    return { shortUrl: paymentLink.short_url };
  }

  /** Fail fast with a clear message when Razorpay credentials are missing or still placeholders. */
  private assertRazorpayConfigured(): void {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const unconfigured =
      !keyId || !keySecret || keyId.startsWith('placeholder') || keySecret.startsWith('placeholder');
    if (unconfigured) {
      this.logger.error('Razorpay is not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing or placeholder)');
      throw new ServiceUnavailableException(
        'Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
  }

  /**
   * Convert a failed Razorpay call into a proper HttpException. The SDK rejects
   * with a plain object `{ statusCode, error: { description, code } }` rather than
   * an Error, which is why raw failures previously surfaced as an opaque 500 with
   * no message or stack in the logs.
   */
  private toPaymentGatewayError(err: unknown, action: string): HttpException {
    if (err instanceof HttpException) {
      return err;
    }
    const rzp = err as { statusCode?: number; error?: { description?: string; code?: string } };
    const code = rzp?.error?.code ?? 'UNKNOWN';
    const description =
      rzp?.error?.description ?? (err instanceof Error ? err.message : 'Unknown payment gateway error');
    this.logger.error(`Razorpay failed to ${action}: [${code}] ${description} (status ${rzp?.statusCode ?? 'n/a'})`);
    return new BadGatewayException(`Payment gateway error: ${description}`);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? process.env.RAZORPAY_KEY_SECRET;
    if (!webhookSecret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook');
      return false;
    }

    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    return expectedSignature === signature;
  }

  async handleWebhookEvent(event: {
    event: string;
    payload: {
      payment_link?: { entity: { id: string; reference_id?: string } };
      payment?: { entity: { id: string; order_id?: string } };
    };
  }): Promise<void> {
    if (event.event === 'payment_link.paid' && event.payload.payment_link) {
      const linkId = event.payload.payment_link.entity.id;
      const invoice = await this.prisma.invoice.findFirst({
        where: { razorpayOrderId: linkId },
        include: { vendor: true },
      });

      if (invoice && invoice.status !== 'PAID') {
        const updated = await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            razorpayPaymentId: event.payload.payment?.entity.id,
          },
          include: { vendor: true, subscription: true },
        });
        await this.finalizePayment(updated);
      }
    }
  }

  private async finalizePayment(invoice: PaidInvoice): Promise<void> {
    if (invoice.subscriptionId) {
      await this.prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: 'ACTIVE', startDate: invoice.subscription?.startDate ?? new Date() },
      });
    }

    await this.prisma.platformIncome.create({
      data: {
        vendorId: invoice.vendorId,
        invoiceId: invoice.id,
        amount: invoice.totalAmount,
        source: invoice.subscriptionId ? 'subscription' : 'invoice',
        description: invoice.description,
      },
    });

    const pdfHtml = renderInvoiceHtml(invoice, invoice.vendor, {
      company: await this.resolveCompany(),
      nextRenewal: invoice.subscription?.endDate ?? null,
    });
    await this.emailService.sendInvoiceEmail(invoice.vendor, invoice, pdfHtml);
    await this.emailService.sendPaymentConfirmation(invoice.vendor, invoice, invoice.subscription);

    await this.notificationsService.notifyAdmin(
      'payment_received',
      'Payment received',
      `₹${(invoice.totalAmount / 100).toFixed(2)} received from ${invoice.vendor.businessName}`,
      { priority: 'INFO', actionType: 'view_invoice', actionData: { invoiceId: invoice.id } },
    );

    const adminWhatsApp = process.env.ADMIN_WHATSAPP_NUMBER ?? process.env.COMPANY_PHONE;
    if (adminWhatsApp) {
      await this.whatsappService.sendTemplate(adminWhatsApp, 'payment_received', [
        invoice.vendor.businessName,
        `₹${(invoice.totalAmount / 100).toFixed(2)}`,
      ]);
    }
  }
}
