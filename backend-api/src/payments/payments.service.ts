import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    });
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
      include: { vendor: true },
    });

    await this.emailService.sendPaymentConfirmation(invoice.vendor, invoice);

    return { verified: true };
  }

  async generatePaymentLink(invoiceId: string, amount: number, vendorEmail: string): Promise<{ shortUrl: string }> {
    const paymentLink = await this.razorpay.paymentLink.create({
      amount,
      currency: 'INR',
      customer: { email: vendorEmail },
      notify: { email: true, sms: false },
      reference_id: invoiceId,
      callback_url: `${process.env.FRONTEND_URL ?? 'https://get4domain.com'}/dashboard/billing`,
      callback_method: 'get',
    });

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { razorpayOrderId: paymentLink.id },
    });

    return { shortUrl: paymentLink.short_url };
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
          include: { vendor: true },
        });
        await this.emailService.sendPaymentConfirmation(updated.vendor, updated);
      }
    }
  }
}
